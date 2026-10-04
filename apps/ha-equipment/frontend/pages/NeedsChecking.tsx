import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, MapPin, RefreshCw, Search } from 'lucide-react'
import { useGetNeedsChecking, useRunEquipmentCommand } from '../hooks/backend/inventory'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { errorMessage, fmtDateTime, newIdempotencyKey, timeAgo } from '../utils/inventory'

type NeedRow = {
  id: string
  physical_id: string
  display_name: string
  version: number
  type_name: string
  stage_name: string
  stage_code: string
  condition_status: string
  review_flag: boolean
  review_reason: string | null
  proposed_cleanup_note: string | null
  id_marking_status: string
  bin_name: string | null
  bin_code: string | null
  effective_location_path: string | null
  direct_location_path: string | null
  intended_location_path: string | null
  checklist_done_count: number
  checklist_not_applicable_count: number
  checklist_pending_count: number
  link_count: number
  reasons: string[]
  physicalWhereabouts: 'bin' | 'located' | 'unknown'
  registryLinkStatus: 'linked' | 'not_confirmed'
  haAvailabilityStatus: 'offline' | 'unavailable' | 'has_snapshot_evidence' | 'unknown'
  sleepyBatteryCount: number
  findings: Array<{ id: string; title: string; severity: string; explanation: string | null; status: string; last_seen_at: string | null }>
  followup_tasks: Array<{ id: string; task_type: string; created_at: string; due_at: string | null; age_days: number; note: string | null }>
  active_removals: Array<{ id: string; removal_type: string; removed_at: string; duration_days: number; custody_bin_name: string | null; custody_location_path: string | null; custody_unknown: boolean }>
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All needs checking' },
  { value: 'manual', label: 'Manual flags' },
  { value: 'condition', label: 'Needs testing / broken' },
  { value: 'whereabouts', label: 'Unknown whereabouts' },
  { value: 'followup', label: 'Open Follow-up tasks' },
  { value: 'needs_battery_change', label: 'Awaiting battery' },
  { value: 'needs_testing', label: 'Awaiting testing' },
  { value: 'temporary_removed', label: 'Removed awaiting return' },
  { value: 'ha', label: 'HA registry/audit' },
  { value: 'unavailable', label: 'Unavailable/offline evidence' },
]

const SORT_OPTIONS = [
  { value: 'default', label: 'Default sort' },
  { value: 'oldest_battery', label: 'Oldest awaiting battery' },
  { value: 'oldest_testing', label: 'Oldest awaiting testing' },
  { value: 'oldest_removed', label: 'Oldest removed awaiting return' },
]

function matchesFilter(row: NeedRow, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === 'manual') return row.review_flag
  if (filter === 'condition') return row.condition_status === 'needs_testing' || row.condition_status === 'confirmed_broken'
  if (filter === 'whereabouts') return row.physicalWhereabouts === 'unknown'
  if (filter === 'followup') return row.followup_tasks.length > 0
  if (filter === 'needs_battery_change') return row.followup_tasks.some((task) => task.task_type === 'needs_battery_change')
  if (filter === 'needs_testing') return row.followup_tasks.some((task) => task.task_type === 'needs_testing')
  if (filter === 'temporary_removed') return row.active_removals.some((removal) => removal.removal_type === 'temporary')
  if (filter === 'ha') return row.registryLinkStatus === 'not_confirmed' && row.findings.length > 0
  if (filter === 'unavailable') return row.haAvailabilityStatus === 'offline' || row.haAvailabilityStatus === 'unavailable'
  return true
}

