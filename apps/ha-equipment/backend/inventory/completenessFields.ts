// Registry of fields the local completeness audit can check. Field keys coming from
// audit_rule rows are validated against this list, and every check reads an explicit
// equipment column — database values are never interpolated into SQL.

export type CompletenessFieldKey =
  | 'manufacturer'
  | 'model'
  | 'serial_number'
  | 'purchase_source'
  | 'purchase_order_id'
  | 'purchased_at'
  | 'ip_address'
  | 'mac_address'
  | 'fcc_id'
  | 'feed_url'
  | 'notes'
  | 'ha_link'

export type CompletenessFieldDefinition = {
  key: CompletenessFieldKey
  label: string
  appliesTo: string
}

export const COMPLETENESS_FIELDS: readonly CompletenessFieldDefinition[] = [
  { key: 'manufacturer', label: 'Manufacturer', appliesTo: 'Most physical products; broadly useful metadata.' },
  { key: 'model', label: 'Model', appliesTo: 'Model number; broadly useful metadata.' },
  { key: 'serial_number', label: 'Serial number', appliesTo: 'Devices with a serial plate or printed serial.' },
  { key: 'purchase_source', label: 'Purchase source', appliesTo: 'Items you bought (vendor/store); not for gifts or bundled items.' },
  { key: 'purchase_order_id', label: 'Purchase order ID', appliesTo: 'Only items ordered online with a trackable order number.' },
  { key: 'purchased_at', label: 'Purchase date', appliesTo: 'Items you bought; useful for warranty math.' },
  { key: 'ip_address', label: 'IP address', appliesTo: 'Networked devices only.' },
  { key: 'mac_address', label: 'MAC address', appliesTo: 'Networked devices only.' },
  { key: 'fcc_id', label: 'FCC ID', appliesTo: 'Wireless devices with an FCC label only.' },
  { key: 'feed_url', label: 'Feed URL / endpoint', appliesTo: 'Items with a data feed or local API endpoint only.' },
  { key: 'notes', label: 'Notes', appliesTo: 'Anything worth remembering about placement or quirks.' },
  { key: 'ha_link', label: 'HA entity link', appliesTo: 'Equipment expected to appear in Home Assistant.' },
]

const FIELD_LABELS: Record<CompletenessFieldKey, string> = Object.fromEntries(
  COMPLETENESS_FIELDS.map((field) => [field.key, field.label]),
) as Record<CompletenessFieldKey, string>

export function isCompletenessFieldKey(value: unknown): value is CompletenessFieldKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FIELD_LABELS, value)
}

export function completenessFieldLabel(key: CompletenessFieldKey): string {
  return FIELD_LABELS[key]
}

/** Equipment columns the checks read; the runner selects exactly these. */
export type CompletenessEquipmentRow = {
  id: string
  display_name: string
  physical_id: string
  equipment_type_id: string
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  purchase_source: string | null
  purchase_order_id: string | null
  purchased_at: string | null
  ip_address: string | null
  mac_address: string | null
  fcc_id: string | null
  feed_url: string | null
  notes: string | null
  active_link_count: number
}

export function isFieldFilled(key: CompletenessFieldKey, row: CompletenessEquipmentRow): boolean {
  if (key === 'ha_link') return row.active_link_count > 0
  if (key === 'purchased_at') return row.purchased_at !== null
  const textValue = row[key]
  return typeof textValue === 'string' && textValue.trim().length > 0
}
