// Browse and filter the read-only HA snapshot mirror: areas, devices, entities.
// Filters: HA instance, area, device, domain/platform, search text, linked/unlinked
// (via the explicit ha_entity_link mapping), and current vs stale. Read-only.
type Params = {
  haInstanceId?: string
  areaId?: string
  deviceId?: string
  domain?: string
  search?: string
  linked?: 'all' | 'linked' | 'unlinked'
  current?: 'all' | 'current' | 'stale'
  limit?: number
}

type EntityRow = {
  id: string
  entity_id: string
  ha_device_id: string | null
  area_id: string | null
  domain: string
  friendly_name: string | null
  state: string | null
  unit_of_measurement: string | null
  platform: string | null
  integration: string | null
  labels: unknown
  disabled_by: string | null
  is_current: boolean
  last_seen_at: string | null
  linked_equipment_id: string | null
  linked_equipment_name: string | null
}

type DeviceRow = {
  id: string
  ha_device_id: string
  name: string | null
  name_by_user: string | null
  area_id: string | null
  area_name: string | null
  manufacturer: string | null
  model: string | null
  sw_version: string | null
  labels: unknown
  disabled_by: string | null
  is_current: boolean
  last_seen_at: string | null
  entity_count: number
}

type AreaRow = {
  id: string
  ha_area_id: string
  name: string
  aliases: unknown
  labels: unknown
  is_current: boolean
  last_seen_at: string | null
  device_count: number
  entity_count: number
}

const DEFAULT_LIMIT = 200

