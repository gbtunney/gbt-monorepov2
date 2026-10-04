import { LOCATION_TREE_CTE } from './locationReadModel'

type Params = {
  limit?: number
  filter?: 'all' | 'manual' | 'condition' | 'whereabouts' | 'ha' | 'unavailable' | 'followup' | 'needs_battery_change' | 'needs_testing' | 'temporary_removed'
  sort?: 'default' | 'oldest_battery' | 'oldest_testing' | 'oldest_removed'
}

type NeedsCheckingRow = Record<string, unknown> & {
  id: string
  review_flag: boolean
  review_reason: string | null
  condition_status: string
  bin_name: string | null
  effective_location_path: string | null
  direct_location_path: string | null
  intended_location_path: string | null
  link_count: number
  findings: Array<Record<string, unknown>> | null
  followup_tasks: Array<Record<string, unknown>> | null
  active_removals: Array<Record<string, unknown>> | null
}

async function hasTable(tableName: string): Promise<boolean> {
  const result = await retoolDb.query(`SELECT to_regclass($1::text) AS table_name`, [`public.${tableName}`])
  return Boolean(result.data[0]?.table_name)
}

export default async function(req: { params: Params }) {
  const limit = Math.min(Math.max(Number(req.params?.limit ?? 200), 1), 500)
  const filter = req.params?.filter ?? 'all'
  const sort = req.params?.sort ?? 'default'

  const rowsResult = await retoolDb.query(
    `${LOCATION_TREE_CTE}, relevant_findings AS (
      SELECT f.*
      FROM audit_finding f
      WHERE f.status IN ('open', 'acknowledged', 'snoozed')
        AND (
          f.category IN ('ha', 'ha_registry', 'discovery', 'registry', 'home_assistant')
          OR f.title ILIKE '%HA%'
          OR f.title ILIKE '%Home Assistant%'
          OR COALESCE(f.explanation, '') ILIKE '%HA%'
          OR COALESCE(f.explanation, '') ILIKE '%Home Assistant%'
          OR f.fingerprint ILIKE '%ha%'
        )
    ), checklist AS (
      SELECT equipment_id,
        count(*) FILTER (WHERE status = 'done')::int AS done_count,
        count(*) FILTER (WHERE status = 'not_applicable')::int AS not_applicable_count,
        count(*) FILTER (WHERE status IN ('todo', 'unknown'))::int AS pending_count,
        jsonb_object_agg(step_key, jsonb_build_object('status', status, 'note', note, 'changed_at', changed_at)) AS steps
      FROM installation_checklist_item
      GROUP BY equipment_id
    ), open_tasks AS (
      SELECT equipment_id,
        jsonb_agg(jsonb_build_object(
          'id', id,
          'task_type', task_type,
          'status', status,
          'note', note,
          'due_at', due_at,
          'created_at', created_at,
          'created_by', created_by,
          'age_days', floor(extract(epoch from (now() - created_at)) / 86400)::int
        ) ORDER BY created_at ASC) AS tasks,
        min(created_at) FILTER (WHERE task_type = 'needs_battery_change') AS oldest_battery_at,
        min(created_at) FILTER (WHERE task_type = 'needs_testing') AS oldest_testing_at,
        count(*)::int AS open_task_count
      FROM equipment_followup_task
      WHERE status = 'open'
      GROUP BY equipment_id
    ), active_removals AS (
      SELECT r.equipment_id,
        jsonb_agg(jsonb_build_object(
          'id', r.id,
          'removal_type', r.removal_type,
          'removed_at', r.removed_at,
          'reason', r.reason,
          'duration_days', floor(extract(epoch from (now() - r.removed_at)) / 86400)::int,
          'original_location_path', original_lr.path,
          'original_bin_name', original_bin.name,
          'custody_location_path', custody_lr.path,
          'custody_bin_name', custody_bin.name,
          'custody_unknown', r.custody_unknown
        ) ORDER BY r.removed_at ASC) AS removals,
        min(r.removed_at) FILTER (WHERE r.removal_type = 'temporary') AS oldest_temporary_removed_at,
        count(*) FILTER (WHERE r.removal_type = 'temporary')::int AS temporary_count
      FROM equipment_removal_record r
      LEFT JOIN loc_read_model original_lr ON original_lr.id = r.original_direct_location_id
      LEFT JOIN bin original_bin ON original_bin.id = r.original_bin_id
      LEFT JOIN loc_read_model custody_lr ON custody_lr.id = r.custody_location_id
      LEFT JOIN bin custody_bin ON custody_bin.id = r.custody_bin_id
      WHERE r.returned_at IS NULL
      GROUP BY r.equipment_id
    )
    SELECT e.id, e.physical_id, e.display_name, e.version,
      t.name AS type_name, s.name AS stage_name, s.code AS stage_code, s.expects_online,
      e.condition_status, e.review_flag, e.review_reason, e.review_updated_at, e.proposed_cleanup_note,
      e.id_marking_status,
      e.bin_id, b.name AS bin_name, b.bin_code,
      direct_lr.path AS direct_location_path,
      eff_lr.path AS effective_location_path,
      intended_lr.path AS intended_location_path,
      COALESCE(c.done_count, 0)::int AS checklist_done_count,
      COALESCE(c.not_applicable_count, 0)::int AS checklist_not_applicable_count,
      COALESCE(c.pending_count, 5)::int AS checklist_pending_count,
      COALESCE(c.steps, '{}'::jsonb) AS checklist_steps,
      (SELECT count(*)::int FROM ha_entity_link l WHERE l.equipment_id = e.id AND l.active) AS link_count,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', f.id, 'category', f.category, 'severity', f.severity,
          'title', f.title, 'explanation', f.explanation, 'status', f.status, 'last_seen_at', f.last_seen_at
        ) ORDER BY f.severity, f.title)
        FROM relevant_findings f WHERE f.equipment_id = e.id
      ), '[]'::jsonb) AS findings,
      COALESCE(ot.tasks, '[]'::jsonb) AS followup_tasks,
      COALESCE(ar.removals, '[]'::jsonb) AS active_removals,
      ot.oldest_battery_at,
      ot.oldest_testing_at,
      ar.oldest_temporary_removed_at,
      COALESCE(ot.open_task_count, 0)::int AS open_task_count,
      COALESCE(ar.temporary_count, 0)::int AS temporary_removal_count
    FROM equipment e
    JOIN equipment_type t ON t.id = e.equipment_type_id
    JOIN lifecycle_stage s ON s.id = e.lifecycle_stage_id
    LEFT JOIN bin b ON b.id = e.bin_id
    LEFT JOIN loc_read_model direct_lr ON direct_lr.id = e.direct_location_id
    LEFT JOIN loc_read_model eff_lr ON eff_lr.id = COALESCE(b.location_id, e.direct_location_id)
    LEFT JOIN loc_read_model intended_lr ON intended_lr.id = e.intended_location_id
    LEFT JOIN checklist c ON c.equipment_id = e.id
    LEFT JOIN open_tasks ot ON ot.equipment_id = e.id
    LEFT JOIN active_removals ar ON ar.equipment_id = e.id
    WHERE e.archived_at IS NULL
      AND (
        e.review_flag = true
        OR e.condition_status IN ('needs_testing', 'confirmed_broken')
        OR COALESCE(ot.open_task_count, 0) > 0
        OR COALESCE(ar.temporary_count, 0) > 0
        OR EXISTS (SELECT 1 FROM relevant_findings f WHERE f.equipment_id = e.id)
      )
    ORDER BY
      e.review_flag DESC,
      CASE e.condition_status WHEN 'confirmed_broken' THEN 0 WHEN 'needs_testing' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END,
      e.display_name
    LIMIT $1::int`,
    [limit],
  )
  const rows = rowsResult.data as NeedsCheckingRow[]

  const snapshotAvailable = await hasTable('ha_entity_snapshot')
  let haEvidenceByEquipment: Record<string, Array<Record<string, unknown>>> = {}
  if (snapshotAvailable && rows.length > 0) {
    const equipmentIds = rows.map((row) => String(row.id))
    const evidenceResult = await retoolDb.query(
      `SELECT l.equipment_id,
        jsonb_agg(jsonb_build_object(
          'entity_id', l.entity_id, 'role', l.role, 'integration', l.integration,
          'state', s.state, 'domain', s.domain, 'is_current', s.is_current,
          'last_seen_at', s.last_seen_at, 'friendly_name', s.friendly_name
        ) ORDER BY l.entity_id) AS evidence
      FROM ha_entity_link l
      LEFT JOIN ha_entity_snapshot s ON s.entity_id = l.entity_id AND s.ha_instance_id = l.ha_instance_id
      WHERE l.active AND l.equipment_id = ANY($1::text[])
      GROUP BY l.equipment_id`,
      [equipmentIds],
    )
    haEvidenceByEquipment = Object.fromEntries(
      evidenceResult.data.map((row: Record<string, unknown>) => [String(row['equipment_id']), row['evidence'] as Array<Record<string, unknown>>]),
    )
  }

  const items = rows.map((row) => {
    const findings = Array.isArray(row.findings) ? row.findings : []
    const tasks = Array.isArray(row.followup_tasks) ? row.followup_tasks : []
    const removals = Array.isArray(row.active_removals) ? row.active_removals : []
    const haEvidence = haEvidenceByEquipment[row.id] ?? []
    const unavailableLinks = haEvidence.filter((link) => String(link['state'] ?? '').toLowerCase() === 'unavailable')
    const offlineLinks = haEvidence.filter((link) => String(link['state'] ?? '').toLowerCase() === 'offline')
    const sleepyBatteryLinks = unavailableLinks.filter((link) => {
      const entity = String(link['entity_id'] ?? '').toLowerCase()
      const role = String(link['role'] ?? '').toLowerCase()
      const domain = String(link['domain'] ?? '').toLowerCase()
      return role.includes('battery') || entity.includes('battery') || domain === 'sensor'
    })
    const reasons: string[] = []
    if (row.review_flag) reasons.push(row.review_reason ? `Flagged: ${row.review_reason}` : 'Manually flagged for review')
    if (row.condition_status === 'needs_testing') reasons.push('Condition: needs testing')
    if (row.condition_status === 'confirmed_broken') reasons.push('Condition: confirmed broken')
    for (const task of tasks) reasons.push(`Follow-up: ${String(task['task_type'] ?? '').replace(/_/g, ' ')}`)
    for (const removal of removals) reasons.push(`${String(removal['removal_type'] ?? 'temporary')} removal awaiting return · ${removal['duration_days'] ?? 0}d`)
    for (const finding of findings) reasons.push(`Audit: ${String(finding['title'] ?? 'Finding')}`)
    if (!row.bin_name && !row.effective_location_path) reasons.push('Physical whereabouts unknown')
    if (row.link_count === 0 && findings.some((finding) => String(finding['title'] ?? '').toLowerCase().includes('ha'))) {
      reasons.push('Missing confirmed HA registry link')
    }
    if (offlineLinks.length > 0) reasons.push(`${offlineLinks.length} linked HA entity${offlineLinks.length === 1 ? '' : 'ies'} offline`)
    if (unavailableLinks.length > 0) reasons.push(`${unavailableLinks.length} linked HA entity${unavailableLinks.length === 1 ? '' : 'ies'} unavailable; not automatically broken`)
    if (sleepyBatteryLinks.length > 0) reasons.push(`${sleepyBatteryLinks.length} battery/sleepy HA signal${sleepyBatteryLinks.length === 1 ? '' : 's'} need context`)

    return {
      ...row,
      reasons,
      physicalWhereabouts: row.bin_name ? 'bin' : row.effective_location_path ? 'located' : 'unknown',
      registryLinkStatus: row.link_count > 0 ? 'linked' : 'not_confirmed',
      haAvailabilityStatus: offlineLinks.length > 0 ? 'offline' : unavailableLinks.length > 0 ? 'unavailable' : haEvidence.length > 0 ? 'has_snapshot_evidence' : 'unknown',
      sleepyBatteryCount: sleepyBatteryLinks.length,
      haEvidence,
    }
  }).filter((row) => {
    if (filter === 'unavailable') return row.haAvailabilityStatus === 'offline' || row.haAvailabilityStatus === 'unavailable'
    if (filter === 'manual') return row.review_flag === true
    if (filter === 'condition') return row.condition_status === 'needs_testing' || row.condition_status === 'confirmed_broken'
    if (filter === 'whereabouts') return row.physicalWhereabouts === 'unknown'
    if (filter === 'ha') return findingsForRow(row).length > 0
    if (filter === 'followup') return tasksForRow(row).length > 0
    if (filter === 'needs_battery_change') return tasksForRow(row).some((task) => String(task['task_type']) === 'needs_battery_change')
    if (filter === 'needs_testing') return tasksForRow(row).some((task) => String(task['task_type']) === 'needs_testing')
    if (filter === 'temporary_removed') return removalsForRow(row).some((removal) => String(removal['removal_type']) === 'temporary')
    return true
  }).sort((a, b) => compareNeedsRows(a, b, sort))

  return { items, total: items.length, snapshotAvailable }
}

