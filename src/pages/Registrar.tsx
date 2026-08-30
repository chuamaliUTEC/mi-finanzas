import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTable } from '@/hooks/useTable'
import { parseQuickExpense, type QuickAddParse } from '@/algorithms/quickadd/parse'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'
import type { PaymentMethod } from '@/types/database'

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'credito_cuotas', label: 'Crédito en cuotas' },
]

const expenseSchema = z.object({
  amount: z.coerce.number().positive('Monto mayor a 0'),
  date: z.string().min(1),
  category_id: z.string().min(1, 'Elige una categoría'),
  subcategory_id: z.string().optional(),
  account_id: z.string().optional(),
  payment_method: z.enum([
    'efectivo', 'yape', 'plin', 'transferencia', 'debito', 'credito', 'credito_cuotas',
  ]),
  merchant: z.string().optional(),
  description: z.string().optional(),
  necessity: z.enum(['necesario', 'deseo']),
  is_emotional: z.boolean(),
})

const incomeSchema = z.object({
  amount: z.coerce.number().positive('Monto mayor a 0'),
  date: z.string().min(1),
  source_id: z.string().optional(),
  account_id: z.string().optional(),
  status: z.enum(['realizado', 'esperado', 'estimado', 'pendiente', 'no_verificado']),
  description: z.string().optional(),
})

const transferSchema = z
  .object({
    amount: z.coerce.number().positive('Monto mayor a 0'),
    date: z.string().min(1),
    from_account_id: z.string().min(1, 'Elige la cuenta de origen'),
    to_account_id: z.string().min(1, 'Elige la cuenta de destino'),
    description: z.string().optional(),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    message: 'Origen y destino deben ser distintos',
    path: ['to_account_id'],
  })

