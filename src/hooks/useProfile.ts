import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types/database'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (queryError) setError(queryError.message)
    else {
      setProfile(data as Profile | null)
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    async (values: Partial<Profile>) => {
      if (!user) return { error: 'No hay sesión activa' }
      const { error: updateError } = await supabase.from('profiles').update(values).eq('id', user.id)
      if (updateError) return { error: updateError.message }
      await refresh()
      return { error: null }
    },
    [user, refresh],
  )

  return { profile, loading, error, save }
}
