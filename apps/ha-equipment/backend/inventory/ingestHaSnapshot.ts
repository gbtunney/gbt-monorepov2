// Imports a versioned Home Assistant snapshot JSON into the read-only mirror tables.
// Import is idempotent (upserts by natural key), never touches canonical inventory, and
// marks rows absent from a full snapshot as stale (is_current = false) instead of deleting.
// No HA tokens/credentials are stored; credential-like attributes are redacted on import.
import { jsonValue, optionalString } from './shared'
import { parseHaSnapshotPayload, type HaSnapshotPayload } from './haSnapshotShared'

type Params = {
  snapshot: unknown
  source?: string
  clientIdempotencyKey?: string
}

type UpsertCounts = { inserted: number; updated: number; skipped: number }

export default async function(req: { params: Params }) {
  const source = optionalString(req.params?.source, 'source', 100) ?? 'manual_import'
  const { payload, warnings } = parseHaSnapshotPayload(req.params?.snapshot)
  const allWarnings = [...warnings]

  // Optional client-supplied idempotency key: repeating the same import returns the same run.
  const clientIdempotencyKey = optionalString(req.params?.clientIdempotencyKey, 'clientIdempotencyKey', 200)
  if (clientIdempotencyKey) {
    const existingRun = await retoolDb.query(
      `SELECT id FROM ha_snapshot_run WHERE idempotency_key = $1::text`,
      [clientIdempotencyKey],
    )
    if (existingRun.data[0]) {
      return {
        ok: true as const,
        runId: String(existingRun.data[0].id),
        idempotentReplay: true,
        message: 'This snapshot was already imported (same client idempotency key).',
      }
    }
  }

  const runResult = await retoolDb.query(
    `INSERT INTO ha_snapshot_run (id, ha_instance_id, source, snapshot_at, full_snapshot, warnings, payload_hash, idempotency_key)
    SELECT gen_random_uuid()::text, $1::text, $2::text, $3::timestamptz, $4::boolean, $5::jsonb, $6::text, gen_random_uuid()::text
    RETURNING id`,
    [
      payload.haInstanceId, source, payload.snapshotAt, payload.fullSnapshot,
      jsonValue(allWarnings), simpleStableHash(JSON.stringify(req.params?.snapshot ?? null)),
    ],
  )
  const runId = String(runResult.data[0].id)

  const areaCounts = await upsertAreas(runId, payload)
  const deviceCounts = await upsertDevices(runId, payload)
  const entityCounts = await upsertEntities(runId, payload)

  // Rows of this instance not present in this full snapshot become stale, never deleted.
  let staleMarked = 0
  if (payload.fullSnapshot) {
    const staleTargets: Array<{ tableName: string; keyColumn: string; presentKeys: string[] }> = [
      { tableName: 'ha_area_snapshot', keyColumn: 'ha_area_id', presentKeys: payload.areas.map((area) => area.areaId) },
      { tableName: 'ha_device_snapshot', keyColumn: 'ha_device_id', presentKeys: payload.devices.map((device) => device.deviceId) },
      { tableName: 'ha_entity_snapshot', keyColumn: 'entity_id', presentKeys: payload.entities.map((entity) => entity.entityId) },
    ]
    for (const target of staleTargets) {
      if (target.presentKeys.length === 0) {
        const markAll = await retoolDb.query(
          `UPDATE ${target.tableName} SET is_current = false
          WHERE ha_instance_id = $1::text AND is_current
          RETURNING id`,
          [payload.haInstanceId],
        )
        staleMarked += markAll.data.length
        continue
      }
      const markStale = await retoolDb.query(
        `UPDATE ${target.tableName} SET is_current = false
        WHERE ha_instance_id = $1::text AND is_current AND NOT (${target.keyColumn} = ANY($2::text[]))
        RETURNING id`,
        [payload.haInstanceId, target.presentKeys],
      )
      staleMarked += markStale.data.length
    }
  }

  await retoolDb.query(
    `UPDATE ha_snapshot_run
    SET areas_count = $1, devices_count = $2, entities_count = $3, warnings = $4::jsonb
    WHERE id = $5::text`,
    [payload.areas.length, payload.devices.length, payload.entities.length, jsonValue(allWarnings), runId],
  )

  return {
    ok: true as const,
    runId,
    haInstanceId: payload.haInstanceId,
    snapshotAt: payload.snapshotAt,
    fullSnapshot: payload.fullSnapshot,
    areas: areaCounts,
    devices: deviceCounts,
    entities: entityCounts,
    staleMarked,
    warnings: allWarnings,
    note: 'Imported into the read-only HA mirror. Canonical inventory was not modified.',
  }
}