export default async function(req: { params: Params }) {
  const params = req.params ?? {}
  const limit = Math.min(Math.max(Number(params.limit ?? DEFAULT_LIMIT), 1), 500)
  const linked = params.linked ?? 'all'
  const current = params.current ?? 'all'
  const search = params.search?.trim() ?? ''
  const searchPattern = search ? `%${search}%` : null

  const entityConditions: string[] = []
  const entityValues: unknown[] = []
  const addEntityCondition = (clause: string, ...clauseValues: unknown[]): void => {
    for (const value of clauseValues) {
      entityValues.push(value)
      clause = clause.replace('?', `$${entityValues.length}::text`)
    }
    entityConditions.push(clause)
  }
  if (params.haInstanceId) addEntityCondition('s.ha_instance_id = ?', params.haInstanceId)
  if (params.areaId) addEntityCondition('s.area_id = ?', params.areaId)
  if (params.deviceId) addEntityCondition('s.ha_device_id = ?', params.deviceId)
  if (params.domain) addEntityCondition('s.domain = ?', params.domain)
  if (searchPattern) {
    addEntityCondition('(s.entity_id ILIKE ? OR s.friendly_name ILIKE ? OR s.domain ILIKE ?)', searchPattern, searchPattern, searchPattern)
  }
  if (current === 'current') addEntityCondition('s.is_current')
  if (current === 'stale') addEntityCondition('NOT s.is_current')
  if (linked === 'linked') addEntityCondition('l.id IS NOT NULL')
  if (linked === 'unlinked') addEntityCondition('l.id IS NULL')
  const entityWhere = entityConditions.length > 0 ? `WHERE ${entityConditions.join(' AND ')}` : ''
  const entityQueryValues = [...entityValues, limit]

  const entitiesResult = await retoolDb.query(
    `SELECT s.id, s.entity_id, s.ha_device_id, s.area_id, s.domain, s.friendly_name, s.state,
      s.unit_of_measurement, s.platform, s.integration, s.labels, s.disabled_by, s.is_current, s.last_seen_at,
      l.equipment_id AS linked_equipment_id, e.display_name AS linked_equipment_name
    FROM ha_entity_snapshot s
    LEFT JOIN ha_entity_link l ON l.entity_id = s.entity_id AND l.active
    LEFT JOIN equipment e ON e.id = l.equipment_id
    ${entityWhere}
    ORDER BY s.is_current DESC, s.domain, s.entity_id
    LIMIT $${entityValues.length + 1}`,
    entityQueryValues,
  )

  const deviceConditions: string[] = []
  const deviceValues: unknown[] = []
  const addDeviceCondition = (clause: string, ...clauseValues: unknown[]): void => {
    for (const value of clauseValues) {
      deviceValues.push(value)
      clause = clause.replace('?', `$${deviceValues.length}::text`)
    }
    deviceConditions.push(clause)
  }
  if (params.haInstanceId) addDeviceCondition('d.ha_instance_id = ?', params.haInstanceId)
  if (params.areaId) addDeviceCondition('d.area_id = ?', params.areaId)
  if (searchPattern) {
    addDeviceCondition('(d.ha_device_id ILIKE ? OR d.name ILIKE ? OR d.name_by_user ILIKE ? OR d.model ILIKE ?)', searchPattern, searchPattern, searchPattern, searchPattern)
  }
  if (current === 'current') addDeviceCondition('d.is_current')
  if (current === 'stale') addDeviceCondition('NOT d.is_current')
  const deviceWhere = deviceConditions.length > 0 ? `WHERE ${deviceConditions.join(' AND ')}` : ''

  const devicesResult = await retoolDb.query(
    `SELECT d.id, d.ha_device_id, d.name, d.name_by_user, d.area_id, a.name AS area_name,
      d.manufacturer, d.model, d.sw_version, d.labels, d.disabled_by, d.is_current, d.last_seen_at,
      (SELECT count(*)::int FROM ha_entity_snapshot es
        WHERE es.ha_instance_id = d.ha_instance_id AND es.ha_device_id = d.ha_device_id) AS entity_count
    FROM ha_device_snapshot d
    LEFT JOIN ha_area_snapshot a ON a.ha_instance_id = d.ha_instance_id AND a.ha_area_id = d.area_id
    ${deviceWhere}
    ORDER BY d.is_current DESC, COALESCE(d.name_by_user, d.name, d.ha_device_id)
    LIMIT $${deviceValues.length + 1}`,
    [...deviceValues, limit],
  )

  const areaConditions: string[] = []
  const areaValues: unknown[] = []
  const addAreaCondition = (clause: string, ...clauseValues: unknown[]): void => {
    for (const value of clauseValues) {
      areaValues.push(value)
      clause = clause.replace('?', `$${areaValues.length}::text`)
    }
    areaConditions.push(clause)
  }
  if (params.haInstanceId) addAreaCondition('a.ha_instance_id = ?', params.haInstanceId)
  if (searchPattern) addAreaCondition('(a.name ILIKE ? OR a.ha_area_id ILIKE ?)', searchPattern, searchPattern)
  if (current === 'current') addAreaCondition('a.is_current')
  if (current === 'stale') addAreaCondition('NOT a.is_current')
  const areaWhere = areaConditions.length > 0 ? `WHERE ${areaConditions.join(' AND ')}` : ''

  const areasResult = await retoolDb.query(
    `SELECT a.id, a.ha_area_id, a.name, a.aliases, a.labels, a.is_current, a.last_seen_at,
      (SELECT count(*)::int FROM ha_device_snapshot ds
        WHERE ds.ha_instance_id = a.ha_instance_id AND ds.area_id = a.ha_area_id) AS device_count,
      (SELECT count(*)::int FROM ha_entity_snapshot es
        WHERE es.ha_instance_id = a.ha_instance_id AND es.area_id = a.ha_area_id) AS entity_count
    FROM ha_area_snapshot a
    ${areaWhere}
    ORDER BY a.is_current DESC, a.name
    LIMIT $${areaValues.length + 1}`,
    [...areaValues, limit],
  )

  return {
    entities: entitiesResult.data as EntityRow[],
    devices: devicesResult.data as DeviceRow[],
    areas: areasResult.data as AreaRow[],
    limit,
  }
}
