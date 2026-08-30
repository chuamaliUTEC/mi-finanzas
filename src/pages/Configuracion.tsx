import { useMemo, useState } from 'react'
import { useTable } from '@/hooks/useTable'
import { useAuth } from '@/hooks/authContext'
import {
  buildCandidates,
  parseCsv,
  suggestMapping,
  type ColumnMapping,
  type ImportCandidate,
} from '@/algorithms/import/csv'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDate } from '@/utils/format'

// Configuración: perfil, categorías e importación de movimientos (secc. 26).

type Step = 'archivo' | 'mapeo' | 'revision' | 'listo'

export function Configuracion() {
  const { profile, refreshProfile } = useAuth()
  const expenses = useTable('expenses')
  const categories = useTable('expense_categories', { orderBy: 'sort_order', ascending: true })
  const accounts = useTable('accounts')
  const auditLogs = useTable('audit_logs', { softDelete: false })

  const [step, setStep] = useState<Step>('archivo')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: null, amount: null, description: null, category: null, account: null,
  })
  const [targetAccount, setTargetAccount] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [newCategory, setNewCategory] = useState('')

  const existing = useMemo(
    () =>
      expenses.rows.map((e) => ({
        date: e.date,
        amount: e.amount,
        description: e.description,
        merchant: e.merchant,
      })),
    [expenses.rows],
  )

  const result = useMemo(
    () => (rows.length > 0 ? buildCandidates(rows, mapping, existing) : null),
    [rows, mapping, existing],
  )

  async function handleFile(file: File) {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.rows.length === 0) return
    setFileName(file.name)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
    const suggested = suggestMapping(parsed.headers)
    setMapping(suggested)
    setStep('mapeo')
  }

  function goToReview() {
    if (!result) return
    // Por defecto se importa todo lo válido menos los duplicados.
    const preselected = new Set<number>()
    result.candidates.forEach((c, i) => {
      if (!c.isDuplicate) preselected.add(i)
    })
    setSelected(preselected)
    setStep('revision')
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function runImport() {
    if (!result) return
    setImporting(true)
    let count = 0
    for (const [index, candidate] of result.candidates.entries()) {
      if (!selected.has(index)) continue
      const matchedCategory = candidate.category
        ? categories.rows.find(
            (c) => c.name.toLowerCase() === candidate.category!.trim().toLowerCase(),
          )
        : undefined
      const { error } = await expenses.insert({
        amount: Math.abs(candidate.amount),
        date: candidate.date,
        description: candidate.description || null,
        category_id: matchedCategory?.id ?? null,
        account_id: targetAccount || null,
        payment_method: 'transferencia',
      })
      if (!error) count++
    }
    setImported(count)
    setImporting(false)
    setStep('listo')
  }

  function reset() {
    setStep('archivo')
    setFileName('')
    setHeaders([])
    setRows([])
    setSelected(new Set())
    setImported(0)
  }

  async function addCategory() {
    if (!newCategory.trim()) return
    await categories.insert({ name: newCategory.trim(), sort_order: 99 })
    setNewCategory('')
  }

  const mappingFields: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
    { key: 'date', label: 'Fecha', required: true },
    { key: 'amount', label: 'Monto', required: true },
    { key: 'description', label: 'Descripción' },
    { key: 'category', label: 'Categoría' },
    { key: 'account', label: 'Cuenta' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Configuración" subtitle="Tu perfil, tus categorías y tus datos." />

      {/* Perfil */}
      <section className="card space-y-3">
        <h2 className="font-medium text-ink-900">Perfil</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">Nombre</dt>
            <dd className="text-ink-900">{profile?.full_name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Moneda base</dt>
            <dd className="text-ink-900">{profile?.base_currency ?? 'PEN'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Empleador</dt>
            <dd className="text-ink-900">{profile?.employer ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Prioridad financiera</dt>
            <dd className="text-ink-900">{profile?.financial_priority ?? '—'}</dd>
          </div>
        </dl>
        <button className="btn-secondary" onClick={() => void refreshProfile()}>
          Actualizar
        </button>
      </section>

      {/* Importación */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-medium text-ink-900">Importar movimientos</h2>
          <p className="mt-1 text-sm text-ink-500">
            Sube el CSV de tu banco o una exportación de Excel guardada como CSV. Nada se registra
            hasta que revises y confirmes.
          </p>
        </div>

        {step === 'archivo' && (
          <div>
            <label className="label" htmlFor="csv">
              Archivo CSV
            </label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv,text/plain"
              className="input"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
          </div>
        )}

        {step === 'mapeo' && result && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              <strong>{fileName}</strong>: {rows.length} filas detectadas. Confirma a qué
              corresponde cada columna.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {mappingFields.map((field) => (
                <div key={field.key}>
                  <label className="label">
                    {field.label}
                    {field.required && <span className="text-critical"> *</span>}
                  </label>
                  <select
                    className="input"
                    value={mapping[field.key] ?? ''}
                    onChange={(e) =>
                      setMapping({ ...mapping, [field.key]: e.target.value || null })
                    }
                  >
                    <option value="">— sin usar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className="label">Importar a la cuenta</label>
                <select
                  className="input"
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                >
                  <option value="">— sin cuenta —</option>
                  {accounts.rows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {result.errors.length > 0 && (
              <p className="text-sm text-warning">
                ⚠️ {result.errors.length} filas no se pudieron interpretar con este mapeo (
                {result.errors[0].reason}).
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn-primary"
                onClick={goToReview}
                disabled={!mapping.date || !mapping.amount || result.candidates.length === 0}
              >
                Continuar ({result.candidates.length} válidas)
              </button>
              <button className="btn-secondary" onClick={reset}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 'revision' && result && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              {selected.size} de {result.candidates.length} movimientos seleccionados.
              {result.duplicateCount > 0 && (
                <span className="text-warning">
                  {' '}
                  Se detectaron {result.duplicateCount} posibles duplicados y quedaron
                  desmarcados.
                </span>
              )}
            </p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-ink-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="p-2"> </th>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {result.candidates.map((candidate: ImportCandidate, i) => (
                    <tr
                      key={i}
                      className={`border-t border-ink-50 ${
                        candidate.isDuplicate ? 'bg-warning/5' : ''
                      }`}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggle(i)}
                        />
                      </td>
                      <td className="p-2 text-ink-700">{formatDate(candidate.date)}</td>
                      <td className="p-2 text-ink-700">
                        {candidate.description || '—'}
                        {candidate.isDuplicate && (
                          <span className="ml-2 text-xs text-warning">posible duplicado</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-medium text-ink-900">
                        {formatCurrency(Math.abs(candidate.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => void runImport()} disabled={importing}>
                {importing ? 'Importando…' : `Importar ${selected.size} movimientos`}
              </button>
              <button className="btn-secondary" onClick={() => setStep('mapeo')}>
                Atrás
              </button>
            </div>
          </div>
        )}

        {step === 'listo' && (
          <div className="space-y-3">
            <p className="text-sm text-positive">
              ✅ Se importaron {imported} movimientos. Tus cifras ya están actualizadas.
            </p>
            <button className="btn-secondary" onClick={reset}>
              Importar otro archivo
            </button>
          </div>
        )}
      </section>

      {/* Categorías */}
      <section className="card space-y-3">
        <h2 className="font-medium text-ink-900">Categorías</h2>
        <div className="flex flex-wrap gap-2">
          {categories.rows.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-1.5 text-sm text-ink-700"
            >
              {c.icon} {c.name}
              <button
                className="text-ink-300 hover:text-critical"
                onClick={() => void categories.remove(c.id)}
                aria-label={`Eliminar ${c.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Nueva categoría</label>
            <input
              className="input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addCategory()}
            />
          </div>
          <button className="btn-primary" onClick={() => void addCategory()}>
            Agregar
          </button>
        </div>
      </section>

      {/* Auditoría */}
      <section className="card space-y-3">
        <h2 className="font-medium text-ink-900">Actividad reciente</h2>
        <p className="text-sm text-ink-500">
          Registro de cambios importantes sobre tus datos financieros.
        </p>
        <ul className="space-y-1 text-sm text-ink-600">
          {auditLogs.rows.slice(0, 15).map((log) => (
            <li key={log.id} className="flex justify-between gap-3">
              <span>
                {log.action === 'create'
                  ? 'Creaste'
                  : log.action === 'update'
                    ? 'Modificaste'
                    : 'Eliminaste'}{' '}
                {log.entity_type.replace(/_/g, ' ')}
              </span>
              <span className="shrink-0 text-ink-400">{formatDate(log.created_at)}</span>
            </li>
          ))}
          {auditLogs.rows.length === 0 && <li className="text-ink-400">Sin actividad todavía.</li>}
        </ul>
      </section>
    </div>
  )
}
