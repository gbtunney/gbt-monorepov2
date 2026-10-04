// Formatting helpers and shared display config for the inventory UI.

/** Compile-time branded string: no runtime wrapper, just a distinct type for IDs. */
type Branded<Value extends string, Name extends string> = Value & { readonly __brand: Name }

export type EquipmentId = Branded<string, 'EquipmentId'>
export type EquipmentTypeId = Branded<string, 'EquipmentTypeId'>
export type LifecycleStageId = Branded<string, 'LifecycleStageId'>
export type LocationId = Branded<string, 'LocationId'>
export type BinId = Branded<string, 'BinId'>
export type HaEntityLinkId = Branded<string, 'HaEntityLinkId'>
export type AuditFindingId = Branded<string, 'AuditFindingId'>

/** Finding status transitions the UI itself drives; the DB stores these as text. */
export type FindingStatus = 'open' | 'acknowledged' | 'snoozed' | 'resolved' | 'ignored'

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

export type SeverityStyle = { label: string; className: string }

export const SEVERITY_STYLES: Record<string, SeverityStyle> = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900' },
  error: { label: 'Error', className: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-900' },
  warning: { label: 'Warning', className: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900' },
  info: { label: 'Info', className: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-900' },
}

export function severityStyle(severity: string): SeverityStyle {
  return SEVERITY_STYLES[severity] ?? { label: severity, className: 'bg-secondary text-secondary-foreground' }
}

/**
 * Presentation-only styling keyed by lifecycle stage code. This map never validates stages
 * and never enumerates which stages are legal — equipment_type/lifecycle_stage DB rows are
 * the only source of truth for that. Unknown stage codes fall back to neutral styling.
 */
const STAGE_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900',
  spare: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-900',
  repair: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900',
  retired: 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  sold: 'bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:border-violet-900',
}

export function stageClass(code: string): string {
  return STAGE_STYLES[code] ?? 'bg-secondary text-secondary-foreground'
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `k_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
