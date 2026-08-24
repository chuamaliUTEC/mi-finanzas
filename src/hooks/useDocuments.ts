import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { UploadedFile } from '@/types/database'

const BUCKET = 'user-files'

export function useDocuments() {
  const { user } = useAuth()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setFiles([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: queryError } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (queryError) setError(queryError.message)
    else {
      setFiles((data ?? []) as UploadedFile[])
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const upload = useCallback(
    async (file: File) => {
      if (!user) return { error: 'No hay sesión activa' }
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadError) return { error: uploadError.message }

      const { error: insertError } = await supabase.from('uploaded_files').insert({
        user_id: user.id,
        bucket_id: BUCKET,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      })
      if (insertError) return { error: insertError.message }
      await refresh()
      return { error: null }
    },
    [user, refresh],
  )

  const remove = useCallback(
    async (doc: UploadedFile) => {
      await supabase.storage.from(doc.bucket_id).remove([doc.storage_path])
      const { error: deleteError } = await supabase.from('uploaded_files').delete().eq('id', doc.id)
      if (deleteError) return { error: deleteError.message }
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  const getSignedUrl = useCallback(async (doc: UploadedFile) => {
    const { data, error: urlError } = await supabase.storage
      .from(doc.bucket_id)
      .createSignedUrl(doc.storage_path, 60)
    return { url: data?.signedUrl ?? null, error: urlError?.message ?? null }
  }, [])

  return { files, loading, error, upload, remove, getSignedUrl }
}
