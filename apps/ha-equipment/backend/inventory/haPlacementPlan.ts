// Reusable HA placement plan DTO for future authenticated Home Assistant sync.
// This module only reads inventory/snapshot state; it never writes to HA.
import { LOCATION_TREE_CTE } from './locationReadModel'

export type HaSnapshotComparison = 'matched' | 'differs' | 'unknown'

export type HaPlacementLinkedTarget = {
  linkId: string
  haInstanceId: string
  entityId: string
  haDeviceId: string | null
  currentEntityAreaId: string | null
  currentDeviceAreaId: string | null
  currentEntityLabels: string[] | null
  currentDeviceLabels: string[] | null
  snapshotComparison: HaSnapshotComparison
}

export type HaPlacementSnapshotStatus = 'not_mapped' | 'no_linked_ha_objects' | 'mapped' | 'differs' | 'unknown'

export type HaPlacementPlan = {
  equipmentId: string
  physicalId: string
  binId: string | null
  binName: string | null
  locationId: string | null
  path: string | null
  effectiveHaAreaId: string | null
  haLabelId: string | null
  linkedHaTargets: HaPlacementLinkedTarget[]
  syncNeeded: boolean
  snapshotStatus: HaPlacementSnapshotStatus
}

type LocationPlanRow = {
  id: string
  path: string
  effective_ha_area_id: string | null
  ha_label_id: string | null
}

type BinPlacementRow = {
  id: string
  name: string
  location_id: string | null
}

type LinkRow = {
  id: string
  ha_instance_id: string
  entity_id: string
  ha_device_id: string | null
}

type SnapshotTablesRow = {
  entity_table: string | null
  device_table: string | null
}

type SnapshotRow = {
  link_id: string
  entity_area_id: string | null
  device_area_id: string | null
  entity_labels: unknown
  device_labels: unknown
}

type PlacementTarget = {
  equipmentId: string
  physicalId: string
  locationId: string | null
  binId?: string | null
  binName?: string | null
}

export async function buildHaPlacementPlanForTarget(target: PlacementTarget): Promise<HaPlacementPlan> {
  const [locationResult, linkResult] = await Promise.all([
    target.locationId
      ? retoolDb.query<LocationPlanRow>(`${LOCATION_TREE_CTE}
          SELECT id, path, effective_ha_area_id, ha_label_id
          FROM loc_read_model WHERE id = $1::text`, [target.locationId])
      : Promise.resolve({ data: [] as LocationPlanRow[] }),
    retoolDb.query<LinkRow>(`
      SELECT id, ha_instance_id, entity_id, ha_device_id
      FROM ha_entity_link
      WHERE equipment_id = $1::text AND active
      ORDER BY entity_id`, [target.equipmentId]),
  ])

  const location = locationResult.data[0] ?? null
  const effectiveHaAreaId = location?.effective_ha_area_id ?? null
  const haLabelId = location?.ha_label_id ?? null
  const linkedTargets = linkResult.data.map((row) => ({
    linkId: row.id,
    haInstanceId: row.ha_instance_id,
    entityId: row.entity_id,
    haDeviceId: row.ha_device_id,
    currentEntityAreaId: null,
    currentDeviceAreaId: null,
    currentEntityLabels: null,
    currentDeviceLabels: null,
    snapshotComparison: 'unknown' as HaSnapshotComparison,
  }))

  if (!effectiveHaAreaId && !haLabelId) {
    return {
      equipmentId: target.equipmentId,
      physicalId: target.physicalId,
      binId: target.binId ?? null,
      binName: target.binName ?? null,
      locationId: location?.id ?? target.locationId,
      path: location?.path ?? null,
      effectiveHaAreaId,
      haLabelId,
      linkedHaTargets: linkedTargets,
      syncNeeded: false,
      snapshotStatus: 'not_mapped',
    }
  }

  if (linkedTargets.length === 0) {
    return {
      equipmentId: target.equipmentId,
      physicalId: target.physicalId,
      binId: target.binId ?? null,
      binName: target.binName ?? null,
      locationId: location?.id ?? target.locationId,
      path: location?.path ?? null,
      effectiveHaAreaId,
      haLabelId,
      linkedHaTargets: linkedTargets,
      syncNeeded: false,
      snapshotStatus: 'no_linked_ha_objects',
    }
  }

  const snapshotRows = await readSnapshotRowsIfAvailable(linkedTargets)
  const snapshotByLink = new Map(snapshotRows.map((row) => [row.link_id, row]))
  const enrichedTargets = linkedTargets.map((targetRow) => {
    const snapshot = snapshotByLink.get(targetRow.linkId)
    const currentEntityLabels = labelsFromUnknown(snapshot?.entity_labels)
    const currentDeviceLabels = labelsFromUnknown(snapshot?.device_labels)
    return {
      ...targetRow,
      currentEntityAreaId: snapshot?.entity_area_id ?? null,
      currentDeviceAreaId: snapshot?.device_area_id ?? null,
      currentEntityLabels,
      currentDeviceLabels,
      snapshotComparison: snapshot
        ? compareSnapshotPlacement({
          desiredAreaId: effectiveHaAreaId,
          desiredLabelId: haLabelId,
          currentEntityAreaId: snapshot.entity_area_id,
          currentDeviceAreaId: snapshot.device_area_id,
          currentEntityLabels,
          currentDeviceLabels,
        })
        : 'unknown' as HaSnapshotComparison,
    }
  })

  const anyDiffers = enrichedTargets.some((targetRow) => targetRow.snapshotComparison === 'differs')
  const allMatched = enrichedTargets.length > 0 && enrichedTargets.every((targetRow) => targetRow.snapshotComparison === 'matched')

  return {
    equipmentId: target.equipmentId,
    physicalId: target.physicalId,
    binId: target.binId ?? null,
    binName: target.binName ?? null,
    locationId: location?.id ?? target.locationId,
    path: location?.path ?? null,
    effectiveHaAreaId,
    haLabelId,
    linkedHaTargets: enrichedTargets,
    syncNeeded: anyDiffers,
    snapshotStatus: anyDiffers ? 'differs' : allMatched ? 'mapped' : 'unknown',
  }
}

