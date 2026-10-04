// Intake queue: unfinished drafts first (most recently touched), then recent finished ones.
export default async function() {
  const result = await retoolDb.query(`
    SELECT i.id, i.status, i.working_name, i.equipment_type_id, i.reserved_physical_id,
      i.current_step, i.purchase_source, i.purchase_order_id, i.acquired_at,
      i.manufacturer, i.model, i.serial_number, i.direct_location_id, i.bin_id,
      i.notes, i.resulting_equipment_id, i.created_at, i.updated_at, i.completed_at, i.cancelled_at,
      t.name AS type_name, t.id_prefix AS type_prefix,
      e.display_name AS resulting_equipment_name
    FROM equipment_intake i
    LEFT JOIN equipment_type t ON t.id = i.equipment_type_id
    LEFT JOIN equipment e ON e.id = i.resulting_equipment_id
    ORDER BY CASE WHEN i.status IN ('pending', 'in_progress') THEN 0 ELSE 1 END,
      i.updated_at DESC
    LIMIT 200`)
  return { intakes: result.data }
}
