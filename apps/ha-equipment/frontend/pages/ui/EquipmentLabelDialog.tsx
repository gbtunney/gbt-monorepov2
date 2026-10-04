import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Button } from '../../lib/shadcn/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../lib/shadcn/dialog'
import './labelPrint.css'

type EquipmentLabelRecord = {
  id: string
  physical_id: string
  display_name: string
  type_name: string
}

export function EquipmentLabelDialog({ equipment }: { equipment: EquipmentLabelRecord }) {
  const detailUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/equipment/${equipment.id}`
    return new URL(`/equipment/${equipment.id}`, window.location.origin).toString()
  }, [equipment.id])

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Printer className="h-4 w-4" /> Print label</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="equipment-label-no-print">
          <DialogTitle>Printable equipment label</DialogTitle>
          <DialogDescription>
            QR opens this equipment card by stable record ID. It does not move the item or encode room, intended area, or mutable state.
          </DialogDescription>
        </DialogHeader>

        <div className="equipment-label-print-area rounded-lg border border-border bg-card p-4 text-card-foreground">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-md bg-white p-2 text-black">
              <QRCodeSVG value={detailUrl} size={112} level="M" includeMargin />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground print:text-black">Inventory ID</div>
              <div className="font-mono text-3xl font-bold leading-tight print:text-black">{equipment.physical_id}</div>
              <div className="mt-1 truncate text-sm font-medium print:text-black">{equipment.display_name}</div>
              <div className="text-xs text-muted-foreground print:text-black">{equipment.type_name}</div>
              <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground print:text-black">{detailUrl}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="equipment-label-no-print">
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
