import { useState, type FormEvent } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { UnknownAmount } from '@/components/StatusBadge'
import { formatCurrency, formatDate, todayISODate } from '@/utils/format'

export interface EntityField {
  name: string
  label: string
  type: 'text' | 'number' | 'date'
  required?: boolean
  defaultValue?: string
}

interface EntityCrudProps<T extends { id: string }> {
  table: string
  title: string
  description?: string
  fields: EntityField[]
  orderBy: string
  /** Column used to render the amount badge in the list (omit if not a money entity). */
  amountField?: keyof T & string
  amountTone?: 'positive' | 'negative'
  /** Column used as the primary label in the list. */
  labelField: keyof T & string
  /** Column used as the secondary (date) label in the list. */
  dateField?: keyof T & string
}

export function EntityCrud<T extends { id: string }>({
  table,
  title,
  description,
  fields,
  orderBy,
  amountField,
  amountTone = 'negative',
  labelField,
  dateField,
}: EntityCrudProps<T>) {
  const { data, loading, error, create, remove } = useSupabaseTable<T>(table, {
    orderBy,
    ascending: false,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const initialValues = () =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'date' ? todayISODate() : '')]),
    )
  const [values, setValues] = useState<Record<string, string>>(initialValues)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const payload: Record<string, unknown> = {}
    for (const field of fields) {
      const raw = values[field.name]
      if (field.type === 'number') {
        // Blank stays null ("por confirmar"/unknown) — never silently becomes 0.
        payload[field.name] = raw === '' ? null : Number(raw)
      } else {
        payload[field.name] = raw || null
      }
    }
    const result = await create(payload as Partial<T>)
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
    } else {
      setValues(initialValues())
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-xs font-medium text-gray-600">
              {field.label}
            </label>
            <input
              id={field.name}
              type={field.type}
              required={field.required}
              step={field.type === 'number' ? '0.01' : undefined}
              value={values[field.name] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        ))}
        <div className="flex items-end sm:col-span-2 md:col-span-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        {formError && <p className="text-sm text-red-600 sm:col-span-2 md:col-span-4">{formError}</p>}
      </form>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-gray-500">Sin registros todavía.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {data.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-gray-800">{String(item[labelField] ?? '—')}</p>
                  {dateField && (
                    <p className="text-xs text-gray-400">{formatDate(String(item[dateField]))}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {amountField &&
                    (item[amountField] === null || item[amountField] === undefined ? (
                      <UnknownAmount />
                    ) : (
                      <span className={amountTone === 'positive' ? 'text-brand-600' : 'text-red-600'}>
                        {formatCurrency(Number(item[amountField]))}
                      </span>
                    ))}
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="text-xs text-gray-400 hover:text-red-600"
                    aria-label="Eliminar"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
