import { useEffect, useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '../../lib/shadcn/badge'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../lib/shadcn/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../lib/shadcn/table'
import { useGetHaDiscovery } from '../../hooks/backend/inventory'
import type { LocationId } from '../../utils/inventory'

export type LocationRow = {
  id: LocationId
  name: string
  parent_location_id: LocationId | null
  parent_name: string | null
  depth: number
  path: string
  ha_area_id: string | null
  ha_label_id: string | null
  effective_ha_area_id: string | null
  effective_area_source_location_id: LocationId | null
  effective_area_source_location_name: string | null
  suggested_ha_label_id: string | null
  suggested_ha_label_display: string | null
}

type AreaOption = {
  ha_area_id: string
  name: string
  ha_instance_id?: string
}

type LocationBridgeTableProps = {
  locations: LocationRow[]
  disabled: boolean
  onSaveArea: (location: LocationRow, haAreaId: string) => void
  onSaveLabel: (location: LocationRow, haLabelId: string) => void
}

export function LocationBridgeTable({ locations, disabled, onSaveArea, onSaveLabel }: LocationBridgeTableProps) {
  const { data: discovery, trigger: triggerDiscovery } = useGetHaDiscovery()

  useEffect(() => { triggerDiscovery({ current: 'current', limit: 100 }) }, [triggerDiscovery])

  const currentAreas = (discovery?.areas ?? []) as AreaOption[]

  const columns = useMemo<ColumnDef<LocationRow>[]>(() => [
    {
      id: 'path',
      header: 'Path',
      cell: ({ row }) => <LocationPathCell location={row.original} />,
    },
    {
      accessorKey: 'parent_name',
      header: 'Parent',
      cell: ({ row }) => row.original.parent_name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'ha_area_id',
      header: 'Direct HA Area',
      cell: ({ row }) => (
        <LocationHaAreaCell
          location={row.original}
          areas={currentAreas}
          disabled={disabled}
          onSave={(haAreaId) => onSaveArea(row.original, haAreaId)}
        />
      ),
    },
    {
      accessorKey: 'effective_ha_area_id',
      header: 'Effective HA Area',
      cell: ({ row }) => <EffectiveAreaCell location={row.original} />,
    },
    {
      accessorKey: 'ha_label_id',
      header: 'HA Label ID',
      cell: ({ row }) => (
        <LocationHaLabelCell
          location={row.original}
          disabled={disabled}
          onSave={(haLabelId) => onSaveLabel(row.original, haLabelId)}
        />
      ),
    },
  ], [currentAreas, disabled, onSaveArea, onSaveLabel])

  const table = useReactTable({
    data: locations,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className={row.original.depth > 0 ? 'bg-muted/20' : ''}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LocationPathCell({ location }: { location: LocationRow }) {
  return (
    <div className="min-w-56" style={{ paddingLeft: `${Math.min(location.depth, 6) * 1.25}rem` }}>
      <div className="flex items-center gap-2">
        {location.depth > 0 && <span className="text-muted-foreground">↳</span>}
        <span className="font-medium">{location.name}</span>
        {location.depth > 0 && <Badge variant="secondary" className="text-xs">Sub-location</Badge>}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{location.path}</div>
    </div>
  )
}

function LocationHaAreaCell({ location, areas, disabled, onSave }: {
  location: LocationRow
  areas: AreaOption[]
  disabled: boolean
  onSave: (haAreaId: string) => void
}) {
  const [value, setValue] = useState(location.ha_area_id ?? '')

  useEffect(() => { setValue(location.ha_area_id ?? '') }, [location.id, location.ha_area_id])

  const options = useMemo(() => {
    if (!location.ha_area_id || areas.some((area) => area.ha_area_id === location.ha_area_id)) return areas
    return [{ ha_area_id: location.ha_area_id, name: `Stored: ${location.ha_area_id}` }, ...areas]
  }, [areas, location.ha_area_id])

  const savedValue = location.ha_area_id ?? ''
  const dirty = value !== savedValue

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value || 'none'} onValueChange={(selected) => setValue(selected === 'none' ? '' : selected)} disabled={disabled}>
          <SelectTrigger className="h-8 w-52"><SelectValue placeholder="Not mapped" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not mapped</SelectItem>
            {options.map((area) => (
              <SelectItem key={`${area.ha_instance_id ?? 'stored'}:${area.ha_area_id}`} value={area.ha_area_id}>
                {area.name} ({area.ha_area_id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8" disabled={disabled || !dirty} onClick={() => onSave(value)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" className="h-8" disabled={disabled || !savedValue} onClick={() => onSave('')}>
          Clear
        </Button>
      </div>
    </div>
  )
}

function EffectiveAreaCell({ location }: { location: LocationRow }) {
  if (!location.effective_ha_area_id) return <span className="text-sm text-muted-foreground">No effective area</span>

  const inherited = location.effective_area_source_location_id !== null
    && location.effective_area_source_location_id !== location.id

  return (
    <div className="space-y-1">
      <Badge variant={inherited ? 'secondary' : 'outline'} className="font-mono text-xs">
        {location.effective_ha_area_id}
      </Badge>
      <div className="text-xs text-muted-foreground">
        {inherited
          ? `Inherited from ${location.effective_area_source_location_name ?? 'ancestor'}`
          : 'Direct mapping'}
      </div>
    </div>
  )
}

function LocationHaLabelCell({ location, disabled, onSave }: {
  location: LocationRow
  disabled: boolean
  onSave: (haLabelId: string) => void
}) {
  const [value, setValue] = useState(location.ha_label_id ?? '')

  useEffect(() => { setValue(location.ha_label_id ?? '') }, [location.id, location.ha_label_id])

  const savedValue = location.ha_label_id ?? ''
  const dirty = value !== savedValue
  const suggestion = location.ha_label_id ? null : location.suggested_ha_label_id

  return (
    <div className="min-w-72 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-64 font-mono text-xs"
          value={value}
          placeholder={suggestion ?? 'loc_room_sub_location'}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
        />
        <Button variant="outline" size="sm" className="h-8" disabled={disabled || !dirty} onClick={() => onSave(value)}>
          Save
        </Button>
        <Button variant="ghost" size="sm" className="h-8" disabled={disabled || !savedValue} onClick={() => onSave('')}>
          Clear
        </Button>
      </div>
      {location.ha_label_id ? null : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{location.suggested_ha_label_display ?? 'Suggested HA label'}</span>
          {suggestion && <span className="font-mono">{suggestion}</span>}
          {suggestion && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={disabled} onClick={() => setValue(suggestion)}>
              Use suggestion
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
