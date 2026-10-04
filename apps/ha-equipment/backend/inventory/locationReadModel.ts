// Shared recursive location read model for physical location hierarchy and HA placement bridge.

export type HaLabelSuggestion = {
  id: string
  display: string
}

export type LocationReadModelRow = {
  id: string
  name: string
  parent_location_id: string | null
  parent_name: string | null
  depth: number
  path: string
  path_for_label: string
  ha_area_id: string | null
  ha_label_id: string | null
  effective_ha_area_id: string | null
  effective_area_source_location_id: string | null
  effective_area_source_location_name: string | null
  suggested_ha_label_id: string | null
  suggested_ha_label_display: string | null
}

export function slugifyLocationPath(path: string): string {
  const slug = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  return slug || 'location'
}

export function suggestHaLabelFromPath(pathParts: string[]): HaLabelSuggestion {
  const path = pathParts.map((part) => part.trim()).filter(Boolean).join(' / ')
  const fallbackPath = path || 'Location'
  return {
    id: `loc_${slugifyLocationPath(fallbackPath)}`,
    display: `Location: ${fallbackPath}`,
  }
}

export const LOCATION_TREE_CTE = `
WITH RECURSIVE loc_tree AS (
  SELECT
    l.id::text AS id,
    l.name,
    l.parent_location_id::text AS parent_location_id,
    NULL::text AS parent_name,
    0::int AS depth,
    l.name::text AS path,
    l.name::text AS path_for_label,
    ARRAY[l.id::text]::text[] AS id_path,
    l.ha_area_id,
    l.ha_label_id,
    l.ha_area_id AS effective_ha_area_id,
    CASE WHEN l.ha_area_id IS NOT NULL THEN l.id::text ELSE NULL END AS effective_area_source_location_id,
    CASE WHEN l.ha_area_id IS NOT NULL THEN l.name ELSE NULL END AS effective_area_source_location_name
  FROM location l
  WHERE l.parent_location_id IS NULL

  UNION ALL

  SELECT
    child.id::text AS id,
    child.name,
    child.parent_location_id::text AS parent_location_id,
    parent.name AS parent_name,
    parent.depth + 1 AS depth,
    parent.path || ' > ' || child.name AS path,
    parent.path_for_label || ' / ' || child.name AS path_for_label,
    parent.id_path || child.id::text AS id_path,
    child.ha_area_id,
    child.ha_label_id,
    COALESCE(child.ha_area_id, parent.effective_ha_area_id) AS effective_ha_area_id,
    CASE
      WHEN child.ha_area_id IS NOT NULL THEN child.id::text
      ELSE parent.effective_area_source_location_id
    END AS effective_area_source_location_id,
    CASE
      WHEN child.ha_area_id IS NOT NULL THEN child.name
      ELSE parent.effective_area_source_location_name
    END AS effective_area_source_location_name
  FROM location child
  JOIN loc_tree parent ON child.parent_location_id::text = parent.id
  WHERE NOT child.id::text = ANY(parent.id_path)
), loc_read_model AS (
  SELECT
    id,
    name,
    parent_location_id,
    parent_name,
    depth,
    path,
    path_for_label,
    ha_area_id,
    ha_label_id,
    effective_ha_area_id,
    effective_area_source_location_id,
    effective_area_source_location_name,
    CASE
      WHEN ha_label_id IS NULL THEN 'loc_' || COALESCE(
        NULLIF(
          regexp_replace(
            regexp_replace(lower(path_for_label), '[^a-z0-9]+', '_', 'g'),
            '(^_+|_+$)', '', 'g'
          ),
          ''
        ),
        'location'
      )
      ELSE NULL
    END AS suggested_ha_label_id,
    CASE WHEN ha_label_id IS NULL THEN 'Location: ' || path_for_label ELSE NULL END AS suggested_ha_label_display
  FROM loc_tree
)
`
