// Transactional equipment commands: every state change updates the materialized row and
// appends its event in one SQL statement (CTE), guarded by an optimistic version check.
// Retries with the same idempotency key never create duplicate events.
// True no-ops (requested value equals current value) return early: no event, no version bump.
import { buildHaPlacementPlanForEquipment, buildHaPlacementPlanForMove, type HaPlacementPlan } from './haPlacementPlan'
import {
  actorName,
  ConflictError,
  isUniqueViolation,
  jsonValue,
  occurredAtOrNow,
  optionalString,
  optionalUuid,
  requireIdempotencyKey,
  requireString,
  requireUuid,
  ValidationError,
} from './shared'

type Command =
  | 'move'            // canonical placement-change command (location and/or bin)
  | 'location_change' // deprecated alias of move
  | 'bin_change'      // deprecated alias of move
  | 'metadata_update' // one canonical command for editable detail fields
  | 'battery_change'
  | 'lifecycle_change'
  | 'rename'
  | 'correction'
  | 'archive'
  | 'unarchive'
  | 'note'
  | 'create_followup_task'
  | 'complete_followup_task'
  | 'temporary_remove'
  | 'permanent_remove'
  | 'put_back'
  | 'move_to_testing_bin'
  | 'installation_check'
  | 'review_update'
  | 'install'
  | 'uninstall'
  | 'pair'
  | 'record_maintenance'

type Params = {
  equipmentId: string
  command: Command
  expectedVersion?: number
  newLocationId?: string
  newBinId?: string
  newStageId?: string
  newDisplayName?: string
  newPhysicalId?: string
  notes?: string
  occurredAt?: string
  detail?: Record<string, unknown>
  // metadata_update fields: only keys that are present participate; empty string clears the value.
  displayName?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  purchaseSource?: string
  purchaseOrderId?: string
  purchasedAt?: string
  ipAddress?: string
  macAddress?: string
  fccId?: string
  feedUrl?: string
  stepKey?: string
  stepStatus?: string
  idMarkingStatus?: string
  conditionStatus?: string
  reviewFlag?: boolean
  reviewReason?: string
  proposedCleanupNote?: string
  intendedLocationId?: string
  testBinId?: string
  reason?: string
  taskType?: string
  taskId?: string
  dueAt?: string
  completionNote?: string
  resolveRelatedTasks?: boolean
  custodyLocationId?: string
  custodyBinId?: string
  custodyUnknown?: boolean
  removalId?: string
  followupTaskTypes?: string[]
  idempotencyKey: string
}

const EVENT_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'battery_change', 'note', 'install', 'uninstall', 'pair', 'record_maintenance',
])

const EVENT_TYPE_BY_COMMAND: Record<Command, string> = {
  move: 'PLACEMENT_CHANGE',
  location_change: 'PLACEMENT_CHANGE',
  bin_change: 'PLACEMENT_CHANGE',
  metadata_update: 'METADATA_UPDATE',
  battery_change: 'BATTERY_CHANGE',
  lifecycle_change: 'LIFECYCLE_CHANGE',
  rename: 'RENAME',
  correction: 'CORRECTION',
  archive: 'ARCHIVE',
  unarchive: 'UNARCHIVE',
  note: 'NOTE',
  create_followup_task: 'FOLLOWUP_TASK_CREATE',
  complete_followup_task: 'FOLLOWUP_TASK_COMPLETE',
  temporary_remove: 'TEMPORARY_REMOVE',
  permanent_remove: 'PERMANENT_REMOVE',
  put_back: 'PUT_BACK',
  move_to_testing_bin: 'MOVE_TO_TESTING_BIN',
  installation_check: 'INSTALLATION_CHECK',
  review_update: 'REVIEW_UPDATE',
  install: 'INSTALL',
  uninstall: 'UNINSTALL',
  pair: 'PAIR',
  record_maintenance: 'MAINTENANCE',
}

