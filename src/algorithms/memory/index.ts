import { supabase } from '@/lib/supabase'
import type { DataStatus, FinancialMemory } from '@/types/database'

/**
 * financial_memory stores durable facts learned about a user
 * (e.g. "ingreso_principal", "objetivo_retiro"), keyed by memory_key.
 *
 * This is append-only: recording a new fact never overwrites the old row.
 * A DB trigger (archive_previous_memory_fact_trigger) demotes the previous
 * 'actual' row for the same key to 'historico' automatically, so the full
 * evolution of a fact is always recoverable.
 */
export async function rememberFact(
  userId: string,
  key: string,
  value: Record<string, unknown>,
  options?: { confidence?: number; source?: string; status?: DataStatus; effectiveDate?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('financial_memory').insert({
    user_id: userId,
    memory_key: key,
    memory_value: value,
    confidence: options?.confidence ?? 0.5,
    source: options?.source ?? 'system',
    status: options?.status ?? 'actual',
    effective_date: options?.effectiveDate ?? new Date().toISOString().slice(0, 10),
  })
  return { error: error?.message ?? null }
}

/** The current ('actual') fact for a key, or null if none has been recorded. */
export async function recallCurrentFact(userId: string, key: string) {
  const { data, error } = await supabase
    .from('financial_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('memory_key', key)
    .eq('status', 'actual')
    .maybeSingle()
  return { data: data as FinancialMemory | null, error: error?.message ?? null }
}

/** Full history for a key, most recent first — never destroyed, only appended to. */
export async function recallFactHistory(userId: string, key: string) {
  const { data, error } = await supabase
    .from('financial_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('memory_key', key)
    .order('effective_date', { ascending: false })
  return { data: (data ?? []) as FinancialMemory[], error: error?.message ?? null }
}
