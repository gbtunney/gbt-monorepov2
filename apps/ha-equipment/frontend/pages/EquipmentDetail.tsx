import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Archive, ArchiveRestore, BatteryCharging, ClipboardList, Link2, MapPin, Pencil, ScrollText,
} from 'lucide-react'
import {
  useGetEquipmentDetail, useGetHaLinkSuggestions, useGetLookupData, useRunEquipmentCommand, useRunSettingsCommand, useUpdateFindingStatus,
} from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Textarea } from '../lib/shadcn/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Separator } from '../lib/shadcn/separator'
import { SeverityBadge, StageBadge, StatusBadge } from './ui/badges'
import { InstallationWorkflow } from './ui/InstallationWorkflow'
import { EquipmentLabelDialog } from './ui/EquipmentLabelDialog'
import { errorMessage, fmtDate, fmtDateTime, newIdempotencyKey, timeAgo, type AuditFindingId, type EquipmentId, type FindingStatus, type HaEntityLinkId } from '../utils/inventory'

type EquipmentRow = {
  id: EquipmentId
  physical_id: string
  display_name: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_source: string | null
  purchase_order_id: string | null
  purchased_at: string | null
  ip_address: string | null
  mac_address: string | null
  fcc_id: string | null
  feed_url: string | null
  notes: string | null
  version: number
  archived_at: string | null
  type_name: string
  stage_name: string
  stage_code: string
  expects_online: boolean
  bin_name: string | null
  bin_id: string | null
  bin_code: string | null
  direct_location_id: string | null
  direct_location_name: string | null
  direct_location_path: string | null
  effective_location_name: string | null
  effective_location_path: string | null
  effective_parent_name: string | null
  effective_ha_area_id: string | null
  effective_ha_label_id: string | null
  effective_area_source_location_name: string | null
  intended_location_id: string | null
  intended_location_name: string | null
  intended_location_path: string | null
  id_marking_status: string
  condition_status: string
  review_flag: boolean
  review_reason: string | null
  review_updated_at: string | null
  proposed_cleanup_note: string | null
}

type LinkRow = {
  id: HaEntityLinkId
  entity_id: string
  integration: string | null
  role: string | null
  active: boolean
  last_seen_at: string | null
}

type EventRow = {
  id: string
  event_type: string
  occurred_at: string
  actor: string
  source: string
  notes: string | null
}

type ChecklistRow = {
  equipment_id: string
  step_key: string
  status: 'todo' | 'unknown' | 'done' | 'not_applicable'
  note: string | null
  changed_at: string
  changed_by: string
}

type FindingRow = {
  id: AuditFindingId
  category: string
  severity: string
  title: string
  explanation: string | null
  suggested_action: string | null
  status: string
  last_seen_at: string | null
}

type LookupData = {
  stages: { id: string; name: string }[]
  locations: {
    id: string
    path: string
    effective_ha_area_id: string | null
    ha_label_id: string | null
  }[]
  bins: {
    id: string
    name: string
    location_path?: string | null
    effective_ha_area_id?: string | null
    ha_label_id?: string | null
  }[]
}

type HaPlacementPlan = {
  syncNeeded: boolean
  snapshotStatus: string
  effectiveHaAreaId: string | null
  haLabelId: string | null
  linkedHaTargets: Array<{ entityId: string; haDeviceId: string | null; snapshotComparison: string }>
}

type CommandKind = 'rename' | 'move' | 'lifecycle_change' | 'battery_change' | 'note' | 'correction'

