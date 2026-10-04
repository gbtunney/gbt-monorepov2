import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2, RefreshCw, Upload } from 'lucide-react'
import {
  useGetHaDiscovery, useGetHaSnapshotStatus, useIngestHaSnapshot, useRunSettingsCommand,
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
import { errorMessage, fmtDateTime, timeAgo } from '../utils/inventory'

type AreaRow = { id: string; ha_area_id: string; name: string; is_current: boolean; last_seen_at: string | null; device_count: number; entity_count: number }
type DeviceRow = { id: string; ha_device_id: string; name: string | null; name_by_user: string | null; area_name: string | null; manufacturer: string | null; model: string | null; is_current: boolean; last_seen_at: string | null; entity_count: number }
type EntityRow = {
  id: string; entity_id: string; domain: string; friendly_name: string | null; state: string | null
  unit_of_measurement: string | null; integration: string | null; platform: string | null
  is_current: boolean; last_seen_at: string | null
  linked_equipment_id: string | null; linked_equipment_name: string | null
}

export default function HaDiscovery() {
  const { data: status, loading: statusLoading, error: statusError, trigger: triggerStatus } = useGetHaSnapshotStatus()
  const { data: discovery, loading: discoveryLoading, error: discoveryError, trigger: triggerDiscovery } = useGetHaDiscovery()

  const [search, setSearch] = useState('')
  const [currentFilter, setCurrentFilter] = useState<'all' | 'current' | 'stale'>('all')
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [linkTarget, setLinkTarget] = useState<EntityRow | null>(null)

  const refresh = useCallback(() => { triggerStatus(); triggerDiscovery({}) }, [triggerStatus, triggerDiscovery])
  useEffect(() => { refresh() }, [refresh])

  if (statusError) {
    return <Alert variant="destructive"><AlertDescription>{statusError}</AlertDescription></Alert>
  }

  const latest = status?.latestRun as Record<string, unknown> | null
  const instanceSummary = (status?.instances ?? []) as Record<string, unknown>[]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Home Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Read-only discovery mirror. Canonical inventory stays in Equipment; linking is explicit.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import snapshot JSON</Button>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          <strong>No automatic HA collector connected yet.</strong> There is no Home Assistant resource or live
          connection in Retool — import a snapshot JSON manually (from an assistant/collector export). Data is as fresh
          as the last import.
        </AlertDescription>
      </Alert>

      {latest ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Last snapshot" value={fmtDateTime(String(latest['snapshot_at'] ?? ''))} sub={`${timeAgo(String(latest['imported_at'] ?? ''))} · ${String(latest['source'] ?? '')}`} />
          {instanceSummary.map((instance) => (
            <SummaryCard
              key={String(instance['haInstanceId'])}
              label={`Instance ${String(instance['haInstanceId'])}`}
              value={`${instance['entitiesCurrent'] ?? 0} entities`}
              sub={`${instance['devicesCurrent'] ?? 0} devices · ${instance['areasCurrent'] ?? 0} areas · ${instance['entitiesStale'] ?? 0} stale`}
            />
          ))}
          <SummaryCard label="Linked" value={`${instanceSummary.reduce((sum, instance) => sum + Number(instance['activeLinks'] ?? 0), 0)} links`} sub="via ha_entity_link" />
        </div>
      ) : statusLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <p className="text-sm text-muted-foreground">No snapshots imported yet.</p>
      )}

      {importResult && <Alert><AlertDescription className="text-sm">{importResult}</AlertDescription></Alert>}
      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-full sm:w-72" placeholder="Search entities, devices, areas…"
          value={search} onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={currentFilter} onValueChange={(value) => setCurrentFilter(value as 'all' | 'current' | 'stale')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Current + stale</SelectItem>
            <SelectItem value="current">Current only</SelectItem>
            <SelectItem value="stale">Stale only</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={discoveryLoading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {discoveryError ? (
        <Alert variant="destructive"><AlertDescription>{discoveryError}</AlertDescription></Alert>
      ) : (
        <Tabs defaultValue="entities">
          <TabsList>
            <TabsTrigger value="entities">Entities ({(discovery?.entities ?? []).length})</TabsTrigger>
            <TabsTrigger value="devices">Devices ({(discovery?.devices ?? []).length})</TabsTrigger>
            <TabsTrigger value="areas">Areas ({(discovery?.areas ?? []).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="mt-4">
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead><TableHead>State</TableHead><TableHead>Integration</TableHead>
                    <TableHead>Linked</TableHead><TableHead>Freshness</TableHead><TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((discovery?.entities ?? []) as EntityRow[]).map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell>
                        <div className="font-mono text-sm">{entity.entity_id}</div>
                        <div className="text-xs text-muted-foreground">{entity.friendly_name ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm">{entity.state ?? '—'}{entity.unit_of_measurement ?? ''}</TableCell>
                      <TableCell className="text-sm">{entity.integration ?? entity.platform ?? '—'}</TableCell>
                      <TableCell>
                        {entity.linked_equipment_id ? (
                          <Link to={`/equipment/${entity.linked_equipment_id}`} className="text-sm text-primary hover:underline">
                            {entity.linked_equipment_name}
                          </Link>
                        ) : <span className="text-xs text-muted-foreground">unlinked</span>}
                      </TableCell>
                      <TableCell>
                        <CurrentBadge isCurrent={entity.is_current} lastSeen={entity.last_seen_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        {!entity.linked_equipment_id && entity.is_current && (
                          <Button variant="outline" size="sm" onClick={() => setLinkTarget(entity)}>
                            <Link2 className="h-4 w-4" /> Link
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {((discovery?.entities ?? []) as EntityRow[]).length === 0 && !discoveryLoading && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No entities match.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="devices" className="mt-4">
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead><TableHead>Area</TableHead><TableHead>Manufacturer / model</TableHead>
                    <TableHead className="text-right">Entities</TableHead><TableHead>Freshness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((discovery?.devices ?? []) as DeviceRow[]).map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{device.name_by_user ?? device.name ?? device.ha_device_id}</div>
                        <div className="font-mono text-xs text-muted-foreground">{device.ha_device_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{device.area_name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{device.manufacturer ?? '—'}{device.model ? ` · ${device.model}` : ''}</TableCell>
                      <TableCell className="text-right">{device.entity_count}</TableCell>
                      <TableCell><CurrentBadge isCurrent={device.is_current} lastSeen={device.last_seen_at} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="areas" className="mt-4">
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area</TableHead><TableHead>HA area id</TableHead>
                    <TableHead className="text-right">Devices</TableHead><TableHead className="text-right">Entities</TableHead>
                    <TableHead>Freshness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((discovery?.areas ?? []) as AreaRow[]).map((area) => (
                    <TableRow key={area.id}>
                      <TableCell className="text-sm font-medium">{area.name}</TableCell>
                      <TableCell className="font-mono text-xs">{area.ha_area_id}</TableCell>
                      <TableCell className="text-right">{area.device_count}</TableCell>
                      <TableCell className="text-right">{area.entity_count}</TableCell>
                      <TableCell><CurrentBadge isCurrent={area.is_current} lastSeen={area.last_seen_at} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <ImportDialog
        open={importOpen} onOpenChange={setImportOpen} jsonText={importJson}
        setJsonText={setImportJson} setActionError={setActionError}
        onImported={(summary) => { setImportResult(summary); setImportOpen(false); refresh() }}
      />
      <LinkEntityDialog
        entity={linkTarget} onOpenChange={(open) => { if (!open) setLinkTarget(null) }}
        onLinked={() => { setLinkTarget(null); refresh() }}
      />
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

function CurrentBadge({ isCurrent, lastSeen }: { isCurrent: boolean; lastSeen: string | null }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="outline" className={isCurrent
        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'}>
        {isCurrent ? 'current' : 'stale'}
      </Badge>
      <span className="text-xs text-muted-foreground">{timeAgo(lastSeen)}</span>
    </div>
  )
}

function ImportDialog({ open, onOpenChange, jsonText, setJsonText, onImported, setActionError }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jsonText: string
  setJsonText: (text: string) => void
  onImported: (summary: string) => void
  setActionError: (message: string | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import HA snapshot JSON</DialogTitle>
          <DialogDescription>
            Paste a snapshot object: {'{'} schemaVersion: 1, haInstanceId, snapshotAt, areas[], devices[], entities[] {'}'}.
            Read-only import — inventory is never modified; credential-like attributes are redacted.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          className="min-h-64 font-mono text-xs" value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder='{ "schemaVersion": 1, "haInstanceId": "home", "snapshotAt": "2026-10-02T10:00:00Z", "areas": [], "devices": [], "entities": [] }'
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <ImportButton jsonText={jsonText} onImported={onImported} setActionError={setActionError} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportButton({ jsonText, onImported, setActionError }: {
  jsonText: string
  onImported: (summary: string) => void
  setActionError: (message: string | null) => void
}) {
  const { trigger: importSnapshot, loading } = useIngestHaSnapshot()
  return (
    <Button
      disabled={loading || !jsonText.trim()}
      onClick={async () => {
        setActionError(null)
        try {
          const parsed = JSON.parse(jsonText)
          const result = await importSnapshot({ snapshot: parsed, source: 'manual_import' })
          const counts = result?.areas && result?.entities
            ? `Areas ${result.areas.inserted}+${result.areas.updated} · Devices ${result.devices.inserted}+${result.devices.updated} · Entities ${result.entities.inserted}+${result.entities.updated} · stale ${result.staleMarked ?? 0}`
            : String(result?.message ?? 'Imported.')
          const warningText = Array.isArray(result?.warnings) && result.warnings.length > 0
            ? ` Warnings: ${result.warnings.length}.`
            : ''
          onImported(`${counts}${warningText}`)
        } catch (err) {
          setActionError(errorMessage(err))
        }
      }}
    >
      {loading ? 'Importing…' : 'Import'}
    </Button>
  )
}

function LinkEntityDialog({ entity, onOpenChange, onLinked }: {
  entity: EntityRow | null
  onOpenChange: (open: boolean) => void
  onLinked: () => void
}) {
  const { trigger: settingsCommand, loading } = useRunSettingsCommand()
  const [equipmentId, setEquipmentId] = useState('')
  const [role, setRole] = useState('')
  const [integration, setIntegration] = useState('')
  const [outletIndex, setOutletIndex] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (entity) {
      setEquipmentId(''); setRole(''); setIntegration(entity.integration ?? entity.platform ?? ''); setOutletIndex('')
      setFormError(null)
    }
  }, [entity])

  return (
    <Dialog open={entity !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link to equipment</DialogTitle>
          <DialogDescription>
            Maps <span className="font-mono">{entity?.entity_id}</span> to an equipment record. Mapping only — HA data
            never overwrites inventory fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="lnk-eq">Equipment ID (from the equipment page URL)</Label>
            <Input id="lnk-eq" className="font-mono text-xs" value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} placeholder="Equipment UUID" />
            <p className="text-xs text-muted-foreground">Tip: open the equipment record and use “Link HA entity” there for a picker with suggestions.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lnk-integration">Integration</Label>
              <Input id="lnk-integration" value={integration} onChange={(event) => setIntegration(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lnk-role">Role</Label>
              <Input id="lnk-role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="battery, power…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lnk-outlet">Outlet index</Label>
              <Input id="lnk-outlet" type="number" value={outletIndex} onChange={(event) => setOutletIndex(event.target.value)} />
            </div>
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={loading || !equipmentId.trim()}
            onClick={async () => {
              setFormError(null)
              try {
                await settingsCommand({
                  command: 'link_entity',
                  equipmentId: equipmentId.trim(),
                  entityId: entity?.entity_id ?? '',
                  integration: integration || undefined,
                  role: role || undefined,
                  outletIndex: outletIndex.trim() === '' ? undefined : Number(outletIndex),
                  idempotencyKey: crypto.randomUUID(),
                })
                onLinked()
              } catch (err) {
                setFormError(errorMessage(err))
              }
            }}
          >
            {loading ? 'Linking…' : 'Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
