import { useEffect, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { useGetSettings, useRunSettingsCommand, useExportInventory } from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Switch } from '../lib/shadcn/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { errorMessage, newIdempotencyKey, type EquipmentTypeId } from '../utils/inventory'
import { LocationBridgeTable, type LocationRow } from './ui/LocationBridgeTable'

type TypeRow = { id: EquipmentTypeId; name: string; description: string | null; id_prefix?: string | null }
type StageRow = { id: string; name: string; code: string; expects_online: boolean }
type RuleRow = {
  id: string
  name: string
  enabled: boolean
  severity?: string | null
  scope?: string | null
  condition_json?: Record<string, unknown> | null
}
type CompletenessFieldRow = { key: string; label: string; appliesTo: string }

export default function Settings() {
  const { data, loading, error, trigger } = useGetSettings()
  const { trigger: settingsCommand, loading: commanding } = useRunSettingsCommand()
  const { trigger: exportInventory, loading: exporting } = useExportInventory()

  const [typeOpen, setTypeOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const [expectationOpen, setExpectationOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { trigger() }, [trigger])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  const counts = (data?.counts ?? {}) as Record<string, number>
  const source = (data?.dataSourceStatus ?? {}) as Record<string, string>

  const downloadExport = async () => {
    setActionError(null)
    try {
      const result = await exportInventory({})
      if (!result) return
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const toggleRule = async (rule: RuleRow, enabled: boolean) => {
    setActionError(null)
    try {
      await settingsCommand({ command: 'toggle_rule', ruleId: rule.id, enabled, idempotencyKey: newIdempotencyKey() })
      trigger()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">Reference data, audit rules, and data sources.</p>
        </div>
        <Button variant="outline" disabled={exporting} onClick={downloadExport}>
          <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export JSON'}
        </Button>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      {loading && !data ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[['Equipment', counts['equipment']], ['Bins', counts['bins']], ['Locations', counts['locations']], ['HA links', counts['ha_links']], ['Open findings', counts['open_findings']]].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-border bg-card p-4">
                <div className="text-2xl font-semibold">{value ?? 0}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="types">
            <TabsList>
              <TabsTrigger value="types">Types</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
              <TabsTrigger value="rules">Audit rules</TabsTrigger>
              <TabsTrigger value="completeness">Completeness</TabsTrigger>
              <TabsTrigger value="sources">Data sources</TabsTrigger>
            </TabsList>

            <TabsContent value="types" className="mt-4">
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setTypeOpen(true)}><Plus className="h-4 w-4" /> New type</Button>
              </div>
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>ID prefix</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {((data?.types ?? []) as TypeRow[]).map((typeRow) => (
                      <TableRow key={typeRow.id}>
                        <TableCell className="font-medium">{typeRow.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{typeRow.description ?? '—'}</TableCell>
                        <TableCell>
                          <TypePrefixRow type={typeRow} disabled={commanding} onSave={(prefix) => {
                            settingsCommand({ command: 'set_type_prefix', typeId: typeRow.id, idPrefix: prefix, idempotencyKey: newIdempotencyKey() })
                              .then(() => trigger())
                              .catch((err: unknown) => setActionError(errorMessage(err)))
                          }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="stages" className="mt-4">
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Expects online</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {((data?.stages ?? []) as StageRow[]).map((stageRow) => (
                      <TableRow key={stageRow.id}>
                        <TableCell className="font-medium">{stageRow.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono text-xs">{stageRow.code}</Badge></TableCell>
                        <TableCell className="text-sm">{stageRow.expects_online ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="locations" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Top-level locations usually map to HA Areas. Sub-locations inherit the nearest mapped HA Area and may use a loc_* HA Label for finer placement.
              </p>
              <div className="mb-3 flex justify-end">
                <Button size="sm" onClick={() => setLocOpen(true)}><Plus className="h-4 w-4" /> New location</Button>
              </div>
              <LocationBridgeTable
                locations={(data?.locations ?? []) as LocationRow[]}
                disabled={commanding}
                onSaveArea={(locationRow, haAreaId) => {
                  settingsCommand({ command: 'set_location_ha_area', locationId: locationRow.id, haAreaId, idempotencyKey: newIdempotencyKey() })
                    .then(() => trigger())
                    .catch((err: unknown) => setActionError(errorMessage(err)))
                }}
                onSaveLabel={(locationRow, haLabelId) => {
                  settingsCommand({ command: 'set_location_ha_label', locationId: locationRow.id, haLabelId, idempotencyKey: newIdempotencyKey() })
                    .then(() => trigger())
                    .catch((err: unknown) => setActionError(errorMessage(err)))
                }}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-4 space-y-3">
              {((data?.rules ?? []) as RuleRow[])
                .filter((ruleRow) => ruleRow.condition_json?.['type'] !== 'field_required')
                .map((ruleRow) => (
                <div key={ruleRow.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
                  <div>
                    <div className="font-medium">{ruleRow.name}</div>
                    {ruleRow.severity && <div className="text-xs text-muted-foreground">Severity: {ruleRow.severity}</div>}
                  </div>
                  <Switch checked={ruleRow.enabled} onCheckedChange={(checked) => toggleRule(ruleRow, checked)} disabled={commanding} />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="completeness" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Expectations checked by the local "Check inventory completeness" action. Missing fields become follow-up
                findings; filling the field resolves them on the next check.
              </p>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setExpectationOpen(true)}><Plus className="h-4 w-4" /> Add expectation</Button>
              </div>
              {((data?.rules ?? []) as RuleRow[])
                .filter((ruleRow) => ruleRow.condition_json?.['type'] === 'field_required')
                .map((ruleRow) => (
                <CompletenessRuleCard
                  key={ruleRow.id}
                  rule={ruleRow}
                  typeNames={new Map(((data?.types ?? []) as TypeRow[]).map((typeRow) => [typeRow.id, typeRow.name]))}
                  disabled={commanding}
                  onToggle={(checked) => toggleRule(ruleRow, checked)}
                  onDelete={() => {
                    settingsCommand({ command: 'delete_field_requirement', ruleId: ruleRow.id, idempotencyKey: newIdempotencyKey() })
                      .then(() => trigger())
                      .catch((err: unknown) => setActionError(errorMessage(err)))
                  }}
                />
              ))}
            </TabsContent>

            <TabsContent value="sources" className="mt-4">
              <dl className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm">
                {Object.entries(source).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="text-muted-foreground sm:text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
          </Tabs>
        </>
      )}

      <CreateTypeDialog open={typeOpen} onOpenChange={setTypeOpen} submitting={commanding} onCreated={() => trigger()} onCommand={settingsCommand} />
      <AddExpectationDialog
        open={expectationOpen}
        onOpenChange={setExpectationOpen}
        submitting={commanding}
        fields={(data?.completenessFields ?? []) as CompletenessFieldRow[]}
        types={(data?.types ?? []) as TypeRow[]}
        onSaved={() => { setExpectationOpen(false); trigger() }}
        onCommand={settingsCommand}
      />
      <CreateLocationDialog
        open={locOpen}
        onOpenChange={setLocOpen}
        submitting={commanding}
        locations={(data?.locations ?? []) as LocationRow[]}
        onCreated={() => trigger()}
        onCommand={settingsCommand}
      />
    </div>
  )
}

function TypePrefixRow({ type, disabled, onSave }: {
  type: TypeRow
  disabled: boolean
  onSave: (prefix: string) => void
}) {
  const [value, setValue] = useState(type.id_prefix ?? '')
  const dirty = value !== (type.id_prefix ?? '')
  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-8 w-28 font-mono text-xs"
        value={value}
        placeholder="none"
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <Button variant="outline" size="sm" className="h-8" disabled={disabled || !dirty} onClick={() => onSave(value)}>
        Save
      </Button>
    </div>
  )
}

function CompletenessRuleCard({ rule, typeNames, disabled, onToggle, onDelete }: {
  rule: RuleRow
  typeNames: Map<string, string>
  disabled: boolean
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  const scope = rule.scope ? typeNames.get(rule.scope) ?? 'Unknown type' : 'All equipment'
  const conditionFieldKey = typeof rule.condition_json?.['fieldKey'] === 'string' ? String(rule.condition_json['fieldKey']) : ''
  const guidance = typeof rule.condition_json?.['guidance'] === 'string' ? String(rule.condition_json['guidance']) : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{typeof rule.condition_json?.['label'] === 'string' ? rule.condition_json['label'] : rule.name}</span>
          <Badge variant="outline" className="font-mono text-xs">{conditionFieldKey}</Badge>
          {rule.severity && <Badge variant="secondary" className="text-xs">{rule.severity}</Badge>}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">Scope: {scope}{guidance ? ` · ${guidance}` : ''}</div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={rule.enabled} onCheckedChange={onToggle} disabled={disabled} />
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={disabled}>
          Delete
        </Button>
      </div>
    </div>
  )
}

function AddExpectationDialog({ open, onOpenChange, submitting, fields, types, onSaved, onCommand }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitting: boolean
  fields: CompletenessFieldRow[]
  types: TypeRow[]
  onSaved: () => void
  onCommand: (params: Record<string, unknown>) => Promise<unknown>
}) {
  const [fieldKey, setFieldKey] = useState('')
  const [typeId, setTypeId] = useState('')
  const [severity, setSeverity] = useState('info')
  const [guidance, setGuidance] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const selectedField = fields.find((field) => field.key === fieldKey)

  const submit = async () => {
    setFormError(null)
    if (!fieldKey) { setFormError('Choose a field.'); return }
    try {
      await onCommand({
        command: 'save_field_requirement',
        fieldKey,
        severity,
        guidance: guidance.trim() || undefined,
        equipmentTypeId: typeId || undefined,
        idempotencyKey: newIdempotencyKey(),
      })
      onOpenChange(false)
      setFieldKey(''); setTypeId(''); setSeverity('info'); setGuidance('')
      onSaved()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add completeness expectation</DialogTitle>
          <DialogDescription>Missing data for this field becomes a follow-up finding on audit checks.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Field</Label>
            <Select value={fieldKey} onValueChange={setFieldKey}>
              <SelectTrigger><SelectValue placeholder="Choose field…" /></SelectTrigger>
              <SelectContent>
                {fields.map((field) => <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedField && <p className="text-xs text-muted-foreground">{selectedField.appliesTo}</p>}
          </div>
          <div className="space-y-1">
            <Label>Applies to</Label>
            <Select value={typeId || 'global'} onValueChange={(value) => setTypeId(value === 'global' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">All equipment</SelectItem>
                {types.map((typeRow) => <SelectItem key={typeRow.id} value={typeRow.id}>{typeRow.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Importance</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-guidance">Guidance (optional)</Label>
            <Input id="exp-guidance" value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Shown as the finding explanation" />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Add expectation'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTypeDialog({ open, onOpenChange, submitting, onCreated, onCommand }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitting: boolean
  onCreated: () => void
  onCommand: (params: Record<string, unknown>) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!name.trim()) { setFormError('Name is required.'); return }
    try {
      await onCommand({ command: 'create_type', name: name.trim(), description: description.trim() || undefined, idempotencyKey: newIdempotencyKey() })
      onOpenChange(false)
      setName(''); setDescription('')
      onCreated()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New equipment type</DialogTitle>
          <DialogDescription>Categories like heater, hygrometer, power strip.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="type-name">Name</Label>
            <Input id="type-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="type-desc">Description</Label>
            <Input id="type-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateLocationDialog({ open, onOpenChange, submitting, locations, onCreated, onCommand }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  submitting: boolean
  locations: LocationRow[]
  onCreated: () => void
  onCommand: (params: Record<string, unknown>) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!name.trim()) { setFormError('Name is required.'); return }
    try {
      await onCommand({ command: 'create_location', name: name.trim(), parentLocationId: parentId || undefined, idempotencyKey: newIdempotencyKey() })
      onOpenChange(false)
      setName(''); setParentId('')
      onCreated()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New location</DialogTitle>
          <DialogDescription>Rooms and sub-locations where items live.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Parent location</Label>
            <Select value={parentId || 'none'} onValueChange={(v) => setParentId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="None (top level)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top level)</SelectItem>
                {locations.map((locationRow) => <SelectItem key={locationRow.id} value={locationRow.id}>{locationRow.path}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
