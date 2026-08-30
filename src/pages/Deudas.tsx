import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTable } from '@/hooks/useTable'
import { computeAvailableMoney } from '@/algorithms/accounts/balance'
import {
  computeDebtBalance,
  debtAnnualRate,
  simulateDebtPlan,
  totalActiveDebt,
  type PayoffStrategy,
} from '@/algorithms/debt/debts'
import {
  cardAvailableCredit,
  cardUtilization,
  cardUtilizedBalance,
  paymentToReachUtilization,
} from '@/algorithms/debt/cards'
import { BigFigure } from '@/components/ui/BigFigure'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatPercent } from '@/utils/format'
import type { Debt } from '@/types/database'

const PRIORITY_LABEL: Record<Debt['priority'], string> = {
  muy_alta: '🔴 Muy alta',
  alta: '🟠 Alta',
  media: '🟡 Media',
  baja: '🟢 Baja',
}

const debtSchema = z.object({
  creditor: z.string().min(1, 'Indica el acreedor'),
  name: z.string().optional(),
  type: z.enum(['revolvente', 'cuotas', 'prestamo_personal', 'sin_intereses', 'otro']),
  initial_balance: z.coerce.number().min(0),
  rate_type: z.enum(['tea', 'tcea', 'sin_interes']),
  tea: z.coerce.number().min(0).optional(),
  tcea: z.coerce.number().min(0).optional(),
  minimum_payment: z.coerce.number().min(0).optional(),
  installment_amount: z.coerce.number().min(0).optional(),
  num_installments: z.coerce.number().int().min(0).optional(),
  installments_paid: z.coerce.number().int().min(0).optional(),
  insurance_monthly: z.coerce.number().min(0).optional(),
  due_day: z.coerce.number().int().min(1).max(31).optional(),
  target_payoff_date: z.string().optional(),
  priority: z.enum(['baja', 'media', 'alta', 'muy_alta']),
  status: z.enum(['activa', 'pagada', 'en_mora', 'congelada', 'no_activada']),
  allows_early_payoff: z.enum(['si', 'no', 'desconocido']),
  credit_card_id: z.string().optional(),
  notes: z.string().optional(),
})

const paymentSchema = z.object({
  date: z.string().min(1),
  amount: z.coerce.number().positive('Monto mayor a 0'),
  principal_amount: z.coerce.number().min(0),
  interest_amount: z.coerce.number().min(0),
  insurance_amount: z.coerce.number().min(0),
  fees_amount: z.coerce.number().min(0),
  penalty_amount: z.coerce.number().min(0),
  is_extra_payment: z.boolean(),
  account_id: z.string().optional(),
})

const cardSchema = z.object({
  name: z.string().min(1, 'Ponle un nombre'),
  issuer: z.string().optional(),
  credit_line: z.coerce.number().min(0),
  cash_line: z.coerce.number().min(0).optional(),
  tea_purchases: z.coerce.number().min(0).optional(),
  tea_cash: z.coerce.number().min(0).optional(),
  tea_usd: z.coerce.number().min(0).optional(),
  membership_fee: z.coerce.number().min(0).optional(),
  insurance_monthly: z.coerce.number().min(0).optional(),
  closing_day: z.coerce.number().int().min(1).max(31).optional(),
  payment_day: z.coerce.number().int().min(1).max(31).optional(),
  benefits: z.string().optional(),
})

function optNum(v: number | undefined): number | null {
  return v === undefined || Number.isNaN(v) ? null : v
}

