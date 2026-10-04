import { useEffect, useState } from 'react'
import { BatteryCharging, CheckCircle2, ClipboardCheck, ClipboardList, MapPin, RotateCcw, Tag } from 'lucide-react'
import { useRunEquipmentCommand } from '../../hooks/backend/inventory'
import { Alert, AlertDescription } from '../../lib/shadcn/alert'
import { Badge } from '../../lib/shadcn/badge'
import { Button } from '../../lib/shadcn/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../lib/shadcn/dialog'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Textarea } from '../../lib/shadcn/textarea'
import { errorMessage, fmtDateTime, newIdempotencyKey } from '../../utils/inventory'

type ChecklistStatus = 'todo' | 'unknown' | 'done' | 'not_applicable'
type TaskType = 'needs_testing' | 'needs_battery_change' | 'needs_labeling' | 'needs_setup' | 'needs_placement_reinstallation' | 'proposed_entity_name_cleanup'

type ChecklistRow = { equipment_id: string; step_key: string; status: ChecklistStatus; note: string | null; changed_at: string; changed_by: string }
type LinkRow = { id: string; entity_id: string; integration: string | null; role: string | null; active: boolean; last_seen_at: string | null }
type TaskRow = {
  id: string; task_type: TaskType; status: 'open' | 'completed'; note: string | null; due_at: string | null
  created_at: string; created_by: string; completed_at: string | null; completion_note: string | null
}
type RemovalRow = {
  id: string; removal_type: 'temporary' | 'permanent'; removed_at: string; returned_at: string | null; reason: string | null
  original_location_path: string | null; original_bin_name: string | null; custody_location_path: string | null
  custody_bin_name: string | null; custody_unknown: boolean
}

type EquipmentForInstall = {
  id: string; version: number; display_name: string; physical_id: string; id_marking_status: string; condition_status: string
  review_flag: boolean; review_reason: string | null; proposed_cleanup_note: string | null
  intended_location_id: string | null; intended_location_path: string | null; bin_name: string | null; bin_code: string | null
  direct_location_id: string | null; bin_id: string | null; effective_location_path: string | null
}

type LookupData = { locations: { id: string; path: string }[]; bins: { id: string; name: string; location_path?: string | null }[] }

const STEPS = [
  { key: 'permanent_device_label', label: 'Permanent device label', detail: 'Box/item handwriting is valid registration; use this when a durable label is actually applied.' },
  { key: 'manufacturer_app_firmware', label: 'Manufacturer app / firmware setup', detail: 'Can be not applicable. Unknown means not checked yet, not broken.' },
  { key: 'ha_link', label: 'Home Assistant device/entity linking', detail: 'Confirmed only by explicit inventory links. Raw imported HA metadata is not treated as a link.' },
  { key: 'physical_placement', label: 'Physical placement evidence', detail: 'Temporary custody does not erase installed-placement evidence. Intended area is planning only.' },
  { key: 'verified_operation', label: 'Verified operation', detail: 'Use after a real function check; unavailable HA state alone is not failure.' },
]

const TASK_LABELS: Record<TaskType, string> = {
  needs_testing: 'Needs testing',
  needs_battery_change: 'Needs battery change',
  needs_labeling: 'Needs labeling',
  needs_setup: 'Needs setup',
  needs_placement_reinstallation: 'Needs placement/reinstallation',
  proposed_entity_name_cleanup: 'Proposed entity name cleanup',
}

const TASK_OPTIONS: Array<{ value: TaskType; label: string }> = Object.entries(TASK_LABELS).map(([value, label]) => ({ value: value as TaskType, label }))
const STATUS_LABELS: Record<ChecklistStatus, string> = { todo: 'Todo', unknown: 'Unknown', done: 'Done', not_applicable: 'N/A' }

function statusClass(status: ChecklistStatus): string {
  if (status === 'done') return 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900'
  if (status === 'not_applicable') return 'bg-secondary text-secondary-foreground'
  if (status === 'todo') return 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900'
  return 'bg-muted text-muted-foreground'
}

