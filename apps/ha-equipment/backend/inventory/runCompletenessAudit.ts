// Local inventory-completeness audit. Runs entirely against the canonical Retool DB —
// it does NOT depend on the Home Assistant collector. Reuses audit_finding /
// finding_status_history / audit_run with the same fingerprint-recurrence semantics as
// snapshot ingestion: recurring issues reopen, fixed issues auto-resolve, intentionally
// ignored findings stay ignored.
import { actorName } from './shared'
import {
  completenessFieldLabel,
  isCompletenessFieldKey,
  isFieldFilled,
  type CompletenessEquipmentRow,
  type CompletenessFieldKey,
} from './completenessFields'

type Params = Record<string, never>

type ExpectationRule = {
  ruleId: string
  fieldKey: CompletenessFieldKey
  label: string | null
  guidance: string | null
  severity: string
  equipmentTypeId: string | null // null = global
}

type ExpectedFinding = {
  equipmentId: string
  equipmentName: string
  fieldKey: string
  label: string
  severity: string
  title: string
  explanation: string
  suggestedAction: string
  fingerprint: string
}

const COMPLETENESS_PREFIX = 'completeness:'
const ACTIVE_STATUSES = new Set(['open', 'acknowledged', 'snoozed'])
const REOPENABLE_STATUSES = new Set(['resolved', 'acknowledged', 'snoozed'])
const VALID_SEVERITIES = new Set(['info', 'warning', 'error'])

function parseCompletenessFingerprint(fingerprint: string): { equipmentId: string; fieldKey: string } | null {
  if (!fingerprint.startsWith(COMPLETENESS_PREFIX)) return null
  const parts = fingerprint.slice(COMPLETENESS_PREFIX.length).split(':')
  const equipmentId = parts[0]
  const fieldKey = parts[1]
  if (!equipmentId || !fieldKey || parts.length !== 2) return null
  return { equipmentId, fieldKey }
}

