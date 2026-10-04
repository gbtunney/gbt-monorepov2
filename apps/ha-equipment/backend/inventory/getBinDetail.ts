// Bin detail: bin fields, contents, event history, scan tag / deep link.
type Params = {
  binId: string
}

export default async function(req: { params: Params }) {
  const binId = String(req.params?.binId ?? '')
  if (!binId) throw new Error('binId is required')

  const head = await retoolDb.query(
    `SELECT b.*, l.name AS location_name, lp.name AS parent_location_name,
      st.tag_code, st.target_url
    FROM bin b
    LEFT JOIN location l ON l.id = b.location_id
    LEFT JOIN location lp ON lp.id = l.parent_location_id
    LEFT JOIN scan_tag st ON st.bin_id = b.id AND st.enabled
    WHERE b.id = $1`,
    [binId],
  )
  const bin = head.data[0]
  if (!bin) throw new Error('Bin not found')

  const [contents, events] = await Promise.all([
    retoolDb.query(
      `SELECT e.id, e.physical_id, e.display_name, e.archived_at,
        t.name AS type_name, s.name AS stage_name, s.code AS stage_code
      FROM equipment e
      JOIN equipment_type t ON t.id = e.equipment_type_id
      JOIN lifecycle_stage s ON s.id = e.lifecycle_stage_id
      WHERE e.bin_id = $1
      ORDER BY e.display_name`,
      [binId],
    ),
    retoolDb.query(
      `SELECT id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json
      FROM bin_event WHERE bin_id = $1
      ORDER BY occurred_at DESC, recorded_at DESC LIMIT 100`,
      [binId],
    ),
  ])

  return {
    bin,
    contents: contents.data,
    events: events.data,
  }
}
