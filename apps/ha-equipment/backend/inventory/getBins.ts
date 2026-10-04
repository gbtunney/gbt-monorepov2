// Bins list with contents counts and effective location.
export default async function() {
  const result = await retoolDb.query(
    `SELECT b.id, b.bin_code, b.name, b.notes, b.archived_at,
      l.id AS location_id, l.name AS location_name, lp.name AS parent_location_name,
      (SELECT count(*)::int FROM equipment e WHERE e.bin_id = b.id AND e.archived_at IS NULL) AS item_count,
      (SELECT count(*)::int FROM scan_tag st WHERE st.bin_id = b.id AND st.enabled) AS tag_count
    FROM bin b
    LEFT JOIN location l ON l.id = b.location_id
    LEFT JOIN location lp ON lp.id = l.parent_location_id
    ORDER BY b.archived_at IS NOT NULL, b.bin_code`,
  )
  return { bins: result.data }
}