export default function EquipmentDetail() {
  const { equipmentId = '' } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, trigger } = useGetEquipmentDetail()
  const { data: lookups, trigger: triggerLookups } = useGetLookupData()
  const { trigger: runCommand, loading: commanding } = useRunEquipmentCommand()
  const { trigger: settingsCommand } = useRunSettingsCommand()
  const { trigger: updateFinding } = useUpdateFindingStatus()

  const [cmdOpen, setCmdOpen] = useState(false)
  const [cmdKind, setCmdKind] = useState<CommandKind>('rename')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (equipmentId) trigger({ equipmentId })
  }, [trigger, equipmentId])

  useEffect(() => { load() }, [load])
  useEffect(() => { triggerLookups() }, [triggerLookups])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }
  if (loading && !data) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  }

  const eq = data?.equipment as EquipmentRow | undefined
  if (!eq) return <p className="text-muted-foreground">Not found.</p>

  const doCommand = async (payload: Record<string, unknown>) => {
    setActionError(null)
    try {
      await runCommand({ equipmentId: eq.id, idempotencyKey: newIdempotencyKey(), ...payload })
      setCmdOpen(false)
      trigger({ equipmentId })
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const openFindings = (data?.openFindings ?? []) as FindingRow[]
  const completenessCount = openFindings.filter((finding) => finding.category === 'completeness').length
  const haPlacementPlan = data?.haPlacementPlan as HaPlacementPlan | undefined
  const haPlacementStatus = haPlacementPlan?.syncNeeded
    ? 'Sync pending'
    : eq.effective_ha_area_id || eq.effective_ha_label_id
      ? 'Mapped'
      : 'Unmapped'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" /> Back to equipment
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {eq.display_name}
            {eq.archived_at && <Badge variant="outline">Archived</Badge>}
            <StageBadge code={eq.stage_code} name={eq.stage_name} />
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{eq.physical_id}</span> · {eq.type_name}
            {eq.manufacturer ? ` · ${eq.manufacturer}` : ''}{eq.model ? ` ${eq.model}` : ''}
          </p>
          {completenessCount > 0 && (
            <Link to="/audit" className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:underline dark:text-amber-400">
              <ClipboardList className="h-4 w-4" />
              {completenessCount} completeness follow-up{completenessCount === 1 ? '' : 's'} — review in Audit Inbox
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <EquipmentLabelDialog equipment={eq} />
          <Button variant="outline" size="sm" onClick={() => { setCmdKind('note'); setCmdOpen(true) }}>
            <ScrollText className="h-4 w-4" /> Add note
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setCmdKind('battery_change'); setCmdOpen(true) }}>
            <BatteryCharging className="h-4 w-4" /> Battery
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Link HA entity
          </Button>
          <Button size="sm" onClick={() => setDetailsOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit details
          </Button>
          {eq.archived_at ? (
            <Button variant="outline" size="sm" onClick={() => doCommand({ command: 'unarchive' })} disabled={commanding}>
              <ArchiveRestore className="h-4 w-4" /> Unarchive
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => doCommand({ command: 'archive' })} disabled={commanding}>
              <Archive className="h-4 w-4" /> Archive
            </Button>
          )}
          <Button size="sm" onClick={() => { setCmdKind('rename'); setCmdOpen(true) }}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="installation">Installation</TabsTrigger>
          <TabsTrigger value="links">HA Links ({(data?.haLinks ?? []).length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="findings">Findings ({(data?.openFindings ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Placement</h3>
              <dl className="space-y-2 text-sm">
                <Field label="Location">
                  {eq.bin_name
                    ? `Bin: ${eq.bin_name}${eq.bin_code ? ` (${eq.bin_code})` : ''}${eq.effective_location_path ? ` · ${eq.effective_location_path}` : ''}`
                    : eq.effective_location_path
                      ? eq.effective_location_path
                      : 'Unplaced'}
                </Field>
                <Field label="Direct location">{eq.direct_location_path ?? eq.direct_location_name ?? '—'}</Field>
                <Field label="Intended area">{eq.intended_location_path ?? '—'}</Field>
                <Field label="HA placement">
                  {eq.effective_ha_area_id || eq.effective_ha_label_id ? (
                    <span className="inline-flex flex-wrap gap-1.5">
                      {eq.effective_ha_area_id && <Badge variant="outline" className="font-mono text-xs">Area: {eq.effective_ha_area_id}</Badge>}
                      {eq.effective_ha_label_id && <Badge variant="secondary" className="font-mono text-xs">Label: {eq.effective_ha_label_id}</Badge>}
                    </span>
                  ) : '—'}
                </Field>
                <Field label="HA placement status">
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <Badge variant={haPlacementStatus === 'Unmapped' ? 'outline' : 'secondary'} className="text-xs">{haPlacementStatus}</Badge>
                    {haPlacementPlan && haPlacementPlan.linkedHaTargets.length > 0 && (
                      <span className="text-xs text-muted-foreground">{haPlacementPlan.linkedHaTargets.length} linked HA object{haPlacementPlan.linkedHaTargets.length === 1 ? '' : 's'}</span>
                    )}
                  </span>
                </Field>
                <Field label="Expects online">{eq.expects_online ? 'Yes' : 'No'}</Field>
                <Field label="Version">{eq.version}</Field>
              </dl>
              <Separator className="my-3" />
              <Button variant="outline" size="sm" onClick={() => { setCmdKind('move'); setCmdOpen(true) }}>
                <MapPin className="h-4 w-4" /> Move
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">Details</h3>
              <dl className="space-y-2 text-sm">
                <Field label="Condition">{eq.condition_status.replace(/_/g, ' ')}</Field>
                <Field label="ID marking">{eq.id_marking_status.replace(/_/g, ' ')}</Field>
                <Field label="Review flag">{eq.review_flag ? (eq.review_reason ?? 'Needs checking') : 'No'}</Field>
                <Field label="Serial number">{eq.serial_number ?? '—'}</Field>
                <Field label="Purchase source">{eq.purchase_source ?? '—'}</Field>
                <Field label="Purchase order ID">{eq.purchase_order_id ?? '—'}</Field>
                <Field label="Purchased">{fmtDate(eq.purchased_at)}</Field>
                <Field label="IP address">{eq.ip_address ?? '—'}</Field>
                <Field label="MAC address">{eq.mac_address ?? '—'}</Field>
                <Field label="FCC ID">{eq.fcc_id ?? '—'}</Field>
                <Field label="Feed endpoint">{eq.feed_url ?? '—'}</Field>
                <Field label="Notes">{eq.notes ?? '—'}</Field>
                <Field label="Stage">
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" onClick={() => { setCmdKind('lifecycle_change'); setCmdOpen(true) }}>
                    Change stage
                  </Button>
                </Field>
                <Field label="Physical ID">
                  <span className="font-mono">{eq.physical_id}</span>{' '}
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" onClick={() => { setCmdKind('correction'); setCmdOpen(true) }}>
                    Correct
                  </Button>
                </Field>
              </dl>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="installation" className="mt-4">
          <InstallationWorkflow
            equipment={eq}
            checklist={(data?.installationChecklist ?? []) as ChecklistRow[]}
            links={(data?.haLinks ?? []) as LinkRow[]}
            followupTasks={(data?.followupTasks ?? []) as never[]}
            removalRecords={(data?.removalRecords ?? []) as never[]}
            lookups={{
              locations: (lookups?.locations ?? []) as LookupData['locations'],
              bins: (lookups?.bins ?? []) as LookupData['bins'],
            }}
            onSaved={() => { trigger({ equipmentId }) }}
          />
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <LinkList
            links={(data?.haLinks ?? []) as LinkRow[]}
            onUnlink={async (linkId) => {
              await settingsCommand({ command: 'unlink_entity', linkId, idempotencyKey: newIdempotencyKey() })
              trigger({ equipmentId })
            }}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <EventHistory events={(data?.events ?? []) as EventRow[]} />
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <FindingList
            findings={openFindings}
            onStatus={async (status, findingId) => {
              await updateFinding({
                findingId, status,
                snoozedUntil: status === 'snoozed' ? new Date(Date.now() + 7 * 864e5).toISOString() : undefined,
              })
              trigger({ equipmentId })
            }}
          />
        </TabsContent>
      </Tabs>

      <CommandDialog
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        kind={cmdKind}
        current={eq}
        submitting={commanding}
        onSubmit={doCommand}
        error={actionError}
        stages={(lookups?.stages ?? []) as LookupData['stages']}
        locations={(lookups?.locations ?? []) as LookupData['locations']}
        bins={(lookups?.bins ?? []) as LookupData['bins']}
      />

      <EditDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        equipment={eq}
        submitting={commanding}
        onSubmit={doCommand}
      />

      <LinkEntityDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        equipmentId={eq.id}
        equipmentName={eq.display_name}
        onLinked={() => trigger({ equipmentId })}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function LinkList({ links, onUnlink }: { links: LinkRow[]; onUnlink: (linkId: HaEntityLinkId) => Promise<void> }) {
  if (links.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No Home Assistant entities linked to this item.</p>
  }
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead>Integration</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((locationOption) => (
            <TableRow key={locationOption.id}>
              <TableCell className="font-mono text-sm">{locationOption.entity_id}</TableCell>
              <TableCell className="text-sm">{locationOption.integration ?? '—'}</TableCell>
              <TableCell className="text-sm">{locationOption.role ?? '—'}</TableCell>
              <TableCell>{locationOption.active ? <Badge variant="outline" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{timeAgo(locationOption.last_seen_at)}</TableCell>
              <TableCell className="text-right">
                {locationOption.active && (
                  <Button variant="ghost" size="sm" onClick={() => onUnlink(locationOption.id)}>Unlink</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function EventHistory({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No events recorded yet.</p>
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">{event.event_type}</Badge>
            <span className="text-sm">{fmtDateTime(event.occurred_at)}</span>
            <span className="text-xs text-muted-foreground">
              by {event.actor} · {event.source} · {timeAgo(event.occurred_at)}
            </span>
          </div>
          {event.notes && <p className="mt-2 text-sm text-muted-foreground">{event.notes}</p>}
        </li>
      ))}
    </ol>
  )
}

function FindingList({ findings, onStatus }: { findings: FindingRow[]; onStatus: (status: FindingStatus, findingId: AuditFindingId) => Promise<void> }) {
  if (findings.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No open findings for this item.</p>
  }
  return (
    <div className="space-y-3">
      {findings.map((finding) => (
        <div key={finding.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="font-medium">{finding.title}</span>
            <StatusBadge status={finding.status} />
          </div>
          {finding.explanation && <p className="mt-1.5 text-sm text-muted-foreground">{finding.explanation}</p>}
          {finding.suggested_action && (
            <p className="mt-1 text-sm"><span className="text-muted-foreground">Suggested: </span>{finding.suggested_action}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onStatus('acknowledged', finding.id)}>Acknowledge</Button>
            <Button variant="outline" size="sm" onClick={() => onStatus('snoozed', finding.id)}>Snooze 7d</Button>
            <Button variant="outline" size="sm" onClick={() => onStatus('resolved', finding.id)}>Resolve</Button>
            <Button variant="outline" size="sm" onClick={() => onStatus('ignored', finding.id)}>Ignore</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

const COMMAND_LABELS: Record<CommandKind, string> = {
  rename: 'Rename item',
  move: 'Move item',
  lifecycle_change: 'Change lifecycle stage',
  battery_change: 'Log battery change',
  note: 'Add note',
  correction: 'Correct physical ID',
}

function CommandDialog({
  open, onOpenChange, kind, current, submitting, onSubmit, error, stages, locations, bins,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CommandKind
  current: EquipmentRow
  submitting: boolean
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  error: string | null
  stages: { id: string; name: string }[]
  locations: LookupData['locations']
  bins: LookupData['bins']
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [locationId, setLocationId] = useState('')
  const [binId, setBinId] = useState('')
  const [stageId, setStageId] = useState('')
  const [physicalId, setPhysicalId] = useState('')

  const selectedLocation = locations.find((locationOption) => locationOption.id === locationId)
  const selectedBin = bins.find((binOption) => binOption.id === binId)

  const close = () => onOpenChange(false)

  const submit = async () => {
    if (kind === 'rename') await onSubmit({ command: 'rename', newDisplayName: name, notes })
    else if (kind === 'move') await onSubmit({ command: 'move', newLocationId: locationId || undefined, newBinId: binId || undefined, notes })
    else if (kind === 'lifecycle_change') await onSubmit({ command: 'lifecycle_change', newStageId: stageId, notes })
    else if (kind === 'battery_change') await onSubmit({ command: 'battery_change', notes })
    else if (kind === 'note') await onSubmit({ command: 'note', notes })
    else if (kind === 'correction') await onSubmit({ command: 'correction', newPhysicalId: physicalId, notes })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{COMMAND_LABELS[kind]}</DialogTitle>
          <DialogDescription>{current.display_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {kind === 'rename' && (
            <div className="space-y-1">
              <Label htmlFor="cmd-name">New display name</Label>
              <Input id="cmd-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {kind === 'correction' && (
            <div className="space-y-1">
              <Label htmlFor="cmd-phys">Corrected physical ID</Label>
              <Input id="cmd-phys" value={physicalId} onChange={(e) => setPhysicalId(e.target.value)} />
            </div>
          )}
          {kind === 'move' && (
            <>
              <div className="space-y-1">
                <Label>Move to location</Label>
                <Select value={locationId || 'none'} onValueChange={(v) => { setLocationId(v === 'none' ? '' : v); setBinId('') }}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {locations.map((locationOption) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>…or move to bin</Label>
                <Select value={binId || 'none'} onValueChange={(v) => { setBinId(v === 'none' ? '' : v); setLocationId('') }}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {bins.map((binOption) => <SelectItem key={binOption.id} value={binOption.id}>{binOption.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <MoveHaPlacementPreview location={selectedLocation} bin={selectedBin} />
            </>
          )}
          {kind === 'lifecycle_change' && (
            <div className="space-y-1">
              <Label>New stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{stages.map((stageOption) => <SelectItem key={stageOption.id} value={stageOption.id}>{stageOption.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {kind !== 'rename' && kind !== 'correction' && (
            <div className="space-y-1">
              <Label htmlFor="cmd-notes">Notes {kind === 'note' || kind === 'battery_change' ? '' : '(optional)'}</Label>
              <Textarea id="cmd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || notes.trim() === '' && kind !== 'rename' && kind !== 'move' && kind !== 'lifecycle_change' && kind !== 'correction'}>
            {submitting ? 'Applying…' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveHaPlacementPreview({ location, bin }: {
  location: LookupData['locations'][number] | undefined
  bin: LookupData['bins'][number] | undefined
}) {
  const targetPath = location?.path ?? bin?.location_path ?? null
  const effectiveHaAreaId = location?.effective_ha_area_id ?? bin?.effective_ha_area_id ?? null
  const haLabelId = location?.ha_label_id ?? bin?.ha_label_id ?? null
  const hasHaPlacement = Boolean(effectiveHaAreaId || haLabelId)

  if (!location && !bin) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Select a location or bin to preview expected HA placement. No Home Assistant write will be performed.
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
      <div className="font-medium text-foreground">Expected HA placement plan</div>
      <div className="grid gap-1.5">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Retool location</span>
          <span className="text-right">{targetPath ?? 'Unplaced'}</span>
        </div>
        {bin && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Bin</span>
            <span className="text-right">{bin.name}</span>
          </div>
        )}
        {hasHaPlacement ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Effective HA Area</span>
              <span className="font-mono text-right">{effectiveHaAreaId ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">HA sub-location label</span>
              <span className="font-mono text-right">{haLabelId ?? '—'}</span>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">HA placement is unmapped for this target.</div>
        )}
      </div>
      <p className="text-muted-foreground">Preview only; Retool is not writing to Home Assistant.</p>
    </div>
  )
}

function EditDetailsDialog({ open, onOpenChange, equipment, submitting, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentRow
  submitting: boolean
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [form, setForm] = useState({
    displayName: '', manufacturer: '', model: '', serialNumber: '', purchaseSource: '',
    purchaseOrderId: '',
    purchasedAt: '', ipAddress: '', macAddress: '', fccId: '', feedUrl: '', notes: '',
  })

  // Seed from the loaded record each time the dialog opens.
  useEffect(() => {
    if (!open) return
    setForm({
      displayName: equipment.display_name ?? '',
      manufacturer: equipment.manufacturer ?? '',
      model: equipment.model ?? '',
      serialNumber: equipment.serial_number ?? '',
      purchaseSource: equipment.purchase_source ?? '',
      purchaseOrderId: equipment.purchase_order_id ?? '',
      purchasedAt: equipment.purchased_at ? String(equipment.purchased_at).slice(0, 10) : '',
      ipAddress: equipment.ip_address ?? '',
      macAddress: equipment.mac_address ?? '',
      fccId: equipment.fcc_id ?? '',
      feedUrl: equipment.feed_url ?? '',
      notes: equipment.notes ?? '',
    })
  }, [open, equipment])

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            Changes are recorded as an append-only METADATA_UPDATE event. Unchanged fields are ignored.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ed-name">Display name</Label>
            <Input id="ed-name" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-serial">Serial number</Label>
            <Input id="ed-serial" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-make">Manufacturer</Label>
            <Input id="ed-make" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-model">Model number</Label>
            <Input id="ed-model" value={form.model} onChange={(e) => set('model', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-source">Purchase source</Label>
            <Input id="ed-source" value={form.purchaseSource} onChange={(e) => set('purchaseSource', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-order">Purchase order ID</Label>
            <Input id="ed-order" value={form.purchaseOrderId} onChange={(e) => set('purchaseOrderId', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-purchased">Purchase date</Label>
            <Input id="ed-purchased" type="date" value={form.purchasedAt} onChange={(e) => set('purchasedAt', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-ip">IP address</Label>
            <Input id="ed-ip" value={form.ipAddress} onChange={(e) => set('ipAddress', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-mac">MAC address</Label>
            <Input id="ed-mac" value={form.macAddress} onChange={(e) => set('macAddress', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-fcc">FCC ID</Label>
            <Input id="ed-fcc" value={form.fccId} onChange={(e) => set('fccId', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ed-feed">Feed URL / endpoint</Label>
            <Input id="ed-feed" value={form.feedUrl} onChange={(e) => set('feedUrl', e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ed-notes">Notes</Label>
            <Textarea id="ed-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Physical ID is corrected separately via the Physical ID correction action.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting}
            onClick={async () => {
              await onSubmit({
                command: 'metadata_update',
                displayName: form.displayName,
                manufacturer: form.manufacturer,
                model: form.model,
                serialNumber: form.serialNumber,
                purchaseSource: form.purchaseSource,
                purchaseOrderId: form.purchaseOrderId,
                purchasedAt: form.purchasedAt,
                ipAddress: form.ipAddress,
                macAddress: form.macAddress,
                fccId: form.fccId,
                feedUrl: form.feedUrl,
                notes: form.notes,
              })
              onOpenChange(false)
            }}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LinkEntityDialog({ open, onOpenChange, equipmentId, equipmentName, onLinked }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentName: string
  onLinked: () => void
}) {
  const { trigger: settingsCommand, loading } = useRunSettingsCommand()
  const { data: suggestions, trigger: fetchSuggestions } = useGetHaLinkSuggestions()
  const [form, setForm] = useState({ entityId: '', haInstanceId: 'default_ha', haDeviceId: '', integration: '', role: '', outletIndex: '' })
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFormError(null)
      fetchSuggestions({ equipmentId }).catch(() => undefined)
    }
  }, [open, equipmentId, fetchSuggestions])

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const applySuggestion = (suggestion: { entity_id: string; ha_device_id: string | null; integration: string | null; platform: string | null }) => {
    setForm((current) => ({
      ...current,
      entityId: suggestion.entity_id,
      haDeviceId: suggestion.ha_device_id ?? '',
      integration: suggestion.integration ?? suggestion.platform ?? current.integration,
    }))
  }

  const submit = async () => {
    setFormError(null)
    if (!form.entityId.trim()) { setFormError('Entity ID is required.'); return }
    try {
      await settingsCommand({
        command: 'link_entity',
        equipmentId,
        entityId: form.entityId.trim(),
        haInstanceId: form.haInstanceId.trim() || undefined,
        haDeviceId: form.haDeviceId.trim() || undefined,
        integration: form.integration.trim() || undefined,
        role: form.role.trim() || undefined,
        outletIndex: form.outletIndex.trim() === '' ? undefined : Number(form.outletIndex),
        idempotencyKey: newIdempotencyKey(),
      })
      onOpenChange(false)
      setForm({ entityId: '', haInstanceId: 'default_ha', haDeviceId: '', integration: '', role: '', outletIndex: '' })
      onLinked()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  const suggestionRows = (suggestions?.suggestions ?? []) as {
    entity_id: string; ha_device_id: string | null; integration: string | null; platform: string | null
    friendly_name: string | null; match_reason: string
  }[]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link HA entity</DialogTitle>
          <DialogDescription>Map a Home Assistant entity to {equipmentName}. Mapping only — no live connection, and HA never overwrites inventory fields.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {suggestionRows.length > 0 && (
            <div className="space-y-1">
              <Label>From current snapshot (deterministic suggestions)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {suggestionRows.map((suggestion) => (
                  <button
                    key={suggestion.entity_id} type="button"
                    className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    <span className="font-mono">{suggestion.entity_id}</span>
                    {suggestion.friendly_name ? <span className="text-muted-foreground"> · {suggestion.friendly_name}</span> : null}
                    <span className="block text-muted-foreground">{suggestion.match_reason}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="le-entity">Entity ID</Label>
              <Input id="le-entity" className="font-mono" value={form.entityId} onChange={(event) => set('entityId', event.target.value)} placeholder="sensor.hyg_14_battery" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="le-instance">HA instance</Label>
              <Input id="le-instance" value={form.haInstanceId} onChange={(event) => set('haInstanceId', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="le-device">HA device ID</Label>
              <Input id="le-device" className="font-mono text-xs" value={form.haDeviceId} onChange={(event) => set('haDeviceId', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="le-integration">Integration</Label>
              <Input id="le-integration" value={form.integration} onChange={(event) => set('integration', event.target.value)} placeholder="e.g. tasmota, zwave" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="le-role">Role</Label>
              <Input id="le-role" value={form.role} onChange={(event) => set('role', event.target.value)} placeholder="e.g. battery, power" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="le-outlet">Outlet index</Label>
              <Input id="le-outlet" type="number" value={form.outletIndex} onChange={(event) => set('outletIndex', event.target.value)} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Linking…' : 'Link'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
