// Full equipment detail: fields, readable relations, HA links, installation checklist, event history, open findings.
import { buildHaPlacementPlanForEquipment } from './haPlacementPlan'
import { LOCATION_TREE_CTE } from './locationReadModel'

type Params = {
  equipmentId: string
}

type EquipmentEventRow = {
  id: string
  event_type: string
  occurred_at: string
  recorded_at: string
  actor: string
  source: string
  notes: string | null
  payload_json: Record<string, unknown>
}

export default async function(req: { params: Params }) {
  const equipmentId = String(req.params?.equipmentId ?? '')
  if (!equipmentId) throw new Error('equipmentId is required')

  const head = await retoolDb.query(
    `${LOCATION_TREE_CTE}
    SELECT e.*, t.name AS type_name, s.name AS stage_name, s.code AS stage_code, s.expects_online,
      e.id_marking_status, e.condition_status, e.review_flag, e.review_reason, e.review_updated_at, e.proposed_cleanup_note,
      b.name AS bin_name, b.bin_code,
      direct_lr.name AS direct_location_name, direct_lr.parent_location_id,
      direct_lr.parent_name AS direct_parent_name,
      direct_lr.path AS direct_location_path,
      eff_lr.id AS effective_location_id, eff_lr.name AS effective_location_name,
      eff_lr.parent_name AS effective_parent_name,
      eff_lr.path AS effective_location_path,
      eff_lr.ha_area_id AS effective_direct_ha_area_id,
      eff_lr.ha_label_id AS effective_ha_label_id,
      eff_lr.effective_ha_area_id,
      eff_lr.effective_area_source_location_id,
      eff_lr.effective_area_source_location_name,
      intended_lr.id AS intended_location_id,
      intended_lr.name AS intended_location_name,
      intended_lr.path AS intended_location_path
    FROM equipment e
    JOIN equipment_type t ON t.id = e.equipment_type_id
    JOIN lifecycle_stage s ON s.id = e.lifecycle_stage_id
    LEFT JOIN bin b ON b.id = e.bin_id
    LEFT JOIN loc_read_model direct_lr ON direct_lr.id = e.direct_location_id
    LEFT JOIN loc_read_model eff_lr ON eff_lr.id = COALESCE(b.location_id, e.direct_location_id)
    LEFT JOIN loc_read_model intended_lr ON intended_lr.id = e.intended_location_id
    WHERE e.id = $1`,
    [equipmentId],
  )
  const equipment = head.data[0]
  if (!equipment) throw new Error('Equipment not found')

  const [links, events, findings, checklist, followupTasks, removalRecords, haPlacementPlan] = await Promise.all([
    retoolDb.query(
      `SELECT id, ha_instance_id, entity_id, ha_device_id, integration, role, outlet_index,
        first_seen_at, last_seen_at, active
      FROM ha_entity_link WHERE equipment_id = $1 ORDER BY active DESC, entity_id`,
      [equipmentId],
    ),
    retoolDb.query(
      `SELECT id, event_type, occurred_at, recorded_at, actor, source, notes, payload_json
      FROM equipment_event WHERE equipment_id = $1
      ORDER BY occurred_at DESC, recorded_at DESC LIMIT 200`,
      [equipmentId],
    ),
    retoolDb.query(
      `SELECT id, category, severity, confidence, title, explanation, suggested_action,
        status, snoozed_until, last_seen_at, fingerprint
      FROM audit_finding WHERE equipment_id = $1
        AND status IN ('open','acknowledged','snoozed')
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'error' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, title`,
      [equipmentId],
    ),
    retoolDb.query(
      `SELECT equipment_id, step_key, status, note, changed_at, changed_by, updated_at
      FROM installation_checklist_item WHERE equipment_id = $1
      ORDER BY CASE step_key
        WHEN 'permanent_device_label' THEN 1
        WHEN 'manufacturer_app_firmware' THEN 2
        WHEN 'ha_link' THEN 3
        WHEN 'physical_placement' THEN 4
        WHEN 'verified_operation' THEN 5
        ELSE 99 END`,
      [equipmentId],
    ),
    retoolDb.query(
      `SELECT id, equipment_id, task_type, status, note, due_at, created_at, created_by,
        completed_at, completed_by, completion_note, updated_at
      FROM equipment_followup_task WHERE equipment_id = $1
      ORDER BY status ASC, created_at ASC`,
      [equipmentId],
    ),
    retoolDb.query(
      `${LOCATION_TREE_CTE}
      SELECT r.*, 
        original_lr.path AS original_location_path,
        original_bin.name AS original_bin_name,
        custody_lr.path AS custody_location_path,
        custody_bin.name AS custody_bin_name
      FROM equipment_removal_record r
      LEFT JOIN loc_read_model original_lr ON original_lr.id = r.original_direct_location_id
      LEFT JOIN bin original_bin ON original_bin.id = r.original_bin_id
      LEFT JOIN loc_read_model custody_lr ON custody_lr.id = r.custody_location_id
      LEFT JOIN bin custody_bin ON custody_bin.id = r.custody_bin_id
      WHERE r.equipment_id = $1
      ORDER BY r.removed_at DESC`,
      [equipmentId],
    ),
    buildHaPlacementPlanForEquipment(equipmentId),
  ])

  return {
    equipment,
    haLinks: links.data,
    events: events.data as EquipmentEventRow[],
    openFindings: findings.data,
    installationChecklist: checklist.data,
    followupTasks: followupTasks.data,
    removalRecords: removalRecords.data,
    haPlacementPlan,
  }
}
