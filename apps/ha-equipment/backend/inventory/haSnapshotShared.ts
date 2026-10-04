// Payload contract and defensive parsing for Home Assistant snapshot imports.
// Payload keys are mapped explicitly below — arbitrary payload fields are never
// interpolated into SQL, and credential-like attribute values are redacted before storage.

export const HA_SNAPSHOT_SCHEMA_VERSION = 1

export type HaSnapshotPayload = {
  schemaVersion: number
  haInstanceId: string
  snapshotAt: string
  fullSnapshot: boolean
  areas: HaSnapshotArea[]
  devices: HaSnapshotDevice[]
  entities: HaSnapshotEntity[]
}

export type HaSnapshotArea = {
  areaId: string
  name: string
  aliases: string[]
  labels: string[]
}

export type HaSnapshotDevice = {
  deviceId: string
  name: string | null
  nameByUser: string | null
  areaId: string | null
  manufacturer: string | null
  model: string | null
  modelId: string | null
  swVersion: string | null
  hwVersion: string | null
  integrationVia: string | null
  identifiers: unknown[]
  connections: unknown[]
  configEntries: unknown[]
  labels: string[]
  disabledBy: string | null
}

export type HaSnapshotEntity = {
  entityId: string
  domain: string
  deviceId: string | null
  areaId: string | null
  platform: string | null
  integration: string | null
  friendlyName: string | null
  originalName: string | null
  deviceClass: string | null
  state: string | null
  unitOfMeasurement: string | null
  disabledBy: string | null
  labels: string[]
  attributes: Record<string, unknown>
}

/** Keys whose values look credential-like are redacted before attributes are stored. */
const CREDENTIAL_KEY_PATTERN = /(token|password|secret|authorization|api_?key|bearer|credential|cookie|session)/i
const REDACTED_MARKER = '[redacted]'

export type ParsedSnapshot = {
  payload: HaSnapshotPayload
  warnings: string[]
}

function asOptionalString(value: unknown, maxLength = 300): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

/** Accepts labels as string[] or {id?,name?}[] and returns a plain string[]. */
function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const labels: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) labels.push(entry.trim().slice(0, 200))
    else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>
      const name = asOptionalString(record['name']) ?? asOptionalString(record['label_id']) ?? asOptionalString(record['id'])
      if (name) labels.push(name)
    }
  }
  return labels
}

function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim().slice(0, 200))
}

function redactAttributes(raw: unknown): { attributes: Record<string, unknown>; redactedCount: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { attributes: {}, redactedCount: 0 }
  const attributes: Record<string, unknown> = {}
  let redactedCount = 0
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (CREDENTIAL_KEY_PATTERN.test(key)) {
      attributes[key] = REDACTED_MARKER
      redactedCount += 1
      continue
    }
    if (value !== null && typeof value === 'object') {
      // Nested objects/arrays are stored as-is except for one redaction pass on their keys.
      const nested = redactAttributes(value)
      attributes[key] = nested.attributes
      redactedCount += nested.redactedCount
      continue
    }
    attributes[key] = value
  }
  return { attributes, redactedCount }
}

/** Opaque string ids only — no UUID assumptions, no whitespace. */
function isValidOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/\s/.test(value.trim())
}