function chunkArray<Item>(items: readonly Item[], chunkSize: number): Item[][] {
  const chunks: Item[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

async function upsertAreas(runId: string, payload: HaSnapshotPayload): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 }
  for (const chunk of chunkArray(payload.areas, 500)) {
    const rows = chunk.map((area) => ({
      area_id: area.areaId, name: area.name,
      aliases: area.aliases, labels: area.labels,
    }))
    const result = await retoolDb.query(
      `INSERT INTO ha_area_snapshot (id, ha_instance_id, ha_area_id, name, aliases, labels, last_seen_snapshot_id, last_seen_at, is_current)
      SELECT gen_random_uuid()::text, $1::text, x.area_id, x.name, x.aliases, x.labels, $2::text, $3::timestamptz, true
      FROM jsonb_to_recordset($4::jsonb) AS x(area_id text, name text, aliases jsonb, labels jsonb)
      ON CONFLICT (ha_instance_id, ha_area_id) DO UPDATE SET
        name = EXCLUDED.name, aliases = EXCLUDED.aliases, labels = EXCLUDED.labels,
        last_seen_snapshot_id = EXCLUDED.last_seen_snapshot_id, last_seen_at = EXCLUDED.last_seen_at, is_current = true
      RETURNING (xmax = 0) AS inserted`,
      [payload.haInstanceId, runId, payload.snapshotAt, JSON.stringify(rows)],
    )
    for (const row of result.data) {
      if (row.inserted === true) counts.inserted += 1
      else counts.updated += 1
    }
  }
  return counts
}

async function upsertDevices(runId: string, payload: HaSnapshotPayload): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 }
  for (const chunk of chunkArray(payload.devices, 500)) {
    const rows = chunk.map((device) => ({
      device_id: device.deviceId, name: device.name, name_by_user: device.nameByUser,
      area_id: device.areaId, manufacturer: device.manufacturer, model: device.model,
      model_id: device.modelId, sw_version: device.swVersion, hw_version: device.hwVersion,
      integration_via: device.integrationVia, identifiers: device.identifiers,
      connections: device.connections, config_entries: device.configEntries,
      labels: device.labels, disabled_by: device.disabledBy,
    }))
    const result = await retoolDb.query(
      `INSERT INTO ha_device_snapshot (
        id, ha_instance_id, ha_device_id, name, name_by_user, area_id, manufacturer, model, model_id,
        sw_version, hw_version, integration_via, identifiers, connections, config_entries, labels,
        disabled_by, last_seen_snapshot_id, last_seen_at, is_current
      )
      SELECT gen_random_uuid()::text, $1::text, x.device_id, x.name, x.name_by_user, x.area_id, x.manufacturer, x.model, x.model_id,
        x.sw_version, x.hw_version, x.integration_via, x.identifiers, x.connections, x.config_entries, x.labels,
        x.disabled_by, $2::text, $3::timestamptz, true
      FROM jsonb_to_recordset($4::jsonb) AS x(
        device_id text, name text, name_by_user text, area_id text, manufacturer text, model text,
        model_id text, sw_version text, hw_version text, integration_via text,
        identifiers jsonb, connections jsonb, config_entries jsonb, labels jsonb, disabled_by text
      )
      ON CONFLICT (ha_instance_id, ha_device_id) DO UPDATE SET
        name = EXCLUDED.name, name_by_user = EXCLUDED.name_by_user, area_id = EXCLUDED.area_id,
        manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model, model_id = EXCLUDED.model_id,
        sw_version = EXCLUDED.sw_version, hw_version = EXCLUDED.hw_version, integration_via = EXCLUDED.integration_via,
        identifiers = EXCLUDED.identifiers, connections = EXCLUDED.connections, config_entries = EXCLUDED.config_entries,
        labels = EXCLUDED.labels, disabled_by = EXCLUDED.disabled_by,
        last_seen_snapshot_id = EXCLUDED.last_seen_snapshot_id, last_seen_at = EXCLUDED.last_seen_at, is_current = true
      RETURNING (xmax = 0) AS inserted`,
      [payload.haInstanceId, runId, payload.snapshotAt, JSON.stringify(rows)],
    )
    for (const row of result.data) {
      if (row.inserted === true) counts.inserted += 1
      else counts.updated += 1
    }
  }
  return counts
}

