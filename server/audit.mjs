import { getDb, newId, nowIso } from './db.mjs';

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export function recordAuditEvent({
  pharmacyId = null,
  actorType,
  actorId = null,
  eventType,
  entityType = null,
  entityId = null,
  metadata = {},
}) {
  const event = {
    id: newId('audit'),
    pharmacy_id: pharmacyId,
    actor_type: actorType || 'system',
    actor_id: actorId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata_json: JSON.stringify(metadata || {}),
    created_at: nowIso(),
  };
  getDb().prepare(`
    INSERT INTO audit_events (
      id, pharmacy_id, actor_type, actor_id, event_type,
      entity_type, entity_id, metadata_json, created_at
    ) VALUES (
      @id, @pharmacy_id, @actor_type, @actor_id, @event_type,
      @entity_type, @entity_id, @metadata_json, @created_at
    )
  `).run(event);
  return { ...event, metadata: metadata || {}, metadata_json: undefined };
}

export function listAuditEvents(pharmacyId, { limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 250));
  return getDb().prepare(`
    SELECT id, actor_type, actor_id, event_type, entity_type, entity_id, metadata_json, created_at
    FROM audit_events
    WHERE pharmacy_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(pharmacyId, safeLimit).map((row) => ({
    ...row,
    metadata: parseJson(row.metadata_json),
    metadata_json: undefined,
  }));
}
