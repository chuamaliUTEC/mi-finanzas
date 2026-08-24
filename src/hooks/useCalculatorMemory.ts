import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { recallCurrentFact, rememberFact } from '@/algorithms/memory'

/**
 * Persists a calculator's input parameters as a single versioned
 * financial_memory fact. Saving new parameters never destroys the old
 * ones — the previous assumption set is kept as history automatically.
 */
export function useCalculatorMemory<T extends object>(key: string, defaults: T) {
  const { user } = useAuth()
  const [params, setParams] = useState<T>(defaults)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    recallCurrentFact(user.id, key).then(({ data }) => {
      if (data?.memory_value && Object.keys(data.memory_value).length > 0) {
        setParams({ ...defaults, ...(data.memory_value as T) })
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key])

  const save = useCallback(
    async (next: T) => {
      if (!user) return { error: 'No hay sesión activa' }
      const result = await rememberFact(user.id, key, next as unknown as Record<string, unknown>, {
        source: 'calculadora',
      })
      if (!result.error) setParams(next)
      return result
    },
    [user, key],
  )

  return { params, setParams, save, loading }
}
