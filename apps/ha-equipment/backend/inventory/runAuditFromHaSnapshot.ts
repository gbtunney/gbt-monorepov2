// Runs the existing snapshot audit derivation over the CURRENT stored HA snapshot mirror
// (read-only). This replays already-imported data — it does NOT contact Home Assistant and
// is not a live audit. Defaults to linked entities only so unlinked registry rows never
// flood the inbox with noise.
import ingestAuditSnapshot from './ingestAuditSnapshot'

type Params = {
  haInstanceId?: string
  allEntities?: boolean // default false: linked entities only
}

export default async function(req: { params: Params; user: User }) {
  const allEntities = req.params?.allEntities === true

  const latestRun = await retoolDb.query(
    `SELECT id, ha_instance_id, snapshot_at FROM ha_snapshot_run ORDER BY imported_at DESC LIMIT 1`,
  )
  const latest = latestRun.data[0]
  if (!latest) throw new Error('No HA snapshot has been imported yet. Import a snapshot JSON first.')

  const haInstanceId = req.params?.haInstanceId ? String(req.params.haInstanceId) : String(latest.ha_instance_id)

  const linkedFilter = allEntities
    ? ''
    : 'AND EXISTS (SELECT 1 FROM ha_entity_link l WHERE l.entity_id = s.entity_id AND l.active)'

  const entitiesResult = await retoolDb.query(
    `SELECT s.entity_id, s.state, s.attributes_json, s.integration, s.last_seen_at
    FROM ha_entity_snapshot s
    WHERE s.ha_instance_id = $1::text AND s.is_current AND s.state IS NOT NULL ${linkedFilter}
    ORDER BY s.entity_id`,
    [haInstanceId],
  )

  const entities = entitiesResult.data.map((row: Record<string, unknown>) => ({
    entityId: String(row['entity_id']),
    state: String(row['state'] ?? ''),
    lastChanged: row['last_seen_at'] ? String(row['last_seen_at']) : undefined,
    attributes: (row['attributes_json'] ?? {}) as Record<string, unknown>,
    integration: row['integration'] ? String(row['integration']) : undefined,
  }))

  if (entities.length === 0) {
    return {
      ok: true as const,
      ran: false as const,
      message: 'No current snapshot entities matched this scope; nothing was audited.',
      haInstanceId,
      sourceSnapshotAt: latest.snapshot_at ? String(latest.snapshot_at) : null,
    }
  }

  // Reuse the existing derivation/finding pipeline verbatim — no new finding logic here.
  const result = await ingestAuditSnapshot({
    params: {
      source: 'ha_snapshot_replay',
      snapshotAt: latest.snapshot_at ? String(latest.snapshot_at) : undefined,
      scope: { kind: 'ha_snapshot_replay', haInstanceId, allEntities },
      entities,
      idempotencyKey: `ha_snapshot_replay:${String(latest.id)}`,
    },
    user: req.user,
  })

  return {
    ok: true as const,
    ran: true as const,
    haInstanceId,
    sourceSnapshotAt: latest.snapshot_at ? String(latest.snapshot_at) : null,
    entitiesAudited: entities.length,
    audit: result,
    note: 'Audited the stored snapshot only — no live HA connection. Linked entities were derived from the existing snapshot ingestion rules.',
  }
}
