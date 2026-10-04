// DDL for the equipment inventory schema. Executed once via the migration runner.
// Column names below reflect the LIVE schema (photo_file_id, default_maint_interval_days).
// Later additive migrations are applied out-of-band with ALTER TABLE ... ADD COLUMN IF NOT EXISTS;
// the v2 additions are noted in comments rather than inlined here so a fresh database and the
// live database end up with the same shape.
export const SCHEMA_DDL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE equipment_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  -- v2: nullable stable prefix for suggested physical IDs (hyg, htr, ps, ...)
  id_prefix text UNIQUE,
  default_maint_interval_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lifecycle_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  expects_online boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false
);

CREATE TABLE location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_location_id uuid REFERENCES location(id),
  ha_area_id text,
  -- v6: optional HA Label bridge for child/sub-locations in the loc_* namespace.
  ha_label_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_code text NOT NULL UNIQUE,
  name text NOT NULL,
  location_id uuid REFERENCES location(id),
  photo_file_id text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  physical_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  equipment_type_id uuid NOT NULL REFERENCES equipment_type(id),
  lifecycle_stage_id uuid NOT NULL REFERENCES lifecycle_stage(id),
  manufacturer text,
  model text,
  serial_number text,
  photo_file_id text,
  notes text,
  direct_location_id uuid REFERENCES location(id),
  bin_id uuid REFERENCES bin(id),
  purchased_at date,
  -- v2 legacy-sheet model columns (all nullable, additive):
  purchase_source text,   -- legacy "bought": Amazon/eBay/Home Depot/... (NOT a date)
  purchase_order_id text, -- opaque retailer order identifier (e.g. Amazon order number); never numeric-validated
  ip_address text,
  mac_address text,
  fcc_id text,
  feed_url text,          -- potentially sensitive; never shown in list tables
  legacy_added_at timestamptz, -- preserved "date added" for eventual legacy sheet import
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  CONSTRAINT equipment_one_placement CHECK (
    (direct_location_id IS NULL OR bin_id IS NULL)
  )
);
CREATE TABLE equipment_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending', -- workflow control: pending | in_progress | completed | cancelled
  working_name text NOT NULL,
  equipment_type_id uuid REFERENCES equipment_type(id),
  manufacturer text,
  model text,
  serial_number text,
  purchase_source text,
  purchase_order_id text,
  acquired_at date,
  direct_location_id uuid REFERENCES location(id),
  bin_id uuid REFERENCES bin(id),
  notes text,
  reserved_physical_id text,
  current_step text,
  raw_import_json jsonb,
  resulting_equipment_id uuid REFERENCES equipment(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- Partial uniqueness: two ACTIVE intakes cannot reserve the same physical ID.
CREATE UNIQUE INDEX uq_equipment_intake_reserved_active
  ON equipment_intake (reserved_physical_id)
  WHERE status IN ('pending', 'in_progress') AND reserved_physical_id IS NOT NULL;
CREATE INDEX idx_equipment_intake_status ON equipment_intake (status, updated_at);
`;

// Idempotent v2 migration for databases created from an older DDL.
export const V2_MIGRATION_DDL = [
  'ALTER TABLE equipment_type ADD COLUMN IF NOT EXISTS id_prefix text',
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_type_id_prefix ON equipment_type (id_prefix) WHERE id_prefix IS NOT NULL',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_source text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS purchase_order_id text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS ip_address text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS mac_address text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS fcc_id text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS feed_url text',
  'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS legacy_added_at timestamptz',
];

// v3 (inventory completeness audit): no new tables — completeness expectations are
// audit_rule rows with condition_json.type = 'field_required' (fieldKey, label, guidance?).
// scope (text) '' = global, otherwise an equipment_type id. The partial unique index below
// enforces one expectation per (field, scope). Findings reuse audit_finding with
// fingerprints completeness:<equipment_id>:<field_key> and category 'completeness'.
export const V3_COMPLETENESS_MIGRATION_DDL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_rule_field_required
    ON audit_rule ((condition_json->>'fieldKey'), COALESCE(scope, ''))
    WHERE condition_json->>'type' = 'field_required'`,
];
// Seeded defaults (idempotent, only when absent): global 'manufacturer' and 'model',
// severity 'info'. Network/HA/order fields are intentionally NOT seeded globally.
export const V3_COMPLETENESS_SEED_FIELD_KEYS = ['manufacturer', 'model'] as const;

// v4 (resumable equipment intake): draft workflow state lives in equipment_intake, kept
// separate from the canonical equipment table and from lifecycle stages. See the
// equipment_intake definition above; the live database creates it idempotently via
// CREATE TABLE IF NOT EXISTS plus the same two indexes.

// v5 (read-only HA snapshot/discovery layer): ha_snapshot_run, ha_area_snapshot,
// ha_device_snapshot, ha_entity_snapshot — a read-only mirror of a Home Assistant
// instance's registry/state keyed by (ha_instance_id, natural id). HA data is NEVER
// canonical inventory: equipment/equipment_event remain canonical, ha_entity_link stays
// the explicit mapping, and location.ha_area_id is an optional bridge to an HA Area.
// Snapshot rows are upserted per import; rows absent from the latest full snapshot are
// marked is_current = false (stale), never deleted. No HA tokens/credentials are stored.

// v6 (location/sub-location → HA Area/Label bridge): Retool location hierarchy stays
// canonical. Top-level room-like locations may map directly to HA Areas. Child and deeper
// sub-locations may store HA Label IDs in a dedicated loc_* namespace and inherit the
// nearest ancestor HA Area through the read model; labels are secondary tags, not canonical
// physical locations.
export const V6_LOCATION_HA_LABEL_MIGRATION_DDL = [
  'ALTER TABLE location ADD COLUMN IF NOT EXISTS ha_label_id text',
  `UPDATE location
    SET ha_area_id = CASE id
      WHEN '8a9460f7-736d-4b1b-be8a-1fc2afb04ec0' THEN 'living_room'
      WHEN 'e1677ea3-1363-4479-b2e3-7cec0a3ef349' THEN 'reptile_room'
      WHEN '819849a6-08d5-4bdb-a3f0-d29298dc3cd9' THEN NULL
      ELSE ha_area_id
    END,
    ha_label_id = CASE id
      WHEN 'aa28e02c-9e4f-4917-b2bf-e093b5a479e5' THEN 'loc_living_room_120_aquarium'
      WHEN '498588dd-97e5-4f0d-b450-01a4b3351cde' THEN 'loc_storage_room_shelf_a'
      ELSE ha_label_id
    END,
    updated_at = now()
    WHERE id IN (
      '8a9460f7-736d-4b1b-be8a-1fc2afb04ec0',
      'e1677ea3-1363-4479-b2e3-7cec0a3ef349',
      '819849a6-08d5-4bdb-a3f0-d29298dc3cd9',
      'aa28e02c-9e4f-4917-b2bf-e093b5a479e5',
      '498588dd-97e5-4f0d-b450-01a4b3351cde'
    )`,
] as const;
