// Bin commands: create, move (location change), rename, and the explicit physical audit.
// Bin moves and audits are append-only events; opening a bin never marks contents verified
// automatically — only an explicit confirm_contents command does.
import {
  actorName,
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

type Params = {
  command: 'create' | 'move' | 'rename' | 'confirm_contents' | 'archive'
  binId?: string
  binCode?: string
  name?: string
  newLocationId?: string
  notes?: string
  occurredAt?: string
  idempotencyKey: string
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const command = params.command
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)
  const actor = actorName(req.user)
  const occurredAt = occurredAtOrNow(params.occurredAt)
  const notes = optionalString(params.notes, 'notes')

  if (command === 'create') {
    const binCode = requireString(params.binCode, 'binCode', 100)
    const name = requireString(params.name, 'name', 200)
    const locationId = optionalUuid(params.newLocationId, 'newLocationId')
    try {
      const result = await retoolDb.query(
        `WITH inserted AS (
          INSERT INTO bin (id, bin_code, name, location_id, notes)
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
          RETURNING id
        ), event AS (
          INSERT INTO bin_event (id, bin_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          SELECT gen_random_uuid()::text, inserted.id, 'CREATE', now(), now(), $5, 'app', $6, $7::jsonb, $8
          FROM inserted
          RETURNING id
        )
        SELECT inserted.id AS bin_id, event.id AS event_id FROM inserted, event`,
        [binCode, name, locationId, optionalString(params.notes, 'notes'), actor, null, jsonValue({ binCode, name }), idempotencyKey],
      )
      const row = result.data[0]
      if (!row) throw new Error('Create bin failed unexpectedly')
      return { ok: true as const, binId: row.bin_id, eventId: row.event_id }
    } catch (error) {
      if (isUniqueViolation(error, 'bin_code')) {
        throw new ValidationError(`Bin code "${binCode}" is already registered`)
      }
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(`SELECT bin_id FROM bin_event WHERE idempotency_key = $1`, [idempotencyKey])
        const row = existing.data[0]
        if (row) return { ok: true as const, binId: row.bin_id, eventId: null, idempotentReplay: true }
      }
      throw error
    }
  }

  const binId = requireUuid(params.binId, 'binId')
  const binRows = await retoolDb.query(
    `SELECT id, bin_code, name, location_id FROM bin WHERE id = $1`,
    [binId],
  )
  const bin = binRows.data[0]
  if (!bin) throw new ValidationError('Bin not found')

  if (command === 'move') {
    const newLocationId = optionalUuid(params.newLocationId, 'newLocationId')
    if ((newLocationId ?? null) === (bin.location_id ?? null)) {
      return { ok: true as const, noOp: true }
    }
    await retoolDb.query(
      `WITH updated AS (
        UPDATE bin SET location_id = $1, updated_at = now() WHERE id = $2
        RETURNING id
      ), event AS (
        INSERT INTO bin_event (id, bin_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
        SELECT gen_random_uuid()::text, updated.id, 'BIN_MOVE', $3, now(), $4, 'app', $5, $6::jsonb, $7
        FROM updated
        RETURNING id
      )
      SELECT event.id AS event_id FROM updated, event`,
      [
        newLocationId, binId, occurredAt, actor, notes ?? null,
        jsonValue({ fromLocationId: bin.location_id ?? null, toLocationId: newLocationId }),
        idempotencyKey,
      ],
    )
    return { ok: true as const, noOp: false }
  }

  if (command === 'rename') {
    const name = requireString(params.name, 'name', 200)
    await retoolDb.query(
      `WITH updated AS (
        UPDATE bin SET name = $1, updated_at = now() WHERE id = $2
        RETURNING id
      ), event AS (
        INSERT INTO bin_event (id, bin_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
        SELECT gen_random_uuid()::text, updated.id, 'RENAME', $3, now(), $4, 'app', $5, $6::jsonb, $7
        FROM updated
        RETURNING id
      )
      SELECT event.id AS event_id FROM updated, event`,
      [name, binId, occurredAt, actor, notes ?? null, jsonValue({ fromName: bin.name, toName: name }), idempotencyKey],
    )
    return { ok: true as const, noOp: false }
  }

  if (command === 'archive') {
    await retoolDb.query(
      `WITH updated AS (
        UPDATE bin SET archived_at = now(), updated_at = now() WHERE id = $1 AND archived_at IS NULL
        RETURNING id
      ), event AS (
        INSERT INTO bin_event (id, bin_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
        SELECT gen_random_uuid()::text, updated.id, 'ARCHIVE', $2, now(), $3, 'app', $4, $5::jsonb, $6
        FROM updated
        RETURNING id
      )
      SELECT event.id AS event_id FROM updated, event`,
      [binId, occurredAt, actor, notes ?? null, jsonValue({}), idempotencyKey],
    )
    return { ok: true as const, noOp: false }
  }

  // confirm_contents: dated physical audit on the bin plus one AUDIT event per contained item.
  if (command === 'confirm_contents') {
    const contents = await retoolDb.query(
      `SELECT id, display_name, physical_id FROM equipment WHERE bin_id = $1 AND archived_at IS NULL`,
      [binId],
    )
    const items = contents.data.map((item) => ({ id: item.id, name: item.display_name, physicalId: item.physical_id }))
    try {
      const result = await retoolDb.query(
        `WITH bin_ev AS (
          INSERT INTO bin_event (id, bin_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key)
          VALUES (gen_random_uuid()::text, $1, 'PHYSICAL_AUDIT', $2, now(), $3, 'app', $4, $5::jsonb, $6)
          RETURNING id
        ), item_ev AS (
          INSERT INTO equipment_event (
            id, equipment_id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json, idempotency_key
          )
          SELECT gen_random_uuid()::text, e.id, 'AUDIT', $7, now(), $8, 'app', $9,
            jsonb_build_object('binId', $10, 'binCode', $11, 'auditEventId', (SELECT id FROM bin_ev)), $12 || ':' || e.id
          FROM equipment e
          WHERE e.bin_id = $13 AND e.archived_at IS NULL
          RETURNING id
        )
        SELECT (SELECT id FROM bin_ev) AS bin_event_id, count(item_ev.id)::int AS item_event_count FROM bin_ev, item_ev`,
        [binId, occurredAt, actor, notes ?? null, jsonValue({ items }), idempotencyKey,
          occurredAt, actor, 'Contents confirmed in bin', binId, bin.bin_code, idempotencyKey, binId],
      )
      const row = result.data[0]
      return { ok: true as const, binEventId: row?.bin_event_id ?? null, itemEventCount: row?.item_event_count ?? 0 }
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await retoolDb.query(
          `SELECT id FROM bin_event WHERE idempotency_key = $1`,
          [idempotencyKey],
        )
        const row = existing.data[0]
        if (row) return { ok: true as const, binEventId: row.id, itemEventCount: null, idempotentReplay: true }
      }
      throw error
    }
  }

  throw new ValidationError(`Unknown bin command "${command}"`)
}
