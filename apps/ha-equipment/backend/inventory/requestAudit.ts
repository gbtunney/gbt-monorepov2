// Queue an audit request. Without a connected external runner this only records the request —
// it must never fabricate a completed audit.
import { actorName, optionalString, requireIdempotencyKey } from './shared'

type Params = {
  scope?: Record<string, unknown>
  notes?: string
  idempotencyKey: string
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)
  const scope = params.scope && typeof params.scope === 'object' ? params.scope : {}
  const notes = optionalString(params.notes, 'notes', 2000)

  try {
    const result = await retoolDb.query(
      `INSERT INTO audit_run (id, source, scope, status, requested_at, summary, idempotency_key)
      VALUES (gen_random_uuid()::text, 'manual_request', $1::jsonb, 'requested', now(), $2, $3)
      RETURNING id, status, requested_at`,
      [JSON.stringify(scope), notes ?? `Audit requested by ${actorName(req.user)} — awaiting external runner`, idempotencyKey],
    )
    const row = result.data[0]
    return {
      ok: true as const,
      runId: row?.id ?? null,
      status: row?.status ?? 'requested',
      awaitingExternalRunner: true,
      idempotencyKey,
      message:
        'Audit request queued. This app has no connected HA collection runner, so the request waits for the external assistant/runner to submit a snapshot. No audit results have been produced.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('uq_audit_run_idem') || (message.includes('duplicate key') && message.includes('idempotency_key'))) {
      const existing = await retoolDb.query(`SELECT id, status FROM audit_run WHERE idempotency_key = $1`, [idempotencyKey])
      const row = existing.data[0]
      return { ok: true as const, runId: row?.id ?? null, status: row?.status ?? 'requested', awaitingExternalRunner: true, idempotentReplay: true, idempotencyKey }
    }
    throw error
  }
}
