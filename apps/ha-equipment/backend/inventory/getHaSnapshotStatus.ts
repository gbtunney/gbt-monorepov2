// Snapshot status per HA instance: latest run, counts, and current-vs-stale tallies so the
// UI can show honestly how fresh discovery data is.
export default async function() {
  const runs = await retoolDb.query(`
    SELECT id, ha_instance_id, source, snapshot_at, imported_at, full_snapshot,
      areas_count, devices_count, entities_count, warnings
    FROM ha_snapshot_run
    ORDER BY imported_at DESC
    LIMIT 10`)

  const tallies = await retoolDb.query(`
    SELECT ha_instance_id,
      count(*) FILTER (WHERE is_current) AS current,
      count(*) FILTER (WHERE NOT is_current) AS stale
    FROM ha_entity_snapshot GROUP BY ha_instance_id`)
  const deviceTallies = await retoolDb.query(`
    SELECT ha_instance_id,
      count(*) FILTER (WHERE is_current) AS current,
      count(*) FILTER (WHERE NOT is_current) AS stale
    FROM ha_device_snapshot GROUP BY ha_instance_id`)
  const areaTallies = await retoolDb.query(`
    SELECT ha_instance_id,
      count(*) FILTER (WHERE is_current) AS current,
      count(*) FILTER (WHERE NOT is_current) AS stale
    FROM ha_area_snapshot GROUP BY ha_instance_id`)

  const linkedCounts = await retoolDb.query(`
    SELECT l.ha_instance_id, count(*)::int AS active_links, count(DISTINCT l.equipment_id)::int AS linked_equipment
    FROM ha_entity_link l WHERE l.active GROUP BY l.ha_instance_id`)

  const tallyMap = new Map(tallies.data.map((row: Record<string, unknown>) => [String(row['ha_instance_id']), row]))
  const deviceTallyMap = new Map(deviceTallies.data.map((row: Record<string, unknown>) => [String(row['ha_instance_id']), row]))
  const areaTallyMap = new Map(areaTallies.data.map((row: Record<string, unknown>) => [String(row['ha_instance_id']), row]))
  const linkedMap = new Map(linkedCounts.data.map((row: Record<string, unknown>) => [String(row['ha_instance_id']), row]))

  const instances = Array.from(new Set([
    ...tallyMap.keys(), ...deviceTallyMap.keys(), ...areaTallyMap.keys(),
  ])).sort()

  return {
    latestRun: runs.data[0] ?? null,
    runs: runs.data,
    instances: instances.map((haInstanceId) => {
      const entityTally = tallyMap.get(haInstanceId)
      const deviceTally = deviceTallyMap.get(haInstanceId)
      const areaTally = areaTallyMap.get(haInstanceId)
      const linked = linkedMap.get(haInstanceId)
      return {
        haInstanceId,
        entitiesCurrent: Number(entityTally?.['current'] ?? 0),
        entitiesStale: Number(entityTally?.['stale'] ?? 0),
        devicesCurrent: Number(deviceTally?.['current'] ?? 0),
        devicesStale: Number(deviceTally?.['stale'] ?? 0),
        areasCurrent: Number(areaTally?.['current'] ?? 0),
        areasStale: Number(areaTally?.['stale'] ?? 0),
        activeLinks: Number(linked?.['active_links'] ?? 0),
        linkedEquipment: Number(linked?.['linked_equipment'] ?? 0),
      }
    }),
    collectorNote: 'No automatic HA collector is connected. Discovery data comes only from manually imported snapshots.',
  }
}