export default async function(req: { params: Params; user: User }) {
  const actor = actorName(req.user)
  const checkedAt = new Date().toISOString()

  const rulesResult = await retoolDb.query(`
    SELECT id, name, scope, condition_json, severity
    FROM audit_rule
    WHERE enabled AND condition_json->>'type' = 'field_required'`)

  const expectations: ExpectationRule[] = []
  for (const ruleRow of rulesResult.data) {
    const condition = (ruleRow.condition_json ?? {}) as Record<string, unknown>
    const conditionFieldKey = condition['fieldKey']
    if (!isCompletenessFieldKey(conditionFieldKey)) continue // unknown keys are ignored, never interpolated
    const rawScope = ruleRow.scope === null || ruleRow.scope === undefined ? '' : String(ruleRow.scope)
    expectations.push({
      ruleId: String(ruleRow.id),
      fieldKey: conditionFieldKey,
      label: typeof condition['label'] === 'string' && condition['label'].trim() ? condition['label'] : completenessFieldLabel(fieldKey),
      guidance: typeof condition['guidance'] === 'string' ? condition['guidance'] : null,
      severity: VALID_SEVERITIES.has(String(ruleRow.severity)) ? String(ruleRow.severity) : 'info',
      equipmentTypeId: rawScope === '' ? null : rawScope,
    })
  }

  const equipmentResult = await retoolDb.query(`
    SELECT e.id, e.display_name, e.physical_id, e.equipment_type_id,
      e.manufacturer, e.model, e.serial_number, e.purchase_source, e.purchase_order_id,
      e.purchased_at, e.ip_address, e.mac_address, e.fcc_id, e.feed_url, e.notes,
      (SELECT count(*)::int FROM ha_entity_link l WHERE l.equipment_id = e.id AND l.active) AS active_link_count
    FROM equipment e
    WHERE e.archived_at IS NULL
    ORDER BY e.display_name`)
  const equipmentRows = equipmentResult.data as CompletenessEquipmentRow[]

  // Expected findings: active equipment × applicable enabled expectations × unfilled field.
  const expectedFindings: ExpectedFinding[] = []
  for (const equipmentRow of equipmentRows) {
    for (const expectation of expectations) {
      if (expectation.equipmentTypeId !== null && expectation.equipmentTypeId !== String(equipmentRow.equipment_type_id)) continue
      if (isFieldFilled(expectation.fieldKey, equipmentRow)) continue
      const label = expectation.label
      expectedFindings.push({
        equipmentId: equipmentRow.id,
        equipmentName: equipmentRow.display_name,
        fieldKey: expectation.fieldKey,
        label,
        severity: expectation.severity,
        title: `Missing ${label.toLowerCase()}`,
        explanation: expectation.guidance ?? `No ${label.toLowerCase()} recorded for this item yet.`,
        suggestedAction: `Open this equipment and fill in "${label}".`,
        fingerprint: `${COMPLETENESS_PREFIX}${equipmentRow.id}:${expectation.fieldKey}`,
      })
    }
  }

  // Pre-capture statuses of reopenable completeness findings so history can record the transition.
  const reopenCandidates = await retoolDb.query(`
    SELECT id, fingerprint, status FROM audit_finding
    WHERE fingerprint LIKE 'completeness:%' AND status IN ('resolved', 'acknowledged', 'snoozed')`)
  const reopenableByFingerprint = new Map<string, { id: string; status: string }>()
  for (const row of reopenCandidates.data) {
    reopenableByFingerprint.set(String(row.fingerprint), { id: String(row.id), status: String(row.status) })
  }

  const runResult = await retoolDb.query(`
    INSERT INTO audit_run (id, source, scope, status, requested_at, snapshot_at, coverage, missing_data, summary, idempotency_key)
    SELECT gen_random_uuid()::text, 'local_completeness', '{"kind":"completeness"}'::jsonb, 'completed',
      now(), $1::timestamptz, '{"mode":"local","requiresHaCollector":false}'::jsonb, '[]'::jsonb, $2::text, gen_random_uuid()::text
    RETURNING id`,
    [checkedAt, 'Local completeness check (no HA collector needed)'],
  )
  const runId = String(runResult.data[0]?.id)

  // Upsert expected findings: create, refresh, or reopen under existing recurrence semantics.
  let opened = 0
  let refreshed = 0
  let reopened = 0
  if (expectedFindings.length > 0) {
    const upsertRows = expectedFindings.map((finding) => ({
      equipment_id: finding.equipmentId,
      severity: finding.severity,
      title: finding.title,
      explanation: finding.explanation,
      evidence_json: {
        latest: { checkedAt, fieldKey: finding.fieldKey, label: finding.label, equipmentName: finding.equipmentName },
        runs: [{ runId, at: checkedAt }],
      },
      suggested_action: finding.suggestedAction,
      fingerprint: finding.fingerprint,
    }))
    const upsert = await retoolDb.query(
      `INSERT INTO audit_finding (
        id, audit_run_id, equipment_id, entity_id, category, severity, confidence,
        title, explanation, evidence_json, suggested_action, fingerprint,
        first_seen_at, last_seen_at, status
      )
      SELECT gen_random_uuid()::text, $1::text, x.equipment_id, NULL, 'completeness', x.severity, 'high',
        x.title, x.explanation, x.evidence_json, x.suggested_action, x.fingerprint,
        $2::timestamptz, $3::timestamptz, 'open'
      FROM jsonb_to_recordset($4::jsonb) AS x(
        equipment_id text, severity text, title text, explanation text,
        evidence_json jsonb, suggested_action text, fingerprint text
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        last_seen_at = EXCLUDED.last_seen_at,
        audit_run_id = EXCLUDED.audit_run_id,
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        explanation = EXCLUDED.explanation,
        suggested_action = EXCLUDED.suggested_action,
        status = CASE
          WHEN audit_finding.status IN ('resolved', 'acknowledged', 'snoozed') THEN 'open'
          ELSE audit_finding.status
        END,
        snoozed_until = CASE
          WHEN audit_finding.status IN ('resolved', 'acknowledged', 'snoozed') THEN NULL
          ELSE audit_finding.snoozed_until
        END,
        evidence_json = jsonb_build_object(
          'latest', EXCLUDED.evidence_json->'latest',
          'runs', COALESCE(audit_finding.evidence_json->'runs', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object('runId', $5::text, 'at', $6::timestamptz))
        )
      RETURNING (xmax = 0) AS inserted, fingerprint`,
      [runId, checkedAt, checkedAt, JSON.stringify(upsertRows), runId, checkedAt],
    )
    for (const row of upsert.data) {
      if (row.inserted === true) opened += 1
      else refreshed += 1
      const reopenable = reopenableByFingerprint.get(String(row.fingerprint))
      if (reopenable && reopenable.status !== 'open') {
        reopened += 1
        await retoolDb.query(
          `INSERT INTO finding_status_history (id, finding_id, from_status, to_status, actor, note)
          VALUES (gen_random_uuid()::text, $1::text, $2::text, 'open', $3::text, $4::text)`,
          [reopenable.id, reopenable.status, actor, 'Reopened by completeness check: field is missing again'],
        )
      }
    }
  }

  // Auto-resolve active completeness findings whose expectation no longer produces a finding:
  // the field was filled, the expectation was disabled/removed, or the equipment was archived.
  const existingActive = await retoolDb.query(`
    SELECT id, fingerprint, status FROM audit_finding
    WHERE fingerprint LIKE 'completeness:%' AND status IN ('open', 'acknowledged', 'snoozed')`)
  const expectedFingerprints = new Set(expectedFindings.map((finding) => finding.fingerprint))
  const equipmentById = new Map(equipmentRows.map((row) => [row.id, row]))
  const resolveTargets: Array<{ findingId: string; note: string }> = []
  for (const row of existingActive.data) {
    const fingerprint = String(row.fingerprint)
    if (expectedFingerprints.has(fingerprint)) continue
    const parsed = parseCompletenessFingerprint(fingerprint)
    let note = 'Auto-resolved: expectation disabled or removed.'
    if (parsed) {
      const equipmentRow = equipmentById.get(parsed.equipmentId)
      if (!equipmentRow) {
        note = 'Auto-resolved: equipment archived or removed.'
      } else if (isCompletenessFieldKey(parsed.fieldKey) && isFieldFilled(parsed.fieldKey, equipmentRow)) {
        note = `Auto-resolved by completeness check: ${completenessFieldLabel(parsed.fieldKey).toLowerCase()} is now filled.`
      }
    }
    resolveTargets.push({ findingId: String(row.id), note })
  }

  let resolved = 0
  if (resolveTargets.length > 0) {
    const resolvedRows = await retoolDb.query(
      `UPDATE audit_finding f
      SET status = 'resolved', snoozed_until = NULL,
        resolution_note = COALESCE(f.resolution_note, x.note), updated_at = now()
      FROM jsonb_to_recordset($1::jsonb) AS x(finding_id text, note text)
      WHERE f.id = x.finding_id AND f.status IN ('open', 'acknowledged', 'snoozed')
      RETURNING f.id`,
      [JSON.stringify(resolveTargets.map((target) => ({ finding_id: target.findingId, note: target.note })))],
    )
    resolved = resolvedRows.data.length
    for (const target of resolveTargets) {
      if (!resolvedRows.data.some((row) => String(row.id) === target.findingId)) continue
      const priorStatus = existingActive.data.find((row) => String(row.id) === target.findingId)
      await retoolDb.query(
        `INSERT INTO finding_status_history (id, finding_id, from_status, to_status, actor, note)
        VALUES (gen_random_uuid()::text, $1::text, $2::text, 'resolved', $3::text, $4::text)`,
        [target.findingId, priorStatus ? String(priorStatus.status) : 'open', actor, target.note],
      )
    }
  }

  const checkedItems = equipmentRows.length
  const summary = `Checked ${checkedItems} equipment against ${expectations.length} expectations: opened ${opened}, refreshed ${refreshed}, reopened ${reopened}, resolved ${resolved}.`

  return {
    ok: true as const,
    runId,
    checkedItems,
    expectationsEvaluated: expectations.length,
    findingsOpened: opened,
    findingsRefreshed: refreshed,
    findingsReopened: reopened,
    findingsResolved: resolved,
    summary,
    note: 'Local audit over the inventory database only — no Home Assistant collector involved. Ignored findings stay ignored.',
  }
}
