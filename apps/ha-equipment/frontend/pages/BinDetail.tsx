import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, ClipboardCheck, MapPin, Pencil } from 'lucide-react'
import { useGetBinDetail, useGetLookupData, useRunBinCommand } from '../hooks/backend/inventory'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { StageBadge } from './ui/badges'
import { errorMessage, fmtDateTime, newIdempotencyKey, timeAgo, type BinId, type EquipmentId } from '../utils/inventory'

type BinHead = {
  id: BinId
  bin_code: string
  name: string
  notes: string | null
  archived_at: string | null
  location_id: string | null
  location_name: string | null
  parent_location_name: string | null
  tag_code: string | null
  target_url: string | null
}

type ContentRow = {
  id: EquipmentId
  physical_id: string
  display_name: string
  archived_at: string | null
  type_name: string
  stage_name: string
  stage_code: string
}

type EventRow = {
  id: string
  event_type: string
  occurred_at: string
  actor: string
  source: string
  notes: string | null
}

export default function BinDetail() {
  const { binId = '' } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, trigger } = useGetBinDetail()
  const { data: lookups, trigger: triggerLookups } = useGetLookupData()
  const { trigger: runCommand, loading: commanding } = useRunBinCommand()

  const [renameOpen, setRenameOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (binId) trigger({ binId })
  }, [trigger, binId])

  useEffect(() => { load() }, [load])
  useEffect(() => { triggerLookups() }, [triggerLookups])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }
  if (loading && !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  }

  const bin = data?.bin as BinHead | undefined
  if (!bin) return <p className="text-muted-foreground">Bin not found.</p>

  const run = async (payload: Record<string, unknown>) => {
    setActionError(null)
    try {
      await runCommand({ binId: bin.id, idempotencyKey: newIdempotencyKey(), ...payload })
      load()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  const contents = (data?.contents ?? []) as ContentRow[]
  const activeCount = contents.filter((content) => !content.archived_at).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/bins')}>
            <ArrowLeft className="h-4 w-4" /> Back to bins
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {bin.name}
            <span className="font-mono text-sm font-normal text-muted-foreground">{bin.bin_code}</span>
            {bin.archived_at && <Badge variant="outline">Archived</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {bin.location_name
              ? <>At {bin.location_name}{bin.parent_location_name ? ` — in ${bin.parent_location_name}` : ''}</>
              : 'No location assigned'}
            {' · '}{activeCount} active item{activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={commanding} onClick={() => run({ command: 'confirm_contents' })}>
            <ClipboardCheck className="h-4 w-4" /> Confirm contents
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
            <MapPin className="h-4 w-4" /> Move
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
            <Pencil className="h-4 w-4" /> Rename
          </Button>
          {!bin.archived_at && (
            <Button variant="outline" size="sm" disabled={commanding} onClick={() => run({ command: 'archive' })}>
              <Archive className="h-4 w-4" /> Archive
            </Button>
          )}
        </div>
      </div>

      {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
      {bin.notes && <p className="text-sm text-muted-foreground">{bin.notes}</p>}

      <Tabs defaultValue="contents">
        <TabsList>
          <TabsTrigger value="contents">Contents ({contents.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          {bin.tag_code && <TabsTrigger value="tag">Scan tag</TabsTrigger>}
        </TabsList>

        <TabsContent value="contents" className="mt-4">
          {contents.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">This bin is empty.</p>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contents.map((content) => (
                    <TableRow key={content.id} className={content.archived_at ? 'opacity-60' : undefined}>
                      <TableCell>
                        <Link to={`/equipment/${content.id}`} className="font-medium hover:underline">{content.display_name}</Link>
                        <div className="font-mono text-xs text-muted-foreground">{content.physical_id}</div>
                      </TableCell>
                      <TableCell className="text-sm">{content.type_name}</TableCell>
                      <TableCell><StageBadge code={content.stage_code} name={content.stage_name} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ol className="space-y-3">
            {((data?.events ?? []) as EventRow[]).map((event) => (
              <li key={event.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{event.event_type}</Badge>
                  <span className="text-sm">{fmtDateTime(event.occurred_at)}</span>
                  <span className="text-xs text-muted-foreground">by {event.actor} · {timeAgo(event.occurred_at)}</span>
                </div>
                {event.notes && <p className="mt-2 text-sm text-muted-foreground">{event.notes}</p>}
              </li>
            ))}
            {((data?.events ?? []) as EventRow[]).length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No events yet.</p>
            )}
          </ol>
        </TabsContent>

        {bin.tag_code && (
          <TabsContent value="tag" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p><span className="text-muted-foreground">Tag code:</span> <span className="font-mono">{bin.tag_code}</span></p>
              {bin.target_url && <p className="mt-1 break-all"><span className="text-muted-foreground">Target:</span> {bin.target_url}</p>}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} current={bin.name} submitting={commanding} onSubmit={run} />
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        currentLocationId={bin.location_id}
        submitting={commanding}
        onSubmit={run}
        locations={(lookups?.locations ?? []) as { id: string; path: string }[]}
      />
    </div>
  )
}

function RenameDialog({ open, onOpenChange, current, submitting, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: string
  submitting: boolean
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [name, setName] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename bin</DialogTitle>
          <DialogDescription>Current name: {current}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="bin-rename">New name</Label>
          <Input id="bin-rename" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting || !name.trim()}
            onClick={async () => { await onSubmit({ command: 'rename', name: name.trim() }); onOpenChange(false); setName('') }}
          >
            {submitting ? 'Saving…' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({ open, onOpenChange, currentLocationId, submitting, onSubmit, locations }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLocationId: string | null
  submitting: boolean
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  locations: { id: string; path: string }[]
}) {
  const [locationId, setLocationId] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move bin</DialogTitle>
          <DialogDescription>Choose a new location for this bin.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>New location</Label>
          <Select value={locationId || 'none'} onValueChange={(v) => setLocationId(v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {locations.map((locationOption) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={submitting}
            onClick={async () => {
              await onSubmit({ command: 'move', newLocationId: locationId || undefined, currentLocationId })
              onOpenChange(false)
            }}
          >
            {submitting ? 'Moving…' : 'Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
