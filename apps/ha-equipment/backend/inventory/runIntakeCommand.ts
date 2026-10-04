// Commands for the resumable equipment intake workflow. Draft state lives in
// equipment_intake; finalization promotes one draft into exactly one canonical equipment
// row using stable idempotency keys, so retries never create duplicate equipment/events.
import {
  actorName,
  isUniqueViolation,
  jsonValue,
  optionalString,
  optionalUuid,
  requireIdempotencyKey,
  requireString,
  requireUuid,
  ValidationError,
} from './shared'
import {
  assertIntakeActive,
  isIntakeStepKey,
  loadIntakeOrThrow,
  optionalDateOnly,
  type IntakeDraftPatch,
  type IntakeRow,
} from './intakeShared'

type IntakeCommand = 'start' | 'update_draft' | 'reserve_id' | 'finalize' | 'cancel'

type Params = {
  command: IntakeCommand
  intakeId?: string
  // start / update_draft
  workingName?: string
  equipmentTypeId?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  purchaseSource?: string
  purchaseOrderId?: string
  acquiredAt?: string
  directLocationId?: string
  binId?: string
  notes?: string
  currentStep?: string
  // reserve_id
  numericIndex?: string
  explicitPhysicalId?: string // legacy/exact UID path
  // finalize
  lifecycleStageId?: string
  finalDisplayName?: string
  equipmentTypeId?: string
}

const RESERVE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