type Tab = 'gasto' | 'ingreso' | 'transferencia'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function Registrar() {
  const [tab, setTab] = useState<Tab>('gasto')
  const [quickText, setQuickText] = useState('')
  const [quickParse, setQuickParse] = useState<QuickAddParse | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const accounts = useTable('accounts')
  const categories = useTable('expense_categories', { orderBy: 'sort_order', ascending: true })
  const subcategories = useTable('expense_subcategories', { softDelete: false })
  const sources = useTable('income_sources')
  const expenses = useTable('expenses')
  const incomes = useTable('income_transactions')
  const transfers = useTable('transfers')

  const expenseForm = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: today(), payment_method: 'efectivo', necessity: 'necesario', is_emotional: false,
    },
  })
  const incomeForm = useForm<z.infer<typeof incomeSchema>>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { date: today(), status: 'realizado' },
  })
  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: today() },
  })

  const selectedCategoryId = expenseForm.watch('category_id')
  const subsForCategory = useMemo(
    () => subcategories.rows.filter((s) => s.category_id === selectedCategoryId),
    [subcategories.rows, selectedCategoryId],
  )

  function flashSaved(message: string) {
    setSaved(message)
    setTimeout(() => setSaved(null), 4000)
  }

  function handleQuickParse() {
    const parsed = parseQuickExpense(quickText, categories.rows, subcategories.rows)
    setQuickParse(parsed)
  }

  async function confirmQuick() {
    if (!quickParse) return
    const { error } = await expenses.insert({
      amount: quickParse.amount,
      date: today(),
      category_id: quickParse.categoryId,
      subcategory_id: quickParse.subcategoryId,
      description: quickParse.description,
      payment_method: 'efectivo',
    })
    if (!error) {
      flashSaved(`Gasto de ${formatCurrency(quickParse.amount)} registrado.`)
      setQuickText('')
      setQuickParse(null)
    }
  }

  async function onSubmitExpense(values: z.infer<typeof expenseSchema>) {
    const { error } = await expenses.insert({
      ...values,
      subcategory_id: values.subcategory_id || null,
      account_id: values.account_id || null,
      merchant: values.merchant || null,
      description: values.description || null,
    })
    if (!error) {
      flashSaved(`Gasto de ${formatCurrency(values.amount)} registrado.`)
      expenseForm.reset({
        date: today(), payment_method: 'efectivo', necessity: 'necesario', is_emotional: false,
      })
    }
  }

  async function onSubmitIncome(values: z.infer<typeof incomeSchema>) {
    const { error } = await incomes.insert({
      ...values,
      source_id: values.source_id || null,
      account_id: values.account_id || null,
      description: values.description || null,
    })
    if (!error) {
      flashSaved(
        values.status === 'realizado'
          ? `Ingreso de ${formatCurrency(values.amount)} registrado.`
          : `Ingreso ${values.status} registrado (no cuenta aún como dinero disponible).`,
      )
      incomeForm.reset({ date: today(), status: 'realizado' })
    }
  }

  async function onSubmitTransfer(values: z.infer<typeof transferSchema>) {
    const { error } = await transfers.insert({
      ...values,
      description: values.description || null,
    })
    if (!error) {
      flashSaved(`Transferencia de ${formatCurrency(values.amount)} registrada.`)
      transferForm.reset({ date: today() })
    }
  }

  const inputError = (msg?: string) =>
    msg ? <p className="mt-1 text-xs text-critical">{msg}</p> : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Registrar" subtitle="Un movimiento a la vez, en segundos." />

      {saved && (
        <div className="rounded-xl bg-positive/10 px-4 py-3 text-sm text-positive">{saved}</div>
      )}

      <div className="card space-y-3">
        <label className="label" htmlFor="quick">
          ⚡ Registro rápido
        </label>
        <div className="flex gap-2">
          <input
            id="quick"
            className="input"
            placeholder='Ej.: "Gasté 25 en almuerzo" o "Uber 18"'
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickParse()}
          />
          <button className="btn-secondary shrink-0" onClick={handleQuickParse}>
            Interpretar
          </button>
        </div>
        {quickParse && (
          <div className="rounded-xl border border-lavender-200 bg-lavender-50 p-4 text-sm">
            <p className="font-medium text-ink-900">
              {formatCurrency(quickParse.amount)} ·{' '}
              {quickParse.categoryName ?? 'Sin categoría detectada'}
              {quickParse.subcategoryName ? ` → ${quickParse.subcategoryName}` : ''} · hoy
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={() => void confirmQuick()}>
                Confirmar
              </button>
              <button className="btn-secondary" onClick={() => setQuickParse(null)}>
                Descartar
              </button>
            </div>
          </div>
        )}
        {quickParse === null && quickText && (
          <p className="text-xs text-ink-400">
            Escribe un monto y una palabra clave de tus categorías, luego presiona Interpretar.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {(['gasto', 'ingreso', 'transferencia'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'rounded-xl bg-lavender-600 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink-600 border border-ink-200'
            }
          >
            {t === 'gasto' ? 'Gasto' : t === 'ingreso' ? 'Ingreso' : 'Transferencia'}
          </button>
        ))}
      </div>

      {tab === 'gasto' && (
        <form className="card space-y-4" onSubmit={expenseForm.handleSubmit(onSubmitExpense)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Monto (S/)</label>
              <input className="input" type="number" step="0.01" {...expenseForm.register('amount')} />
              {inputError(expenseForm.formState.errors.amount?.message)}
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" {...expenseForm.register('date')} />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select className="input" {...expenseForm.register('category_id')}>
                <option value="">Elige…</option>
                {categories.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              {inputError(expenseForm.formState.errors.category_id?.message)}
            </div>
            <div>
              <label className="label">Subcategoría</label>
              <select className="input" {...expenseForm.register('subcategory_id')}>
                <option value="">—</option>
                {subsForCategory.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cuenta</label>
              <select className="input" {...expenseForm.register('account_id')}>
                <option value="">—</option>
                {accounts.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="input" {...expenseForm.register('payment_method')}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Persona / comercio</label>
              <input className="input" {...expenseForm.register('merchant')} />
            </div>
            <div>
              <label className="label">Descripción</label>
              <input className="input" {...expenseForm.register('description')} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-ink-700">
            <label className="flex items-center gap-2">
              <input type="radio" value="necesario" {...expenseForm.register('necessity')} />
              Necesario
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="deseo" {...expenseForm.register('necessity')} />
              Deseo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...expenseForm.register('is_emotional')} />
              Gasto emocional
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={expenseForm.formState.isSubmitting}>
            Registrar gasto
          </button>
        </form>
      )}

      {tab === 'ingreso' && (
        <form className="card space-y-4" onSubmit={incomeForm.handleSubmit(onSubmitIncome)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Monto (S/)</label>
              <input className="input" type="number" step="0.01" {...incomeForm.register('amount')} />
              {inputError(incomeForm.formState.errors.amount?.message)}
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" {...incomeForm.register('date')} />
            </div>
            <div>
              <label className="label">Fuente</label>
              <select className="input" {...incomeForm.register('source_id')}>
                <option value="">—</option>
                {sources.rows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cuenta destino</label>
              <select className="input" {...incomeForm.register('account_id')}>
                <option value="">—</option>
                {accounts.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" {...incomeForm.register('status')}>
                <option value="realizado">Realizado (ya lo tengo)</option>
                <option value="esperado">Esperado</option>
                <option value="estimado">Estimado</option>
                <option value="pendiente">Pendiente de cobro</option>
                <option value="no_verificado">No verificado</option>
              </select>
              <p className="mt-1 text-xs text-ink-400">
                Solo lo realizado cuenta como dinero disponible.
              </p>
            </div>
            <div>
              <label className="label">Descripción</label>
              <input className="input" {...incomeForm.register('description')} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={incomeForm.formState.isSubmitting}>
            Registrar ingreso
          </button>
        </form>
      )}

      {tab === 'transferencia' && (
        <form className="card space-y-4" onSubmit={transferForm.handleSubmit(onSubmitTransfer)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Monto (S/)</label>
              <input className="input" type="number" step="0.01" {...transferForm.register('amount')} />
              {inputError(transferForm.formState.errors.amount?.message)}
            </div>
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" {...transferForm.register('date')} />
            </div>
            <div>
              <label className="label">De</label>
              <select className="input" {...transferForm.register('from_account_id')}>
                <option value="">Elige…</option>
                {accounts.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {inputError(transferForm.formState.errors.from_account_id?.message)}
            </div>
            <div>
              <label className="label">Hacia</label>
              <select className="input" {...transferForm.register('to_account_id')}>
                <option value="">Elige…</option>
                {accounts.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {inputError(transferForm.formState.errors.to_account_id?.message)}
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descripción</label>
              <input className="input" {...transferForm.register('description')} />
            </div>
          </div>
          <p className="text-xs text-ink-400">
            Una transferencia mueve dinero entre tus cuentas: no es ingreso ni gasto.
          </p>
          <button type="submit" className="btn-primary" disabled={transferForm.formState.isSubmitting}>
            Registrar transferencia
          </button>
        </form>
      )}
    </div>
  )
}
