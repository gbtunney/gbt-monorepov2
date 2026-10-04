import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, CheckCircle2, History, PlayCircle } from 'lucide-react'
import {
  useGetAuditInbox, useRequestAudit, useRunAuditFromHaSnapshot, useRunCompletenessAudit, useUpdateFindingStatus,
} from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/shadcn/dialog'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Separator } from '../lib/shadcn/separator'
import { SeverityBadge, StatusBadge } from './ui/badges'
import { errorMessage, fmtDateTime, newIdempotencyKey, timeAgo, type AuditFindingId, type FindingStatus } from '../utils/inventory'

type FindingRow = {
  id: AuditFindingId
  equipment_id: string | null
  entity_id: string | null
  category: string
  severity: string
  confidence: string
  title: string
  explanation: string | null
  suggested_action: string | null
  status: string
  first_seen_at: string
  last_seen_at: string
  equipment_name: string | null
  equipment_physical_id: string | null
}

type RunRow = {
  id: string
  source: string
  status: string
  requested_at: string
  completed_at: string | null
  summary: string | null
  error: string | null
}

const RUN_STATUS_CLASS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  partial: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
  failed: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
  requested: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
}

export default function Audit() {
  const { data, loading, error, trigger } = useGetAuditInbox()
  const { trigger: updateFinding } = useUpdateFindingStatus()
  const { trigger: requestAudit, loading: requesting } = useRequestAudit()
  const { trigger: runCompleteness, loading: completenessRunning } = useRunCompletenessAudit()
  const { trigger: runSnapshotAudit, loading: snapshotAuditRunning } = useRunAuditFromHaSnapshot()

  const [snoozeFor, setSnoozeFor] = useState<FindingRow | null>(null)
  const [snoozeDays, setSnoozeDays] = useState('7')
  const [actionError, setActionError] = useState<string | null>(null)
  const [completenessResult, setCompletenessResult] = useState<string | null>(null)

  useEffect(() => { trigger() }, [trigger])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  const findings: FindingRow[] = data?.findings ?? []
  const runs: RunRow[] = data?.runs ?? []
  const counts = (data?.severityCounts ?? {}) as Record<string, number>

  const setStatus = async (finding: FindingRow, status: FindingStatus, snoozedUntil?: string) => {
    setActionError(null)
    try {
      await updateFinding({ findingId: finding.id, status, snoozedUntil })
      trigger()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {data?.activeLinks ?? 0} active entity links across {data?.linkedEquipment ?? 0} items ·
            last audit {timeAgo(data?.latestCompletedRunAt)}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={completenessRunning}
          onClick={async () => {
            setActionError(null)
            try {
              const result = await runCompleteness({})
              setCompletenessResult(result?.summary ?? 'Completeness check finished.')
              trigger()
            } catch (err) {
              setActionError(errorMessage(err))
            }
          }}
        >
          <CheckCircle2 className="h-4 w-4" /> {completenessRunning ? 'Checking…' : 'Check inventory completeness'}
        </Button>
        <Button
          variant="outline"
          disabled={snapshotAuditRunning}
          onClick={async () => {
            setActionError(null)
            try {
              const result = await runSnapshotAudit({})
              setCompletenessResult(
                result?.ran
                  ? `Re-audited ${result.entitiesAudited} linked entities from the stored HA snapshot (snapshot time ${result.sourceSnapshotAt}). No live HA connection was used.`
                  : String(result?.message ?? 'Nothing to audit from the stored snapshot.'),
              )
              trigger()
            } catch (err) {
              setActionError(errorMessage(err))
            }
          }}
        >
          <History className="h-4 w-4" /> {snapshotAuditRunning ? 'Auditing…' : 'Run audit from stored HA snapshot'}
        </Button>
        <Button
          disabled={requesting}
          onClick={async () => {
            setActionError(null)
            try {
              await requestAudit({ requestedBy: 'app', idempotencyKey: newIdempotencyKey() })
              trigger()
            } catch (err) {
              setActionError(errorMessage(err))
            }
          }}
        >
          <PlayCircle className="h-4 w-4" /> {requesting ? 'Requesting…' : 'Request audit'}
        </Button>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      <Alert>
        <AlertDescription className="text-sm">
          Home Assistant collector: <strong>not connected</strong>. HA audits only reflect snapshots submitted manually or
          by an external runner — findings can be stale or pending between runs, and this page never fetches live HA data.
          The <strong>inventory completeness</strong> check runs locally against this database and does not need the
          collector. "Run audit from stored HA snapshot" re-runs the existing snapshot rules over the last imported HA
          snapshot — also no live connection.
        </AlertDescription>
      </Alert>

      {completenessResult && (
        <Alert>
          <AlertDescription className="text-sm">{completenessResult}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['critical', 'error', 'warning', 'info'] as const).map((sev) => (
          <div key={sev} className="rounded-lg border border-border bg-card p-4">
            <div className="text-2xl font-semibold">{counts[sev] ?? 0}</div>
            <SeverityBadge severity={sev} />
          </div>
        ))}
      </div>

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4 space-y-3">
          {loading && findings.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : findings.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 h-8 w-8" />
              No currently open findings.
              <span className="mt-1 block text-xs">
                This does not guarantee equipment is healthy — the HA collector is not connected, so audits depend on
                manually submitted snapshots and results may be stale or pending.
              </span>
            </p>
          ) : (
            findings.map((finding) => (
              <div key={finding.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={finding.severity} />
                  <span className="font-medium">{finding.title}</span>
                  <StatusBadge status={finding.status} />
                </div>
                {finding.explanation && <p className="mt-1.5 text-sm text-muted-foreground">{finding.explanation}</p>}
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  {finding.equipment_id && finding.equipment_name && (
                    <Link to={`/equipment/${finding.equipment_id}`} className="text-primary hover:underline">
                      {finding.equipment_name}
                    </Link>
                  )}
                  {finding.entity_id && <span className="font-mono">{finding.entity_id}</span>}
                  <span>{finding.category.replace(/_/g, ' ')} · confidence {finding.confidence}</span>
                  <span>first seen {timeAgo(finding.first_seen_at)} · last seen {timeAgo(finding.last_seen_at)}</span>
                </div>
                {finding.suggested_action && (
                  <p className="mt-1 text-sm"><span className="text-muted-foreground">Suggested: </span>{finding.suggested_action}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStatus(finding, 'acknowledged')}>Acknowledge</Button>
                  <Button variant="outline" size="sm" onClick={() => setSnoozeFor(finding)}>Snooze…</Button>
                  <Button variant="outline" size="sm" onClick={() => setStatus(finding, 'resolved')}>Resolve</Button>
                  <Button variant="outline" size="sm" onClick={() => setStatus(finding, 'ignored')}>Ignore</Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge variant="outline" className={RUN_STATUS_CLASS[run.status] ?? ''}>{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{run.source}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDateTime(run.requested_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDateTime(run.completed_at)}</TableCell>
                    <TableCell className="max-w-xs text-sm">
                      {run.error ? <span className="text-destructive">{run.error}</span> : run.summary ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No audit runs yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <SnoozeDialog
        finding={snoozeFor}
        days={snoozeDays}
        setDays={setSnoozeDays}
        onClose={() => setSnoozeFor(null)}
        onConfirm={async () => {
          if (!snoozeFor) return
          await setStatus(snoozeFor, 'snoozed', new Date(Date.now() + Number(snoozeDays) * 864e5).toISOString())
          setSnoozeFor(null)
        }}
      />
    </div>
  )
}

function SnoozeDialog({ finding, days, setDays, onClose, onConfirm }: {
  finding: FindingRow | null
  days: string
  setDays: (d: string) => void
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  return (
    <Dialog open={finding !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Snooze finding</DialogTitle>
          <DialogDescription>Hide this finding until the snooze expires.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="snooze-days">Days</Label>
          <Input id="snooze-days" type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Snooze</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
