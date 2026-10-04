// Audit inbox: findings grouped for review plus run history and the latest successful audit time.
export default async function() {
  const [findings, runs, counts, links] = await Promise.all([
    retoolDb.query(
      `SELECT f.id, f.audit_run_id, f.equipment_id, f.entity_id, f.category, f.severity, f.confidence,
        f.title, f.explanation, f.evidence_json, f.suggested_action, f.fingerprint,
        f.first_seen_at, f.last_seen_at, f.status, f.snoozed_until, f.resolution_note,
        e.display_name AS equipment_name, e.physical_id AS equipment_physical_id
      FROM audit_finding f
      LEFT JOIN equipment e ON e.id = f.equipment_id
      WHERE f.status IN ('open', 'acknowledged', 'snoozed')
        AND (f.snoozed_until IS NULL OR f.snoozed_until < now())
      ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        f.last_seen_at DESC
      LIMIT 200`,
    ),
    retoolDb.query(
      `SELECT id, source, status, requested_at, started_at, completed_at, snapshot_at, coverage, missing_data, summary, error
      FROM audit_run ORDER BY requested_at DESC LIMIT 10`,
    ),
    retoolDb.query(
      `SELECT severity, count(*)::int AS n FROM audit_finding
      WHERE status IN ('open', 'acknowledged') GROUP BY severity`,
    ),
    retoolDb.query(
      `SELECT count(*)::int AS active_links, count(DISTINCT equipment_id)::int AS linked_equipment
      FROM ha_entity_link WHERE active`,
    ),
  ])

  const severityCounts: Record<string, number> = { critical: 0, error: 0, warning: 0, info: 0 }
  for (const row of counts.data) {
    severityCounts[String(row.severity)] = Number(row.n)
  }
  const latestCompleted = runs.data.find((run) => run.status === 'completed' || run.status === 'partial')

  return {
    findings: findings.data,
    runs: runs.data,
    severityCounts,
    latestCompletedRunAt: latestCompleted?.completed_at ?? null,
    activeLinks: links.data[0]?.active_links ?? 0,
    linkedEquipment: links.data[0]?.linked_equipment ?? 0,
  }
}
