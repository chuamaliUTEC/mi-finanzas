import { supabase } from '@/lib/supabase'

/**
 * financial_memory stores small, durable facts learned about a user
 * (e.g. "average_monthly_expense", "preferred_payoff_strategy"), keyed by memory_key.
 * This is intentionally a thin key/value layer, not an ML model.
 */
export async function rememberFact(
  userId: string,
  key: string,
  value: Record<string, unknown>,
  confidence = 0.5,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('financial_memory')
    .upsert(
      { user_id: userId, memory_key: key, memory_value: value, confidence, source: 'system' },
      { onConflict: 'user_id,memory_key' },
    )
  return { error: error?.message ?? null }
}

export async function recallFact(userId: string, key: string) {
  const { data, error } = await supabase
    .from('financial_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('memory_key', key)
    .maybeSingle()
  return { data, error: error?.message ?? null }
}