function ageText(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const days = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (days <= 0) return 'today'
  return `${days}d`
}

export function InstallationWorkflow({ equipment, checklist, links, followupTasks, removalRecords, lookups, onSaved }: {
  equipment: EquipmentForInstall; checklist: ChecklistRow[]; links: LinkRow[]; followupTasks: TaskRow[]; removalRecords: RemovalRow[]; lookups: LookupData; onSaved: () => void
}) {
  const { trigger: runCommand, loading } = useRunEquipmentCommand()
  const [error, setError] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState({
    idMarkingStatus: equipment.id_marking_status ?? 'unknown', conditionStatus: equipment.condition_status ?? 'unknown',
    reviewFlag: equipment.review_flag, reviewReason: equipment.review_reason ?? '', intendedLocationId: equipment.intended_location_id ?? '',
    proposedCleanupNote: equipment.proposed_cleanup_note ?? '',
  })
  const [dialog, setDialog] = useState<'task' | 'move' | 'testing' | 'temporary' | 'permanent' | null>(null)

  useEffect(() => {
    setReviewForm({
      idMarkingStatus: equipment.id_marking_status ?? 'unknown', conditionStatus: equipment.condition_status ?? 'unknown',
      reviewFlag: equipment.review_flag, reviewReason: equipment.review_reason ?? '', intendedLocationId: equipment.intended_location_id ?? '',
      proposedCleanupNote: equipment.proposed_cleanup_note ?? '',
    })
  }, [equipment])

  const checklistByKey = Object.fromEntries(checklist.map((row) => [row.step_key, row]))
  const activeLinks = links.filter((link) => link.active)
  const openTasks = followupTasks.filter((task) => task.status === 'open')
  const openRemovals = removalRecords.filter((removal) => !removal.returned_at)
  const temporaryRemoval = openRemovals.find((removal) => removal.removal_type === 'temporary')
  const completed = STEPS.filter((step) => {
    const status = checklistByKey[step.key]?.status ?? 'unknown'
    return status === 'done' || status === 'not_applicable'
  }).length

  const run = async (payload: Record<string, unknown>) => {
    setError(null)
    try {
      await runCommand({ equipmentId: equipment.id, expectedVersion: equipment.version, idempotencyKey: newIdempotencyKey(), ...payload })
      onSaved()
      setDialog(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const saveReview = async () => run({ command: 'review_update', ...reviewForm })
  const saveStep = async (stepKey: string, status: ChecklistStatus, note: string) => run({ command: 'installation_check', stepKey, stepStatus: status, notes: note })
  const completeTask = async (task: TaskRow, completionNote?: string) => run({ command: 'complete_followup_task', taskId: task.id, completionNote })
  const recordBatteryAndResolve = async (task: TaskRow) => {
    await run({ command: 'battery_change', notes: `Battery change recorded while resolving task ${task.id}` })
    await runCommand({ equipmentId: equipment.id, expectedVersion: equipment.version, command: 'complete_followup_task', taskId: task.id, completionNote: 'Resolved after battery-change record', idempotencyKey: newIdempotencyKey() })
    onSaved()
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {temporaryRemoval && (
        <Alert>
          <AlertDescription>
            Temporarily removed {ageText(temporaryRemoval.removed_at)} ago. Installed/home placement is retained as{' '}
            {temporaryRemoval.original_bin_name ? `Bin: ${temporaryRemoval.original_bin_name}` : temporaryRemoval.original_location_path ?? 'unknown'};
            current custody is {custodyText(temporaryRemoval)}. HA area/setup evidence is preserved.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-medium"><ClipboardCheck className="h-5 w-5 text-primary" /> Installation checklist</h3>
              <p className="mt-1 text-sm text-muted-foreground">Independent follow-up workflow; steps can be completed in any order.</p>
            </div>
            <Badge variant="outline">{completed}/{STEPS.length} resolved</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {STEPS.map((step) => {
              const row = checklistByKey[step.key]
              return <ChecklistStep key={step.key} stepKey={step.key} label={step.label} detail={step.detail} status={row?.status ?? 'unknown'} note={row?.note ?? ''} changedAt={row?.changed_at ?? null} changedBy={row?.changed_by ?? null} disabled={loading} onSave={saveStep} />
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="flex items-center gap-2 font-medium"><Tag className="h-5 w-5 text-primary" /> Registration status</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <InfoLine label="Physical ID" value={equipment.physical_id} mono />
              <InfoLine label="ID marking" value={equipment.id_marking_status.replace(/_/g, ' ')} />
              <InfoLine label="Condition" value={equipment.condition_status.replace(/_/g, ' ')} />
              <InfoLine label="Installed/home" value={equipment.bin_name ? `Bin: ${equipment.bin_name}` : equipment.effective_location_path ?? 'Unknown'} />
              <InfoLine label="Intended area" value={equipment.intended_location_path ?? '—'} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Intended area, installed/home placement, and temporary custody are separate.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="font-medium">HA evidence</h3>
            {activeLinks.length > 0 ? <div className="mt-2 space-y-2">{activeLinks.map((link) => <div key={link.id} className="rounded-md border border-border p-2 text-xs"><div className="font-mono text-foreground">{link.entity_id}</div><div className="text-muted-foreground">{link.integration ?? 'unknown integration'}{link.role ? ` · ${link.role}` : ''}{link.last_seen_at ? ` · last seen ${fmtDateTime(link.last_seen_at)}` : ''}</div></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No confirmed HA entity/device link. Imported metadata alone is not confirmation.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-medium"><ClipboardList className="h-5 w-5 text-primary" /> Follow-up</h3><Button size="sm" variant="outline" onClick={() => setDialog('task')}>Add task</Button></div>
        {openTasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No open follow-up tasks.</p> : <div className="mt-3 space-y-2">{openTasks.map((task) => <TaskCard key={task.id} task={task} loading={loading} onComplete={completeTask} onBatteryResolve={recordBatteryAndResolve} />)}</div>}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-medium">Placement and removal actions</h3>
        <p className="mt-1 text-sm text-muted-foreground">Temporary removal records custody without changing installed/home placement or HA area. Permanent removal is explicit and separate.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialog('move')}><MapPin className="h-4 w-4" /> Move to existing bin</Button>
          <Button variant="outline" onClick={() => setDialog('testing')}><MapPin className="h-4 w-4" /> Move to bin for testing</Button>
          <Button variant="outline" onClick={() => setDialog('temporary')}>Temporary removal</Button>
          <Button variant="outline" onClick={() => setDialog('permanent')}>Permanent removal</Button>
          {temporaryRemoval && <Button variant="outline" onClick={() => run({ command: 'put_back', removalId: temporaryRemoval.id, notes: 'Returned to retained installed placement' })}><RotateCcw className="h-4 w-4" /> Put back</Button>}
        </div>
      </div>

      <ReviewPanel reviewForm={reviewForm} setReviewForm={setReviewForm} locations={lookups.locations} loading={loading} saveReview={saveReview} />
      <TaskDialog open={dialog === 'task'} onOpenChange={(open) => setDialog(open ? 'task' : null)} loading={loading} onSubmit={(taskType, note, dueAt) => run({ command: 'create_followup_task', taskType, notes: note, dueAt })} />
      <PlacementDialog open={dialog === 'move'} onOpenChange={(open) => setDialog(open ? 'move' : null)} bins={lookups.bins} locations={lookups.locations} loading={loading} onSubmit={(payload) => run({ command: 'move', ...payload })} />
      <TestingDialog open={dialog === 'testing'} onOpenChange={(open) => setDialog(open ? 'testing' : null)} bins={lookups.bins} loading={loading} onSubmit={(testBinId, reason) => run({ command: 'move_to_testing_bin', testBinId, reason })} />
      <RemovalDialog type="temporary" open={dialog === 'temporary'} onOpenChange={(open) => setDialog(open ? 'temporary' : null)} bins={lookups.bins} locations={lookups.locations} loading={loading} onSubmit={(payload) => run({ command: 'temporary_remove', ...payload })} />
      <RemovalDialog type="permanent" open={dialog === 'permanent'} onOpenChange={(open) => setDialog(open ? 'permanent' : null)} bins={lookups.bins} locations={lookups.locations} loading={loading} onSubmit={(payload) => run({ command: 'permanent_remove', ...payload })} />
    </div>
  )
}

function TaskCard({ task, loading, onComplete, onBatteryResolve }: { task: TaskRow; loading: boolean; onComplete: (task: TaskRow, note?: string) => Promise<void>; onBatteryResolve: (task: TaskRow) => Promise<void> }) {
  return <div className="rounded-md border border-border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium">{TASK_LABELS[task.task_type]}</span><span className="ml-2 text-xs text-muted-foreground">age {ageText(task.created_at)}{task.due_at ? ` · due ${fmtDateTime(task.due_at)}` : ''}</span>{task.note && <p className="mt-1 text-muted-foreground">{task.note}</p>}</div><div className="flex gap-2">{task.task_type === 'needs_battery_change' && <Button size="sm" variant="outline" disabled={loading} onClick={() => { void onBatteryResolve(task) }}><BatteryCharging className="h-4 w-4" /> Record battery & resolve</Button>}<Button size="sm" variant="outline" disabled={loading} onClick={() => { void onComplete(task, 'Resolved from equipment card') }}>Complete</Button></div></div></div>
}

function ChecklistStep({ stepKey, label, detail, status, note, changedAt, changedBy, disabled, onSave }: { stepKey: string; label: string; detail: string; status: ChecklistStatus; note: string; changedAt: string | null; changedBy: string | null; disabled: boolean; onSave: (stepKey: string, status: ChecklistStatus, note: string) => Promise<void> }) {
  const [draftStatus, setDraftStatus] = useState<ChecklistStatus>(status)
  const [draftNote, setDraftNote] = useState(note)
  useEffect(() => { setDraftStatus(status); setDraftNote(note) }, [status, note])
  return <div className="rounded-md border border-border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2 font-medium">{draftStatus === 'done' && <CheckCircle2 className="h-4 w-4 text-primary" />}{label}<Badge variant="outline" className={statusClass(status)}>{STATUS_LABELS[status]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{detail}</p>{changedAt && <p className="mt-1 text-xs text-muted-foreground">Last changed {fmtDateTime(changedAt)} by {changedBy ?? 'unknown'}</p>}</div></div><div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as ChecklistStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem><SelectItem value="todo">Todo</SelectItem><SelectItem value="done">Done</SelectItem><SelectItem value="not_applicable">Not applicable</SelectItem></SelectContent></Select><Input value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Optional note" /><Button variant="outline" disabled={disabled} onClick={() => { void onSave(stepKey, draftStatus, draftNote) }}>Save</Button></div></div>
}

function ReviewPanel({ reviewForm, setReviewForm, locations, loading, saveReview }: { reviewForm: { idMarkingStatus: string; conditionStatus: string; reviewFlag: boolean; reviewReason: string; intendedLocationId: string; proposedCleanupNote: string }; setReviewForm: (updater: (current: { idMarkingStatus: string; conditionStatus: string; reviewFlag: boolean; reviewReason: string; intendedLocationId: string; proposedCleanupNote: string }) => { idMarkingStatus: string; conditionStatus: string; reviewFlag: boolean; reviewReason: string; intendedLocationId: string; proposedCleanupNote: string }) => void; locations: LookupData['locations']; loading: boolean; saveReview: () => Promise<void> }) {
  return <div className="rounded-lg border border-border bg-card p-4"><h3 className="font-medium">Review, condition, and planning</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><SelectField label="ID marking" value={reviewForm.idMarkingStatus} onValueChange={(value) => setReviewForm((current) => ({ ...current, idMarkingStatus: value }))} options={[['unknown', 'Unknown'], ['not_marked', 'Not marked yet'], ['box_or_item_marked', 'Handwritten on box/item'], ['permanent_device_label', 'Permanent device label']]} /><SelectField label="Condition/status" value={reviewForm.conditionStatus} onValueChange={(value) => setReviewForm((current) => ({ ...current, conditionStatus: value }))} options={[['unknown', 'Unknown'], ['needs_testing', 'Needs testing'], ['working', 'Working'], ['confirmed_broken', 'Confirmed broken']]} /><div className="space-y-1"><Label>Intended area</Label><Select value={reviewForm.intendedLocationId || 'none'} onValueChange={(value) => setReviewForm((current) => ({ ...current, intendedLocationId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="No intended area" /></SelectTrigger><SelectContent><SelectItem value="none">No intended area</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.path}</SelectItem>)}</SelectContent></Select></div><SelectField label="Manual review flag" value={reviewForm.reviewFlag ? 'yes' : 'no'} onValueChange={(value) => setReviewForm((current) => ({ ...current, reviewFlag: value === 'yes' }))} options={[['no', 'Not flagged'], ['yes', 'Needs checking']]} /><div className="space-y-1 sm:col-span-2"><Label htmlFor="review-reason">Review reason</Label><Input id="review-reason" value={reviewForm.reviewReason} onChange={(event) => setReviewForm((current) => ({ ...current, reviewReason: event.target.value }))} /></div><div className="space-y-1 sm:col-span-2"><Label htmlFor="cleanup-note">Optional cleanup/checking note</Label><Textarea id="cleanup-note" rows={2} value={reviewForm.proposedCleanupNote} onChange={(event) => setReviewForm((current) => ({ ...current, proposedCleanupNote: event.target.value }))} /></div></div><div className="mt-3 flex justify-end"><Button onClick={() => { void saveReview() }} disabled={loading}>{loading ? 'Saving…' : 'Save review fields'}</Button></div></div>
}

function SelectField({ label, value, onValueChange, options }: { label: string; value: string; onValueChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div className="space-y-1"><Label>{label}</Label><Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent></Select></div>
}

function TaskDialog({ open, onOpenChange, loading, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; loading: boolean; onSubmit: (taskType: TaskType, note: string, dueAt: string) => void }) {
  const [taskType, setTaskType] = useState<TaskType>('needs_testing')
  const [note, setNote] = useState('')
  const [dueAt, setDueAt] = useState('')
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add follow-up task</DialogTitle><DialogDescription>Tasks are independent from condition, placement, and setup evidence.</DialogDescription></DialogHeader><div className="space-y-3"><SelectField label="Task" value={taskType} onValueChange={(value) => setTaskType(value as TaskType)} options={TASK_OPTIONS.map((option) => [option.value, option.label])} /><div className="space-y-1"><Label htmlFor="task-due">Due date (optional)</Label><Input id="task-due" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><div className="space-y-1"><Label htmlFor="task-note">Note</Label><Textarea id="task-note" value={note} onChange={(event) => setNote(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading} onClick={() => onSubmit(taskType, note, dueAt)}>Save task</Button></DialogFooter></DialogContent></Dialog>
}

function PlacementDialog({ open, onOpenChange, bins, locations, loading, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; bins: LookupData['bins']; locations: LookupData['locations']; loading: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const isBin = destination.startsWith('bin:')
  const id = destination.slice(4)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Move to existing bin/location</DialogTitle><DialogDescription>Explicitly updates current placement and logs an event.</DialogDescription></DialogHeader><DestinationFields destination={destination} setDestination={setDestination} bins={bins} locations={locations} allowUnknown={false} /><div className="space-y-1"><Label>Reason/notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading || !destination} onClick={() => onSubmit({ newBinId: isBin ? id : undefined, newLocationId: !isBin ? id : undefined, notes })}>Save move</Button></DialogFooter></DialogContent></Dialog>
}

function TestingDialog({ open, onOpenChange, bins, loading, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; bins: LookupData['bins']; loading: boolean; onSubmit: (testBinId: string, reason: string) => void }) {
  const [binId, setBinId] = useState('')
  const [reason, setReason] = useState('')
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Move to bin for testing</DialogTitle><DialogDescription>Records temporary custody in a bin and creates a Needs testing follow-up task. Installed placement and HA area are preserved.</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1"><Label>Testing bin</Label><Select value={binId} onValueChange={setBinId}><SelectTrigger><SelectValue placeholder="Choose existing bin…" /></SelectTrigger><SelectContent>{bins.map((bin) => <SelectItem key={bin.id} value={bin.id}>{bin.name}{bin.location_path ? ` · ${bin.location_path}` : ''}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading || !binId || !reason.trim()} onClick={() => onSubmit(binId, reason)}>Save testing custody</Button></DialogFooter></DialogContent></Dialog>
}

function RemovalDialog({ type, open, onOpenChange, bins, locations, loading, onSubmit }: { type: 'temporary' | 'permanent'; open: boolean; onOpenChange: (open: boolean) => void; bins: LookupData['bins']; locations: LookupData['locations']; loading: boolean; onSubmit: (payload: Record<string, unknown>) => void }) {
  const [destination, setDestination] = useState('unknown')
  const [reason, setReason] = useState('')
  const [taskType, setTaskType] = useState<TaskType | 'none'>(type === 'temporary' ? 'needs_placement_reinstallation' : 'none')
  const isBin = destination.startsWith('bin:')
  const id = destination.slice(4)
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{type === 'temporary' ? 'Temporary removal' : 'Permanent removal'}</DialogTitle><DialogDescription>{type === 'temporary' ? 'Maintenance/temporary custody. Retains installed/home placement, HA area, links, and setup evidence.' : 'Explicitly clears retained installed/home placement while preserving history and links. HA area-clear remains a proposal for review, not an automatic sync.'}</DialogDescription></DialogHeader>{type === 'permanent' && <Alert><AlertDescription>Permanent unlocated means no HA area assignment; this app will not invent an Unlocated area or bin tag, and will not execute HA changes here.</AlertDescription></Alert>}<DestinationFields destination={destination} setDestination={setDestination} bins={bins} locations={locations} allowUnknown /><div className="space-y-1"><Label>Optional follow-up task</Label><Select value={taskType} onValueChange={(value) => setTaskType(value as TaskType | 'none')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No task</SelectItem>{TASK_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Reason</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={loading} onClick={() => onSubmit({ custodyUnknown: destination === 'unknown', custodyBinId: isBin ? id : undefined, custodyLocationId: destination !== 'unknown' && !isBin ? id : undefined, reason, followupTaskTypes: taskType === 'none' ? [] : [taskType] })}>Save {type} removal</Button></DialogFooter></DialogContent></Dialog>
}

function DestinationFields({ destination, setDestination, bins, locations, allowUnknown }: { destination: string; setDestination: (value: string) => void; bins: LookupData['bins']; locations: LookupData['locations']; allowUnknown: boolean }) {
  return <div className="space-y-1"><Label>Destination/custody</Label><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue placeholder="Choose destination…" /></SelectTrigger><SelectContent>{allowUnknown && <SelectItem value="unknown">Explicitly unknown/unlocated</SelectItem>}{bins.map((bin) => <SelectItem key={`bin:${bin.id}`} value={`bin:${bin.id}`}>Bin: {bin.name}{bin.location_path ? ` · ${bin.location_path}` : ''}</SelectItem>)}{locations.map((location) => <SelectItem key={`loc:${location.id}`} value={`loc:${location.id}`}>Location: {location.path}</SelectItem>)}</SelectContent></Select></div>
}

function custodyText(removal: RemovalRow): string {
  if (removal.custody_bin_name) return `Bin: ${removal.custody_bin_name}`
  if (removal.custody_location_path) return removal.custody_location_path
  return 'explicitly unknown/unlocated'
}

function InfoLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className={mono ? 'font-mono text-right' : 'text-right capitalize'}>{value}</dd></div>
}