export function Deudas() {
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments', { orderBy: 'date' })
  const cards = useTable('credit_cards')
  const accounts = useTable('accounts')
  const incomes = useTable('income_transactions')
  const expensesT = useTable('expenses')
  const transfers = useTable('transfers')

  const [editingDebt, setEditingDebt] = useState<Debt | 'new' | null>(null)
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null)
  const [showCardForm, setShowCardForm] = useState(false)
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalancha')
  const [monthlyBudget, setMonthlyBudget] = useState('900')

  const balanceData = useMemo(
    () => ({ incomes: incomes.rows, expenses: expensesT.rows, transfers: transfers.rows }),
    [incomes.rows, expensesT.rows, transfers.rows],
  )
  const availableMoney = computeAvailableMoney(accounts.rows, balanceData)
  const totalDebt = totalActiveDebt(debts.rows, debtPayments.rows)

  const plan = useMemo(() => {
    const budget = parseFloat(monthlyBudget)
    if (!(budget > 0)) return null
    return simulateDebtPlan(debts.rows, debtPayments.rows, strategy, budget)
  }, [debts.rows, debtPayments.rows, strategy, monthlyBudget])

  const debtForm = useForm<z.infer<typeof debtSchema>>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      type: 'otro', rate_type: 'tea', priority: 'media', status: 'activa',
      allows_early_payoff: 'desconocido',
    },
  })
  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      principal_amount: 0, interest_amount: 0, insurance_amount: 0,
      fees_amount: 0, penalty_amount: 0, is_extra_payment: false,
    },
  })
  const cardForm = useForm<z.infer<typeof cardSchema>>({ resolver: zodResolver(cardSchema) })

  function startEditDebt(debt: Debt | 'new') {
    setEditingDebt(debt)
    setPayingDebt(null)
    if (debt === 'new') {
      debtForm.reset({
        type: 'otro', rate_type: 'tea', priority: 'media', status: 'activa',
        allows_early_payoff: 'desconocido', initial_balance: 0,
      })
    } else {
      debtForm.reset({
        creditor: debt.creditor,
        name: debt.name ?? '',
        type: debt.type,
        initial_balance: debt.initial_balance,
        rate_type: debt.rate_type,
        tea: debt.tea ?? undefined,
        tcea: debt.tcea ?? undefined,
        minimum_payment: debt.minimum_payment ?? undefined,
        installment_amount: debt.installment_amount ?? undefined,
        num_installments: debt.num_installments ?? undefined,
        installments_paid: debt.installments_paid,
        insurance_monthly: debt.insurance_monthly,
        due_day: debt.due_day ?? undefined,
        target_payoff_date: debt.target_payoff_date ?? '',
        priority: debt.priority,
        status: debt.status,
        allows_early_payoff: debt.allows_early_payoff,
        credit_card_id: debt.credit_card_id ?? '',
        notes: debt.notes ?? '',
      })
    }
  }

  async function onSubmitDebt(values: z.infer<typeof debtSchema>) {
    const payload = {
      creditor: values.creditor,
      name: values.name || null,
      type: values.type,
      initial_balance: values.initial_balance,
      rate_type: values.rate_type,
      tea: optNum(values.tea),
      tcea: optNum(values.tcea),
      minimum_payment: optNum(values.minimum_payment),
      installment_amount: optNum(values.installment_amount),
      num_installments: optNum(values.num_installments),
      installments_paid: values.installments_paid ?? 0,
      insurance_monthly: values.insurance_monthly ?? 0,
      due_day: optNum(values.due_day),
      target_payoff_date: values.target_payoff_date || null,
      priority: values.priority,
      status: values.status,
      allows_early_payoff: values.allows_early_payoff,
      credit_card_id: values.credit_card_id || null,
      notes: values.notes || null,
    }
    if (editingDebt === 'new') await debts.insert(payload)
    else if (editingDebt) await debts.update(editingDebt.id, payload)
    setEditingDebt(null)
  }

  async function onSubmitPayment(values: z.infer<typeof paymentSchema>) {
    if (!payingDebt) return
    await debtPayments.insert({
      ...values,
      debt_id: payingDebt.id,
      account_id: values.account_id || null,
    })
    setPayingDebt(null)
    paymentForm.reset({
      date: new Date().toISOString().slice(0, 10),
      principal_amount: 0, interest_amount: 0, insurance_amount: 0,
      fees_amount: 0, penalty_amount: 0, is_extra_payment: false,
    })
  }

  async function onSubmitCard(values: z.infer<typeof cardSchema>) {
    await cards.insert({
      name: values.name,
      issuer: values.issuer || null,
      credit_line: values.credit_line,
      cash_line: values.cash_line ?? 0,
      tea_purchases: optNum(values.tea_purchases),
      tea_cash: optNum(values.tea_cash),
      tea_usd: optNum(values.tea_usd),
      membership_fee: values.membership_fee ?? 0,
      insurance_monthly: values.insurance_monthly ?? 0,
      closing_day: optNum(values.closing_day),
      payment_day: optNum(values.payment_day),
      benefits: values.benefits || null,
    })
    setShowCardForm(false)
    cardForm.reset()
  }

  const activeDebts = debts.rows.filter((d) => d.status !== 'pagada')
  const paymentAmount = paymentForm.watch('amount')

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Deudas y tarjetas"
        subtitle="¿Cuánto debo y qué ataco primero?"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowCardForm(true)}>
              + Tarjeta
            </button>
            <button className="btn-primary" onClick={() => startEditDebt('new')}>
              + Deuda
            </button>
          </div>
        }
      />

      <BigFigure
        label="💳 Total de deuda activa"
        amount={totalDebt}
        tone={totalDebt > 0 ? 'critical' : 'positive'}
        hint="No incluye deudas pagadas ni no activadas (como UTEC)."
      />

      {/* Deudas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Deudas</h2>
        {activeDebts.map((debt) => {
          const balance = computeDebtBalance(debt, debtPayments.rows)
          const rate = debtAnnualRate(debt)
          return (
            <div key={debt.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink-900">
                    {debt.name ?? debt.creditor}{' '}
                    <span className="ml-1 text-xs text-ink-400">{PRIORITY_LABEL[debt.priority]}</span>
                  </p>
                  <p className="text-sm text-ink-500">
                    {rate > 0
                      ? `${debt.rate_type === 'tcea' ? 'TCEA' : 'TEA'} ${rate.toFixed(2)} %`
                      : 'Sin intereses'}
                    {debt.minimum_payment ? ` · mínimo ${formatCurrency(debt.minimum_payment)}` : ''}
                    {debt.installment_amount ? ` · cuota ${formatCurrency(debt.installment_amount)}` : ''}
                    {debt.num_installments
                      ? ` (${debt.installments_paid}/${debt.num_installments} pagadas)`
                      : ''}
                    {debt.due_day ? ` · vence el ${debt.due_day}` : ''}
                    {debt.target_payoff_date ? ` · objetivo: ${debt.target_payoff_date}` : ''}
                  </p>
                  <p className="text-xs text-ink-400">
                    Pago anticipado con reducción de intereses:{' '}
                    {debt.allows_early_payoff === 'desconocido'
                      ? '❓ desconocido (preguntar al acreedor)'
                      : debt.allows_early_payoff === 'si'
                        ? '✅ sí'
                        : '❌ no'}
                    {debt.status !== 'activa' ? ` · estado: ${debt.status}` : ''}
                  </p>
                </div>
                <p className="text-xl font-semibold text-ink-900">{formatCurrency(balance)}</p>
              </div>
              <div className="flex gap-3 text-sm">
                <button className="text-lavender-700" onClick={() => setPayingDebt(debt)}>
                  Registrar pago
                </button>
                <button className="text-lavender-700" onClick={() => startEditDebt(debt)}>
                  Editar
                </button>
                <button className="text-critical" onClick={() => void debts.remove(debt.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
        {activeDebts.length === 0 && !debts.loading && (
          <p className="text-sm text-ink-500">Sin deudas registradas. 🎉</p>
        )}
      </section>

      {/* Registrar pago */}
      {payingDebt && (
        <form className="card space-y-4" onSubmit={paymentForm.handleSubmit(onSubmitPayment)} noValidate>
          <h2 className="font-medium text-ink-900">
            Pago a {payingDebt.name ?? payingDebt.creditor} (saldo:{' '}
            {formatCurrency(computeDebtBalance(payingDebt, debtPayments.rows))})
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Fecha</label>
              <input className="input" type="date" {...paymentForm.register('date')} />
            </div>
            <div>
              <label className="label">Monto total (S/)</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('amount')} />
            </div>
            <div>
              <label className="label">Cuenta de origen</label>
              <select className="input" {...paymentForm.register('account_id')}>
                <option value="">—</option>
                {accounts.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">A capital</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('principal_amount')} />
            </div>
            <div>
              <label className="label">Interés</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('interest_amount')} />
            </div>
            <div>
              <label className="label">Seguro</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('insurance_amount')} />
            </div>
            <div>
              <label className="label">Comisiones</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('fees_amount')} />
            </div>
            <div>
              <label className="label">Mora</label>
              <input className="input" type="number" step="0.01" {...paymentForm.register('penalty_amount')} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...paymentForm.register('is_extra_payment')} />
            Amortización voluntaria (pago extra al capital)
          </label>
          {paymentAmount > 0 && (
            <p className="text-xs text-ink-400">
              Si no conoces el desglose, pon todo el monto en “A capital” y ajústalo cuando llegue
              tu estado de cuenta.
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Guardar pago
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPayingDebt(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Formulario de deuda */}
      {editingDebt && (
        <form className="card space-y-4" onSubmit={debtForm.handleSubmit(onSubmitDebt)} noValidate>
          <h2 className="font-medium text-ink-900">
            {editingDebt === 'new' ? 'Nueva deuda' : `Editar ${editingDebt.creditor}`}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Acreedor</label>
              <input className="input" {...debtForm.register('creditor')} />
              {debtForm.formState.errors.creditor && (
                <p className="mt-1 text-xs text-critical">
                  {debtForm.formState.errors.creditor.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Nombre</label>
              <input className="input" {...debtForm.register('name')} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" {...debtForm.register('type')}>
                <option value="revolvente">Revolvente (tarjeta)</option>
                <option value="cuotas">Préstamo en cuotas</option>
                <option value="prestamo_personal">Préstamo personal</option>
                <option value="sin_intereses">Sin intereses</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">Saldo actual (S/)</label>
              <input className="input" type="number" step="0.01" {...debtForm.register('initial_balance')} />
            </div>
            <div>
              <label className="label">Tipo de tasa</label>
              <select className="input" {...debtForm.register('rate_type')}>
                <option value="tea">TEA</option>
                <option value="tcea">TCEA</option>
                <option value="sin_interes">Sin interés</option>
              </select>
            </div>
            <div>
              <label className="label">TEA %</label>
              <input className="input" type="number" step="0.0001" {...debtForm.register('tea')} />
            </div>
            <div>
              <label className="label">TCEA %</label>
              <input className="input" type="number" step="0.0001" {...debtForm.register('tcea')} />
            </div>
            <div>
              <label className="label">Pago mínimo</label>
              <input className="input" type="number" step="0.01" {...debtForm.register('minimum_payment')} />
            </div>
            <div>
              <label className="label">Cuota</label>
              <input className="input" type="number" step="0.01" {...debtForm.register('installment_amount')} />
            </div>
            <div>
              <label className="label">N° cuotas</label>
              <input className="input" type="number" {...debtForm.register('num_installments')} />
            </div>
            <div>
              <label className="label">Cuotas pagadas</label>
              <input className="input" type="number" {...debtForm.register('installments_paid')} />
            </div>
            <div>
              <label className="label">Seguro mensual</label>
              <input className="input" type="number" step="0.01" {...debtForm.register('insurance_monthly')} />
            </div>
            <div>
              <label className="label">Día de vencimiento</label>
              <input className="input" type="number" min={1} max={31} {...debtForm.register('due_day')} />
            </div>
            <div>
              <label className="label">Fecha objetivo de pago</label>
              <input className="input" type="date" {...debtForm.register('target_payoff_date')} />
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select className="input" {...debtForm.register('priority')}>
                <option value="muy_alta">Muy alta</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" {...debtForm.register('status')}>
                <option value="activa">Activa</option>
                <option value="pagada">Pagada</option>
                <option value="en_mora">En mora</option>
                <option value="congelada">Congelada</option>
                <option value="no_activada">No activada</option>
              </select>
            </div>
            <div>
              <label className="label">¿Permite pago anticipado?</label>
              <select className="input" {...debtForm.register('allows_early_payoff')}>
                <option value="desconocido">Desconocido</option>
                <option value="si">Sí, reduce intereses</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="label">Tarjeta vinculada</label>
              <select className="input" {...debtForm.register('credit_card_id')}>
                <option value="">Ninguna</option>
                {cards.rows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="label">Notas</label>
              <input className="input" {...debtForm.register('notes')} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingDebt(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tarjetas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Tarjetas</h2>
        <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink-700">
          💳 Crédito disponible ≠ 💵 dinero disponible. Tu dinero real es{' '}
          <strong>{formatCurrency(availableMoney)}</strong>; la línea libre de tus tarjetas es
          deuda potencial, no capacidad de gasto.
        </div>
        {cards.rows.map((card) => {
          const utilized = cardUtilizedBalance(card, debts.rows, debtPayments.rows)
          const available = cardAvailableCredit(card, debts.rows, debtPayments.rows)
          const utilization = cardUtilization(card, debts.rows, debtPayments.rows)
          const toThirty = paymentToReachUtilization(card, debts.rows, debtPayments.rows)
          const utilizationTone =
            utilization > 0.6 ? 'bg-critical' : utilization > 0.3 ? 'bg-warning' : 'bg-positive'
          return (
            <div key={card.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink-900">{card.name}</p>
                  <p className="text-sm text-ink-500">
                    Línea {formatCurrency(card.credit_line)}
                    {card.cash_line > 0 ? ` + ${formatCurrency(card.cash_line)} efectivo` : ''}
                    {card.tea_purchases ? ` · TEA ${card.tea_purchases.toFixed(2)} %` : ''}
                    {card.tea_usd ? ` · TEA USD ${card.tea_usd.toFixed(2)} %` : ''}
                  </p>
                  <p className="text-xs text-ink-400">
                    {card.closing_day ? `Cierre: ${card.closing_day}` : ''}
                    {card.payment_day ? ` · Pago: ${card.payment_day}` : ''}
                    {card.membership_fee > 0
                      ? ` · Membresía ${formatCurrency(card.membership_fee)}`
                      : ''}
                    {card.benefits ? ` · ${card.benefits}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-ink-900">{formatCurrency(utilized)}</p>
                  <p className="text-xs text-ink-500">usado · libre {formatCurrency(available)}</p>
                </div>
              </div>
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full ${utilizationTone}`}
                    style={{ width: `${Math.min(100, utilization * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Utilización {formatPercent(utilization)}
                  {utilization > 0.3 &&
                    ` · paga ${formatCurrency(toThirty)} para bajar a 30 %`}
                </p>
              </div>
            </div>
          )
        })}
        {cards.rows.length === 0 && !cards.loading && (
          <p className="text-sm text-ink-500">Sin tarjetas registradas.</p>
        )}
      </section>

      {/* Formulario de tarjeta */}
      {showCardForm && (
        <form className="card space-y-4" onSubmit={cardForm.handleSubmit(onSubmitCard)} noValidate>
          <h2 className="font-medium text-ink-900">Nueva tarjeta</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" {...cardForm.register('name')} />
            </div>
            <div>
              <label className="label">Emisor</label>
              <input className="input" {...cardForm.register('issuer')} />
            </div>
            <div>
              <label className="label">Línea total (S/)</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('credit_line')} />
            </div>
            <div>
              <label className="label">Línea efectivo (S/)</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('cash_line')} />
            </div>
            <div>
              <label className="label">TEA compras %</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('tea_purchases')} />
            </div>
            <div>
              <label className="label">TEA efectivo %</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('tea_cash')} />
            </div>
            <div>
              <label className="label">TEA USD %</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('tea_usd')} />
            </div>
            <div>
              <label className="label">Membresía anual</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('membership_fee')} />
            </div>
            <div>
              <label className="label">Seguro mensual</label>
              <input className="input" type="number" step="0.01" {...cardForm.register('insurance_monthly')} />
            </div>
            <div>
              <label className="label">Día de cierre</label>
              <input className="input" type="number" min={1} max={31} {...cardForm.register('closing_day')} />
            </div>
            <div>
              <label className="label">Día de pago</label>
              <input className="input" type="number" min={1} max={31} {...cardForm.register('payment_day')} />
            </div>
            <div>
              <label className="label">Beneficios</label>
              <input className="input" {...cardForm.register('benefits')} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Guardar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowCardForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Simulador */}
      <section className="card space-y-4">
        <h2 className="font-medium text-ink-900">Simulador: ¿cuándo quedo libre?</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Estrategia</label>
            <select
              className="input"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as PayoffStrategy)}
            >
              <option value="avalancha">Avalancha (mayor tasa primero)</option>
              <option value="bola_de_nieve">Bola de nieve (menor saldo primero)</option>
              <option value="personalizada">Prioridad personalizada</option>
            </select>
          </div>
          <div>
            <label className="label">Presupuesto mensual para deudas (S/)</label>
            <input
              className="input"
              type="number"
              step="10"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
            />
          </div>
        </div>
        {plan && plan.insufficientBudget && (
          <p className="text-sm text-critical">
            🔴 Con ese presupuesto la deuda no converge: los intereses crecen más rápido de lo que
            pagas. Sube el monto mensual.
          </p>
        )}
        {plan && !plan.insufficientBudget && plan.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="py-2 pr-4">Deuda</th>
                  <th className="py-2 pr-4">Saldo</th>
                  <th className="py-2 pr-4">Liquidada en</th>
                  <th className="py-2">Intereses proyectados</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => (
                  <tr key={item.debt.id} className="border-b border-ink-50">
                    <td className="py-2 pr-4">{item.debt.name ?? item.debt.creditor}</td>
                    <td className="py-2 pr-4">{formatCurrency(item.startingBalance)}</td>
                    <td className="py-2 pr-4">
                      {item.payoffMonth} {item.payoffMonth === 1 ? 'mes' : 'meses'}
                    </td>
                    <td className="py-2">{formatCurrency(item.interestPaid)}</td>
                  </tr>
                ))}
                <tr className="font-medium text-ink-900">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4">{formatCurrency(totalDebt)}</td>
                  <td className="py-2 pr-4">{plan.totalMonths} meses</td>
                  <td className="py-2">{formatCurrency(plan.totalInterest)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
