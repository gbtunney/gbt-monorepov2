import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useGetNextPhysicalId, useRegisterPhysicalItem } from '../../hooks/backend/inventory'
import { Alert, AlertDescription } from '../../lib/shadcn/alert'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Textarea } from '../../lib/shadcn/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Separator } from '../../lib/shadcn/separator'
import { errorMessage, newIdempotencyKey, type BinId, type EquipmentId, type EquipmentTypeId, type LocationId } from '../../utils/inventory'

type EquipmentTypeOption = { id: EquipmentTypeId; name: string; id_prefix?: string | null }
type LocationOption = { id: LocationId; path: string }
type BinOption = { id: BinId; name: string }

export type AddFormLookups = {
  types: EquipmentTypeOption[]
  stages: { id: string; name: string }[]
  locations: LocationOption[]
  bins: BinOption[]
  manufacturers: string[]
  models: { model: string; manufacturer: string | null }[]
}

const emptyForm = {
  physicalId: '', displayName: '', typeId: '',
  placement: 'none' as 'none' | 'location' | 'bin', locationId: '', binId: '', intendedLocationId: '',
  idMarkingStatus: 'box_or_item_marked', conditionStatus: 'unknown',
  reviewFlag: false, reviewReason: '', proposedCleanupNote: '', notes: '',
}

const MARKING_OPTIONS = [
  { value: 'box_or_item_marked', label: 'Handwritten on box/item' },
  { value: 'permanent_device_label', label: 'Permanent device label applied' },
  { value: 'not_marked', label: 'Not marked yet' },
  { value: 'unknown', label: 'Unknown' },
]

