// Ingest a structured, timestamped HA snapshot from an external assistant/runner.
// Preserves unavailable/unknown states distinctly from numeric zero, derives rule-based
// findings, dedupes by stable fingerprint (never auto-resolving), and groups multiple
// unavailable entities of the same equipment into one likely-outage finding.
import { isUniqueViolation, jsonValue, optionalString, requireIdempotencyKey, requireString } from './shared'

type SnapshotEntity = {
  entityId: string
  state: string
  lastChanged?: string
  lastUpdated?: string
  attributes?: Record<string, unknown>
  deviceId?: string
  integration?: string
}

type AssistantFinding = {
  equipmentId?: string
  entityId?: string
  category: string
  severity?: string
  confidence?: string
  title: string
  explanation?: string
  evidence?: Record<string, unknown>
  suggestedAction?: string
  fingerprint?: string
}

type Params = {
  source: string
  snapshotAt?: string
  scope?: Record<string, unknown>
  coverage?: Record<string, unknown>
  missingData?: Array<Record<string, unknown>>
  entities?: SnapshotEntity[]
  assistantFindings?: AssistantFinding[]
  idempotencyKey: string
}

type DerivedFinding = {
  equipmentId: string | null
  entityId: string | null
  category: string
  severity: string
  confidence: string
  title: string
  explanation: string | null
  evidence: Record<string, unknown>
  suggestedAction: string | null
  fingerprint: string
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)
}

