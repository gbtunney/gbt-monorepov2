// Suggests the next physical ID for an intake, considering BOTH canonical equipment
// physical_ids and physical IDs reserved by other active intakes. The legacy Google
// Sheet has NOT been imported, so legacy UIDs are NOT known to this suggestion.
import { loadIntakeOrThrow } from './intakeShared'

type Params = {
  intakeId: string
  candidateIndex?: string // optional: check a specific numeric index instead of suggesting
}

export default async function(req: { params: Params }) {
  const intakeId = String(req.params?.intakeId ?? '')
  if (!intakeId) throw new Error('intakeId is required')
  const intake = await loadIntakeOrThrow(intakeId)

  const typeResult = await retoolDb.query(
    `SELECT id, name, id_prefix FROM equipment_type WHERE id = $1::text`,
    [intake.equipment_type_id ?? ''],
  )
  const equipmentType = typeResult.data[0]
  const prefix = equipmentType?.id_prefix ? String(equipmentType.id_prefix) : null
  if (!prefix) {
    return {
      intakeId,
      prefix: null,
      suggestion: null,
      candidate: null,
      candidateAvailable: null,
      note: 'Choose an equipment type with an ID prefix to get suggestions. You can always use the legacy/exact-UID path instead.',
    }
  }

  // Highest numeric suffix seen for this prefix across canonical equipment (including
  // archived history) and physical IDs reserved by OTHER active intakes.
  const equipmentRows = await retoolDb.query(
    `SELECT physical_id FROM equipment WHERE physical_id = $1::text OR physical_id LIKE $2::text`,
    [prefix, `${prefix}_%`],
  )
  const intakeRows = await retoolDb.query(
    `SELECT reserved_physical_id FROM equipment_intake
    WHERE (reserved_physical_id = $1::text OR reserved_physical_id LIKE $2::text)
      AND status IN ('pending', 'in_progress') AND id <> $3::text`,
    [prefix, `${prefix}_%`, intakeId],
  )

  const escapedPrefix = prefix.replace(/[^a-z0-9]/gi, '')
  const suffixPattern = new RegExp(`^${escapedPrefix}[_-](\\d+)$`, 'i')
  let highestSuffix = 0
  const checkRows = [...equipmentRows.data, ...intakeRows.data]
  for (const row of checkRows) {
    const value = row.reserved_physical_id ?? row.physical_id
    const match = String(value).match(suffixPattern)
    if (match?.[1]) {
      const numeric = Number(match[1])
      if (Number.isFinite(numeric) && numeric > highestSuffix) highestSuffix = numeric
    }
  }
  const nextIndex = highestSuffix + 1

  // Optional candidate check: is a specific numeric index free?
  let candidate: string | null = null
  let candidateAvailable: boolean | null = null
  if (req.params?.candidateIndex !== undefined && String(req.params.candidateIndex).trim() !== '') {
    const raw = String(req.params.candidateIndex).trim()
    if (!/^\d+$/.test(raw)) throw new Error('candidateIndex must be digits only')
    candidate = `${prefix}_${raw}`
    const equipmentTaken = await retoolDb.query(`SELECT 1 FROM equipment WHERE physical_id = $1::text`, [candidate])
    const intakeTaken = await retoolDb.query(
      `SELECT 1 FROM equipment_intake
      WHERE reserved_physical_id = $1::text AND status IN ('pending', 'in_progress') AND id <> $2::text`,
      [candidate, intakeId],
    )
    candidateAvailable = equipmentTaken.data.length === 0 && intakeTaken.data.length === 0
  }

  return {
    intakeId,
    prefix,
    typeName: equipmentType ? String(equipmentType.name) : null,
    highestKnownSuffix: highestSuffix,
    suggestion: `${prefix}_${nextIndex}`,
    candidate,
    candidateAvailable,
    reservedPhysicalId: intake.reserved_physical_id,
    scopeNote: 'Suggestions only know IDs already stored in Retool plus IDs reserved by active intakes. The legacy Google Sheet has NOT been imported, so legacy UIDs are not accounted for — use the exact/legacy UID path when in doubt.',
  }
}