function tasksForRow(row: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(row['followup_tasks']) ? row['followup_tasks'] as Array<Record<string, unknown>> : []
}

function removalsForRow(row: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(row['active_removals']) ? row['active_removals'] as Array<Record<string, unknown>> : []
}

function findingsForRow(row: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(row['findings']) ? row['findings'] as Array<Record<string, unknown>> : []
}

function oldestDateMs(values: Array<Record<string, unknown>>, key: string, type?: string): number {
  let min = Number.POSITIVE_INFINITY
  for (const value of values) {
    if (type && String(value['task_type'] ?? value['removal_type'] ?? '') !== type) continue
    const raw = value[key]
    if (!raw) continue
    const ms = new Date(String(raw)).getTime()
    if (Number.isFinite(ms) && ms < min) min = ms
  }
  return min
}

function compareNeedsRows(a: Record<string, unknown>, b: Record<string, unknown>, sort: string): number {
  if (sort === 'oldest_battery') return oldestDateMs(tasksForRow(a), 'created_at', 'needs_battery_change') - oldestDateMs(tasksForRow(b), 'created_at', 'needs_battery_change')
  if (sort === 'oldest_testing') return oldestDateMs(tasksForRow(a), 'created_at', 'needs_testing') - oldestDateMs(tasksForRow(b), 'created_at', 'needs_testing')
  if (sort === 'oldest_removed') return oldestDateMs(removalsForRow(a), 'removed_at', 'temporary') - oldestDateMs(removalsForRow(b), 'removed_at', 'temporary')
  return 0
}
