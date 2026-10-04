// Shared validation + error helpers for inventory backend functions.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}


export function requireString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${field} exceeds ${maxLength} characters`)
  }
  return trimmed
}

export function optionalString(value: unknown, field: string, maxLength = 5000): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`)
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > maxLength) throw new ValidationError(`${field} exceeds ${maxLength} characters`)
  return trimmed
}

export function requireUuid(value: unknown, field: string): string {
  // Historical name kept for existing callers. Live Retool DB IDs are text columns and may
  // contain UUID-shaped values or other stable text IDs, so validate non-empty text only.
  return requireString(value, field, 200)
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  return requireUuid(value, field)
}

export function requireIdempotencyKey(value: unknown): string {
  const key = optionalString(value, 'idempotencyKey', 200)
  if (!key) throw new ValidationError('idempotencyKey is required for every command')
  return key
}

/** Accepts an ISO 8601 timestamp or null/undefined (falls back to now). */
export function occurredAtOrNow(value: unknown, field = 'occurredAt'): string {
  if (value === undefined || value === null || value === '') return new Date().toISOString()
  if (typeof value !== 'string') throw new ValidationError(`${field} must be an ISO 8601 string`)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`${field} is not a valid ISO 8601 timestamp`)
  return parsed.toISOString()
}

export function actorName(user: User | undefined): string {
  if (!user) return 'unknown'
  if (user.fullName && user.fullName.trim().length > 0) return user.fullName.trim()
  return user.email || 'unknown'
}

/** Detects a unique-constraint violation so idempotent retries can succeed quietly. */
export function isUniqueViolation(error: unknown, constraintSubstring: string): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('duplicate key') && message.includes(constraintSubstring)
}

export function isCheckViolation(error: unknown, constraintSubstring: string): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('check constraint') && message.includes(constraintSubstring)
}

export function isForeignKeyViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('violates foreign key constraint')
}

export function jsonValue(value: unknown): string {
  return JSON.stringify(value ?? {})
}