export function parseHaSnapshotPayload(raw: unknown): ParsedSnapshot {
  const warnings: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Snapshot must be a JSON object')
  }
  const root = raw as Record<string, unknown>

  const schemaVersion = Number(root['schemaVersion'])
  if (schemaVersion !== HA_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported snapshot schemaVersion ${String(root['schemaVersion'])}; expected ${HA_SNAPSHOT_SCHEMA_VERSION}`)
  }
  const haInstanceId = asOptionalString(root['haInstanceId'], 100)
  if (!haInstanceId) throw new Error('haInstanceId is required')

  const snapshotAtRaw = asOptionalString(root['snapshotAt'], 100)
  const snapshotAt = snapshotAtRaw && !Number.isNaN(new Date(snapshotAtRaw).getTime())
    ? new Date(snapshotAtRaw).toISOString()
    : new Date().toISOString()
  if (snapshotAtRaw && new Date(snapshotAtRaw).toISOString() !== snapshotAt) {
    warnings.push('snapshotAt was missing or not a valid timestamp; import time was used instead.')
  }
  const fullSnapshot = root['fullSnapshot'] !== false

  const areas: HaSnapshotArea[] = []
  const rawAreas = Array.isArray(root['areas']) ? root['areas'] : []
  rawAreas.forEach((entry, index) => {
    const row = entry as Record<string, unknown>
    const areaId = row['areaId'] ?? row['area_id']
    const name = asOptionalString(row['name'], 200)
    if (!isValidOpaqueId(areaId) || !name) {
      warnings.push(`areas[${index}] skipped: missing or invalid areaId/name`)
      return
    }
    areas.push({
      areaId: areaId.trim(), name,
      aliases: normalizeAliases(row['aliases']),
      labels: normalizeLabels(row['labels']),
    })
  })

  const devices: HaSnapshotDevice[] = []
  const rawDevices = Array.isArray(root['devices']) ? root['devices'] : []
  rawDevices.forEach((entry, index) => {
    const row = entry as Record<string, unknown>
    const deviceId = row['deviceId'] ?? row['device_id']
    if (!isValidOpaqueId(deviceId)) {
      warnings.push(`devices[${index}] skipped: missing or invalid deviceId`)
      return
    }
    devices.push({
      deviceId: deviceId.trim(),
      name: asOptionalString(row['name']),
      nameByUser: asOptionalString(row['nameByUser'] ?? row['name_by_user']),
      areaId: asOptionalString(row['areaId'] ?? row['area_id'], 200),
      manufacturer: asOptionalString(row['manufacturer'], 200),
      model: asOptionalString(row['model'], 200),
      modelId: asOptionalString(row['modelId'] ?? row['model_id'], 200),
      swVersion: asOptionalString(row['swVersion'] ?? row['sw_version'], 100),
      hwVersion: asOptionalString(row['hwVersion'] ?? row['hw_version'], 100),
      integrationVia: asOptionalString(row['integrationVia'] ?? row['integration_via'], 100),
      identifiers: Array.isArray(row['identifiers']) ? row['identifiers'] : [],
      connections: Array.isArray(row['connections']) ? row['connections'] : [],
      configEntries: Array.isArray(row['configEntries'] ?? row['config_entries']) ? (row['configEntries'] ?? row['config_entries']) as unknown[] : [],
      labels: normalizeLabels(row['labels']),
      disabledBy: asOptionalString(row['disabledBy'] ?? row['disabled_by'], 100),
    })
  })

  const entities: HaSnapshotEntity[] = []
  const rawEntities = Array.isArray(root['entities']) ? root['entities'] : []
  rawEntities.forEach((entry, index) => {
    const row = entry as Record<string, unknown>
    const entityId = row['entityId'] ?? row['entity_id']
    if (!isValidOpaqueId(entityId)) {
      warnings.push(`entities[${index}] skipped: missing or invalid entityId`)
      return
    }
    const trimmedEntityId = entityId.trim()
    const dotIndex = trimmedEntityId.indexOf('.')
    const domain = dotIndex > 0 ? trimmedEntityId.slice(0, dotIndex) : null
    if (!domain) {
      warnings.push(`entities[${index}] skipped: entityId "${trimmedEntityId}" has no domain prefix`)
      return
    }
    const { attributes, redactedCount } = redactAttributes(row['attributes'])
    if (redactedCount > 0) {
      warnings.push(`entities[${index}] (${trimmedEntityId}): ${redactedCount} credential-like attribute value(s) redacted`)
    }
    const unitFromAttributes = attributes['unit_of_measurement']
    entities.push({
      entityId: trimmedEntityId,
      domain,
      deviceId: asOptionalString(row['deviceId'] ?? row['device_id'], 200),
      areaId: asOptionalString(row['areaId'] ?? row['area_id'], 200),
      platform: asOptionalString(row['platform'], 100),
      integration: asOptionalString(row['integration'], 100),
      friendlyName: asOptionalString(row['friendlyName'] ?? row['friendly_name'], 200),
      originalName: asOptionalString(row['originalName'] ?? row['original_name'], 200),
      deviceClass: asOptionalString(row['deviceClass'] ?? row['device_class'], 100),
      state: asOptionalString(row['state'], 200),
      unitOfMeasurement: asOptionalString(row['unitOfMeasurement'] ?? row['unit_of_measurement'], 50)
        ?? (typeof unitFromAttributes === 'string' ? unitFromAttributes.slice(0, 50) : null),
      disabledBy: asOptionalString(row['disabledBy'] ?? row['disabled_by'], 100),
      labels: normalizeLabels(row['labels']),
      attributes,
    })
  })

  return {
    payload: { schemaVersion, haInstanceId, snapshotAt, fullSnapshot, areas, devices, entities },
    warnings,
  }
}
