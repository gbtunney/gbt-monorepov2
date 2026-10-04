// Shared types and helpers for the resumable equipment intake workflow.
import { ValidationError } from './shared'

/** Workflow-control statuses for intake drafts (deliberately NOT lifecycle stages). */
export type IntakeStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export const ACTIVE_INTAKE_STATUSES: readonly IntakeStatus[] = ['pending', 'in_progress']

export function isIntakeStatus(value: unknown): value is IntakeStatus {
  return value === 'pending' || value === 'in_progress' || value === 'completed' || value === 'cancelled'
}

export function requireIntakeStatus(value: unknown): IntakeStatus {
  if (!isIntakeStatus(value)) throw new ValidationError(`Unknown intake status "${String(value)}"`)
  return value
}

/** Guided-flow step keys; stored on the intake so the wizard resumes where it left off. */
export type IntakeStepKey =
  | 'acquisition'
  | 'identify'
  | 'assign_id'
  | 'product_details'
  | 'placement'
  | 'ha_setup'
  | 'finish'

export const INTAKE_STEP_ORDER: readonly IntakeStepKey[] = [
  'acquisition', 'identify', 'assign_id', 'product_details', 'placement', 'ha_setup', 'finish',
]

export function isIntakeStepKey(value: unknown): value is IntakeStepKey {
  return typeof value === 'string' && (INTAKE_STEP_ORDER as readonly string[]).includes(value)
}

export type IntakeRow = {
  id: string
  status: IntakeStatus
  working_name: string
  equipment_type_id: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_source: string | null
  purchase_order_id: string | null
  acquired_at: string | null
  direct_location_id: string | null
  bin_id: string | null
  notes: string | null
  reserved_physical_id: string | null
  current_step: string | null
  resulting_equipment_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  cancelled_at: string | null
}

/** Optional intake fields that update_draft may set; only present keys are applied. */
export type IntakeDraftPatch = {
  workingName?: string
  equipmentTypeId?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  purchaseSource?: string
  purchaseOrderId?: string
  acquiredAt?: string
  directLocationId?: string
  binId?: string
  notes?: string
  currentStep?: string
}

/** Loads one intake row or throws; used by every mutating intake command. */
export async function loadIntakeOrThrow(intakeId: string): Promise<IntakeRow> {
  const result = await retoolDb.query(`SELECT * FROM equipment_intake WHERE id = $1::text`, [intakeId])
  const row = result.data[0] as IntakeRow | undefined
  if (!row) throw new ValidationError('Intake draft not found')
  return row
}

export function assertIntakeActive(row: IntakeRow): void {
  if (!ACTIVE_INTAKE_STATUSES.includes(row.status)) {
    throw new ValidationError(`Intake is already ${row.status}; only pending or in-progress drafts can be changed`)
  }
}

/** Normalizes a date-only string (YYYY-MM-DD) or rejects it. */
export function optionalDateOnly(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${field} is not a valid date`)
  return parsed.toISOString().slice(0, 10)
}
