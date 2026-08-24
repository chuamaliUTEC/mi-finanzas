import { useEffect, useState, type FormEvent } from 'react'
import { useProfile } from '@/hooks/useProfile'

export default function Preferences() {
  const { profile, loading, save } = useProfile()
  const [fullName, setFullName] = useState('')
  const [currency, setCurrency] = useState('PEN')
  const [locale, setLocale] = useState('es-PE')
  const [timezone, setTimezone] = useState('America/Lima')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setCurrency(profile.currency)
      setLocale(profile.locale)
      setTimezone(profile.timezone)
    }
  }, [profile])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    const result = await save({ full_name: fullName, currency, locale, timezone })
    setSaving(false)
    if (result.error) setError(result.error)
    else setSaved(true)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">⚙️ Preferencias</h2>
        <p className="text-sm text-gray-500">Datos de tu perfil y configuración regional.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Moneda</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Configuración regional (locale)</label>
            <input
              type="text"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Zona horaria</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-brand-700">Guardado.</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </form>
      )}
    </div>
  )
}
