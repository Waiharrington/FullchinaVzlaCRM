import { client } from './client'
import type { AuditLog, SystemActivityLog } from './types'

export async function getAuditLogs(limit = 200, allPages = false): Promise<AuditLog[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client()
    .from('audit_logs')
    .select('id,occurred_at,actor_name,module,action,details,severity')
    .order('occurred_at', { ascending: false })
    .limit(allPages ? 500 : limit)
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  return rows.map((r) => ({
    id: r.id as string,
    occurredAt: r.occurred_at as string,
    actorName: r.actor_name as string,
    module: r.module as string,
    action: r.action as string,
    details: (r.details as string) ?? null,
    severity: r.severity as AuditLog['severity'],
  }))
}

export async function getSystemActivityLogs(offset = 0, limit = 100): Promise<SystemActivityLog[]> {
  const { data, error } = await client()
    .from('system_activity_logs')
    .select('id,occurred_at,actor_name,module,action,entity_table,entity_id,entity_label,changed_fields,changes,context')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    actorName: String(row.actor_name ?? 'Sistema'),
    module: String(row.module ?? 'Sistema'),
    action: row.action as SystemActivityLog['action'],
    entityTable: String(row.entity_table),
    entityId: row.entity_id == null ? null : String(row.entity_id),
    entityLabel: row.entity_label == null ? null : String(row.entity_label),
    changedFields: Array.isArray(row.changed_fields) ? row.changed_fields.map(String) : [],
    changes: row.changes && typeof row.changes === 'object' ? row.changes as SystemActivityLog['changes'] : {},
    context: row.context && typeof row.context === 'object' ? row.context as SystemActivityLog['context'] : {},
  }))
}

// --- Helpers -----------------------------------------------------------------

// --- Proveedores -------------------------------------------------------------