/** Metadata columns editable through metadata_update: param key -> column. */
const METADATA_FIELDS: ReadonlyArray<{ key: keyof Params; column: string; kind: 'text' | 'date' }> = [
  { key: 'displayName', column: 'display_name', kind: 'text' },
  { key: 'manufacturer', column: 'manufacturer', kind: 'text' },
  { key: 'model', column: 'model', kind: 'text' },
  { key: 'serialNumber', column: 'serial_number', kind: 'text' },
  { key: 'purchaseSource', column: 'purchase_source', kind: 'text' },
  { key: 'purchaseOrderId', column: 'purchase_order_id', kind: 'text' },
  { key: 'purchasedAt', column: 'purchased_at', kind: 'date' },
  { key: 'ipAddress', column: 'ip_address', kind: 'text' },
  { key: 'macAddress', column: 'mac_address', kind: 'text' },
  { key: 'fccId', column: 'fcc_id', kind: 'text' },
  { key: 'feedUrl', column: 'feed_url', kind: 'text' },
  { key: 'notes', column: 'notes', kind: 'text' },
]

const MAX_LEN: Record<string, number> = {
  display_name: 200, manufacturer: 200, model: 200, serial_number: 200,
  purchase_source: 200, purchase_order_id: 100, ip_address: 100, mac_address: 100, fcc_id: 100, feed_url: 500, notes: 5000,
}

function normalizeDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${field} is not a valid date`)
  return parsed.toISOString().slice(0, 10)
}

const INSTALLATION_STEPS: ReadonlySet<string> = new Set([
  'permanent_device_label', 'manufacturer_app_firmware', 'ha_link', 'physical_placement', 'verified_operation',
])

const INSTALLATION_STATUSES: ReadonlySet<string> = new Set(['todo', 'unknown', 'done', 'not_applicable'])

const CONDITION_STATUSES: ReadonlySet<string> = new Set(['unknown', 'needs_testing', 'working', 'confirmed_broken'])

const ID_MARKING_STATUSES: ReadonlySet<string> = new Set([
  'unknown', 'not_marked', 'box_or_item_marked', 'permanent_device_label',
])

const FOLLOWUP_TASK_TYPES: ReadonlySet<string> = new Set([
  'needs_testing', 'needs_battery_change', 'needs_labeling', 'needs_setup',
  'needs_placement_reinstallation', 'proposed_entity_name_cleanup',
])

function requireEnum(value: unknown, field: string, allowed: ReadonlySet<string>): string {
  const normalized = requireString(value, field, 100)
  if (!allowed.has(normalized)) throw new ValidationError(`${field} is invalid`)
  return normalized
}

function optionalDueAt(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new ValidationError('dueAt is not a valid date/time')
  return parsed.toISOString()
}

function normalizeTaskTypes(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const out: string[] = []
  for (const value of values) {
    const taskType = requireEnum(value, 'followupTaskTypes', FOLLOWUP_TASK_TYPES)
    if (!out.includes(taskType)) out.push(taskType)
  }
  return out
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const equipmentId = requireUuid(params.equipmentId, 'equipmentId')
  // location_change / bin_change normalize onto the canonical move command.
  const rawCommand = requireString(params.command, 'command')
  const command: Command = rawCommand === 'location_change' || rawCommand === 'bin_change'
    ? 'move'
    : rawCommand as Command
  if (!(command in EVENT_TYPE_BY_COMMAND)) {
    throw new ValidationError(`Unknown command "${command}"`)
  }
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)
  const occurredAt = occurredAtOrNow(params.occurredAt)
  const notes = optionalString(params.notes, 'notes')
  const actor = actorName(req.user)

  const current = await retoolDb.query(
    `SELECT id, physical_id, display_name, direct_location_id, bin_id, lifecycle_stage_id, version, archived_at,
      manufacturer, model, serial_number, purchase_source, purchase_order_id, purchased_at,
      ip_address, mac_address, fcc_id, feed_url, notes, intended_location_id,
      id_marking_status, condition_status, review_flag, review_reason, proposed_cleanup_note
     FROM equipment WHERE id = $1`,
    [equipmentId],
  )
  const row = current.data[0]
  if (!row) throw new ValidationError('Equipment not found')

  const expectedVersion = Number.isFinite(Number(params.expectedVersion)) ? Number(params.expectedVersion) : Number(row.version)
  if (Number(row.version) !== expectedVersion) {
    const existingEvent = await retoolDb.query(
      `SELECT id FROM equipment_event WHERE idempotency_key = $1::text AND equipment_id = $2::text`,
      [idempotencyKey, equipmentId],
    )
    const replay = existingEvent.data[0]
    if (replay) {
      const replayPlacementPlan = command === 'move' || command === 'move_to_testing_bin'
        ? await buildHaPlacementPlanForEquipment(equipmentId)
        : undefined
      return {
        ok: true as const,
        noOp: false,
        eventId: replay.id,
        version: Number(row.version),
        idempotentReplay: true,
        ...(replayPlacementPlan ? { haPlacementPlan: replayPlacementPlan } : {}),
      }
    }
    throw new ConflictError(
      `Version conflict: expected version ${expectedVersion} but current is ${row.version}. Reload and retry.`,
    )
  }

  const noOp = (haPlacementPlan?: HaPlacementPlan) => ({
    ok: true as const,
    noOp: true,
    eventId: null,
    version: Number(row.version),
    ...(haPlacementPlan ? { haPlacementPlan } : {}),
  })

  if (command === 'create_followup_task') {
    const taskType = requireEnum(params.taskType, 'taskType', FOLLOWUP_TASK_TYPES)
    const taskNote = optionalString(params.notes, 'notes', 2000)
    const dueAt = optionalDueAt(params.dueAt)
    const payloadJson = jsonValue({ taskType, note: taskNote, dueAt, versionAtEvent: Number(row.version) })
    try {
      const result = await retoolDb.query(
        `WITH updated AS (
          UPDATE equipment SET version = version + 1, updated_at = now()
          WHERE id = $1::text AND version = $2::int
          RETURNING id, version
        ), task AS (
          INSERT INTO equipment_followup_task (id, equipment_id, task_type, status, note, due_at, created_by)
          SELECT gen_random_uuid()::text, updated.id, $3::text, 'open', $4::text, $5::timestamptz, $6::text
          FROM updated
          RETURNING id
        ), event AS (
          INSERT INTO equipment_event (id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          SELECT gen_random_uuid()::text, updated.id, 'FOLLOWUP_TASK_CREATE', $7::timestamptz, now(), $6::text, 'app', $4::text, $8::jsonb, $9::text
          FROM updated
          RETURNING id
        )
        SELECT updated.version AS new_version, task.id AS task_id, event.id AS event_id FROM updated, task, event`,
        [equipmentId, expectedVersion, taskType, taskNote, dueAt, actor, occurredAt, payloadJson, idempotencyKey],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return { ok: true as const, noOp: false, taskId: updated.task_id, eventId: updated.event_id, version: Number(updated.new_version) }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(row.version), idempotentReplay: true }
      }
      throw error
    }
  }

  if (command === 'complete_followup_task') {
    const taskId = requireUuid(params.taskId, 'taskId')
    const completionNote = optionalString(params.completionNote ?? params.notes, 'completionNote', 2000)
    const taskResult = await retoolDb.query(
      `SELECT id, task_type, status FROM equipment_followup_task WHERE id = $1::text AND equipment_id = $2::text`,
      [taskId, equipmentId],
    )
    const task = taskResult.data[0]
    if (!task) throw new ValidationError('Follow-up task not found')
    if (String(task.status) === 'completed') return noOp()
    const payloadJson = jsonValue({ taskId, taskType: task.task_type, completionNote, versionAtEvent: Number(row.version) })
    try {
      const result = await retoolDb.query(
        `WITH updated AS (
          UPDATE equipment SET version = version + 1, updated_at = now()
          WHERE id = $1::text AND version = $2::int
          RETURNING id, version
        ), task AS (
          UPDATE equipment_followup_task
          SET status = 'completed', completed_at = $3::timestamptz, completed_by = $4::text,
            completion_note = $5::text, updated_at = now()
          WHERE id = $6::text AND equipment_id = (SELECT id FROM updated) AND status = 'open'
          RETURNING id, task_type
        ), event AS (
          INSERT INTO equipment_event (id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          SELECT gen_random_uuid()::text, updated.id, 'FOLLOWUP_TASK_COMPLETE', $3::timestamptz, now(), $4::text, 'app', $5::text, $7::jsonb, $8::text
          FROM updated, task
          RETURNING id
        )
        SELECT updated.version AS new_version, task.id AS task_id, event.id AS event_id FROM updated, task, event`,
        [equipmentId, expectedVersion, occurredAt, actor, completionNote, taskId, payloadJson, idempotencyKey],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return { ok: true as const, noOp: false, taskId: updated.task_id, eventId: updated.event_id, version: Number(updated.new_version) }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(row.version), idempotentReplay: true }
      }
      throw error
    }
  }

  if (command === 'temporary_remove' || command === 'permanent_remove') {
    const removalType = command === 'temporary_remove' ? 'temporary' : 'permanent'
    const custodyLocationId = optionalUuid(params.custodyLocationId, 'custodyLocationId')
    const custodyBinId = optionalUuid(params.custodyBinId, 'custodyBinId')
    const custodyUnknown = params.custodyUnknown === true
    if ((custodyLocationId && custodyBinId) || (!custodyUnknown && !custodyLocationId && !custodyBinId)) {
      throw new ValidationError('Choose one temporary/storage destination bin or location, or explicitly mark custody unknown')
    }
    const reason = optionalString(params.reason ?? params.notes, 'reason', 1000)
    const taskTypes = normalizeTaskTypes(params.followupTaskTypes)
    const payload = {
      removalType,
      reason,
      originalPlacement: { directLocationId: row.direct_location_id ?? null, binId: row.bin_id ?? null },
      custody: { locationId: custodyLocationId, binId: custodyBinId, unknown: custodyUnknown },
      followupTaskTypes: taskTypes,
      haSetupPreserved: removalType === 'temporary',
      versionAtEvent: Number(row.version),
    }
    const shouldClearInstalledPlacement = removalType === 'permanent'
    try {
      const result = await retoolDb.query(
        `WITH updated AS (
          UPDATE equipment
          SET direct_location_id = CASE WHEN $1::boolean THEN NULL ELSE direct_location_id END,
            bin_id = CASE WHEN $1::boolean THEN NULL ELSE bin_id END,
            version = version + 1,
            updated_at = now()
          WHERE id = $2::text AND version = $3::int
          RETURNING id, version
        ), removal AS (
          INSERT INTO equipment_removal_record (
            id, equipment_id, removal_type, removed_at, reason,
            original_direct_location_id, original_bin_id,
            custody_location_id, custody_bin_id, custody_unknown, created_by
          )
          SELECT gen_random_uuid()::text, updated.id, $4::text, $5::timestamptz, $6::text,
            $7::text, $8::text, $9::text, $10::text, $11::boolean, $12::text
          FROM updated
          RETURNING id
        ), tasks AS (
          INSERT INTO equipment_followup_task (id, equipment_id, task_type, status, note, created_by)
          SELECT gen_random_uuid()::text, updated.id, task_type, 'open', $6::text, $12::text
          FROM updated, unnest($13::text[]) AS task_type
          RETURNING id
        ), event AS (
          INSERT INTO equipment_event (id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          SELECT gen_random_uuid()::text, updated.id, CASE WHEN $4::text = 'temporary' THEN 'TEMPORARY_REMOVE' ELSE 'PERMANENT_REMOVE' END,
            $5::timestamptz, now(), $12::text, 'app', $6::text, $14::jsonb, $15::text
          FROM updated
          RETURNING id
        )
        SELECT updated.version AS new_version, removal.id AS removal_id, event.id AS event_id,
          (SELECT count(*)::int FROM tasks) AS tasks_created
        FROM updated, removal, event`,
        [
          shouldClearInstalledPlacement, equipmentId, expectedVersion,
          removalType, occurredAt, reason, row.direct_location_id ?? null, row.bin_id ?? null,
          custodyLocationId, custodyBinId, custodyUnknown, actor, taskTypes,
          jsonValue(payload), idempotencyKey,
        ],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return { ok: true as const, noOp: false, removalId: updated.removal_id, tasksCreated: Number(updated.tasks_created ?? 0), eventId: updated.event_id, version: Number(updated.new_version) }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(row.version), idempotentReplay: true }
      }
      if (isForeignKeyViolation(error)) throw new ValidationError('Invalid custody bin or location')
      throw error
    }
  }

  if (command === 'put_back') {
    const removalIdParam = optionalUuid(params.removalId, 'removalId')
    const removalResult = await retoolDb.query(
      `SELECT id FROM equipment_removal_record
       WHERE equipment_id = $1::text AND removal_type = 'temporary' AND returned_at IS NULL
         AND ($2::text IS NULL OR id = $2::text)
       ORDER BY removed_at DESC LIMIT 1`,
      [equipmentId, removalIdParam],
    )
    const removal = removalResult.data[0]
    if (!removal) throw new ValidationError('No open temporary removal record to put back')
    const returnNote = optionalString(params.notes, 'notes', 1000)
    const payloadJson = jsonValue({ removalId: removal.id, returnNote, versionAtEvent: Number(row.version) })
    try {
      const result = await retoolDb.query(
        `WITH updated AS (
          UPDATE equipment SET version = version + 1, updated_at = now()
          WHERE id = $1::text AND version = $2::int
          RETURNING id, version
        ), removal AS (
          UPDATE equipment_removal_record
          SET returned_at = $3::timestamptz, returned_by = $4::text, return_note = $5::text, updated_at = now()
          WHERE id = $6::text AND equipment_id = (SELECT id FROM updated) AND returned_at IS NULL
          RETURNING id
        ), event AS (
          INSERT INTO equipment_event (id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          SELECT gen_random_uuid()::text, updated.id, 'PUT_BACK', $3::timestamptz, now(), $4::text, 'app', $5::text, $7::jsonb, $8::text
          FROM updated, removal
          RETURNING id
        )
        SELECT updated.version AS new_version, removal.id AS removal_id, event.id AS event_id FROM updated, removal, event`,
        [equipmentId, expectedVersion, occurredAt, actor, returnNote, removal.id, payloadJson, idempotencyKey],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return { ok: true as const, noOp: false, removalId: updated.removal_id, eventId: updated.event_id, version: Number(updated.new_version) }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(row.version), idempotentReplay: true }
      }
      throw error
    }
  }

  if (command === 'installation_check') {
    const stepKey = requireEnum(params.stepKey, 'stepKey', INSTALLATION_STEPS)
    const stepStatus = requireEnum(params.stepStatus, 'stepStatus', INSTALLATION_STATUSES)
    const stepNote = optionalString(params.notes, 'notes', 2000)
    const existingStep = await retoolDb.query(
      `SELECT status, note FROM installation_checklist_item WHERE equipment_id = $1::text AND step_key = $2::text`,
      [equipmentId, stepKey],
    )
    const previousStep = existingStep.data[0]
    const previousStatus = previousStep?.status === undefined ? null : String(previousStep.status)
    const previousNote = previousStep?.note === undefined || previousStep.note === null ? null : String(previousStep.note)
    if (previousStatus === stepStatus && previousNote === stepNote) return noOp()
    const eventPayload = {
      stepKey,
      fromStatus: previousStatus,
      toStatus: stepStatus,
      fromNote: previousNote,
      toNote: stepNote,
      versionAtEvent: Number(row.version),
    }
    try {
      const result = await retoolDb.query(
        `WITH guarded AS (
          SELECT id FROM equipment WHERE id = $1::text AND version = $2::int
        ), upserted AS (
          INSERT INTO installation_checklist_item (
            equipment_id, step_key, status, note, changed_at, changed_by, updated_at
          )
          SELECT guarded.id, $3::text, $4::text, $5::text, $6::timestamptz, $7::text, now()
          FROM guarded
          ON CONFLICT (equipment_id, step_key) DO UPDATE SET
            status = EXCLUDED.status,
            note = EXCLUDED.note,
            changed_at = EXCLUDED.changed_at,
            changed_by = EXCLUDED.changed_by,
            updated_at = now()
          RETURNING equipment_id
        ), updated AS (
          UPDATE equipment e SET version = version + 1, updated_at = now()
          FROM guarded WHERE e.id = guarded.id
          RETURNING e.id, e.version
        ), event AS (
          INSERT INTO equipment_event (
            id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
          )
          SELECT gen_random_uuid()::text, updated.id, 'INSTALLATION_CHECK', $6::timestamptz, now(), $7::text, 'app', $5::text, $8::jsonb, $9::text
          FROM updated
          RETURNING id
        )
        SELECT updated.version AS new_version, event.id AS event_id FROM updated, event`,
        [equipmentId, expectedVersion, stepKey, stepStatus, stepNote, occurredAt, actor, jsonValue(eventPayload), idempotencyKey],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return { ok: true as const, noOp: false, eventId: updated.event_id, version: Number(updated.new_version) }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) {
          const fresh = await retoolDb.query(`SELECT version FROM equipment WHERE id = $1::text`, [equipmentId])
          return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(fresh.data[0]?.version ?? row.version), idempotentReplay: true }
        }
      }
      throw error
    }
  }

  if (command === 'move_to_testing_bin') {
    const targetBinId = requireUuid(params.testBinId ?? params.newBinId, 'testBinId')
    const reason = requireString(params.reason ?? params.notes, 'reason', 500)
    const targetBin = await retoolDb.query(`SELECT id, name FROM bin WHERE id = $1::text AND archived_at IS NULL`, [targetBinId])
    const targetBinRow = targetBin.data[0]
    if (!targetBinRow) throw new ValidationError('Choose an existing active bin for testing')
    const eventPayload = {
      removalType: 'temporary',
      retainedInstalledPlacement: { directLocationId: row.direct_location_id ?? null, binId: row.bin_id ?? null },
      temporaryCustody: { locationId: null, binId: targetBinId, unknown: false },
      followupTaskTypes: ['needs_testing'],
      intendedLocationPreserved: row.intended_location_id ?? null,
      haSetupPreserved: true,
      versionAtEvent: Number(row.version),
    }
    try {
      const result = await retoolDb.query(
        `WITH updated AS (
          UPDATE equipment
          SET version = version + 1,
            updated_at = now()
          WHERE id = $1::text AND version = $2::int
          RETURNING id, version
        ), removal AS (
          INSERT INTO equipment_removal_record (
            id, equipment_id, removal_type, removed_at, reason,
            original_direct_location_id, original_bin_id,
            custody_location_id, custody_bin_id, custody_unknown, created_by
          )
          SELECT gen_random_uuid()::text, updated.id, 'temporary', $3::timestamptz, $4::text,
            $5::text, $6::text, NULL::text, $7::text, false, $8::text
          FROM updated
          RETURNING id
        ), task AS (
          INSERT INTO equipment_followup_task (id, equipment_id, task_type, status, note, created_by)
          SELECT gen_random_uuid()::text, updated.id, 'needs_testing', 'open', $9::text, $10::text
          FROM updated
          RETURNING id
        ), event AS (
          INSERT INTO equipment_event (
            id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
          )
          SELECT gen_random_uuid()::text, updated.id, 'MOVE_TO_TESTING_BIN', $11::timestamptz, now(), $12::text, 'app', $13::text, $14::jsonb, $15::text
          FROM updated
          RETURNING id
        )
        SELECT updated.version AS new_version, removal.id AS removal_id, task.id AS task_id, event.id AS event_id FROM updated, removal, task, event`,
        [
          equipmentId, expectedVersion, occurredAt, reason, row.direct_location_id ?? null,
          row.bin_id ?? null, targetBinId, actor, reason, actor, occurredAt, actor,
          reason, jsonValue(eventPayload), idempotencyKey,
        ],
      )
      const updated = result.data[0]
      if (!updated) throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
      return {
        ok: true as const,
        noOp: false,
        removalId: updated.removal_id,
        taskId: updated.task_id,
        eventId: updated.event_id,
        version: Number(updated.new_version),
      }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT id FROM equipment_event WHERE idempotency_key = $1::text`, [idempotencyKey])
        const eventRow = existing.data[0]
        if (eventRow) {
          const fresh = await retoolDb.query(`SELECT version FROM equipment WHERE id = $1::text`, [equipmentId])
          return { ok: true as const, noOp: false, eventId: eventRow.id, version: Number(fresh.data[0]?.version ?? row.version), idempotentReplay: true }
        }
      }
      throw error
    }
  }

  let eventNotes = notes
  let payload: Record<string, unknown> = { ...(params.detail ?? {}) }
  const sets: string[] = []
  const setValues: unknown[] = []
  // Statement params: SET values are $1..$n, then WHERE id/version, then event fields.
  const nextParam = (): string => `$${1 + setValues.length}`

  if (command === 'move') {
    const newLocationId = optionalUuid(params.newLocationId, 'newLocationId')
    const newBinId = optionalUuid(params.newBinId, 'newBinId')
    if (newLocationId && newBinId) {
      throw new ValidationError('An item is either in a location or in a bin, not both')
    }
    const oldLocationId = row.direct_location_id as string | null
    const oldBinId = row.bin_id as string | null
    if ((newLocationId ?? null) === oldLocationId && (newBinId ?? null) === oldBinId) {
      const currentPlacementPlan = await buildHaPlacementPlanForMove({
        equipmentId,
        physicalId: String(row.physical_id),
        newLocationId,
        newBinId,
      })
      return noOp(currentPlacementPlan)
    }
    const oldEffective = oldBinId ? 'bin' : oldLocationId ? 'location' : 'unknown'
    payload = {
      ...payload,
      from: { locationId: oldLocationId, binId: oldBinId, kind: oldEffective },
      to: { locationId: newLocationId ?? null, binId: newBinId ?? null, kind: newBinId ? 'bin' : newLocationId ? 'location' : 'unknown' },
    }
    sets.push(`direct_location_id = ${nextParam()}`)
    setValues.push(newLocationId)
    sets.push(`bin_id = ${nextParam()}`)
    setValues.push(newBinId)
  } else if (command === 'lifecycle_change') {
    const newStageId = requireUuid(params.newStageId, 'newStageId')
    if (newStageId === String(row.lifecycle_stage_id)) return noOp()
    payload = { ...payload, fromStageId: row.lifecycle_stage_id, toStageId: newStageId }
    sets.push(`lifecycle_stage_id = ${nextParam()}`)
    setValues.push(newStageId)
  } else if (command === 'rename') {
    const newDisplayName = requireString(params.newDisplayName, 'newDisplayName', 200)
    if (newDisplayName === String(row.display_name)) return noOp()
    payload = { ...payload, fromName: row.display_name, toName: newDisplayName }
    sets.push(`display_name = ${nextParam()}`)
    setValues.push(newDisplayName)
  } else if (command === 'correction') {
    const newPhysicalId = requireString(params.newPhysicalId, 'newPhysicalId', 100)
    if (newPhysicalId === String(row.physical_id)) return noOp()
    payload = { ...payload, fromPhysicalId: row.physical_id, toPhysicalId: newPhysicalId }
    sets.push(`physical_id = ${nextParam()}`)
    setValues.push(newPhysicalId)
  } else if (command === 'metadata_update') {
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    for (const field of METADATA_FIELDS) {
      if (!(field.key in params)) continue
      const raw = params[field.key]
      const maxLen = MAX_LEN[field.column] ?? 500
      const to = field.kind === 'date'
        ? normalizeDate(raw, String(field.key))
        : optionalString(raw, String(field.key), maxLen)
      const currentRaw = row[field.column]
      const from = field.kind === 'date'
        ? (currentRaw ? String(currentRaw).slice(0, 10) : null)
        : (currentRaw === null || currentRaw === undefined ? null : String(currentRaw))
      if (to === from) continue
      changes[field.column] = { from, to }
      sets.push(`${field.column} = ${nextParam()}`)
      setValues.push(to)
    }
    if (Object.keys(changes).length === 0) return noOp()
    payload = { ...payload, changes }
  } else if (command === 'review_update') {
    const changes: Record<string, { from: unknown; to: unknown }> = {}
    const applyText = (paramKey: keyof Params, column: string, maxLength: number): void => {
      if (!(paramKey in params)) return
      const to = optionalString(params[paramKey], String(paramKey), maxLength)
      const from = row[column] === null || row[column] === undefined ? null : String(row[column])
      if (to === from) return
      changes[column] = { from, to }
      sets.push(`${column} = ${nextParam()}`)
      setValues.push(to)
    }
    if ('idMarkingStatus' in params) {
      const to = requireEnum(params.idMarkingStatus, 'idMarkingStatus', ID_MARKING_STATUSES)
      const from = String(row.id_marking_status ?? 'unknown')
      if (to !== from) {
        changes['id_marking_status'] = { from, to }
        sets.push(`id_marking_status = ${nextParam()}`)
        setValues.push(to)
      }
    }
    if ('conditionStatus' in params) {
      const to = requireEnum(params.conditionStatus, 'conditionStatus', CONDITION_STATUSES)
      const from = String(row.condition_status ?? 'unknown')
      if (to !== from) {
        changes['condition_status'] = { from, to }
        sets.push(`condition_status = ${nextParam()}`)
        setValues.push(to)
      }
    }
    if ('reviewFlag' in params) {
      const to = params.reviewFlag === true
      const from = row.review_flag === true
      if (to !== from) {
        changes['review_flag'] = { from, to }
        sets.push(`review_flag = ${nextParam()}`)
        setValues.push(to)
      }
    }
    applyText('reviewReason', 'review_reason', 500)
    applyText('proposedCleanupNote', 'proposed_cleanup_note', 2000)
    if ('intendedLocationId' in params) {
      const to = optionalUuid(params.intendedLocationId, 'intendedLocationId')
      const from = row.intended_location_id === null || row.intended_location_id === undefined ? null : String(row.intended_location_id)
      if (to !== from) {
        changes['intended_location_id'] = { from, to }
        sets.push(`intended_location_id = ${nextParam()}`)
        setValues.push(to)
      }
    }
    if ('review_flag' in changes || 'review_reason' in changes || 'condition_status' in changes) {
      sets.push('review_updated_at = now()')
    }
    if (Object.keys(changes).length === 0) return noOp()
    payload = { ...payload, changes }
  } else if (command === 'archive') {
    if (row.archived_at) return noOp()
    sets.push('archived_at = now()')
    payload = { ...payload, archivedAt: new Date().toISOString() }
  } else if (command === 'unarchive') {
    if (!row.archived_at) return noOp()
    sets.push('archived_at = NULL')
  }

  const isEventOnly = EVENT_ONLY_COMMANDS.has(command) || sets.length === 0
  const eventType = EVENT_TYPE_BY_COMMAND[command]
  payload = { ...payload, versionAtEvent: Number(row.version) }
  const setId = `$${setValues.length + 1}`
  const setVersion = `$${setValues.length + 2}`
  const evType = `$${setValues.length + 3}`
  const evOccurred = `$${setValues.length + 4}`
  const evActor = `$${setValues.length + 5}`
  const evNotes = `$${setValues.length + 6}`
  const evPayload = `$${setValues.length + 7}`
  const evKey = `$${setValues.length + 8}`

  try {
    if (isEventOnly) {
      const insert = await retoolDb.query(
        `INSERT INTO equipment_event (
          id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
        ) VALUES (gen_random_uuid()::text, $1, $2, $3, now(), $4, 'app', $5, $6::jsonb, $7)
        RETURNING id`,
        [equipmentId, eventType, occurredAt, actor, eventNotes, jsonValue(payload), idempotencyKey],
      )
      return { ok: true as const, noOp: false, eventId: insert.data[0]?.id ?? null, version: Number(row.version) }
    }

    const setClauses = [...sets, `version = version + 1`, `updated_at = now()`].join(', ')
    const statement = `
      WITH updated AS (
        UPDATE equipment SET ${setClauses}
        WHERE id = ${setId} AND version = ${setVersion}
        RETURNING id, version
      ), event AS (
        INSERT INTO equipment_event (
          id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
        )
        SELECT gen_random_uuid()::text, updated.id, ${evType}, ${evOccurred}, now(), ${evActor}, 'app', ${evNotes}, ${evPayload}::jsonb, ${evKey}
        FROM updated
        RETURNING id
      )
      SELECT updated.version AS new_version, event.id AS event_id FROM updated, event`
    const result = await retoolDb.query(statement, [
      ...setValues, equipmentId, expectedVersion, eventType, occurredAt, actor, eventNotes, jsonValue(payload), idempotencyKey,
    ])
    const updated = result.data[0]
    if (!updated) {
      throw new ConflictError('Version conflict: the record changed concurrently. Reload and retry.')
    }
    const returnedPlacementPlan = command === 'move' ? await buildHaPlacementPlanForEquipment(equipmentId) : undefined
    return {
      ok: true as const,
      noOp: false,
      eventId: updated.event_id,
      version: Number(updated.new_version),
      ...(returnedPlacementPlan ? { haPlacementPlan: returnedPlacementPlan } : {}),
    }
  } catch (error) {
    if (isUniqueViolation(error, 'idempotency_key')) {
      const existing = await retoolDb.query(
        `SELECT id, equipment_id, version FROM equipment_event WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      const eventRow = existing.data[0]
      if (eventRow) {
        const fresh = await retoolDb.query(`SELECT version FROM equipment WHERE id = $1`, [equipmentId])
        const replayPlacementPlan = command === 'move' ? await buildHaPlacementPlanForEquipment(equipmentId) : undefined
        return {
          ok: true as const,
          noOp: false,
          eventId: eventRow.id,
          version: Number(fresh.data[0]?.version ?? row.version),
          idempotentReplay: true,
          ...(replayPlacementPlan ? { haPlacementPlan: replayPlacementPlan } : {}),
        }
      }
    }
    if (error instanceof ConflictError) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('equipment_one_placement')) {
      throw new ValidationError('An item is either in a location or in a bin, not both')
    }
    if (message.includes('violates foreign key constraint')) {
      throw new ValidationError('Invalid location, bin, or lifecycle stage reference')
    }
    if (message.includes('physical_id_key')) {
      throw new ValidationError('Another record already uses that physical_id')
    }
    throw error
  }
}
