// Readable-name selectors for forms: types, lifecycle stages, locations, bins,
// plus distinct manufacturer/model values for autocomplete in the Add Equipment form.
import { LOCATION_TREE_CTE } from './locationReadModel'

export default async function() {
  const [types, stages, locations, bins, manufacturers, models] = await Promise.all([
    retoolDb.query(`SELECT id, name, id_prefix FROM equipment_type ORDER BY name`),
    retoolDb.query(`SELECT id, code, name, expects_online FROM lifecycle_stage WHERE archived = false ORDER BY sort_order`),
    retoolDb.query(`${LOCATION_TREE_CTE}
      SELECT
        id, name, parent_location_id, parent_name, depth, path,
        ha_area_id, ha_label_id, effective_ha_area_id,
        effective_area_source_location_id, effective_area_source_location_name,
        suggested_ha_label_id, suggested_ha_label_display
      FROM loc_read_model ORDER BY path`),
    retoolDb.query(`${LOCATION_TREE_CTE}
      SELECT b.id, b.bin_code, b.name,
        lr.id AS location_id,
        lr.name AS location_name,
        lr.path AS location_path,
        lr.effective_ha_area_id,
        lr.ha_label_id
      FROM bin b
      LEFT JOIN loc_read_model lr ON lr.id = b.location_id
      WHERE b.archived_at IS NULL ORDER BY b.bin_code`),
    retoolDb.query(
      `SELECT DISTINCT manufacturer FROM equipment WHERE manufacturer IS NOT NULL AND manufacturer <> '' ORDER BY 1`,
    ),
    retoolDb.query(
      `SELECT model, manufacturer FROM equipment WHERE model IS NOT NULL AND model <> '' ORDER BY model`,
    ),
  ])

  return {
    types: types.data,
    stages: stages.data,
    locations: locations.data,
    bins: bins.data,
    manufacturers: manufacturers.data.map((row: Record<string, unknown>) => String(row['manufacturer'])),
    models: models.data.map((row: Record<string, unknown>) => ({
      model: String(row['model']),
      manufacturer: row['manufacturer'] === null || row['manufacturer'] === undefined ? null : String(row['manufacturer']),
    })),
  }
}
