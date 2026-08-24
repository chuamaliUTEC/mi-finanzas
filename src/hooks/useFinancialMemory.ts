import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { rememberFact } from '@/algorithms/memory'
import type { DataStatus, FinancialMemory } from '@/types/database'

export interface MemoryGroup {
  key: string
  current: FinancialMemory | null
  history: FinancialMemory[]
}

function groupByKey(rows: FinancialMemory[]): MemoryGroup[] {
  const byKey = new Map<string, FinancialMemory[]>()
  for (const row of rows) {
    const list = byKey.get(row.memory_key) ?? []
    list.push(row)
    byKey.set(row.memory_key, list)
  }
  return Array.from(byKey.entries())
    .map(([key, rows]) => ({
      key,
      current: rows.find((r) => r.status === 'actual') ?? rows[0] ?? null,
      history: rows
        .filter((r) => r.status !== 'actual')
        .sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function useFinancialMemory() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<MemoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('financial_memory')
      .select('*')
      .eq('user_id', user.id)
      .order('effective_date', { ascending: false })
    if (queryError) {
      setError(queryError.message)
    } else {
      setGroups(groupByKey((data ?? []) as FinancialMemory[]))
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addFact = useCallback(
    async (
      key: string,
      value: string,
      options?: { status?: DataStatus; source?: string; note?: string },
    ) => {
      if (!user) return { error: 'No hay sesión activa' }
      const result = await rememberFact(
        user.id,
        key,
        { texto: value, nota: options?.note ?? null },
        { status: options?.status, source: options?.source },
      )
      if (!result.error) await refresh()
      return result
    },
    [user, refresh],
  )

  return { groups, loading, error, refresh, addFact }
}
