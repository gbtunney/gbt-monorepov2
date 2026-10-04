// Full intake draft for resuming the guided flow, plus DB-backed placement options.
export default async function(req: { params: { intakeId: string } }) {
  const intakeId = String(req.params?.intakeId ?? '')
  if (!intakeId) throw new Error('intakeId is required')

  const head = await retoolDb.query(`
    SELECT i.*, t.name AS type_name, t.id_prefix AS type_prefix,
      loc.name AS direct_location_name, b.name AS bin_name,
      e.display_name AS resulting_equipment_name
    FROM equipment_intake i
    LEFT JOIN equipment_type t ON t.id = i.equipment_type_id
    LEFT JOIN location loc ON loc.id = i.direct_location_id
    LEFT JOIN bin b ON b.id = i.bin_id
    LEFT JOIN equipment e ON e.id = i.resulting_equipment_id
    WHERE i.id = $1::text`,
    [intakeId],
  )
  const intake = head.data[0]
  if (!intake) throw new Error('Intake draft not found')
  return { intake }
}