function draftPatchFromParams(params: Params): IntakeDraftPatch {
  // Only keys explicitly present in the request participate; empty string clears a field.
  const patch: IntakeDraftPatch = {}
  if ('workingName' in params) patch.workingName = optionalString(params.workingName, 'workingName', 200) ?? undefined
  if ('equipmentTypeId' in params) patch.equipmentTypeId = optionalUuid(params.equipmentTypeId, 'equipmentTypeId') ?? undefined
  if ('manufacturer' in params) patch.manufacturer = optionalString(params.manufacturer, 'manufacturer', 200) ?? undefined
  if ('model' in params) patch.model = optionalString(params.model, 'model', 200) ?? undefined
  if ('serialNumber' in params) patch.serialNumber = optionalString(params.serialNumber, 'serialNumber', 200) ?? undefined
  if ('purchaseSource' in params) patch.purchaseSource = optionalString(params.purchaseSource, 'purchaseSource', 200) ?? undefined
  if ('purchaseOrderId' in params) patch.purchaseOrderId = optionalString(params.purchaseOrderId, 'purchaseOrderId', 100) ?? undefined
  if ('acquiredAt' in params) patch.acquiredAt = optionalDateOnly(params.acquiredAt, 'acquiredAt') ?? undefined
  if ('directLocationId' in params) patch.directLocationId = optionalUuid(params.directLocationId, 'directLocationId') ?? undefined
  if ('binId' in params) patch.binId = optionalUuid(params.binId, 'binId') ?? undefined
  if ('notes' in params) patch.notes = optionalString(params.notes, 'notes') ?? undefined
  if ('currentStep' in params) {
    if (params.currentStep && !isIntakeStepKey(params.currentStep)) {
      throw new ValidationError(`Unknown intake step "${params.currentStep}"`)
    }
    patch.currentStep = params.currentStep ?? undefined
  }
  return patch
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const command = requireString(params.command, 'command') as IntakeCommand
  const actor = actorName(req.user)

  if (command === 'start') {
    const workingName = requireString(params.workingName, 'workingName', 200)
    const equipmentTypeId = optionalUuid(params.equipmentTypeId, 'equipmentTypeId')
    const acquiredAt = optionalDateOnly(params.acquiredAt, 'acquiredAt')
    const result = await retoolDb.query(
      `INSERT INTO equipment_intake (id, status, working_name, equipment_type_id, purchase_source, purchase_order_id, acquired_at, notes, current_step)
      VALUES (gen_random_uuid()::text, 'pending', $1::text, $2::text, $3::text, $4::text, $5::date, $6::text, 'identify')
      RETURNING id, status, working_name`,
      [workingName, equipmentTypeId, optionalString(params.purchaseSource, 'purchaseSource', 200),
        optionalString(params.purchaseOrderId, 'purchaseOrderId', 100), acquiredAt, optionalString(params.notes, 'notes')],
    )
    const row = result.data[0]
    return { ok: true as const, intakeId: row?.id ?? null, status: row?.status ?? 'pending' }
  }

  const intakeId = requireUuid(params.intakeId, 'intakeId')
  const intake = await loadIntakeOrThrow(intakeId)

  if (command === 'cancel') {
    assertIntakeActive(intake)
    await retoolDb.query(
      `UPDATE equipment_intake SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1::text`,
      [intakeId],
    )
    return { ok: true as const, status: 'cancelled' as const }
  }

  if (command === 'update_draft') {
    assertIntakeActive(intake)
    const patch = draftPatchFromParams(params)
    const assignments: string[] = []
    const values: unknown[] = []
    const addAssignment = (column: string, value: unknown, cast: 'text' | 'date' = 'text'): void => {
      values.push(value)
      assignments.push(`${column} = $${values.length}::${cast}`)
    }
    if (patch.workingName !== undefined) {
      if (!patch.workingName || patch.workingName.trim().length === 0) throw new ValidationError('workingName cannot be blank')
      addAssignment('working_name', patch.workingName.trim())
    }
    if (patch.equipmentTypeId !== undefined) addAssignment('equipment_type_id', patch.equipmentTypeId)
    if (patch.manufacturer !== undefined) addAssignment('manufacturer', patch.manufacturer)
    if (patch.model !== undefined) addAssignment('model', patch.model)
    if (patch.serialNumber !== undefined) addAssignment('serial_number', patch.serialNumber)
    if (patch.purchaseSource !== undefined) addAssignment('purchase_source', patch.purchaseSource)
    if (patch.purchaseOrderId !== undefined) addAssignment('purchase_order_id', patch.purchaseOrderId)
    if (patch.acquiredAt !== undefined) addAssignment('acquired_at', patch.acquiredAt, 'date')
    if (patch.directLocationId !== undefined) addAssignment('direct_location_id', patch.directLocationId)
    if (patch.binId !== undefined) addAssignment('bin_id', patch.binId)
    if (patch.notes !== undefined) addAssignment('notes', patch.notes)
    if (patch.currentStep !== undefined) addAssignment('current_step', patch.currentStep)
    if (assignments.length === 0) return { ok: true as const, noOp: true, intake: summarize(intake) }
    values.push(intakeId)
    await retoolDb.query(
      `UPDATE equipment_intake SET ${assignments.join(', ')}, status = 'in_progress', updated_at = now()
      WHERE id = $${values.length}::text`,
      values,
    )
    const fresh = await loadIntakeOrThrow(intakeId)
    return { ok: true as const, intake: summarize(fresh) }
  }

  if (command === 'reserve_id') {
    assertIntakeActive(intake)
    let candidateId: string
    const explicitId = optionalString(params.explicitPhysicalId, 'explicitPhysicalId', 100)
    if (explicitId) {
      // Legacy/exact UID path: take the string exactly as provided.
      candidateId = explicitId
      if (!RESERVE_ID_PATTERN.test(candidateId)) {
        throw new ValidationError('Physical ID may only contain letters, numbers, dashes, and underscores')
      }
    } else {
      const numericIndex = requireString(params.numericIndex, 'numericIndex', 12)
      if (!/^\d+$/.test(numericIndex)) throw new ValidationError('Numeric index must contain digits only')
      const prefix = await prefixForIntake(intake)
      candidateId = `${prefix}_${numericIndex}`
    }
    await assertPhysicalIdAvailable(candidateId, intakeId)
    try {
      await retoolDb.query(
        `UPDATE equipment_intake SET reserved_physical_id = $1::text, updated_at = now() WHERE id = $2::text`,
        [candidateId, intakeId],
      )
    } catch (error) {
      if (isUniqueViolation(error, 'uq_equipment_intake_reserved_active')) {
        throw new ValidationError(`"${candidateId}" is already reserved by another active intake`)
      }
      throw error
    }
    return { ok: true as const, reservedPhysicalId: candidateId }
  }

  if (command === 'finalize') {
    return finalizeIntake(intake, params, actor)
  }

  throw new ValidationError(`Unknown intake command "${command}"`)
}

