// Settings commands: create type / location / bin, toggle audit rule, link an HA entity,
// manage completeness field expectations, and maintain HA placement bridges.
import {
  actorName,
  isForeignKeyViolation,
  isUniqueViolation,
  optionalString,
  optionalUuid,
  requireIdempotencyKey,
  requireString,
  requireUuid,
  ValidationError,
} from './shared'
import { completenessFieldLabel, isCompletenessFieldKey, type CompletenessFieldKey } from './completenessFields'

type Params = {
  command: 'create_type' | 'create_location' | 'toggle_rule' | 'link_entity' | 'unlink_entity' | 'set_type_prefix'
    | 'save_field_requirement' | 'delete_field_requirement' | 'set_location_ha_area' | 'set_location_ha_label'
  // create_type
  name?: string
  description?: string
  defaultMaintenanceIntervalDays?: number
  // create_location
  parentLocationId?: string
  haAreaId?: string
  // toggle_rule
  ruleId?: string
  enabled?: boolean
  // set_type_prefix
  typeId?: string
  idPrefix?: string
  // save_field_requirement / delete_field_requirement
  fieldKey?: string
  severity?: string
  guidance?: string
  // link/unlink entity
  equipmentId?: string
  entityId?: string
  linkId?: string
  haInstanceId?: string
  haDeviceId?: string
  integration?: string
  role?: string
  outletIndex?: number
  // set_location_ha_area / set_location_ha_label
  locationId?: string
  haAreaId?: string
  haLabelId?: string
  idempotencyKey: string
}

