import { useMemo, useState, type FormEvent } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { UnknownAmount } from '@/components/StatusBadge'
import { formatCurrency, formatDate, todayISODate } from '@/utils/format'

export interface EntityFieldOption {
  value: string
  label: string
}

export interface EntityField {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  required?: boolean
  defaultValue?: string
  /** Required when type is 'select'. Populate from a related table (e.g. categories). */
  options?: EntityFieldOption[]
  /** For type 'select': the label shown for an empty/no selection. */
  placeholder?: string
}

interface EntityCrudProps<T extends { id: string }> {
  table: string
  title: string
  description?: string
  fields: EntityField[]
  orderBy: string
  ascending?: boolean
  /** Column used to render the amount badge in the list (omit if not a money entity). */
  amountField?: keyof T & string
  amountTone?: 'positive' | 'negative'
  /** Column used as the primary label in the list. */
  labelField: keyof T & string
  /** Column used as the secondary (date) label in the list, and for the date-range filter. */
  dateField?: keyof T & string
}

export function EntityCrud<T extends { id: string }>({
  table,
  title,
  description,
  fields,
  orderBy,
  ascending = false,
  amountField,
  amountTone = 'negative',
  labelField,
  dateField,
}: EntityCrudProps<T>) {
  const { data, loading, error, create, update, remove } = useSupabaseTable<T>(table, {
    orderBy,
    ascending,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const initialValues = () =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.defaultValue ?? (f.type === 'date' ? todayISODate() : '')]),
    )
  const [values, setValues] = useState<Record<string, string>>(initialValues)

  const openNewForm = () => {
    setEditingId(null)
    setValues(initialValues())
    setFormOpen(true)
  }

  const openEditForm = (item: T) => {
    setEditingId(item.id)
    setValues(
      Object.fromEntries(fields.map((f) => [f.name, item[f.name as keyof T] == null ? '' : String(item[f.name as keyof T])])),
    )
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const payload: Record<string, unknown> = {}
    for (const field of fields) {
      const raw = values[field.name]
      if (field.type === 'number') {
        payload[field.name] = raw === '' ? null : Number(raw)
      } else {
        payload[field.name] = raw || null
      }
    }
    const result = editingId ? await update(editingId, payload as Partial<T>) : await create(payload as Partial<T>)
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
    } else {
      setValues(initialValues())
      setEditingId(null)
      setFormOpen(false)
    }
  }

  const filteredData = useMemo(() => {
    if (!dateField || (!dateFrom && !dateTo)) return data
    return data.filter((item) => {
      const value = String(item[dateField] ?? '')
      if (dateFrom && value < dateFrom) return false
      if (dateTo && value > dateTo) return false
      return true
    })
  }, [data, dateField, dateFrom, dateTo])

  // Resolves a select field's stored id to its human label, e.g. category_id -> "Alimentación".
  const selectFields = fields.filter((f) => f.type === 'select')
  const optionLookup = useMemo(() => {
    const lookup: Record<string, Record<string, string>> = {}
    for (const field of selectFields) {
      lookup[field.name] = Object.fromEntries((field.options ?? []).map((o) => [o.value, o.label]))
    }
    return lookup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>

      {/* Contextual toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={formOpen && !editingId ? () => setFormOpen(false) : openNewForm}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {formOpen && !editingId ? 'Cancelar' : `+ Nuevo`}
        </button>
        {dateField && (
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Filtros{dateFrom || dateTo ? ' •' : ''}
          </button>
        )}
      </div>

      {filtersOpen && dateField && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-xs font-medium text-gray-600">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  id={field.name}
                  required={field.required}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">{field.placeholder ?? 'Sin seleccionar'}</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.name}
                  type={field.type}
                  required={field.required}
                  step={field.type === 'number' ? '0.01' : undefined}
                  value={values[field.name] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
            </div>
          ))}
          <div className="flex items-end gap-2 sm:col-span-2 md:col-span-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
          {formError && <p className="text-sm text-red-600 sm:col-span-2 md:col-span-4">{formError}</p>}
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredData.length === 0 ? (
          <p className="text-sm text-gray-500">Sin registros{data.length > 0 ? ' en este filtro' : ' todavía'}.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {filteredData.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => openEditForm(item)}
                  className="text-left hover:text-brand-700"
                >
                  <p className="text-gray-800">{String(item[labelField] ?? '—')}</p>
                  <p className="text-xs text-gray-400">
                    {[
                      dateField ? formatDate(String(item[dateField])) : null,
                      ...selectFields.map((f) => {
                        const raw = item[f.name as keyof T]
                        return raw ? optionLookup[f.name]?.[String(raw)] : null
                      }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
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