export default function NeedsChecking() {
  const { data, loading, error, trigger } = useGetNeedsChecking()
  const { trigger: runCommand, loading: saving } = useRunEquipmentCommand()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('default')
  const [q, setQ] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { trigger({ limit: 300, filter, sort }) }, [trigger, filter, sort])

  const rows = (data?.items ?? []) as NeedRow[]
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false
      if (!query) return true
      return [row.display_name, row.physical_id, row.type_name, row.review_reason, ...(row.reasons ?? [])]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    })
  }, [rows, filter, q])

  const clearReview = async (row: NeedRow) => {
    setActionError(null)
    try {
      await runCommand({
        command: 'review_update',
        equipmentId: row.id,
        expectedVersion: row.version,
        reviewFlag: false,
        reviewReason: '',
        idempotencyKey: newIdempotencyKey(),
      })
      trigger({ limit: 300, filter, sort })
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const refresh = () => trigger({ limit: 300, filter, sort })

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Needs Checking</h1>
          <p className="text-sm text-muted-foreground">
            Open Follow-up tasks, manual review flags, condition concerns, temporary removals awaiting return, and relevant HA audit findings.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search item, ID, reason…" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent>{FILTER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No items match this checking filter.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/equipment/${row.id}`} className="font-medium hover:underline">{row.display_name}</Link>
                    <Badge variant="outline" className="font-mono">{row.physical_id}</Badge>
                    <Badge variant="secondary">{row.condition_status.replace(/_/g, ' ')}</Badge>
                    {row.review_flag && <Badge variant="outline">manual flag</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{row.type_name}</span>
                    <span>{row.stage_name}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {placementText(row)}</span>
                    <span>Intended: {row.intended_location_path ?? '—'}</span>
                    <span>Install: {row.checklist_done_count + row.checklist_not_applicable_count}/5 resolved</span>
                    <span>Follow-up: {row.followup_tasks.length} open</span>
                    <span>Removed: {row.active_removals.length > 0 ? `${row.active_removals.length} awaiting return` : 'no'}</span>
                    <span>HA links: {row.link_count}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link to={`/equipment/${row.id}`}>Open checklist</Link></Button>
                  {row.review_flag && (
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => clearReview(row)}>
                      <CheckCircle2 className="h-4 w-4" /> Clear review flag
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Reason</div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.reasons.map((reason, index) => (
                      <Badge key={`${reason}-${index}`} variant="outline" className="whitespace-normal text-left">{reason}</Badge>
                    ))}
                  </div>
                  {row.followup_tasks.length > 0 && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {row.followup_tasks.map((task) => (
                        <div key={task.id}>Follow-up: {task.task_type.replace(/_/g, ' ')} · age {task.age_days}d{task.due_at ? ` · due ${fmtDateTime(task.due_at)}` : ''}{task.note ? ` · ${task.note}` : ''}</div>
                      ))}
                    </div>
                  )}
                  {row.active_removals.length > 0 && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {row.active_removals.map((removal) => (
                        <div key={removal.id}>Removed awaiting return · duration {removal.duration_days}d · custody {removal.custody_bin_name ? `Bin: ${removal.custody_bin_name}` : removal.custody_location_path ?? 'unknown'}</div>
                      ))}
                    </div>
                  )}
                  {row.proposed_cleanup_note && <p className="text-sm text-muted-foreground">Cleanup/check note: {row.proposed_cleanup_note}</p>}
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                  <div className="mb-2 flex items-center gap-1.5 font-medium text-foreground"><AlertCircle className="h-4 w-4" /> Status distinctions</div>
                  <div className="grid gap-1.5">
                    <StatusLine label="Physical whereabouts" value={row.physicalWhereabouts === 'unknown' ? 'Unknown' : row.physicalWhereabouts === 'bin' ? 'Known bin' : 'Known location'} />
                    <StatusLine label="Registry link" value={row.registryLinkStatus === 'linked' ? 'Confirmed explicit link' : 'No confirmed link'} />
                    <StatusLine label="HA availability" value={availabilityText(row)} />
                    <StatusLine label="Battery/sleepy note" value={row.sleepyBatteryCount > 0 ? `${row.sleepyBatteryCount} possible sleepy/battery signal${row.sleepyBatteryCount === 1 ? '' : 's'}` : 'No sleepy battery signal flagged'} />
                  </div>
                  <p className="mt-2 text-muted-foreground">Unavailable or no recent activity is context only; this page does not infer broken from it.</p>
                </div>
              </div>

              {row.findings.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {row.findings.map((finding) => (
                    <div key={finding.id}>
                      Audit: {finding.title}{finding.last_seen_at ? ` · seen ${timeAgo(finding.last_seen_at)}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function placementText(row: NeedRow): string {
  if (row.bin_name) return `Bin: ${row.bin_name}${row.bin_code ? ` (${row.bin_code})` : ''}`
  return row.effective_location_path ?? row.direct_location_path ?? 'Unknown whereabouts'
}

function availabilityText(row: NeedRow): string {
  if (row.haAvailabilityStatus === 'offline') return 'Offline evidence present'
  if (row.haAvailabilityStatus === 'unavailable') return 'Unavailable evidence present, not broken by itself'
  if (row.haAvailabilityStatus === 'has_snapshot_evidence') return 'Snapshot evidence present'
  return 'Unknown / no snapshot evidence'
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
