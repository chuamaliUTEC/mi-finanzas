import { useRef, useState } from 'react'
import { useDocuments } from '@/hooks/useDocuments'
import { formatDate } from '@/utils/format'

export default function Documents() {
  const { files, loading, error, upload, remove, getSignedUrl } = useDocuments()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const result = await upload(file)
    setUploading(false)
    if (result.error) setUploadError(result.error)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleOpen = async (doc: (typeof files)[number]) => {
    const { url, error: urlError } = await getSignedUrl(doc)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else if (urlError) setUploadError(urlError)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">📁 Documentos</h2>
        <p className="text-sm text-gray-500">
          Estados de cuenta, recibos, contratos y comprobantes. Se guardan en Supabase Storage, no en
          el navegador.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
          Subir un documento
        </label>
        <input
          id="file-upload"
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
          className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
        {uploading && <p className="mt-2 text-sm text-gray-500">Subiendo…</p>}
        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no subes documentos.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {files.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  className="text-left text-brand-700 hover:underline"
                >
                  {doc.file_name}
                  <span className="ml-2 text-xs text-gray-400">{formatDate(doc.created_at.slice(0, 10))}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
