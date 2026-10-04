import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useGetEquipmentList, useGetLookupData } from '../hooks/backend/inventory'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { StageBadge } from './ui/badges'
import { AddEquipmentForm, type AddFormLookups } from './ui/AddEquipmentForm'
import type { EquipmentId } from '../utils/inventory'

const PAGE_SIZE = 25

type Row = {
  id: EquipmentId
  physical_id: string
  display_name: string
  manufacturer: string | null
  model: string | null
  type_name: string
  stage_name: string
  stage_code: string
  bin_name: string | null
  effective_location_name: string | null
  effective_location_path: string | null
  effective_parent_name: string | null
  open_issues: number
  link_count: number
}

export default function Equipment() {
  const [q, setQ] = useState('')
  const [typeId, setTypeId] = useState('')
  const [stageId, setStageId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [offset, setOffset] = useState(0)
  const [addOpen, setAddOpen] = useState(false)

  const { data: lookups, trigger: triggerLookups } = useGetLookupData()
  const { data, loading, error, trigger } = useGetEquipmentList()

  const params: Record<string, unknown> = useMemo(() => {
    const p: Record<string, unknown> = { limit: PAGE_SIZE, offset }
    if (q.trim()) p['q'] = q.trim()
    if (typeId) p['typeId'] = typeId
    if (stageId) p['stageId'] = stageId
    if (locationId) p['locationId'] = locationId
    return p
  }, [q, typeId, stageId, locationId, offset])

  useEffect(() => { triggerLookups() }, [triggerLookups])
  useEffect(() => { trigger(params) }, [trigger, params])

  const rows: Row[] = data?.items ?? []
  const total = data?.total ?? 0

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Equipment</h1>
          <p className="text-sm text-muted-foreground">{total} items tracked</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Quick register</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Quick register physical item</DialogTitle>
              <DialogDescription>Only type and a unique physical inventory ID are required. Installation checklist follows on the equipment detail page.</DialogDescription>
            </DialogHeader>
            <AddEquipmentForm
              lookups={(lookups ?? {
                types: [], stages: [], locations: [], bins: [], manufacturers: [], models: [],
              }) as AddFormLookups}
              onCreated={() => {
                setAddOpen(false)
                trigger(params)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, ID, make, model…"
            className="pl-8"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0) }}
          />
        </div>
        <Select value={typeId || 'all'} onValueChange={(v) => { setTypeId(v === 'all' ? '' : v); setOffset(0) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(lookups?.types ?? []).map((typeOption: { id: string; name: string }) => <SelectItem key={typeOption.id} value={typeOption.id}>{typeOption.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stageId || 'all'} onValueChange={(v) => { setStageId(v === 'all' ? '' : v); setOffset(0) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {(lookups?.stages ?? []).map((stageOption: { id: string; name: string }) => <SelectItem key={stageOption.id} value={stageOption.id}>{stageOption.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locationId || 'all'} onValueChange={(v) => { setLocationId(v === 'all' ? '' : v); setOffset(0) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {(lookups?.locations ?? []).map((locationOption: { id: string; path: string }) => <SelectItem key={locationOption.id} value={locationOption.id}>{locationOption.path}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No equipment matches these filters.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Issues</TableHead>
                <TableHead className="text-right">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link to={`/equipment/${row.id}`} className="font-medium hover:underline">
                      {row.display_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {row.physical_id}{row.manufacturer ? ` · ${row.manufacturer}` : ''}{row.model ? ` ${row.model}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{row.type_name}</TableCell>
                  <TableCell><StageBadge code={row.stage_code} name={row.stage_name} /></TableCell>
                  <TableCell className="text-sm">
                    {row.bin_name
                      ? <>Bin: {row.bin_name}{row.effective_location_path ? <span className="text-muted-foreground"> · {row.effective_location_path}</span> : null}</>
                      : row.effective_location_path
                        ? <>{row.effective_location_path}</>
                        : row.effective_location_name
                          ? <>{row.effective_location_name}{row.effective_parent_name ? <span className="text-muted-foreground"> · {row.effective_parent_name}</span> : null}</>
                          : <span className="text-muted-foreground">Unplaced</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.open_issues > 0
                      ? <span className="font-medium text-red-600 dark:text-red-400">{row.open_issues}</span>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.link_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
