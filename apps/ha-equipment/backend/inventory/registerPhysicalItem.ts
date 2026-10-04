import {
  actorName,
  isCheckViolation,
  isForeignKeyViolation,
  isUniqueViolation,
  jsonValue,
  optionalString,
  optionalUuid,
  requireIdempotencyKey,
  requireString,
  requireUuid,
  ValidationError,
} from './shared'

type IdMarkingStatus = 'unknown' | 'not_marked' | 'box_or_item_marked' | 'permanent_device_label'
type ConditionStatus = 'unknown' | 'needs_testing' | 'working' | 'confirmed_broken'

type Params = {
  physicalId: string
  equipmentTypeId: string
  displayName?: string
  directLocationId?: string
  binId?: string
  intendedLocationId?: string
  idMarkingStatus?: IdMarkingStatus
  conditionStatus?: ConditionStatus
  reviewFlag?: boolean
  reviewReason?: string
  proposedCleanupNote?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  purchaseSource?: string
  purchaseOrderId?: string
  purchasedAt?: string
  notes?: string
  idempotencyKey: string
}

const VALID_MARKING: ReadonlySet<string> = new Set([
  'unknown', 'not_marked', 'box_or_item_marked', 'permanent_device_label',
])
const VALID_CONDITION: ReadonlySet<string> = new Set([
  'unknown', 'needs_testing', 'working', 'confirmed_broken',
])

function normalizeDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${field} is not a valid date`)
  return parsed.toISOString().slice(0, 10)
}

async function initialLifecycleStageId(): Promise<string> {
  const result = await retoolDb.query(
    `SELECT id, code, expects_online
     FROM lifecycle_stage
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

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const physicalId = requireString(params.physicalId, 'physicalId', 100)
  const equipmentTypeId = requireUuid(params.equipmentTypeId, 'equipmentTypeId')
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)
  const directLocationId = optionalUuid(params.directLocationId, 'directLocationId')
  const binId = optionalUuid(params.binId, 'binId')
  const intendedLocationId = optionalUuid(params.intendedLocationId, 'intendedLocationId')
  if (directLocationId && binId) throw new ValidationError('Choose either current bin or actual location, not both')

  const typeResult = await retoolDb.query(`SELECT id, name FROM equipment_type WHERE id = $1::text`, [equipmentTypeId])
  const typeRow = typeResult.data[0]
  if (!typeRow) throw new ValidationError('Equipment type not found')
  const typeName = String(typeRow.name)
  const displayName = optionalString(params.displayName, 'displayName', 200) ?? `${typeName} ${physicalId}`

  const idMarkingStatus = params.idMarkingStatus ?? 'box_or_item_marked'
  if (!VALID_MARKING.has(idMarkingStatus)) throw new ValidationError('idMarkingStatus is invalid')
  const conditionStatus = params.conditionStatus ?? 'unknown'
  if (!VALID_CONDITION.has(conditionStatus)) throw new ValidationError('conditionStatus is invalid')

  const reservation = await retoolDb.query(
    `SELECT id, working_name
     FROM equipment_intake
     WHERE reserved_physical_id = $1::text
       AND status IN ('pending', 'in_progress')
     LIMIT 1`,
    [physicalId],
  )
  const reservedBy = reservation.data[0]
  if (reservedBy) {
    throw new ValidationError(
      `"${physicalId}" is reserved by active intake draft "${String(reservedBy.working_name)}". Open Legacy Intake to safely finalize or cancel that draft first.`,
    )
  }

  const lifecycleStageId = await initialLifecycleStageId()
  const actor = actorName(req.user)
  const payload = {
    physicalId,
    displayName,
    equipmentTypeId,
    lifecycleStageId,
    directLocationId,
    binId,
    intendedLocationId,
    idMarkingStatus,
    conditionStatus,
    reviewFlag: params.reviewFlag === true,
  }

  try {
    const result = await retoolDb.query(
      `WITH inserted AS (
        INSERT INTO equipment (
          id, physical_id, display_name, equipment_type_id, lifecycle_stage_id,
          manufacturer, model, serial_number, notes, direct_location_id, bin_id,
          purchased_at, purchase_source, purchase_order_id, intended_location_id,
          id_marking_status, condition_status, review_flag, review_reason,
          review_updated_at, proposed_cleanup_note, version
        ) VALUES (
          gen_random_uuid()::text, $1::text, $2::text, $3::text, $4::text,
          $5::text, $6::text, $7::text, $8::text, $9::text, $10::text,
          $11::date, $12::text, $13::text, $14::text,
          $15::text, $16::text, $17::boolean, $18::text,
          CASE WHEN $17::boolean THEN now() ELSE NULL END,
          $19::text, 1
        )
        RETURNING id, version
      ), event AS (
        INSERT INTO equipment_event (
          id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
        )
        SELECT gen_random_uuid()::text, inserted.id, 'REGISTER', now(), now(), $20::text, 'app', $21::text, $22::jsonb, $23::text
        FROM inserted
        RETURNING id
      )
      SELECT inserted.id AS equipment_id, inserted.version, event.id AS event_id
      FROM inserted, event`,
      [
        physicalId, displayName, equipmentTypeId, lifecycleStageId,
        optionalString(params.manufacturer, 'manufacturer', 200),
        optionalString(params.model, 'model', 200),
        optionalString(params.serialNumber, 'serialNumber', 200),
        optionalString(params.notes, 'notes'), directLocationId, binId,
        normalizeDate(params.purchasedAt, 'purchasedAt'),
        optionalString(params.purchaseSource, 'purchaseSource', 200),
        optionalString(params.purchaseOrderId, 'purchaseOrderId', 100),
        intendedLocationId, idMarkingStatus, conditionStatus, params.reviewFlag === true,
        optionalString(params.reviewReason, 'reviewReason', 500),
        optionalString(params.proposedCleanupNote, 'proposedCleanupNote', 2000),
        actor, optionalString(params.notes, 'notes'), jsonValue(payload), idempotencyKey,
      ],
    )
    const row = result.data[0]
    if (!row) throw new Error('Registration failed unexpectedly')
    return { ok: true as const, equipmentId: row.equipment_id, version: row.version, eventId: row.event_id }
  } catch (error) {
    if (isUniqueViolation(error, 'idempotency_key')) {
      const existing = await retoolDb.query(
        `SELECT equipment_id FROM equipment_event WHERE idempotency_key = $1::text`,
        [idempotencyKey],
      )
      const row = existing.data[0]
      if (row?.equipment_id) return { ok: true as const, equipmentId: row.equipment_id, version: null, eventId: null, idempotentReplay: true }
    }
    if (isUniqueViolation(error, 'physical_id')) {
      throw new ValidationError(`A record with physical ID "${physicalId}" already exists`)
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError('Invalid type, location, bin, or intended area reference')
    }
    if (isCheckViolation(error, 'equipment_placement_check') || isCheckViolation(error, 'equipment_one_placement')) {
      throw new ValidationError('Choose either current bin or actual location, not both')
    }
    throw error
  }
}
