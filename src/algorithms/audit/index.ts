import { supabase } from '@/lib/supabase'

interface AuditEntryInput {
  userId: string
  action: string
  tableName?: string
  recordId?: string
  changes?: Record<string, unknown>
}

/** Appends one row to audit_logs. Never throws: auditing must not block the user's action. */
export async function recordAuditEntry(entry: AuditEntryInput): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    table_name: entry.tableName ?? null,
    record_id: entry.recordId ?? null,
    changes: entry.changes ?? null,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('No se pudo registrar la entrada de auditoría:', error.message)
  }
}