async function upsertEntities(runId: string, payload: HaSnapshotPayload): Promise<UpsertCounts> {
  const counts: UpsertCounts = { inserted: 0, updated: 0, skipped: 0 }
  for (const chunk of chunkArray(payload.entities, 500)) {
    const rows = chunk.map((entity) => ({
      entity_id: entity.entityId, ha_device_id: entity.deviceId, area_id: entity.areaId,
      platform: entity.platform, integration: entity.integration, domain: entity.domain,
      friendly_name: entity.friendlyName, original_name: entity.originalName, device_class: entity.deviceClass,
      state: entity.state, unit_of_measurement: entity.unitOfMeasurement, disabled_by: entity.disabledBy,
      labels: entity.labels, attributes_json: entity.attributes,
    }))
    const result = await retoolDb.query(
      `INSERT INTO ha_entity_snapshot (
        id, ha_instance_id, entity_id, ha_device_id, area_id, platform, integration, domain,
        friendly_name, original_name, device_class, state, unit_of_measurement, disabled_by,
        labels, attributes_json, last_seen_snapshot_id, last_seen_at, is_current
      )
      SELECT gen_random_uuid()::text, $1::text, x.entity_id, x.ha_device_id, x.area_id, x.platform, x.integration, x.domain,
        x.friendly_name, x.original_name, x.device_class, x.state, x.unit_of_measurement, x.disabled_by,
        x.labels, x.attributes_json, $2::text, $3::timestamptz, true
      FROM jsonb_to_recordset($4::jsonb) AS x(
        entity_id text, ha_device_id text, area_id text, platform text, integration text, domain text,
        friendly_name text, original_name text, device_class text, state text, unit_of_measurement text,
        disabled_by text, labels jsonb, attributes_json jsonb
      )
      ON CONFLICT (ha_instance_id, entity_id) DO UPDATE SET
        ha_device_id = EXCLUDED.ha_device_id, area_id = EXCLUDED.area_id,
        platform = EXCLUDED.platform, integration = EXCLUDED.integration, domain = EXCLUDED.domain,
        friendly_name = EXCLUDED.friendly_name, original_name = EXCLUDED.original_name,
        device_class = EXCLUDED.device_class, state = EXCLUDED.state,
        unit_of_measurement = EXCLUDED.unit_of_measurement, disabled_by = EXCLUDED.disabled_by,
        labels = EXCLUDED.labels, attributes_json = EXCLUDED.attributes_json,
        last_seen_snapshot_id = EXCLUDED.last_seen_snapshot_id, last_seen_at = EXCLUDED.last_seen_at, is_current = true
      RETURNING (xmax = 0) AS inserted`,
      [payload.haInstanceId, runId, payload.snapshotAt, JSON.stringify(rows)],
    )
    for (const row of result.data) {
      if (row.inserted === true) counts.inserted += 1
      else counts.updated += 1
    }
  }
  return counts
}

/** Small deterministic hash for change detection; not a security primitive. */
function simpleStableHash(text: string): string {
  let hash = 5381
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0
  }
  return `h${hash.toString(16)}_${text.length.toString(16)}`
}
