import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/authContext'
import type { TableName, TableRows } from '@/types/database'

// Entidades cuyos cambios se registran en audit_logs (secc. 39). El resto
// de tablas de alta frecuencia (gastos individuales) audita solo el borrado.
const AUDITED_TABLES: ReadonlySet<string> = new Set([
  'accounts', 'income_sources', 'extraordinary_incomes', 'debts',
  'credit_cards', 'monthly_budgets', 'budget_categories', 'savings_goals',
  'financial_rules', 'receivables',
])

async function writeAudit(
  userId: string,
  table: string,
  entityId: string,
  action: 'create' | 'update' | 'delete',
  previous: unknown,
  next: unknown,
) {
  if (!AUDITED_TABLES.has(table) && action !== 'delete') return
  await supabase.from('audit_logs').insert({
    user_id: userId,
    entity_type: table,
    entity_id: entityId,
    action,
    previous_value: previous ?? null,
    new_value: next ?? null,
  })
}

interface UseTableOptions {
  orderBy?: string
  ascending?: boolean
  /** false para tablas sin columna deleted_at (p. ej. subcategorías). */
  softDelete?: boolean
}

export function useTable<T extends TableName>(table: T, options: UseTableOptions = {}) {
  type Row = TableRows[T]
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { orderBy = 'created_at', ascending = false, softDelete = true } = options

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase.from(table).select('*').eq('user_id', user.id)
    if (softDelete) query = query.is('deleted_at', null)
    const { data, error: err } = await query.order(orderBy, { ascending })
    if (err) setError(err.message)
    else {
      setError(null)
      setRows((data ?? []) as Row[])
    }
    setLoading(false)
  }, [user, table, orderBy, ascending, softDelete])

  useEffect(() => {
    void reload()
  }, [reload])

  const insert = useCallback(
    async (values: Partial<Row>): Promise<{ data: Row | null; error: string | null }> => {
      if (!user) return { data: null, error: 'Sin sesión' }
      const { data, error: err } = await supabase
        .from(table)
        .insert({ ...(values as Record<string, unknown>), user_id: user.id })
        .select()
        .single()
      if (err) return { data: null, error: err.message }
      const row = data as Row
      await writeAudit(user.id, table, (row as { id: string }).id, 'create', null, row)
      await reload()
      return { data: row, error: null }
    },
    [user, table, reload],
  )

  const update = useCallback(
    async (id: string, values: Partial<Row>): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Sin sesión' }
      const previous = rows.find((r) => (r as { id: string }).id === id) ?? null
      const { data, error: err } = await supabase
        .from(table)
        .update(values as Record<string, unknown>)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (err) return { error: err.message }
      await writeAudit(user.id, table, id, 'update', previous, data)
      await reload()
      return { error: null }
    },
    [user, table, rows, reload],
  )

  const remove = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Sin sesión' }
      const previous = rows.find((r) => (r as { id: string }).id === id) ?? null
      const result = softDelete
        ? await supabase
            .from(table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', user.id)
        : await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
      if (result.error) return { error: result.error.message }
      await writeAudit(user.id, table, id, 'delete', previous, null)
      await reload()
      return { error: null }
    },
    [user, table, rows, reload, softDelete],
  )

  return { rows, loading, error, reload, insert, update, remove }
}
