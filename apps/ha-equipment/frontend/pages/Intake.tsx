import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, PackagePlus, Trash2 } from 'lucide-react'
import { useGetIntakeQueue, useGetLookupData, useRunIntakeCommand } from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Textarea } from '../lib/shadcn/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Separator } from '../lib/shadcn/separator'
import { errorMessage, timeAgo } from '../utils/inventory'

type IntakeQueueRow = {
  id: string
  status: string
  working_name: string
  equipment_type_id: string | null
  type_name: string | null
  reserved_physical_id: string | null
  current_step: string | null
  purchase_source: string | null
  purchase_order_id: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  resulting_equipment_id: string | null
  resulting_equipment_name: string | null
  updated_at: string
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900',
  in_progress: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-900',
  completed: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900',
  cancelled: 'bg-zinc-200 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
}

function intakeProgress(row: IntakeQueueRow): string[] {
  const done: string[] = []
  if (row.equipment_type_id) done.push('type')
  if (row.reserved_physical_id) done.push('ID')
  if (row.manufacturer || row.model || row.serial_number) done.push('details')
  if (row.purchase_source || row.purchase_order_id) done.push('acquisition')
  return done
}

export default function Intake() {
  const { data, loading, error, trigger } = useGetIntakeQueue()
  const { trigger: runCommand, loading: commanding } = useRunIntakeCommand()

  useEffect(() => { trigger() }, [trigger])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  const rows = (data?.intakes ?? []) as IntakeQueueRow[]
  const active = rows.filter((row) => row.status === 'pending' || row.status === 'in_progress')
  const finished = rows.filter((row) => row.status !== 'pending' && row.status !== 'in_progress')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Legacy Intake Drafts</h1>
        <p className="text-sm text-muted-foreground">
          Existing draft/reservation access is preserved. Use this only to safely finalize or cancel active legacy drafts;
          new physical items should be registered from Equipment with Quick Register.
        </p>
      </div>

      <QuickIntakeCard commanding={commanding} onCreated={() => trigger()} />

      {loading && rows.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
      ) : active.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No open intake drafts.</p>
      ) : (
        <div className="space-y-3">
          {active.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/intake/${row.id}`} className="font-medium hover:underline">{row.working_name}</Link>
                    <Badge variant="outline" className={STATUS_BADGE[row.status]}>{row.status.replace('_', ' ')}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{row.type_name ?? 'No type yet'}</span>
                    <span className="font-mono">{row.reserved_physical_id ?? 'no ID reserved'}</span>
                    <span>at step: {(row.current_step ?? 'identify').replace(/_/g, ' ')}</span>
                    <span>has: {intakeProgress(row).join(', ') || 'nothing yet'}</span>
                    <span>updated {timeAgo(row.updated_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link to={`/intake/${row.id}`}>Resume <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                    disabled={commanding}
                    onClick={() => {
                      runCommand({ command: 'cancel', intakeId: row.id }).then(() => trigger()).catch(() => trigger())
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <>
          <Separator />
          <h2 className="text-sm font-medium text-muted-foreground">Recently finished</h2>
          <div className="space-y-2">
            {finished.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
                <span className={row.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}>{row.working_name}</span>
                {row.status === 'completed' && row.resulting_equipment_id ? (
                  <Link to={`/equipment/${row.resulting_equipment_id}`} className="text-primary hover:underline">
                    {row.resulting_equipment_name ?? 'View equipment'}
                  </Link>
                ) : (
                  <Badge variant="outline" className={STATUS_BADGE[row.status]}>{row.status}</Badge>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QuickIntakeCard({ commanding, onCreated }: { commanding: boolean; onCreated: () => void }) {
  const { trigger: runCommand } = useRunIntakeCommand()
  const [form, setForm] = useState({ workingName: '', typeId: '', purchaseSource: '', purchaseOrderId: '', acquiredAt: '', notes: '' })
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!form.workingName.trim()) { setFormError('Give it a working name.'); return }
    try {
      await runCommand({
        command: 'start',
        workingName: form.workingName.trim(),
        equipmentTypeId: form.typeId || undefined,
        purchaseSource: form.purchaseSource.trim() || undefined,
        purchaseOrderId: form.purchaseOrderId.trim() || undefined,
        acquiredAt: form.acquiredAt || undefined,
        notes: form.notes.trim() || undefined,
      })
      setForm({ workingName: '', typeId: '', purchaseSource: '', purchaseOrderId: '', acquiredAt: '', notes: '' })
      onCreated()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <PackagePlus className="h-5 w-5 text-primary" />
        <h2 className="font-medium">Quick intake — remember it now</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="qi-name">Working name</Label>
          <Input
            id="qi-name" value={form.workingName} placeholder="e.g. new space heater for the reptile room"
            onChange={(event) => setForm((current) => ({ ...current, workingName: event.target.value }))}
          />
        </div>
        <TypeSelect value={form.typeId} onChange={(value) => setForm((current) => ({ ...current, typeId: value }))} />
        <div className="space-y-1">
          <Label htmlFor="qi-source">Purchase source</Label>
          <Input id="qi-source" value={form.purchaseSource} onChange={(event) => setForm((current) => ({ ...current, purchaseSource: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qi-order">Order ID</Label>
          <Input id="qi-order" value={form.purchaseOrderId} onChange={(event) => setForm((current) => ({ ...current, purchaseOrderId: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="qi-date">Acquired</Label>
          <Input id="qi-date" type="date" value={form.acquiredAt} onChange={(event) => setForm((current) => ({ ...current, acquiredAt: event.target.value }))} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="qi-notes">Notes</Label>
          <Textarea id="qi-notes" rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </div>
      </div>
      {formError && <p className="mt-2 text-sm text-destructive">{formError}</p>}
      <div className="mt-3 flex justify-end">
        <Button onClick={submit} disabled={commanding}>{commanding ? 'Saving…' : 'Remember it'}</Button>
      </div>
    </div>
  )
}

function TypeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { data: lookups, trigger: triggerLookups } = useGetLookupData()
  const typeOptions = (lookups?.types ?? []) as { id: string; name: string }[]
  useEffect(() => { triggerLookups() }, [triggerLookups])
  return (
    <div className="space-y-1">
      <Label>Type (optional)</Label>
      <Select value={value || 'none'} onValueChange={(selected) => onChange(selected === 'none' ? '' : selected)}>
        <SelectTrigger><SelectValue placeholder="Not sure yet" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not sure yet</SelectItem>
          {typeOptions.map((typeOption) => <SelectItem key={typeOption.id} value={typeOption.id}>{typeOption.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