export default async function(req: { params: Params; user: User }) {
  const params = req.params ?? {}
  const actor = actorName(req.user)
  void actor

  if (params.command === 'create_type') {
    const name = requireString(params.name, 'name', 200)
    try {
      const result = await retoolDb.query(
        `INSERT INTO equipment_type (id, name, description, default_maint_interval_days)
        VALUES (gen_random_uuid()::text, $1, $2, $3) RETURNING id`,
        [name, optionalString(params.description, 'description', 2000),
          params.defaultMaintenanceIntervalDays !== undefined ? Number(params.defaultMaintenanceIntervalDays) : null],
      )
      return { ok: true as const, id: result.data[0]?.id ?? null }
    } catch (error) {
      if (isUniqueViolation(error, 'equipment_type_name_key')) {
        throw new ValidationError(`Type "${name}" already exists`)
      }
      throw error
    }
  }

  if (params.command === 'create_location') {
    const name = requireString(params.name, 'name', 200)
    const parentId = optionalUuid(params.parentLocationId, 'parentLocationId')
    if (parentId) {
      // Walk up the ancestor chain; the new node cannot exist yet so a cycle is impossible,
      // but a self-referencing or dangling parent must be rejected.
      const parent = await retoolDb.query(`SELECT id FROM location WHERE id = $1`, [parentId])
      if (!parent.data[0]) throw new ValidationError('Parent location not found')
    }
    const result = await retoolDb.query(
      `INSERT INTO location (id, name, parent_location_id, ha_area_id, notes)
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id`,
      [name, parentId, optionalString(params.haAreaId, 'haAreaId', 100), optionalString(params.notes, 'notes', 2000)],
    )
    return { ok: true as const, id: result.data[0]?.id ?? null }
  }

  if (params.command === 'toggle_rule') {
    const ruleId = requireUuid(params.ruleId, 'ruleId')
    await retoolDb.query(
      `UPDATE audit_rule SET enabled = $1, updated_at = now() WHERE id = $2`,
      [params.enabled === true, ruleId],
    )
    return { ok: true as const }
  }

  if (params.command === 'set_type_prefix') {
    const typeId = requireUuid(params.typeId, 'typeId')
    // Empty string clears the prefix; prefix is normalized to a short slug-ish token.
    const prefix = optionalString(params.idPrefix, 'idPrefix', 30)
    if (prefix && !/^[a-z0-9][a-z0-9_-]*$/i.test(prefix)) {
      throw new ValidationError('Prefix may only contain letters, numbers, dashes, and underscores')
    }
    const normalized = prefix ? prefix.toLowerCase() : null
    try {
      await retoolDb.query(
        `UPDATE equipment_type SET id_prefix = $1, updated_at = now() WHERE id = $2`,
        [normalized, typeId],
      )
      return { ok: true as const, idPrefix: normalized }
    } catch (error) {
      if (isUniqueViolation(error, 'uq_equipment_type_id_prefix')) {
        throw new ValidationError(`Prefix "${normalized}" is already used by another type`)
      }
      throw error
    }
  }

  if (params.command === 'link_entity') {
    const equipmentId = requireUuid(params.equipmentId, 'equipmentId')
    const entityId = requireString(params.entityId, 'entityId', 200)
    const haInstanceId = optionalString(params.haInstanceId, 'haInstanceId', 100) ?? 'default_ha'
    const haDeviceId = optionalString(params.haDeviceId, 'haDeviceId', 200)
    const integration = optionalString(params.integration, 'integration', 100)
    const role = optionalString(params.role, 'role', 100)
    try {
      const result = await retoolDb.query(
        `INSERT INTO ha_entity_link (
          id, equipment_id, ha_instance_id, entity_id, ha_device_id, integration, role, outlet_index, active
        ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, true)
        RETURNING id`,
        [equipmentId, haInstanceId, entityId, haDeviceId, integration, role, params.outletIndex !== undefined ? Number(params.outletIndex) : null],
      )
      return { ok: true as const, id: result.data[0]?.id ?? null }
    } catch (error) {
      if (isUniqueViolation(error, 'uq_ha_active')) {
        throw new ValidationError(`${entityId} is already actively linked to another equipment record`)
      }
      if (isForeignKeyViolation(error)) {
        throw new ValidationError('Equipment not found')
      }
      throw error
    }
  }

  if (params.command === 'unlink_entity') {
    const linkId = requireUuid(params.linkId, 'linkId')
    await retoolDb.query(`UPDATE ha_entity_link SET active = false WHERE id = $1`, [linkId])
    return { ok: true as const }
  }

  if (params.command === 'set_location_ha_area') {
    const locationId = requireUuid(params.locationId, 'locationId')
    // Empty string clears the optional bridge from a physical location to an HA Area.
    const haAreaId = optionalString(params.haAreaId, 'haAreaId', 200)
    const locationExists = await retoolDb.query(`SELECT 1 FROM location WHERE id = $1::text`, [locationId])
    if (!locationExists.data[0]) throw new ValidationError('Location not found')
    await retoolDb.query(
      `UPDATE location SET ha_area_id = $1::text, updated_at = now() WHERE id = $2::text`,
      [haAreaId, locationId],
    )
    return { ok: true as const, haAreaId }
  }

  if (params.command === 'set_location_ha_label') {
    const locationId = requireUuid(params.locationId, 'locationId')
    // Empty string clears the optional secondary HA Label bridge.
    const haLabelId = optionalString(params.haLabelId, 'haLabelId', 200)
    if (haLabelId && !/^loc_[a-z0-9_]+$/.test(haLabelId)) {
      throw new ValidationError('HA Label ID must use the loc_* namespace with lowercase letters, numbers, and underscores')
    }
    const locationExists = await retoolDb.query(`SELECT 1 FROM location WHERE id = $1::text`, [locationId])
    if (!locationExists.data[0]) throw new ValidationError('Location not found')
    await retoolDb.query(
      `UPDATE location SET ha_label_id = $1::text, updated_at = now() WHERE id = $2::text`,
      [haLabelId, locationId],
    )
    return { ok: true as const, haLabelId }
  }

  if (params.command === 'save_field_requirement') {
    const conditionFieldKey = requireString(params.fieldKey, 'fieldKey', 100)
    if (!isCompletenessFieldKey(conditionFieldKey)) {
      throw new ValidationError(`Unsupported completeness field "${conditionFieldKey}"`)
    }
    const fieldKey: CompletenessFieldKey = conditionFieldKey
    const severity = optionalString(params.severity, 'severity', 20) ?? 'info'
    if (severity !== 'info' && severity !== 'warning' && severity !== 'error') {
      throw new ValidationError('Severity must be info, warning, or error')
    }
    const guidance = optionalString(params.guidance, 'guidance', 500)
    const scopeTypeId = optionalUuid(params.equipmentTypeId, 'equipmentTypeId')
    const label = completenessFieldLabel(fieldKey)
    let ruleName = `Completeness: ${label}`
    if (scopeTypeId) {
      const typeRow = await retoolDb.query(`SELECT name FROM equipment_type WHERE id = $1::text`, [scopeTypeId])
      const typeName = typeRow.data[0]?.name ? String(typeRow.data[0].name) : 'type'
      ruleName = `Completeness: ${label} (${typeName})`
    }
    const conditionJson = JSON.stringify({ type: 'field_required', fieldKey, label, ...(guidance ? { guidance } : {}) })

    if (params.ruleId) {
      const ruleId = requireUuid(params.ruleId, 'ruleId')
      const updated = await retoolDb.query(
        `UPDATE audit_rule
        SET name = $1::text, scope = $2::text, condition_json = $3::jsonb, severity = $4::text, updated_at = now()
        WHERE id = $5::text AND condition_json->>'type' = 'field_required'
        RETURNING id`,
        [ruleName, scopeTypeId ?? '', conditionJson, severity, ruleId],
      )
      if (!updated.data[0]) throw new ValidationError('Completeness expectation not found')
      return { ok: true as const, ruleId }
    }

    try {
      const inserted = await retoolDb.query(
        `INSERT INTO audit_rule (id, name, scope, enabled, condition_json, grace_minutes, severity, exceptions_json)
        SELECT gen_random_uuid()::text, $1::text, $2::text, true, $3::jsonb, 0, $4::text, '{}'::jsonb
        RETURNING id`,
        [ruleName, scopeTypeId ?? '', conditionJson, severity],
      )
      return { ok: true as const, ruleId: inserted.data[0]?.id ?? null }
    } catch (error) {
      if (isUniqueViolation(error, 'uq_audit_rule_field_required')) {
        throw new ValidationError(`An expectation for "${label}" already exists at this scope`)
      }
      throw error
    }
  }

  if (params.command === 'delete_field_requirement') {
    const ruleId = requireUuid(params.ruleId, 'ruleId')
    const deleted = await retoolDb.query(
      `DELETE FROM audit_rule
      WHERE id = $1::text AND condition_json->>'type' = 'field_required'
      RETURNING id`,
      [ruleId],
    )
    if (!deleted.data[0]) throw new ValidationError('Completeness expectation not found')
    return { ok: true as const }
  }

  void requireIdempotencyKey(params.idempotencyKey)
  throw new ValidationError(`Unknown settings command "${String(params.command)}"`)
}