export default async function(req: { params: Params }) {
  const params = req.params ?? {}
  const source = requireString(params.source, 'source', 100)
  const idempotencyKey = requireIdempotencyKey(params.idempotencyKey)

  const snapshotAt = params.snapshotAt ? new Date(String(params.snapshotAt)) : new Date()
  if (Number.isNaN(snapshotAt.getTime())) throw new Error('snapshotAt is not a valid timestamp')
  const snapshotIso = snapshotAt.toISOString()

  const entities = Array.isArray(params.entities) ? params.entities : []
  const assistantFindings = Array.isArray(params.assistantFindings) ? params.assistantFindings : []
  const missingData = Array.isArray(params.missingData) ? params.missingData : []
  if (entities.length === 0 && assistantFindings.length === 0) {
    throw new Error('Snapshot must include entities or assistantFindings')
  }

  // Load active links with the owning equipment's lifecycle expectation.
  const links = await retoolDb.query(
    `SELECT l.id, l.entity_id, l.equipment_id, l.ha_device_id, l.role, l.integration,
      s.expects_online, e.display_name
    FROM ha_entity_link l
    JOIN equipment e ON e.id = l.equipment_id
    JOIN lifecycle_stage s ON s.id = e.lifecycle_stage_id
    WHERE l.active`,
  )
  const linkByEntity = new Map<string, Record<string, unknown>>()
  for (const link of links.data) linkByEntity.set(String(link.entity_id), link)

  // Enabled rules provide thresholds; the app never invents animal-care limits.
  const rules = await retoolDb.query(
    `SELECT id, name, scope, condition_json, grace_minutes, severity FROM audit_rule WHERE enabled`,
  )
  let batteryThreshold = 20
  let staleMaxAgeMinutes: number | null = null
  const rangeRules: Array<Record<string, unknown>> = []
  for (const rule of rules.data) {
    const condition = (rule.condition_json ?? {}) as Record<string, unknown>
    const type = String(condition['type'] ?? '')
    if (type === 'battery_threshold') batteryThreshold = Number(condition['threshold'] ?? batteryThreshold)
    else if (type === 'stale') staleMaxAgeMinutes = Number(condition['maxAgeMinutes'] ?? 0)
    else if (type === 'range') rangeRules.push({ ...condition, severity: rule.severity, name: rule.name })
  }

  const findings: DerivedFinding[] = []
  const unavailableByEquipment = new Map<string, SnapshotEntity[]>()
  const seenEntityIds: string[] = []

  for (const entity of entities) {
    const entityId = requireString(entity?.entityId, 'entityId', 200)
    const state = optionalString(entity?.state, 'state', 200)
    if (!state) continue
    seenEntityIds.push(entityId)
    const link = linkByEntity.get(entityId)
    const evidence: Record<string, unknown> = {
      latest: {
        entityId,
        state,
        lastChanged: entity.lastChanged ?? null,
        lastUpdated: entity.lastUpdated ?? null,
        snapshotAt: snapshotIso,
      },
    }

    if (!link) {
      findings.push({
        equipmentId: null,
        entityId,
        category: 'unmapped_entity',
        severity: 'info',
        confidence: 'high',
        title: `HA entity not linked to inventory: ${entityId}`,
        explanation: 'This entity is not mapped to any equipment record. Link it in settings or on the equipment page.',
        evidence,
        suggestedAction: 'Link entity to an equipment record',
        fingerprint: `unmapped:${entityId}`,
      })
      continue
    }

    const equipmentId = String(link.equipment_id)
    const expectsOnline = link.expects_online === true
    evidence['equipment'] = { id: equipmentId, name: link.display_name, expectsOnline }

    if (state === 'unavailable') {
      if (!expectsOnline) continue // stored/retired/spare: expected offline, no alert
      const list = unavailableByEquipment.get(equipmentId) ?? []
      list.push(entity)
      unavailableByEquipment.set(equipmentId, list)
      continue
    }

    if (state === 'unknown') {
      findings.push({
        equipmentId,
        entityId,
        category: 'unknown_state',
        severity: 'info',
        confidence: 'low',
        title: `Unknown state: ${entityId}`,
        explanation: 'The entity reports unknown. Labelled as needing investigation; an unknown state alone is not proof of failure.',
        evidence,
        suggestedAction: 'Investigate entity state',
        fingerprint: `unknown:${entityId}`,
      })
      continue
    }

    const numeric = Number(state)
    const isBattery = String(link.role) === 'battery' || entityId.endsWith('_battery') ||
      (entity.attributes && typeof entity.attributes['battery_level'] !== 'undefined')
    if (isBattery && Number.isFinite(numeric)) {
      evidence['latest']['threshold'] = batteryThreshold
      if (numeric < batteryThreshold) {
        findings.push({
          equipmentId,
          entityId,
          category: 'low_battery',
          severity: 'warning',
          confidence: 'high',
          title: `Low battery on ${String(link.display_name)} (${entityId})`,
          explanation: `Battery reports ${numeric}, below the configured threshold of ${batteryThreshold}.`,
          evidence,
          suggestedAction: 'Log a battery replacement',
          fingerprint: `battery_low:${entityId}`,
        })
      }
      continue
    }

    if (Number.isFinite(numeric)) {
      for (const rule of rangeRules) {
        const role = rule['role'] ? String(rule['role']) : null
        if (role && String(link.role) !== role) continue
        const min = rule['min'] !== undefined ? Number(rule['min']) : null
        const max = rule['max'] !== undefined ? Number(rule['max']) : null
        if ((min !== null && numeric < min) || (max !== null && numeric > max)) {
          findings.push({
            equipmentId,
            entityId,
            category: 'out_of_range',
            severity: String(rule['severity'] ?? 'warning'),
            confidence: 'medium',
            title: `Out-of-range reading: ${entityId} = ${numeric} (rule: ${String(rule['name'])})`,
            explanation: 'Value is outside the configured range. Needs investigation.',
            evidence: { ...evidence, rule: { name: rule['name'], min, max } },
            suggestedAction: 'Investigate reading',
            fingerprint: `range:${entityId}:${String(rule['name'])}`,
          })
        }
      }
    }

    if (staleMaxAgeMinutes !== null && entity.lastUpdated) {
      const ageMs = snapshotAt.getTime() - new Date(String(entity.lastUpdated)).getTime()
      if (Number.isFinite(ageMs) && ageMs > staleMaxAgeMinutes * 60_000) {
        findings.push({
          equipmentId,
          entityId,
          category: 'stale_data',
          severity: 'info',
          confidence: 'low',
          title: `No recent updates: ${entityId}`,
          explanation: `Last update ${entity.lastUpdated} is older than the ${staleMaxAgeMinutes} minute expectation. Needs investigation; this alone does not prove the sensor is dead.`,
          evidence,
          suggestedAction: 'Investigate reporting interval',
          fingerprint: `stale:${entityId}`,
        })
      }
    }
  }

  // Group multiple unexpected unavailabilities under one likely device/integration outage.
  for (const [equipmentId, list] of unavailableByEquipment) {
    const first = list[0]
    if (!first) continue
    const deviceId = first.deviceId ? String(first.deviceId) : null
    if (list.length >= 2) {
      findings.push({
        equipmentId,
        entityId: null,
        category: 'possible_device_outage',
        severity: 'error',
        confidence: 'medium',
        title: `Multiple unavailable entities on one device (${list.length})`,
        explanation: `${list.length} entities of this equipment are unavailable at snapshot time. Grouped as a likely shared device or integration outage rather than one alert per entity.`,
        evidence: { latest: { snapshotAt: snapshotIso, entities: list.map((item) => item.entityId), haDeviceId: deviceId } },
        suggestedAction: 'Check the device/integration, then investigate individually if it persists past the grace period',
        fingerprint: `outage:${equipmentId}`,
      })
    } else {
      const entityId = String(first.entityId)
      findings.push({
        equipmentId,
        entityId,
        category: 'unexpected_unavailable',
        severity: 'warning',
        confidence: 'medium',
        title: `Unexpectedly unavailable: ${entityId}`,
        explanation: 'Equipment is expected online but its entity is unavailable at snapshot time. Grace period applies; a single stale timestamp alone is not proof of a dead sensor.',
        evidence: { latest: { snapshotAt: snapshotIso, entityId, lastChanged: first.lastChanged ?? null, haDeviceId: deviceId } },
        suggestedAction: 'Check device power/connectivity',
        fingerprint: `unavailable:${entityId}`,
      })
    }
  }

  for (const finding of assistantFindings) {
    const title = requireString(finding?.title, 'assistantFindings.title', 300)
    const fingerprint = optionalString(finding?.fingerprint, 'fingerprint', 200) ??
      `assistant:${slug(String(finding?.category ?? 'note'))}:${finding?.entityId ?? finding?.equipmentId ?? 'none'}:${slug(title)}`
    findings.push({
      equipmentId: finding?.equipmentId ? String(finding.equipmentId) : null,
      entityId: finding?.entityId ? String(finding.entityId) : null,
      category: requireString(finding?.category, 'assistantFindings.category', 100),
      severity: optionalString(finding?.severity, 'severity', 20) ?? 'warning',
      confidence: optionalString(finding?.confidence, 'confidence', 20) ?? 'medium',
      title,
      explanation: optionalString(finding?.explanation, 'explanation') ?? 'Assistant-supplied finding.',
      evidence: { latest: { snapshotAt: snapshotIso, ...(finding?.evidence ?? {}) } },
      suggestedAction: optionalString(finding?.suggestedAction, 'suggestedAction', 500),
      fingerprint,
    })
  }

  const runStatus = missingData.length > 0 ? 'partial' : 'completed'
  const summary = `Entities: ${entities.length}, findings: ${findings.length}, missing data entries: ${missingData.length}`

  let runId: string
  try {
    const run = await retoolDb.query(
      `INSERT INTO audit_run (
        id, source, scope, status, requested_at, snapshot_at, coverage, missing_data, summary, idempotency_key
      ) VALUES (
        gen_random_uuid()::text, $1, $2::jsonb, $3, now(), $4, $5::jsonb, $6::jsonb, $7, $8
      ) RETURNING id`,
      [
        source, jsonValue(params.scope ?? {}), runStatus, snapshotIso,
        jsonValue(params.coverage ?? {}), jsonValue(missingData), summary, idempotencyKey,
      ],
    )
    runId = String(run.data[0]?.id)
  } catch (error) {
    if (isUniqueViolation(error, 'idempotency_key')) {
      const existing = await retoolDb.query(`SELECT id FROM audit_run WHERE idempotency_key = $1`, [idempotencyKey])
      const row = existing.data[0]
      if (row) return { ok: true as const, runId: row.id, findingsIngested: 0, idempotentReplay: true, summary: 'Snapshot already ingested (idempotent replay).' }
    }
    throw error
  }

  let created = 0
  let updated = 0
  let reopened = 0
  if (findings.length > 0) {
    const rows = findings.map((finding) => ({
      equipment_id: finding.equipmentId,
      entity_id: finding.entityId,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      title: finding.title,
      explanation: finding.explanation,
      evidence_json: { latest: finding.evidence['latest'], runs: [{ runId, at: snapshotIso }] },
      suggested_action: finding.suggestedAction,
      fingerprint: finding.fingerprint,
    }))

    // Capture which non-open statuses these fingerprints had BEFORE the upsert so a
    // recurrence can reopen them and record the transition in status history.
    const fingerprints = rows.map((row) => row.fingerprint)
    const pre = await retoolDb.query(
      `SELECT id, fingerprint, status FROM audit_finding
      WHERE fingerprint = ANY($1::text[]) AND status IN ('resolved', 'acknowledged', 'snoozed')`,
      [fingerprints],
    )
    const preByFingerprint = new Map<string, { id: string; status: string }>()
    for (const row of pre.data) {
      preByFingerprint.set(String(row.fingerprint), { id: String(row.id), status: String(row.status) })
    }

    const upsert = await retoolDb.query(
      `INSERT INTO audit_finding (
        id, audit_run_id, equipment_id, entity_id, category, severity, confidence,
        title, explanation, evidence_json, suggested_action, fingerprint,
        first_seen_at, last_seen_at, status
      )
      SELECT gen_random_uuid()::text, $1, x.equipment_id, x.entity_id, x.category, x.severity, x.confidence,
        x.title, x.explanation, x.evidence_json, x.suggested_action, x.fingerprint,
        $2, $3, 'open'
      FROM jsonb_to_recordset($4::jsonb) AS x(
        equipment_id text, entity_id text, category text, severity text, confidence text,
        title text, explanation text, evidence_json jsonb, suggested_action text, fingerprint text
      )
      ON CONFLICT (fingerprint) DO UPDATE SET
        last_seen_at = EXCLUDED.last_seen_at,
        audit_run_id = EXCLUDED.audit_run_id,
        -- A recurring issue becomes visible again; intentionally ignored stays ignored.
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
          'runs', COALESCE(audit_finding.evidence_json->'runs', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('runId', EXCLUDED.audit_run_id, 'at', EXCLUDED.last_seen_at))
        )
      RETURNING (xmax = 0) AS inserted, fingerprint`,
      [runId, snapshotIso, snapshotIso, JSON.stringify(rows)],
    )
    for (const row of upsert.data) {
      if (row.inserted === true) created += 1
      else updated += 1
    }

    // Record reopen transitions in history (best effort; preserves the audit trail).
    for (const [fingerprint, previous] of preByFingerprint) {
      const stillOpen = upsert.data.some((upsertRow) => upsertRow.fingerprint === fingerprint && upsertRow.inserted === false)
      if (!stillOpen) continue
      reopened += 1
      await retoolDb.query(
        `INSERT INTO finding_status_history (id, finding_id, from_status, to_status, actor, note)
        VALUES (gen_random_uuid()::text, $1, $2, 'open', $3, $4)`,
        [previous.id, previous.status, source, `Reopened by recurring snapshot finding (${snapshotIso})`],
      )
    }
  }

  if (seenEntityIds.length > 0) {
    await retoolDb.query(
      `UPDATE ha_entity_link SET last_seen_at = $1 WHERE active AND entity_id = ANY($2::text[])`,
      [snapshotIso, seenEntityIds],
    )
  }

  return {
    ok: true as const,
    runId,
    status: runStatus,
    entitiesIngested: entities.length,
    findingsCreated: created,
    findingsUpdated: updated,
    findingsReopened: reopened,
    summary,
    note: 'Imported snapshots are stored as historical snapshots at their snapshotAt time, not live data. Partial runs never resolve existing findings. Recurring findings reopen resolved/acknowledged/snoozed records; intentionally ignored findings stay ignored.',
  }
}
