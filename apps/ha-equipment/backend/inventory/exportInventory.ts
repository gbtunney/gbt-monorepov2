// Complete JSON export including relationships and events, with schema version and timestamp.
export default async function() {
  const [
    meta, types, stages, locations, bins, equipment, equipmentEvents, binEvents,
    links, runs, findings, rules, tags, history, attachments, intakes,
  ] = await Promise.all([
    retoolDb.query(`SELECT key, value FROM schema_meta`),
    retoolDb.query(`SELECT * FROM equipment_type ORDER BY name`),
    retoolDb.query(`SELECT * FROM lifecycle_stage ORDER BY sort_order`),
    retoolDb.query(`SELECT * FROM location ORDER BY name`),
    retoolDb.query(`SELECT * FROM bin ORDER BY bin_code`),
    retoolDb.query(`SELECT * FROM equipment ORDER BY physical_id`),
    retoolDb.query(`SELECT * FROM equipment_event ORDER BY occurred_at`),
    retoolDb.query(`SELECT * FROM bin_event ORDER BY occurred_at`),
    retoolDb.query(`SELECT * FROM ha_entity_link`),
    retoolDb.query(`SELECT * FROM audit_run ORDER BY requested_at`),
    retoolDb.query(`SELECT * FROM audit_finding ORDER BY fingerprint`),
    retoolDb.query(`SELECT * FROM audit_rule ORDER BY name`),
    retoolDb.query(`SELECT * FROM scan_tag`),
    retoolDb.query(`SELECT * FROM finding_status_history ORDER BY "at"`),
    retoolDb.query(`SELECT * FROM attachment ORDER BY created_at`),
    retoolDb.query(`SELECT * FROM equipment_intake ORDER BY created_at`),
  ])

  const metaMap: Record<string, string> = {}
  for (const row of meta.data) metaMap[String(row.key)] = String(row.value)

  return {
    exportFormat: 'equipment-inventory-json',
    schemaVersion: metaMap['schema_version'] ?? '1',
    generatedAt: new Date().toISOString(),
    displayTimezone: 'America/New_York',
    data: {
      equipmentTypes: types.data,
      lifecycleStages: stages.data,
      locations: locations.data,
      bins: bins.data,
      equipment: equipment.data,
      equipmentEvents: equipmentEvents.data,
      binEvents: binEvents.data,
      haEntityLinks: links.data,
      auditRuns: runs.data,
      auditFindings: findings.data,
      auditRules: rules.data,
      scanTags: tags.data,
      findingStatusHistory: history.data,
      attachments: attachments.data,
      // Draft intake workflow state — clearly separate from canonical equipment.
      equipmentIntakes: intakes.data,
    },
    notes: [
      'Attachment metadata is exported; attachment file bytes need a separate backup path.',
      'Restore should target a separate test database first; re-import is idempotent by natural keys (physical_id, bin_code, fingerprint, idempotency_key).',
      'equipmentIntakes contains unfinished and finished intake drafts; completed drafts reference their resulting equipment via resulting_equipment_id.',
    ],
  }
}