async function prefixForIntake(intake: IntakeRow): Promise<string> {
  if (!intake.equipment_type_id) {
    throw new ValidationError('Choose an equipment type before reserving an ID (or use the legacy/exact UID path)')
  }
  const typeResult = await retoolDb.query(
    `SELECT id_prefix FROM equipment_type WHERE id = $1::text`,
    [intake.equipment_type_id],
  )
  const prefix = typeResult.data[0]?.id_prefix ? String(typeResult.data[0].id_prefix) : null
  if (!prefix) {
    throw new ValidationError('This equipment type has no ID prefix. Set one in Settings, or use the legacy/exact UID path.')
  }
  return prefix
}

async function assertPhysicalIdAvailable(candidateId: string, intakeId: string): Promise<void> {
  const equipmentTaken = await retoolDb.query(`SELECT 1 FROM equipment WHERE physical_id = $1::text`, [candidateId])
  if (equipmentTaken.data.length > 0) {
    throw new ValidationError(`"${candidateId}" is already used by an equipment record`)
  }
  const intakeTaken = await retoolDb.query(
    `SELECT 1 FROM equipment_intake
    WHERE reserved_physical_id = $1::text AND status IN ('pending', 'in_progress') AND id <> $2::text`,
    [candidateId, intakeId],
  )
  if (intakeTaken.data.length > 0) {
    throw new ValidationError(`"${candidateId}" is already reserved by another active intake`)
  }
}

function summarize(row: IntakeRow) {
  return {
    id: row.id,
    status: row.status,
    workingName: row.working_name,
    equipmentTypeId: row.equipment_type_id,
    reservedPhysicalId: row.reserved_physical_id,
    currentStep: row.current_step,
    updatedAt: row.updated_at,
  }
}

async function initialLifecycleStageId(): Promise<string> {
  const result = await retoolDb.query(
    `SELECT id FROM lifecycle_stage
     WHERE archived = false
     ORDER BY
       CASE
         WHEN code = 'spare' THEN 0
         WHEN code = 'stored' THEN 1
         WHEN expects_online = false THEN 2
         ELSE 3
       END,
       sort_order NULLS LAST,
       name
     LIMIT 1`,
  )
  const row = result.data[0]
  if (!row?.id) throw new ValidationError('No active lifecycle stage is available for registration')
  return String(row.id)
}