export async function buildHaPlacementPlanForEquipment(equipmentId: string): Promise<HaPlacementPlan> {
  const equipmentResult = await retoolDb.query<{
    id: string
    physical_id: string
    direct_location_id: string | null
    bin_id: string | null
    bin_name: string | null
    bin_location_id: string | null
  }>(`
    SELECT e.id, e.physical_id, e.direct_location_id, e.bin_id,
      b.name AS bin_name, b.location_id AS bin_location_id
    FROM equipment e
    LEFT JOIN bin b ON b.id = e.bin_id
    WHERE e.id = $1::text`, [equipmentId])
  const equipment = equipmentResult.data[0]
  if (!equipment) throw new Error('Equipment not found')

  return buildHaPlacementPlanForTarget({
    equipmentId: equipment.id,
    physicalId: equipment.physical_id,
    locationId: equipment.bin_location_id ?? equipment.direct_location_id,
    binId: equipment.bin_id,
    binName: equipment.bin_name,
  })
}

export async function buildHaPlacementPlanForMove(params: {
  equipmentId: string
  physicalId: string
  newLocationId: string | null
  newBinId: string | null
}): Promise<HaPlacementPlan> {
  if (!params.newBinId) {
    return buildHaPlacementPlanForTarget({
      equipmentId: params.equipmentId,
      physicalId: params.physicalId,
      locationId: params.newLocationId,
      binId: null,
      binName: null,
    })
  }

  const binResult = await retoolDb.query<BinPlacementRow>(
    `SELECT id, name, location_id FROM bin WHERE id = $1::text`,
    [params.newBinId],
  )
  const bin = binResult.data[0]
  if (!bin) throw new Error('Bin not found')

  return buildHaPlacementPlanForTarget({
    equipmentId: params.equipmentId,
    physicalId: params.physicalId,
    locationId: bin.location_id,
    binId: bin.id,
    binName: bin.name,
  })
}

async function readSnapshotRowsIfAvailable(linkedTargets: HaPlacementLinkedTarget[]): Promise<SnapshotRow[]> {
  const tables = await retoolDb.query<SnapshotTablesRow>(`
    SELECT
      to_regclass('public.ha_entity_snapshot')::text AS entity_table,
      to_regclass('public.ha_device_snapshot')::text AS device_table`)
  const tableInfo = tables.data[0]
  if (!tableInfo?.entity_table || !tableInfo.device_table) return []

  const targetJson = JSON.stringify(linkedTargets.map((target) => ({
    link_id: target.linkId,
    ha_instance_id: target.haInstanceId,
    entity_id: target.entityId,
    ha_device_id: target.haDeviceId,
  })))

  const result = await retoolDb.query<SnapshotRow>(`
    SELECT x.link_id,
      es.area_id AS entity_area_id,
      ds.area_id AS device_area_id,
      es.labels AS entity_labels,
      ds.labels AS device_labels
    FROM jsonb_to_recordset($1::jsonb) AS x(
      link_id text,
      ha_instance_id text,
      entity_id text,
      ha_device_id text
    )
    LEFT JOIN ha_entity_snapshot es
      ON es.ha_instance_id = x.ha_instance_id
      AND es.entity_id = x.entity_id
      AND es.is_current
    LEFT JOIN ha_device_snapshot ds
      ON ds.ha_instance_id = x.ha_instance_id
      AND ds.ha_device_id = x.ha_device_id
      AND ds.is_current`, [targetJson])
  return result.data
}

function compareSnapshotPlacement(params: {
  desiredAreaId: string | null
  desiredLabelId: string | null
  currentEntityAreaId: string | null
  currentDeviceAreaId: string | null
  currentEntityLabels: string[] | null
  currentDeviceLabels: string[] | null
}): HaSnapshotComparison {
  const areaComparison = compareArea(params.desiredAreaId, [params.currentEntityAreaId, params.currentDeviceAreaId])
  const labelComparison = compareLabel(params.desiredLabelId, [params.currentEntityLabels, params.currentDeviceLabels])
  if (areaComparison === 'differs' || labelComparison === 'differs') return 'differs'
  if (areaComparison === 'matched' && labelComparison === 'matched') return 'matched'
  return 'unknown'
}

function compareArea(desiredAreaId: string | null, currentAreaIds: Array<string | null>): HaSnapshotComparison {
  if (!desiredAreaId) return 'matched'
  const knownAreaIds = currentAreaIds.filter((areaId): areaId is string => Boolean(areaId))
  if (knownAreaIds.length === 0) return 'unknown'
  return knownAreaIds.includes(desiredAreaId) ? 'matched' : 'differs'
}

function compareLabel(desiredLabelId: string | null, currentLabelSets: Array<string[] | null>): HaSnapshotComparison {
  if (!desiredLabelId) return 'matched'
  const knownLabelSets = currentLabelSets.filter((labels): labels is string[] => labels !== null)
  if (knownLabelSets.length === 0) return 'unknown'
  return knownLabelSets.some((labels) => labels.includes(desiredLabelId)) ? 'matched' : 'differs'
}

function labelsFromUnknown(value: unknown): string[] | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string')
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === 'string')
    } catch (_error) {
      return null
    }
  }
  return null
}
