// Suggest the next physical ID for a type, based on the type's id_prefix and existing
// physical IDs matching prefix_<number> (e.g. hyg_14 -> hyg_15). Considers canonical
// equipment, including archived rows, plus active intake reservations so suggestions avoid
// collisions with unfinished drafts. Purely advisory: the suggestion is never reserved.
type Params = {
  typeId: string
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default async function(req: { params: Params }) {
  const typeId = String(req.params?.typeId ?? '')
  if (!typeId) throw new Error('typeId is required')

  const typeResult = await retoolDb.query(`SELECT id, name, id_prefix FROM equipment_type WHERE id = $1`, [typeId])
  const type = typeResult.data[0]
  if (!type) throw new Error('Equipment type not found')

  const prefix = type.id_prefix ? String(type.id_prefix) : null
  if (!prefix) {
    return {
      typeId,
      typeName: String(type.name),
      prefix: null,
      suggestion: null,
      pattern: null,
      note: 'This type has no id_prefix configured. Set one in Settings to enable suggestions; manual IDs remain fully supported.',
    }
  }

  // Highest existing numeric suffix for this prefix, across active and archived records,
  // plus active intake reservations, so suggestions never collide with history or drafts.
  const [equipmentRows, reservationRows] = await Promise.all([
    retoolDb.query(
      `SELECT physical_id FROM equipment WHERE physical_id = $1 OR physical_id LIKE $2`,
      [prefix, `${prefix}_%`],
    ),
    retoolDb.query(
      `SELECT reserved_physical_id AS physical_id FROM equipment_intake
       WHERE status IN ('pending', 'in_progress')
         AND reserved_physical_id IS NOT NULL
         AND (reserved_physical_id = $1 OR reserved_physical_id LIKE $2)`,
      [prefix, `${prefix}_%`],
    ),
  ])
  let maxSuffix = 0
  const escaped = escapeRegex(prefix)
  for (const row of [...equipmentRows.data, ...reservationRows.data]) {
    const physicalId = String(row.physical_id)
    const match = physicalId.match(new RegExp(`^${escaped}[_-](\\d+)$`, 'i'))
    if (match?.[1]) {
      const value = Number(match[1])
      if (Number.isFinite(value) && value > maxSuffix) maxSuffix = value
    }
  }
  const next = maxSuffix + 1

  return {
    typeId,
    typeName: String(type.name),
    prefix,
    suggestion: `${prefix}_${next}`,
    pattern: `${prefix}_<number>`,
    highestExisting: maxSuffix,
    activeReservationCount: reservationRows.data.length,
    note: 'Advisory only. The ID is not reserved until creation; manual override is always allowed. Suggestions include canonical equipment and active intake reservations, but not unregistered legacy spreadsheet rows — use the exact handwritten UID when present.',
  }
}
