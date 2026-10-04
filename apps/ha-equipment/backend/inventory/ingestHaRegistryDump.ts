// Maps raw Home Assistant registry dump arrays (area/device/entity registry rows) into the
// ingestHaSnapshot v1 contract, reusing the existing importer with its sanitization,
// redaction, and stale semantics. Registry dumps carry registry fields only — there is no
// live state, and none is fabricated.
import ingestHaSnapshot from './ingestHaSnapshot'

type Params = {
  areas: unknown
  devices: unknown
  entities: unknown
  haInstanceId?: string
  source?: string
}

function parseArray(value: unknown, label: string): Array<Record<string, unknown>> {
  const raw = typeof value === 'string' ? value : JSON.stringify(value ?? [])
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`)
  return parsed as Array<Record<string, unknown>>
}

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 300) : null
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

export default async function(req: { params: Params; user: User }) {
  const rawAreas = parseArray(req.params?.areas, 'areas')
  const rawDevices = parseArray(req.params?.devices, 'devices')
  const rawEntities = parseArray(req.params?.entities, 'entities')

  const areas = rawAreas.map((row) => ({
    areaId: text(row['id']) ?? '',
    name: text(row['name']) ?? '',
    aliases: stringArray(row['aliases']),
    labels: stringArray(row['labels']),
  }))

  const devices = rawDevices.map((row) => ({
    deviceId: text(row['id']) ?? '',
    name: text(row['name']),
    nameByUser: text(row['name_by_user']),
    areaId: text(row['area_id']),
    manufacturer: text(row['manufacturer']),
    model: text(row['model']),
    modelId: text(row['model_id']),
    swVersion: text(row['sw_version']),
    hwVersion: text(row['hw_version']),
    integrationVia: text(row['via_device_id']),
    identifiers: Array.isArray(row['identifiers']) ? row['identifiers'] : [],
    connections: Array.isArray(row['connections']) ? row['connections'] : [],
    configEntries: Array.isArray(row['config_entries'])
      ? row['config_entries']
      : text(row['config_entry_id']) ? [row['config_entry_id']] : [],
    labels: stringArray(row['labels']),
    disabledBy: text(row['disabled_by']),
  }))

  const entities = rawEntities.map((row) => {
    const platform = text(row['platform'])
    return {
      entityId: text(row['entity_id']) ?? '',
      deviceId: text(row['device_id']),
      areaId: text(row['area_id']),
      platform,
      // Registry dumps identify the integration only through the platform domain.
      integration: platform,
      friendlyName: text(row['name']),
      originalName: text(row['original_name']),
      deviceClass: text(row['device_class']),
      // Registry dumps have no live state or attributes — do not fabricate any.
      state: null as string | null,
      unitOfMeasurement: null as string | null,
      disabledBy: text(row['disabled_by']),
      labels: stringArray(row['labels']),
      attributes: {} as Record<string, unknown>,
    }
  })

  const snapshot = {
    schemaVersion: 1,
    haInstanceId: text(req.params?.haInstanceId) ?? 'homeassistant',
    snapshotAt: new Date().toISOString(),
    fullSnapshot: true,
    areas,
    devices,
    entities,
  }

  const importResult = await ingestHaSnapshot({
    params: { snapshot, source: text(req.params?.source) ?? 'manual_registry_url_import' },
  })

  return {
    ok: true as const,
    registryCounts: { areas: areas.length, devices: devices.length, entities: entities.length },
    import: importResult,
  }
}
