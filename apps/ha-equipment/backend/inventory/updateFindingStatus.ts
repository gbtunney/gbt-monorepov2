// Finding status change (acknowledge / snooze / resolve / ignore / reopen) with retained history.
import { actorName, optionalString, requireString, requireUuid, ValidationError } from './shared'

type Params = {
  findingId: string
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved' | 'ignored'
  note?: string
  snoozedUntil?: string
}

const VALID_STATUSES = new Set(['open', 'acknowledged', 'snoozed', 'resolved', 'ignored'])

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const findingId = requireUuid(params.findingId, 'findingId')
  const status = requireString(params.status, 'status')
  if (!VALID_STATUSES.has(status)) throw new ValidationError(`Invalid status "${status}"`)
  const note = optionalString(params.note, 'note', 2000)
  const actor = actorName(req.user)

  let snoozedUntil: string | null = null
  if (status === 'snoozed') {
    if (!params.snoozedUntil) throw new ValidationError('snoozedUntil is required when snoozing')
    const parsed = new Date(String(params.snoozedUntil))
    if (Number.isNaN(parsed.getTime())) throw new ValidationError('snoozedUntil is not a valid timestamp')
    snoozedUntil = parsed.toISOString()
  }

  const existing = await retoolDb.query(`SELECT id, status FROM audit_finding WHERE id = $1`, [findingId])
  const current = existing.data[0]
  if (!current) throw new ValidationError('Finding not found')

  const result = await retoolDb.query(
    `WITH updated AS (
      UPDATE audit_finding
      SET status = $1, snoozed_until = $2, resolution_note = COALESCE($3, resolution_note), updated_at = now()
      WHERE id = $4
      RETURNING id, status
    ), history AS (
      INSERT INTO finding_status_history (id, finding_id, from_status, to_status, actor, note)
      SELECT gen_random_uuid()::text, updated.id, $5, updated.status, $6, $7
      FROM updated
      RETURNING id
    )
    SELECT updated.status FROM updated, history`,
    [status, snoozedUntil, note, findingId, String(current.status), actor, note],
  )
  const row = result.data[0]
  if (!row) throw new ValidationError('Finding not found')
  return { ok: true as const, status: row.status }
}
