import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTable } from '@/hooks/useTable'
import {
  accountsMissingBalance,
  computeAccountBalanceOrNull,
  computeAvailableMoney,
} from '@/algorithms/accounts/balance'
import { BigFigure } from '@/components/ui/BigFigure'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'
import type { Account, AccountType } from '@/types/database'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'sueldo', label: 'Cuenta sueldo' },
  { value: 'bancaria', label: 'Cuenta bancaria' },
  { value: 'ahorro', label: 'Cuenta de ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'inversion', label: 'Inversión' },
]

const schema = z.object({
  name: z.string().min(1, 'Ponle un nombre'),
  type: z.enum(['bancaria', 'ahorro', 'sueldo', 'efectivo', 'yape', 'plin', 'inversion']),
  institution: z.string().optional(),
  // Vacío = saldo desconocido. No es lo mismo que cero.
  initial_balance: z.union([z.coerce.number(), z.literal('')]),
  is_verified: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function Cuentas() {
  const accounts = useTable('accounts')
  const incomes = useTable('income_transactions')
  const expenses = useTable('expenses')
  const transfers = useTable('transfers')
  const [editing, setEditing] = useState<Account | 'new' | null>(null)

  const balanceData = useMemo(
    () => ({ incomes: incomes.rows, expenses: expenses.rows, transfers: transfers.rows }),
    [incomes.rows, expenses.rows, transfers.rows],
  )

  const available = computeAvailableMoney(accounts.rows, balanceData)
  const missingBalance = accountsMissingBalance(accounts.rows)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'bancaria', initial_balance: 0, is_verified: true },
  })

  function startEdit(account: Account | 'new') {
    setEditing(account)
    if (account === 'new') {
      form.reset({ name: '', type: 'bancaria', institution: '', initial_balance: 0, is_verified: true })
    } else {
      form.reset({
        name: account.name,
        type: account.type,
        institution: account.institution ?? '',
        initial_balance: account.initial_balance ?? '',
        is_verified: account.is_verified,
      })
    }
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      institution: values.institution || null,
      // Cadena vacía => el saldo queda como desconocido, no como cero.
      initial_balance: values.initial_balance === '' ? null : values.initial_balance,
    }
    if (editing === 'new') await accounts.insert(payload)
    else if (editing) await accounts.update(editing.id, payload)
    setEditing(null)
  }

  const loading = accounts.loading || incomes.loading || expenses.loading || transfers.loading

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Cuentas"
        subtitle="¿Cuánto dinero tengo realmente?"
        action={
          <button className="btn-primary" onClick={() => startEdit('new')}>
            Agregar cuenta
          </button>
        }
      />

      <BigFigure
        label="💵 Dinero disponible real"
        amount={available}
        hint="Solo cuentas verificadas con saldo registrado. Los activos no verificados y el crédito no cuentan aquí."
      />

      {missingBalance.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink-700">
          Falta el saldo de {missingBalance.map((a) => a.name).join(', ')}. Mientras no lo
          registres, ese dinero no entra en el cálculo — y “Puedes gastar” se queda corto.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-400">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {accounts.rows.map((account) => {
            const balance = computeAccountBalanceOrNull(account, balanceData)
            return (
              <div key={account.id} className="card flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-ink-900">
                    {account.name}
                    {!account.is_verified && (
                      <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                        ⚠️ No verificado
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-500">
                    {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
                    {account.institution ? ` · ${account.institution}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {balance === null ? (
                    <p className="text-sm text-ink-400">Saldo pendiente de actualizar</p>
                  ) : (
                    <p className="text-lg font-semibold text-ink-900">
                      {formatCurrency(balance, account.currency)}
                    </p>
                  )}
                  <button className="text-sm text-lavender-700" onClick={() => startEdit(account)}>
                    Editar
                  </button>
                  <button
                    className="text-sm text-critical"
                    onClick={() => void accounts.remove(account.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
          {accounts.rows.length === 0 && (
            <p className="text-sm text-ink-500">
              Aún no tienes cuentas. Agrega dónde vive tu dinero (banco, efectivo, Yape…).
            </p>
          )}
        </div>
      )}

      {editing && (
        <form className="card space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <h2 className="font-medium text-ink-900">
            {editing === 'new' ? 'Nueva cuenta' : `Editar ${editing.name}`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nombre</label>
              <input className="input" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-critical">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" {...form.register('type')}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Institución (opcional)</label>
              <input className="input" {...form.register('institution')} />
            </div>
            <div>
              <label className="label">Saldo actual (S/)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Déjalo vacío si aún no lo sabes"
                {...form.register('initial_balance')}
              />
              <p className="mt-1 text-xs text-ink-400">
                Vacío = “no lo sé todavía”. Escribe 0 solo si de verdad tienes cero.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...form.register('is_verified')} />
            Dinero verificado (desmarca si es un monto declarado que aún no comprobaste)
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
