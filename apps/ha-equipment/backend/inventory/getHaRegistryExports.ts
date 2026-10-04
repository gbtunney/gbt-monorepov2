// Read-only fetch of the Home Assistant registry exports via the configured REST resource.
// The resource's base URL did not persist, so the absolute HTTPS URLs are set here until
// the resource is reconfigured. Returns the three raw registry arrays (JSON text parsed).
const EXPORT_BASE_URL = 'https://yzcm6icwt327ovrlkovlq6vvtbrwxk6j.ui.nabu.casa/local/ha_exports'

type RegistryExport = {
  areas: unknown[]
  devices: unknown[]
  entities: unknown[]
}

function parseRegistryArray(text: unknown, label: string): unknown[] {
  const raw = typeof text === 'string' ? text : JSON.stringify(text)
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${label} export is not a JSON array`)
  return parsed
}

export default async function() {
  const files: Array<{ file: string; key: keyof RegistryExport }> = [
    { file: 'ha_areas_raw.json', key: 'areas' },
    { file: 'ha_devices_raw.json', key: 'devices' },
    { file: 'ha_entities_raw.json', key: 'entities' },
  ]
  const result: Partial<RegistryExport> = {}
  const byteCounts: Record<string, number> = {}
  for (const entry of files) {
    const response = await homeAssistantRegistryExports.rawRequest<string>({
      path: `${EXPORT_BASE_URL}/${entry.file}`,
      method: 'GET',
    })
    byteCounts[entry.key] = typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data ?? null).length
    result[entry.key] = parseRegistryArray(response.data, entry.key)
  }
  return {
    areas: result.areas ?? [],
    devices: result.devices ?? [],
    entities: result.entities ?? [],
    byteCounts,
    fetchedAt: new Date().toISOString(),
    note: 'Registry dumps contain registry fields only — no live entity state or attributes.',
  }
}
