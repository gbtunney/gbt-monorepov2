// Deterministic link suggestions for one equipment record: snapshot entities whose IDs,
// device IDs, or friendly names contain the equipment's physical_id token, or whose
// friendly name exactly matches the display name, minus already-linked entities.
// Deliberately NOT fuzzy — nothing is auto-linked here.
type Params = { equipmentId: string }

type SuggestionRow = {
  entity_id: string
  ha_device_id: string | null
  area_id: string | null
  domain: string
  platform: string | null
  integration: string | null
  friendly_name: string | null
  state: string | null
  match_reason: string
}

export default async function(req: { params: Params }) {
  const equipmentId = String(req.params?.equipmentId ?? '')
  if (!equipmentId) throw new Error('equipmentId is required')

  const equipmentResult = await retoolDb.query(
    `SELECT id, physical_id, display_name FROM equipment WHERE id = $1::text`,
    [equipmentId],
  )
  const equipment = equipmentResult.data[0]
  if (!equipment) throw new Error('Equipment not found')

  // Latest imported snapshot defines which HA instance we suggest from.
  const latestRun = await retoolDb.query(
    `SELECT ha_instance_id FROM ha_snapshot_run ORDER BY imported_at DESC LIMIT 1`,
  )
  const haInstanceId = latestRun.data[0]?.ha_instance_id ? String(latestRun.data[0].ha_instance_id) : null
  if (!haInstanceId) {
    return { equipmentId, physicalId: String(equipment.physical_id), suggestions: [], note: 'No HA snapshot imported yet.' }
  }

  // Deterministic tokens: the physical_id itself plus its underscore/dash segments (length >= 3).
  const tokens = new Set<string>()
  const physicalId = String(equipment.physical_id).toLowerCase()
  tokens.add(physicalId)
  for (const segment of physicalId.split(/[_\-\s]+/)) {
    if (segment.length >= 3) tokens.add(segment)
  }
  const displayName = String(equipment.display_name).trim().toLowerCase()

  const candidates = await retoolDb.query(
    `SELECT s.entity_id, s.ha_device_id, s.area_id, s.domain, s.platform, s.integration,
      s.friendly_name, s.state
    FROM ha_entity_snapshot s
    LEFT JOIN ha_entity_link l ON l.entity_id = s.entity_id AND l.active
    WHERE s.is_current AND s.ha_instance_id = $1::text AND l.id IS NULL`,
    [haInstanceId],
  )

  const suggestions: SuggestionRow[] = []
  for (const row of candidates.data) {
    const entityId = String(row.entity_id).toLowerCase()
    const deviceId = row.ha_device_id ? String(row.ha_device_id).toLowerCase() : null
    const friendlyName = row.friendly_name ? String(row.friendly_name).toLowerCase() : null
    let matchReason: string | null = null
    if (deviceId && tokens.has(deviceId)) matchReason = `device id matches ${String(equipment.physical_id)}`
    else if (tokens.has(entityId)) matchReason = `entity id matches ${String(equipment.physical_id)}`
    else {
      for (const token of tokens) {
        if (entityId.includes(token)) { matchReason = `entity id contains "${token}"`; break }
      }
    }
    if (!matchReason && friendlyName && friendlyName === displayName) matchReason = 'friendly name exactly matches display name'
    if (!matchReason && friendlyName) {
      for (const token of tokens) {
        if (friendlyName.includes(token)) { matchReason = `friendly name contains "${token}"`; break }
      }
    }
    if (matchReason) {
      suggestions.push({
        entity_id: String(row.entity_id),
        ha_device_id: row.ha_device_id ? String(row.ha_device_id) : null,
        area_id: row.area_id ? String(row.area_id) : null,
        domain: String(row.domain),
        platform: row.platform ? String(row.platform) : null,
        integration: row.integration ? String(row.integration) : null,
        friendly_name: row.friendly_name ? String(row.friendly_name) : null,
        state: row.state ? String(row.state) : null,
        match_reason: matchReason,
      })
    }
  }

  return {
    equipmentId,
    haInstanceId,
    physicalId: String(equipment.physical_id),
    suggestions: suggestions.slice(0, 50),
    note: 'Deterministic hints only (ID tokens / exact name). Review before linking — nothing is auto-linked.',
  }
}