export function AddEquipmentForm({ lookups, onCreated }: {
  lookups: AddFormLookups
  onCreated: (equipmentId: EquipmentId | null) => void
}) {
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const { trigger: registerPhysicalItem, loading: creating } = useRegisterPhysicalItem()
  const { data: suggestion, trigger: fetchSuggestion, loading: suggesting } = useGetNextPhysicalId()

  const selectedType = lookups.types.find((typeOption) => typeOption.id === form.typeId)
  const sensibleName = selectedType && form.physicalId.trim() ? `${selectedType.name} ${form.physicalId.trim()}` : ''
  const displayNameToSave = form.displayName.trim() || sensibleName
  const suggestionValue = suggestion?.suggestion ? String(suggestion.suggestion) : null
  const activeReservationCount = Number(suggestion?.activeReservationCount ?? 0)

  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!form.typeId) return
    fetchSuggestion({ typeId: form.typeId })
  }, [form.typeId, fetchSuggestion])

  const locationOptions = useMemo(() => lookups.locations, [lookups.locations])
  const binOptions = useMemo(() => lookups.bins, [lookups.bins])

  const submit = async () => {
    setFormError(null)
    if (!form.typeId || !form.physicalId.trim()) {
      setFormError('Type and physical inventory ID are required.')
      return
    }
    if (form.placement === 'location' && !form.locationId) {
      setFormError('Choose an actual location or switch placement to unlocated.')
      return
    }
    if (form.placement === 'bin' && !form.binId) {
      setFormError('Choose a current bin or switch placement to unlocated.')
      return
    }
    try {
      const result = await registerPhysicalItem({
        physicalId: form.physicalId.trim(),
        equipmentTypeId: form.typeId,
        displayName: displayNameToSave,
        directLocationId: form.placement === 'location' ? form.locationId : undefined,
        binId: form.placement === 'bin' ? form.binId : undefined,
        intendedLocationId: form.intendedLocationId || undefined,
        idMarkingStatus: form.idMarkingStatus,
        conditionStatus: form.conditionStatus,
        reviewFlag: form.reviewFlag,
        reviewReason: form.reviewReason.trim() || undefined,
        proposedCleanupNote: form.proposedCleanupNote.trim() || undefined,
        notes: form.notes.trim() || undefined,
        idempotencyKey: newIdempotencyKey(),
      })
      onCreated((result?.equipmentId ?? null) as EquipmentId | null)
      setForm(emptyForm)
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription>
          Quick registration creates the canonical inventory record now. Purchase details, model data, HA linking,
          and installation checks can be completed later from the equipment detail page.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Type <span className="text-destructive">*</span></Label>
          <Select value={form.typeId} onValueChange={(value) => set('typeId', value)}>
            <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
            <SelectContent>{lookups.types.map((typeOption) => <SelectItem key={typeOption.id} value={typeOption.id}>{typeOption.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="eq-physical">Physical inventory ID <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input id="eq-physical" value={form.physicalId} onChange={(event) => set('physicalId', event.target.value)} placeholder="e.g. hyg_14 or handwritten ID" className="font-mono" />
            <Button type="button" variant="outline" size="icon" aria-label="Use suggested ID" onClick={() => suggestionValue && set('physicalId', suggestionValue)} disabled={!form.typeId || suggesting || !suggestionValue}>
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          {suggestionValue && (
            <p className="text-xs text-muted-foreground">
              Suggested: <span className="font-mono">{suggestionValue}</span>. This only checks registered inventory, archived rows, and active reservations{activeReservationCount > 0 ? ` including ${activeReservationCount} active reservation${activeReservationCount === 1 ? '' : 's'}` : ''}; it may collide with legacy spreadsheet labels not yet registered. Use exact existing handwritten UID when present.
            </p>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="eq-name">Display name (optional)</Label>
          <Input id="eq-name" value={form.displayName} onChange={(event) => set('displayName', event.target.value)} placeholder={sensibleName || 'Defaults from type and ID'} />
          <p className="text-xs text-muted-foreground">Leaving this blank saves “{sensibleName || 'Type physical_id'}”. Intended area never changes the name.</p>
        </div>
      </div>

      <Separator />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Current physical placement</Label>
          <Select value={form.placement} onValueChange={(value) => set('placement', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unlocated for now</SelectItem>
              <SelectItem value="bin">In an existing bin</SelectItem>
              <SelectItem value="location">At an actual location</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.placement === 'bin' && (
          <div className="space-y-1">
            <Label>Current bin</Label>
            <Select value={form.binId} onValueChange={(value) => set('binId', value)}>
              <SelectTrigger><SelectValue placeholder="Choose bin…" /></SelectTrigger>
              <SelectContent>{binOptions.map((binOption) => <SelectItem key={binOption.id} value={binOption.id}>{binOption.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {form.placement === 'location' && (
          <div className="space-y-1">
            <Label>Actual location</Label>
            <Select value={form.locationId} onValueChange={(value) => set('locationId', value)}>
              <SelectTrigger><SelectValue placeholder="Choose location…" /></SelectTrigger>
              <SelectContent>{locationOptions.map((locationOption) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label>Intended area for planning (optional)</Label>
          <Select value={form.intendedLocationId || 'none'} onValueChange={(value) => set('intendedLocationId', value === 'none' ? '' : value)}>
            <SelectTrigger><SelectValue placeholder="No intended area" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No intended area</SelectItem>
              {locationOptions.map((locationOption) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Planning only — does not set actual location, HA area, or display name.</p>
        </div>
      </div>

      <Separator />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>ID marking</Label>
          <Select value={form.idMarkingStatus} onValueChange={(value) => set('idMarkingStatus', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MARKING_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Condition/status</Label>
          <Select value={form.conditionStatus} onValueChange={(value) => set('conditionStatus', value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unknown</SelectItem>
              <SelectItem value="needs_testing">Needs testing</SelectItem>
              <SelectItem value="working">Working</SelectItem>
              <SelectItem value="confirmed_broken">Confirmed broken</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="eq-notes">Registration notes (optional)</Label>
          <Textarea id="eq-notes" rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={submit} disabled={creating}>{creating ? 'Registering…' : 'Register item'}</Button>
      </div>
    </div>
  )
}
