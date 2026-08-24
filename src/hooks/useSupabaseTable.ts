import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/**
 * Generic CRUD hook scoped to the current user's rows in a given table.
 * Every domain table in this project carries a `user_id` column protected
 * by RLS, so this one hook covers list/create/update/delete for all of them.
 */
export function useSupabaseTable<T extends { id: string }>(
  table: string,
  options?: { orderBy?: string; ascending?: boolean },
) {
  const { user } = useAuth()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase.from(table).select('*').eq('user_id', user.id)
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options?.ascending ?? false })
    }
    const { data: rows, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
    } else {
      setData((rows ?? []) as T[])
      setError(null)
    }
    setLoading(false)
  }, [table, user, options?.orderBy, options?.ascending])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(
    async (values: Partial<T>) => {
      if (!user) return { error: 'No hay sesión activa' }
      const { error: insertError } = await supabase
        .from(table)
        .insert({ ...values, user_id: user.id } as Record<string, unknown>)
      if (insertError) return { error: insertError.message }
      await refresh()
      return { error: null }
    },
    [table, user, refresh],
  )

  const update = useCallback(
    async (id: string, values: Partial<T>) => {
      const { error: updateError } = await supabase
        .from(table)
        .update(values as Record<string, unknown>)
        .eq('id', id)
      if (updateError) return { error: updateError.message }
      await refresh()
      return { error: null }
    },
    [table, refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
      if (deleteError) return { error: deleteError.message }
      await refresh()
      return { error: null }
    },
    [table, refresh],
  )

  return { data, loading, error, refresh, create, update, remove }
}
