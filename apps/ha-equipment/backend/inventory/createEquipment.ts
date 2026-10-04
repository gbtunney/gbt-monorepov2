// Create an equipment record plus its CREATE event atomically in one statement.
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

type Params = {
  physicalId: string
  displayName: string
  equipmentTypeId: string
  lifecycleStageId: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  notes?: string
  directLocationId?: string
  binId?: string
  purchasedAt?: string
  purchaseSource?: string // legacy "bought" column: vendor/source, not a date
  purchaseOrderId?: string // opaque retailer order identifier (Amazon order number etc.)
  ipAddress?: string
  macAddress?: string
  fccId?: string
  feedUrl?: string
  legacyAddedAt?: string // preserved "date added" for eventual legacy import
  idempotencyKey: string
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const physicalId = requireString(params.physicalId, 'physicalId', 100)
  const displayName = requireString(params.displayName, 'displayName', 200)
  const equipmentTypeId = requireUuid(params.equipmentTypeId, 'equipmentTypeId')
  const lifecycleStageId = requireUuid(params.lifecycleStageId, 'lifecycleStageId')
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)
  const manufacturer = optionalString(params.manufacturer, 'manufacturer', 200)
  const model = optionalString(params.model, 'model', 200)
  const serialNumber = optionalString(params.serialNumber, 'serialNumber', 200)
  const notes = optionalString(params.notes, 'notes')
  const directLocationId = optionalUuid(params.directLocationId, 'directLocationId')
  const binId = optionalUuid(params.binId, 'binId')

  if (directLocationId && binId) {
    throw new ValidationError('An item is either in a location or in a bin, not both')
  }

  let purchasedAt: string | null = null
  if (params.purchasedAt) {
    const parsed = new Date(String(params.purchasedAt))
    if (Number.isNaN(parsed.getTime())) throw new ValidationError('purchasedAt is not a valid date')
    purchasedAt = parsed.toISOString().slice(0, 10)
  }

  let legacyAddedAt: string | null = null
  if (params.legacyAddedAt) {
    const parsed = new Date(String(params.legacyAddedAt))
    if (Number.isNaN(parsed.getTime())) throw new ValidationError('legacyAddedAt is not a valid timestamp')
    legacyAddedAt = parsed.toISOString()
  }

  const purchaseSource = optionalString(params.purchaseSource, 'purchaseSource', 200)
  const purchaseOrderId = optionalString(params.purchaseOrderId, 'purchaseOrderId', 100)
  const ipAddress = optionalString(params.ipAddress, 'ipAddress', 100)
  const macAddress = optionalString(params.macAddress, 'macAddress', 100)
  const fccId = optionalString(params.fccId, 'fccId', 100)
  const feedUrl = optionalString(params.feedUrl, 'feedUrl', 500)

  const payload = { physicalId, displayName, directLocationId, binId, purchasedAt, purchaseSource, purchaseOrderId }

  try {
    const result = await retoolDb.query(
      `WITH inserted AS (
        INSERT INTO equipment (
          id, physical_id, display_name, equipment_type_id, lifecycle_stage_id,
          manufacturer, model, serial_number, notes, direct_location_id, bin_id,
          purchased_at, purchase_source, purchase_order_id, ip_address, mac_address, fcc_id, feed_url,
          legacy_added_at, version
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 1
        )
        RETURNING id, version
      ), event AS (
        INSERT INTO equipment_event (
          id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
        )
        SELECT gen_random_uuid()::text, inserted.id, 'CREATE', now(), now(), $19, 'app', $20, $21::jsonb, $22
        FROM inserted
        RETURNING id
      )
      SELECT inserted.id AS equipment_id, inserted.version, event.id AS event_id
      FROM inserted, event`,
      [
        physicalId, displayName, equipmentTypeId, lifecycleStageId,
        manufacturer, model, serialNumber, notes, directLocationId, binId,
        purchasedAt, purchaseSource, purchaseOrderId, ipAddress, macAddress, fccId, feedUrl,
        legacyAddedAt, actorName(req.user), notes, jsonValue(payload), idempotencyKey,
      ],
    )
    const row = result.data[0]
    if (!row) throw new Error('Create failed unexpectedly')
    return { ok: true as const, equipmentId: row.equipment_id, version: row.version, eventId: row.event_id }
  } catch (error) {
    if (isUniqueViolation(error, 'physical_id')) {
      throw new ValidationError(`A record with physical_id "${physicalId}" already exists`)
    }
    if (isUniqueViolation(error, 'idempotency_key')) {
      const existing = await retoolDb.query(
        `SELECT equipment_id FROM equipment_event WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      const row = existing.data[0]
      if (row) return { ok: true as const, equipmentId: row.equipment_id, version: null, eventId: null, idempotentReplay: true }
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError('Invalid type, lifecycle stage, location, or bin reference')
    }
    if (isCheckViolation(error, 'equipment_one_placement')) {
      throw new ValidationError('An item is either in a location or in a bin, not both')
    }
    throw error
  }
}
