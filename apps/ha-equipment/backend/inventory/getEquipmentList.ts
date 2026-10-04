// Server-side equipment list with search, filters, and pagination.
import { LOCATION_TREE_CTE } from './locationReadModel'

type Params = {
  q?: string
  typeId?: string
  stageId?: string
  locationId?: string
  binId?: string
  unresolvedOnly?: boolean
  includeArchived?: boolean
  limit?: number
  offset?: number
}

const BASE_FROM = `
FROM equipment e
JOIN equipment_type t ON t.id = e.equipment_type_id
JOIN lifecycle_stage s ON s.id = e.lifecycle_stage_id
LEFT JOIN bin b ON b.id = e.bin_id
LEFT JOIN loc_read_model loc ON loc.id = e.direct_location_id
LEFT JOIN loc_read_model eff ON eff.id = COALESCE(b.location_id, e.direct_location_id)`

export default async function(req: { params: Params }) {
  const params = req.params ?? {}
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 1), 200)
  const offset = Math.max(Number(params.offset ?? 0), 0)

  const conditions: string[] = []
  const values: unknown[] = []
  // The SQL driver maps placeholders by occurrence, so every $N needs its own bound value.
  const add = (clause: string, ...clauseValues: unknown[]): void => {
    for (const value of clauseValues) {
      values.push(value)
      clause = clause.replace('$N', `$${values.length}`)
    }
    conditions.push(clause)
  }

  if (!params.includeArchived) conditions.push('e.archived_at IS NULL')
  if (params.q && String(params.q).trim().length > 0) {
    const pattern = `%${String(params.q).trim()}%`
    add(`(e.display_name ILIKE $N OR e.physical_id ILIKE $N OR e.manufacturer ILIKE $N OR e.model ILIKE $N)`, pattern, pattern, pattern, pattern)
  }
  if (params.typeId) add('e.equipment_type_id = $N', String(params.typeId))
  if (params.stageId) add('e.lifecycle_stage_id = $N', String(params.stageId))
  if (params.binId) add('e.bin_id = $N', String(params.binId))
  if (params.locationId) add('COALESCE(b.location_id, e.direct_location_id) = $N', String(params.locationId))
  if (params.unresolvedOnly) {
    conditions.push(`EXISTS (
      SELECT 1 FROM audit_finding f
      WHERE f.equipment_id = e.id
        AND f.status IN ('open', 'acknowledged')
        AND (f.snoozed_until IS NULL OR f.snoozed_until < now())
    )`)
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
  const listValues = [...values, limit, offset]

  const rows = await retoolDb.query(
    `${LOCATION_TREE_CTE}
    SELECT e.id, e.physical_id, e.display_name, e.manufacturer, e.model, e.version,
      t.name AS type_name, s.name AS stage_name, s.code AS stage_code, s.expects_online,
      e.bin_id, b.name AS bin_name, b.bin_code,
      loc.id AS direct_location_id, loc.name AS direct_location_name, loc.path AS direct_location_path,
      eff.id AS effective_location_id, eff.name AS effective_location_name,
      eff.parent_name AS effective_parent_name, eff.path AS effective_location_path,
      eff.ha_label_id AS effective_ha_label_id, eff.effective_ha_area_id,
      (SELECT count(*)::int FROM audit_finding f WHERE f.equipment_id = e.id
        AND f.status IN ('open','acknowledged') AND (f.snoozed_until IS NULL OR f.snoozed_until < now())) AS open_issues,
      (SELECT count(*)::int FROM ha_entity_link l WHERE l.equipment_id = e.id AND l.active) AS link_count
    ${BASE_FROM}${where}
    ORDER BY e.display_name ASC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues,
  )

  const countResult = await retoolDb.query(`${LOCATION_TREE_CTE}
    SELECT count(*)::int AS total ${BASE_FROM}${where}`, values)

  return {
    items: rows.data,
    total: countResult.data[0]?.total ?? 0,
    limit,
    offset,
  }
}