async function finalizeIntake(intake: IntakeRow, params: Params, actor: string) {
  const idempotencyKey = `intake_finalize:${intake.id}`

  // Already finished: idempotent replay.
  if (intake.status === 'completed' && intake.resulting_equipment_id) {
    return { ok: true as const, equipmentId: intake.resulting_equipment_id, idempotentReplay: true }
  }
  assertIntakeActive(intake)

  const displayName = optionalString(params.finalDisplayName, 'finalDisplayName', 200) ?? intake.working_name
  const equipmentTypeId = intake.equipment_type_id
    ? String(intake.equipment_type_id)
    : optionalUuid(params.equipmentTypeId, 'equipmentTypeId')
  if (!equipmentTypeId) throw new ValidationError('Equipment type is required to finish as equipment')
  const lifecycleStageId = params.lifecycleStageId ? requireUuid(params.lifecycleStageId, 'lifecycleStageId') : await initialLifecycleStageId()
  const physicalId = intake.reserved_physical_id
    ? String(intake.reserved_physical_id)
    : optionalString(params.explicitPhysicalId, 'explicitPhysicalId', 100)
  if (!physicalId) throw new ValidationError('Reserve a physical ID (or provide a legacy/exact UID) before finishing')

  try {
    const insertResult = await retoolDb.query(
      `WITH inserted AS (
        INSERT INTO equipment (
          id, physical_id, display_name, equipment_type_id, lifecycle_stage_id,
          manufacturer, model, serial_number, notes, direct_location_id, bin_id,
          purchased_at, purchase_source, purchase_order_id, version
        ) VALUES (
          gen_random_uuid()::text, $1::text, $2::text, $3::text, $4::text,
          $5::text, $6::text, $7::text, $8::text, $9::text, $10::text,
          $11::date, $12::text, $13::text, 1
        )
        RETURNING id, version
      ), event AS (
        INSERT INTO equipment_event (
          id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
        )
        SELECT gen_random_uuid()::text, inserted.id, 'CREATE', now(), now(), $14::text, 'app', $15::text, $16::jsonb, $17::text
        FROM inserted
        RETURNING id
      )
      SELECT inserted.id AS equipment_id, inserted.version, event.id AS event_id
      FROM inserted, event`,
      [
        physicalId, displayName, equipmentTypeId, lifecycleStageId,
        intake.manufacturer, intake.model, intake.serial_number, intake.notes,
        intake.direct_location_id, intake.bin_id,
        intake.acquired_at, intake.purchase_source, intake.purchase_order_id,
        actor, 'Registered from intake draft',
        jsonValue({ intakeId: intake.id, workingName: intake.working_name }),
        idempotencyKey,
      ],
    )
    const created = insertResult.data[0]
    if (!created) throw new Error('Finalize insert failed unexpectedly')
    await recordAcquiredEvent(intake, String(created.equipment_id), actor)
    await retoolDb.query(
      `UPDATE equipment_intake
      SET status = 'completed', resulting_equipment_id = $1::text, completed_at = now(), updated_at = now()
      WHERE id = $2::text`,
      [String(created.equipment_id), intake.id],
    )
    return {
      ok: true as const,
      equipmentId: String(created.equipment_id),
      physicalId,
      intakeCompleted: true,
    }
  } catch (error) {
    // Race/idempotency: the CREATE event for this intake already exists -> resolve instead of duplicating.
    if (isUniqueViolation(error, 'idempotency_key')) {
      const existingEvent = await retoolDb.query(
        `SELECT equipment_id FROM equipment_event WHERE idempotency_key = $1::text`,
        [idempotencyKey],
      )
      const existingEquipmentId = existingEvent.data[0]?.equipment_id ? String(existingEvent.data[0].equipment_id) : null
      if (existingEquipmentId) {
        await retoolDb.query(
          `UPDATE equipment_intake
          SET status = 'completed', resulting_equipment_id = $1::text,
            completed_at = COALESCE(completed_at, now()),
            reserved_physical_id = COALESCE(reserved_physical_id, $2::text), updated_at = now()
          WHERE id = $3::text`,
          [existingEquipmentId, physicalId, intake.id],
        )
        return { ok: true as const, equipmentId: existingEquipmentId, physicalId, idempotentReplay: true }
      }
    }
    if (isUniqueViolation(error, 'physical_id')) {
      throw new ValidationError(`"${physicalId}" already exists as equipment; choose a different index or legacy UID`)
    }
    throw error
  }
}

/** Separate ACQUIRED event so acquisition is never conflated with database registration. */
async function recordAcquiredEvent(intake: IntakeRow, equipmentId: string, actor: string): Promise<void> {
  if (!intake.acquired_at && !intake.purchase_source) return
  await retoolDb.query(
    `INSERT INTO equipment_event (
      id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
    )
    VALUES (gen_random_uuid()::text, $1::text, 'ACQUIRED', $2::timestamptz, now(), $3::text, 'app', $4::text, $5::jsonb, $6::text)`,
    [
      equipmentId,
      intake.acquired_at ? new Date(String(intake.acquired_at)).toISOString() : new Date().toISOString(),
      actor,
      intake.purchase_source ? `Acquired from ${intake.purchase_source}` : 'Acquired (source not recorded)',
      jsonValue({
        acquiredAt: intake.acquired_at,
        purchaseSource: intake.purchase_source,
        purchaseOrderId: intake.purchase_order_id,
      }),
      `intake_acquired:${intake.id}`,
    ],
  )
}
