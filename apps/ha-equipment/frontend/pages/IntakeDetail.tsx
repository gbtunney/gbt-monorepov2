import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react'
import {
  useGetIntakeDetail, useGetIntakeIdSuggestion, useGetLookupData, useRunCompletenessAudit, useRunIntakeCommand,
} from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Textarea } from '../lib/shadcn/textarea'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Separator } from '../lib/shadcn/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { errorMessage, fmtDate, newIdempotencyKey } from '../utils/inventory'

type IntakeDetail = {
  id: string
  status: string
  working_name: string
  equipment_type_id: string | null
  type_name: string | null
  type_prefix: string | null
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_source: string | null
  purchase_order_id: string | null
  acquired_at: string | null
  direct_location_id: string | null
  direct_location_name: string | null
  bin_id: string | null
  bin_name: string | null
  notes: string | null
  reserved_physical_id: string | null
  current_step: string | null
  resulting_equipment_id: string | null
  created_at: string | null
}

const STEP_LABELS: Record<string, string> = {
  acquisition: 'Acquisition', identify: 'Identify', assign_id: 'Assign ID',
  product_details: 'Product details', placement: 'Placement', ha_setup: 'HA setup', finish: 'Finish',
}
const STEP_ORDER = ['acquisition', 'identify', 'assign_id', 'product_details', 'placement', 'ha_setup', 'finish']

