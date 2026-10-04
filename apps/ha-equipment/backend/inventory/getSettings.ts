// Settings data: types, stages, locations, audit rules, completeness fields, data-source status, demo flag.
import { COMPLETENESS_FIELDS } from './completenessFields'
import { LOCATION_TREE_CTE } from './locationReadModel'

export default async function() {
  const [types, stages, locations, rules, meta, counts] = await Promise.all([
    retoolDb.query(`SELECT * FROM equipment_type ORDER BY name`),
    retoolDb.query(`SELECT * FROM lifecycle_stage ORDER BY sort_order`),
    retoolDb.query(`${LOCATION_TREE_CTE}
      SELECT * FROM loc_read_model ORDER BY path`),
    retoolDb.query(`SELECT * FROM audit_rule ORDER BY name`),
    retoolDb.query(`SELECT key, value FROM schema_meta`),
    retoolDb.query(`
      SELECT
        (SELECT count(*)::int FROM equipment WHERE archived_at IS NULL) AS equipment,
        (SELECT count(*)::int FROM bin WHERE archived_at IS NULL) AS bins,
        (SELECT count(*)::int FROM location) AS locations,
        (SELECT count(*)::int FROM ha_entity_link WHERE active) AS ha_links,
        (SELECT count(*)::int FROM audit_finding WHERE status IN ('open','acknowledged')) AS open_findings`),
  ])

  const metaMap: Record<string, string> = {}
  for (const row of meta.data) metaMap[String(row.key)] = String(row.value)

  return {
    types: types.data,
    stages: stages.data,
    locations: locations.data,
    rules: rules.data,
    counts: counts.data[0] ?? {},
    dataSourceStatus: {
      database: 'retool_db (Retool-managed PostgreSQL)',
      demoDataset: metaMap['demo_seeded'] ? 'Demo dataset present (clearly marked illustrative records)' : 'No demo dataset',
      haRunner: 'Not connected — audit ingestion is manual/assistant-assisted (MVP mode)',
      attachmentStorage: 'Attachment metadata only; file bytes require an external durable store',
    },
    completenessFields: COMPLETENESS_FIELDS,
  }
}
