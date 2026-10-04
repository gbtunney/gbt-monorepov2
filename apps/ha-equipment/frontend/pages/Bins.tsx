import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useGetBins, useRunBinCommand } from '../hooks/backend/inventory'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../lib/shadcn/dialog'
import { Skeleton } from '../lib/shadcn/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../lib/shadcn/table'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Badge } from '../lib/shadcn/badge'
import { errorMessage, newIdempotencyKey, type BinId } from '../utils/inventory'

type BinRow = {
  id: BinId
  bin_code: string
  name: string
  notes: string | null
  archived_at: string | null
  location_name: string | null
  parent_location_name: string | null
  item_count: number
  tag_count: number
}

export default function Bins() {
  const { data, loading, error, trigger } = useGetBins()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => { trigger() }, [trigger])

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  const bins: BinRow[] = data?.bins ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bins</h1>
          <p className="text-sm text-muted-foreground">Storage containers that group items by shelf, drawer, or box.</p>
        </div>
        <CreateBinDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => trigger()} />
      </div>

      {loading && bins.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : bins.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No bins yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bin</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Tags</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bins.map((binRow) => (
                <TableRow key={binRow.id} className={binRow.archived_at ? 'opacity-60' : undefined}>
                  <TableCell>
                    <Link to={`/bins/${binRow.id}`} className="font-medium hover:underline">{binRow.name}</Link>
                    <div className="font-mono text-xs text-muted-foreground">{binRow.bin_code}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {binRow.location_name ?? <span className="text-muted-foreground">—</span>}
                    {binRow.location_name && binRow.parent_location_name && (
                      <span className="text-muted-foreground"> · {binRow.parent_location_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{binRow.item_count}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{binRow.tag_count}</TableCell>
                  <TableCell>
                    {binRow.archived_at
                      ? <Badge variant="outline">Archived</Badge>
                      : <Badge variant="outline" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Active</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function CreateBinDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { trigger: runCommand, loading } = useRunBinCommand()
  const [binCode, setBinCode] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!binCode.trim() || !name.trim()) {
      setFormError('Bin code and name are required.')
      return
    }
    try {
      await runCommand({
        command: 'create',
        binCode: binCode.trim(),
        name: name.trim(),
        notes: notes.trim() || undefined,
        idempotencyKey: newIdempotencyKey(),
      })
      onOpenChange(false)
      setBinCode(''); setName(''); setNotes('')
      onCreated()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New bin</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New bin</DialogTitle>
          <DialogDescription>Register a storage container.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bin-code">Bin code</Label>
            <Input id="bin-code" value={binCode} onChange={(e) => setBinCode(e.target.value)} placeholder="bin_021" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bin-name">Name</Label>
            <Input id="bin-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cable spares" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bin-notes">Notes</Label>
            <Input id="bin-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