export default function IntakeDetail() {
  const { intakeId = '' } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, trigger } = useGetIntakeDetail()
  const { data: lookups, trigger: triggerLookups } = useGetLookupData()
  const { trigger: runCommand, loading: commanding } = useRunIntakeCommand()
  const { trigger: runCompleteness } = useRunCompletenessAudit()

  const [activeStep, setActiveStep] = useState('acquisition')
  const [actionError, setActionError] = useState<string | null>(null)
  const [finalizeResult, setFinalizeResult] = useState<{ equipmentId: string; physicalId: string } | null>(null)
  const [completenessSummary, setCompletenessSummary] = useState<string | null>(null)

  const reload = useCallback(() => { if (intakeId) trigger({ intakeId }) }, [trigger, intakeId])
  useEffect(() => { reload(); triggerLookups() }, [reload, triggerLookups])

  const intake = data?.intake as IntakeDetail | undefined
  useEffect(() => {
    if (intake?.current_step && STEP_ORDER.includes(intake.current_step)) setActiveStep(intake.current_step)
  }, [intake?.current_step])

  const saveDraft = useCallback(async (patch: Record<string, unknown>, nextStep?: string) => {
    setActionError(null)
    try {
      await runCommand({ command: 'update_draft', intakeId, ...patch, ...(nextStep ? { currentStep: nextStep } : {}) })
      if (nextStep) setActiveStep(nextStep)
      reload()
      return true
    } catch (err) {
      setActionError(errorMessage(err))
      return false
    }
  }, [runCommand, intakeId, reload])

  const typeOptions = (lookups?.types ?? []) as { id: string; name: string; id_prefix?: string | null }[]
  const stageOptions = (lookups?.stages ?? []) as { id: string; name: string }[]
  const locationOptions = (lookups?.locations ?? []) as { id: string; path: string }[]
  const binOptions = (lookups?.bins ?? []) as { id: string; name: string }[]

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }
  if (loading && !intake) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
  }
  if (!intake) return <p className="text-muted-foreground">Intake draft not found.</p>

  const isActive = intake.status === 'pending' || intake.status === 'in_progress'

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/intake')}>
          <ArrowLeft className="h-4 w-4" /> Back to intake queue
        </Button>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {intake.working_name}
          <Badge variant="outline" className="capitalize">{intake.status.replace('_', ' ')}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {intake.type_name ?? 'No type yet'}
          {intake.reserved_physical_id ? <> · ID <span className="font-mono">{intake.reserved_physical_id}</span></> : ' · no ID reserved'}
          {' · started '}{fmtDate(intake.created_at ?? undefined)}
        </p>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      {!isActive ? (
        <Alert>
          <AlertDescription>
            This intake is {intake.status}.
            {intake.resulting_equipment_id && (
              <> <Link to={`/equipment/${intake.resulting_equipment_id}`} className="text-primary hover:underline">View the equipment record</Link>.</>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs value={activeStep} onValueChange={setActiveStep}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            {STEP_ORDER.map((stepKey) => (
              <TabsTrigger key={stepKey} value={stepKey} className="text-xs sm:text-sm">{STEP_LABELS[stepKey]}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="acquisition" className="mt-4">
            <AcquisitionStep intake={intake} disabled={commanding} onSave={saveDraft} />
          </TabsContent>
          <TabsContent value="identify" className="mt-4">
            <IdentifyStep intake={intake} typeOptions={typeOptions} disabled={commanding} onSave={saveDraft} />
          </TabsContent>
          <TabsContent value="assign_id" className="mt-4">
            <AssignIdStep intake={intake} disabled={commanding} reload={reload} setActionError={setActionError} />
          </TabsContent>
          <TabsContent value="product_details" className="mt-4">
            <ProductDetailsStep intake={intake} disabled={commanding} onSave={saveDraft} />
          </TabsContent>
          <TabsContent value="placement" className="mt-4">
            <PlacementStep
              intake={intake} locationOptions={locationOptions} binOptions={binOptions}
              disabled={commanding} onSave={saveDraft}
            />
          </TabsContent>
          <TabsContent value="ha_setup" className="mt-4">
            <HaSetupStep onNext={() => { setActiveStep('finish'); void saveDraft({}, 'finish') }} />
          </TabsContent>
          <TabsContent value="finish" className="mt-4">
            <FinishStep
              intake={intake} stageOptions={stageOptions} disabled={commanding}
              onFinalized={(result) => { setFinalizeResult(result); reload() }}
              setActionError={setActionError}
            />
          </TabsContent>
        </Tabs>
      )}

      {finalizeResult && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 className="h-5 w-5" /> Registered as <span className="font-mono">{finalizeResult.physicalId}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={`/equipment/${finalizeResult.equipmentId}`}>View equipment</Link>
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={async () => {
                try {
                  const result = await runCompleteness({})
                  setActionError(null)
                  setCompletenessSummary(result?.summary ?? 'Completeness check finished.')
                } catch (err) {
                  setActionError(errorMessage(err))
                }
              }}
            >
              <Sparkles className="h-4 w-4" /> Check completeness
            </Button>
            <Button asChild size="sm" variant="ghost"><Link to="/intake">Back to queue</Link></Button>
          </div>
          {completenessSummary && <p className="mt-2 text-emerald-900 dark:text-emerald-100">{completenessSummary}</p>}
        </div>
      )}
    </div>
  )
}

type StepProps = {
  intake: IntakeDetail
  disabled: boolean
  onSave: (patch: Record<string, unknown>, nextStep?: string) => Promise<boolean>
}

function StepActions({ disabled, onSave }: {
  disabled: boolean
  onSave: () => void
}) {
  return (
    <div className="mt-3">
      <Button size="sm" onClick={onSave} disabled={disabled}>Save &amp; continue</Button>
    </div>
  )
}

function AcquisitionStep({ intake, disabled, onSave }: StepProps) {
  const [form, setForm] = useState({
    purchaseSource: intake.purchase_source ?? '', purchaseOrderId: intake.purchase_order_id ?? '',
    acquiredAt: intake.acquired_at ? String(intake.acquired_at).slice(0, 10) : '', notes: intake.notes ?? '',
  })
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="acq-source">Purchase source</Label>
          <Input id="acq-source" value={form.purchaseSource} onChange={(event) => setForm((current) => ({ ...current, purchaseSource: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="acq-order">Order ID</Label>
          <Input id="acq-order" value={form.purchaseOrderId} onChange={(event) => setForm((current) => ({ ...current, purchaseOrderId: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="acq-date">Acquired date</Label>
          <Input id="acq-date" type="date" value={form.acquiredAt} onChange={(event) => setForm((current) => ({ ...current, acquiredAt: event.target.value }))} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="acq-notes">Notes</Label>
          <Textarea id="acq-notes" rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </div>
      </div>
      <StepActions
        disabled={disabled}
        onSave={() => { void onSave({
          purchaseSource: form.purchaseSource, purchaseOrderId: form.purchaseOrderId,
          acquiredAt: form.acquiredAt, notes: form.notes,
        }, 'identify') }}
      />
    </div>
  )
}

function IdentifyStep({ intake, typeOptions, disabled, onSave }: StepProps & { typeOptions: { id: string; name: string }[] }) {
  const [workingName, setWorkingName] = useState(intake.working_name)
  const [typeId, setTypeId] = useState(intake.equipment_type_id ?? '')
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="idn-name">Working name</Label>
          <Input id="idn-name" value={workingName} onChange={(event) => setWorkingName(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Equipment type</Label>
          <Select value={typeId || 'none'} onValueChange={(value) => setTypeId(value === 'none' ? '' : value)}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not sure yet</SelectItem>
              {typeOptions.map((typeOption) => <SelectItem key={typeOption.id} value={typeOption.id}>{typeOption.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <StepActions
        disabled={disabled}
        onSave={() => { void onSave({ workingName, equipmentTypeId: typeId }, 'assign_id') }}
      />
    </div>
  )
}

function AssignIdStep({ intake, disabled, reload, setActionError }: {
  intake: IntakeDetail
  disabled: boolean
  reload: () => void
  setActionError: (message: string | null) => void
}) {
  const { trigger: runCommand, loading } = useRunIntakeCommand()
  const { data: suggestion, trigger: fetchSuggestion } = useGetIntakeIdSuggestion()
  const [mode, setMode] = useState<'suggest' | 'legacy'>('suggest')
  const [numericIndex, setNumericIndex] = useState('')
  const [legacyId, setLegacyId] = useState('')

  const suggestible = Boolean(intake.equipment_type_id)
  useEffect(() => {
    if (!suggestible) return
    fetchSuggestion({ intakeId: intake.id }).catch(() => undefined)
  }, [suggestible, intake.id, fetchSuggestion])

  const preview = useMemo(() => {
    if (mode === 'legacy') return legacyId
    const prefix = intake.type_prefix ?? suggestion?.prefix ?? null
    return prefix && numericIndex ? `${prefix}_${numericIndex}` : null
  }, [mode, legacyId, intake.type_prefix, suggestion?.prefix, numericIndex])

  const reserve = async () => {
    setActionError(null)
    try {
      if (mode === 'legacy') {
        await runCommand({ command: 'reserve_id', intakeId: intake.id, explicitPhysicalId: legacyId, idempotencyKey: newIdempotencyKey() })
      } else {
        await runCommand({ command: 'reserve_id', intakeId: intake.id, numericIndex, idempotencyKey: newIdempotencyKey() })
      }
      reload()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {intake.reserved_physical_id ? (
        <div className="space-y-2">
          <p className="text-sm">Reserved ID: <span className="font-mono font-medium">{intake.reserved_physical_id}</span></p>
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => { setLegacyId(intake.reserved_physical_id ?? ''); setMode('legacy'); void 0 }}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'suggest' ? 'default' : 'outline'} onClick={() => setMode('suggest')}>Suggested numbering</Button>
            <Button size="sm" variant={mode === 'legacy' ? 'default' : 'outline'} onClick={() => setMode('legacy')}>Use existing / legacy UID</Button>
          </div>
          {mode === 'suggest' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Prefix (from type)</Label>
                  <Input value={intake.type_prefix ?? suggestion?.prefix ?? ''} readOnly className="font-mono bg-muted" placeholder={suggestible ? '—' : 'Choose a type first'} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="aid-index">Numeric index</Label>
                  <Input id="aid-index" inputMode="numeric" value={numericIndex}
                    onChange={(event) => setNumericIndex(event.target.value.replace(/\D/g, ''))}
                    placeholder={suggestible ? String(suggestion?.suggestion ?? '').split('_').pop() ?? '' : ''} />
                </div>
                <div className="space-y-1">
                  <Label>Preview</Label>
                  <Input value={preview ?? ''} readOnly className="font-mono bg-muted" />
                </div>
              </div>
              {suggestion?.suggestion && (
                <p className="text-xs text-muted-foreground">
                  Suggested next: <span className="font-mono">{String(suggestion.suggestion)}</span> — edit the index freely.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="aid-legacy">Exact physical ID</Label>
              <Input id="aid-legacy" className="font-mono" value={legacyId} onChange={(event) => setLegacyId(event.target.value)} placeholder="e.g. hyg_14 from the old sheet" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{suggestion?.scopeNote ?? 'The suggestion only knows IDs already in Retool plus active intake reservations — the legacy sheet has not been imported.'}</p>
          <Button size="sm" disabled={disabled || loading || (mode === 'suggest' ? !numericIndex : !legacyId.trim())} onClick={reserve}>
            {loading ? 'Reserving…' : 'Reserve ID'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ProductDetailsStep({ intake, disabled, onSave }: StepProps) {
  const [form, setForm] = useState({
    manufacturer: intake.manufacturer ?? '', model: intake.model ?? '', serialNumber: intake.serial_number ?? '',
  })
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="pd-make">Manufacturer</Label>
          <Input id="pd-make" value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pd-model">Model</Label>
          <Input id="pd-model" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pd-serial">Serial number</Label>
          <Input id="pd-serial" value={form.serialNumber} onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))} />
        </div>
      </div>
      <StepActions
        disabled={disabled}
        onSave={() => { void onSave({ manufacturer: form.manufacturer, model: form.model, serialNumber: form.serialNumber }, 'placement') }}
      />
    </div>
  )
}

function PlacementStep({ intake, locationOptions, binOptions, disabled, onSave }: StepProps & {
  locationOptions: { id: string; path: string }[]
  binOptions: { id: string; name: string }[]
}) {
  const [locationId, setLocationId] = useState(intake.direct_location_id ?? '')
  const [binId, setBinId] = useState(intake.bin_id ?? '')
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Location (optional)</Label>
          <Select value={locationId || 'none'} onValueChange={(value) => { setLocationId(value === 'none' ? '' : value); setBinId('') }}>
            <SelectTrigger><SelectValue placeholder="Not placed yet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not placed yet</SelectItem>
              {locationOptions.map((locationOption) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>…or bin (optional)</Label>
          <Select value={binId || 'none'} onValueChange={(value) => { setBinId(value === 'none' ? '' : value); setLocationId('') }}>
            <SelectTrigger><SelectValue placeholder="No bin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No bin</SelectItem>
              {binOptions.map((binOption) => <SelectItem key={binOption.id} value={binOption.id}>{binOption.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <StepActions
        disabled={disabled}
        onSave={() => { void onSave({ directLocationId: locationId, binId }, 'ha_setup') }}
      />
    </div>
  )
}

function HaSetupStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm">
        Home Assistant entities can only be linked to a real equipment record, so this step finishes after registration.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        After you finish, open the equipment page and use “Link HA entity”. Nothing is stored here yet — this step is
        intentionally deferred, not skipped silently.
      </p>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={onNext}>Continue to finish</Button>
      </div>
    </div>
  )
}

function FinishStep({ intake, stageOptions, disabled, onFinalized, setActionError }: {
  intake: IntakeDetail
  stageOptions: { id: string; name: string }[]
  disabled: boolean
  onFinalized: (result: { equipmentId: string; physicalId: string }) => void
  setActionError: (message: string | null) => void
}) {
  const { trigger: runCommand, loading } = useRunIntakeCommand()
  const [displayName, setDisplayName] = useState(intake.working_name)
  const [stageId, setStageId] = useState('')
  const ready = Boolean(intake.reserved_physical_id && intake.equipment_type_id)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dl className="space-y-1.5 text-sm">
        <SummaryLine label="Physical ID" value={intake.reserved_physical_id ?? 'NOT RESERVED — go back to Assign ID'} />
        <SummaryLine label="Display name" value={displayName || intake.working_name} />
        <SummaryLine label="Type" value={intake.type_name ?? 'NOT SET — go back to Identify'} />
        <SummaryLine label="Placement" value={intake.direct_location_name ?? (intake.bin_name ? `Bin: ${intake.bin_name}` : 'Unplaced (fine)')} />
        <SummaryLine label="Acquired" value={intake.acquired_at ? fmtDate(intake.acquired_at) : intake.purchase_source ?? 'Not recorded (fine)'} />
      </dl>
      <Separator className="my-3" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="fin-name">Display name</Label>
          <Input id="fin-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Lifecycle stage (optional)</Label>
          <Select value={stageId || 'auto'} onValueChange={(value) => setStageId(value === 'auto' ? '' : value)}>
            <SelectTrigger><SelectValue placeholder="Use safe registration stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Use safe registration stage</SelectItem>
              {stageOptions.map((stageOption) => <SelectItem key={stageOption.id} value={stageOption.id}>{stageOption.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Optional gaps stay optional — the completeness audit will surface them as follow-ups later.
      </p>
      <div className="mt-3">
        <Button
          disabled={disabled || loading || !ready}
          onClick={async () => {
            setActionError(null)
            try {
              const result = await runCommand({
                command: 'finalize',
                intakeId: intake.id,
                lifecycleStageId: stageId || undefined,
                finalDisplayName: displayName,
                idempotencyKey: newIdempotencyKey(),
              })
              if (result?.equipmentId && result?.physicalId) onFinalized({ equipmentId: String(result.equipmentId), physicalId: String(result.physicalId) })
            } catch (err) {
              setActionError(errorMessage(err))
            }
          }}
        >
          {loading ? 'Finishing…' : 'Finish as equipment'}
        </Button>
      </div>
    </div>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
