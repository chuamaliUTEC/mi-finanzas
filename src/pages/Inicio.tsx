import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import { monthlyExpectedIncome } from '@/algorithms/spendable/spendable'
import { SEVERITY_ICON } from '@/algorithms/rules/engine'
import { isInMonth } from '@/algorithms/budget/budget'
import { useAuth } from '@/hooks/authContext'
import { formatCurrency, formatDate } from '@/utils/format'

// Dashboard minimalista (secc. 13-14): una cifra protagonista ("puedes
// gastar"), lo urgente si lo hay, y la pregunta que guía a cada sección.

const QUESTIONS = [
  { to: '/deudas', icon: '💳', label: '¿Cuánto debo?' },
  { to: '/calendario', icon: '📅', label: '¿Qué tengo que pagar?' },
  { to: '/presupuesto', icon: '📉', label: '¿Estoy gastando demasiado?' },
  { to: '/metas', icon: '🎯', label: '¿Cómo voy con mis metas?' },
  { to: '/decisiones', icon: '🧠', label: '¿Qué debería hacer hoy?' },
]

export function Inicio() {
  const { profile } = useAuth()
  const overview = useFinancialOverview()
  const [showBreakdown, setShowBreakdown] = useState(false)

  const { spendable, tables, year, month } = overview

  const expectedIncomeMonth = tables.sources.rows.reduce(
    (sum, s) => sum + monthlyExpectedIncome(s),
    0,
  )
  const realIncomeMonth = tables.incomes.rows
    .filter(
      (i) => i.deleted_at === null && i.status === 'realizado' && isInMonth(i.date, year, month),
    )
    .reduce((sum, i) => sum + i.amount, 0)

  const totalPlanned = overview.monthBudgetCategories.reduce((s, bc) => s + bc.planned_amount, 0)
  const totalSpentMonth = overview.monthExpenses
    .filter((e) => e.deleted_at === null && e.status === 'confirmado')
    .reduce((s, e) => s + e.amount, 0)

  const topAlert = overview.alerts[0]
  const greeting = profile?.full_name ? `Hola, ${profile.full_name}` : 'Hola'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{greeting}</h1>
        <p className="text-sm text-ink-500">Esto es lo que importa hoy.</p>
      </div>

      {/* 1. LA cifra */}
      <div className="card border-lavender-200 bg-gradient-to-br from-white to-lavender-50">
        <p className="text-sm font-medium text-ink-500">💵 Puedes gastar hoy</p>
        <p
          className={`mt-1 text-5xl font-semibold tracking-tight ${
            spendable.today < 0 ? 'text-critical' : 'text-ink-900'
          }`}
        >
          {overview.loading ? '…' : formatCurrency(spendable.today)}
        </p>
        <p className="mt-2 text-sm text-ink-500">
          Esta semana: <strong>{formatCurrency(spendable.week)}</strong> · este mes:{' '}
          <strong>{formatCurrency(spendable.month)}</strong>
        </p>
        {overview.missingBalanceAccounts.length > 0 && (
          <p className="mt-2 text-sm text-warning">
            ⚠️ Falta el saldo de{' '}
            {overview.missingBalanceAccounts.map((a) => a.name).join(', ')}.{' '}
            <Link to="/cuentas" className="font-medium underline">
              Regístralo
            </Link>{' '}
            para que esta cifra sea real.
          </p>
        )}
        {spendable.month < 0 && overview.missingBalanceAccounts.length === 0 && (
          <p className="mt-2 text-sm text-critical">
            🔴 Tus obligaciones del mes superan tu dinero disponible.
          </p>
        )}
        <button
          className="mt-3 text-sm font-medium text-lavender-700"
          onClick={() => setShowBreakdown(!showBreakdown)}
        >
          {showBreakdown ? 'Ocultar cálculo' : '¿Cómo se calculó?'}
        </button>
        {showBreakdown && (
          <dl className="mt-3 space-y-1 border-t border-lavender-100 pt-3 text-sm text-ink-600">
            <div className="flex justify-between">
              <dt>Dinero disponible real</dt>
              <dd>{formatCurrency(spendable.breakdown.availableMoney)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Obligaciones de deuda del mes</dt>
              <dd>−{formatCurrency(spendable.breakdown.debtObligations)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Gastos recurrentes pendientes</dt>
              <dd>−{formatCurrency(spendable.breakdown.recurringPending)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Presupuesto protegido restante</dt>
              <dd>−{formatCurrency(spendable.breakdown.protectedBudgetRemaining)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Ahorro comprometido</dt>
              <dd>−{formatCurrency(spendable.breakdown.committedSavings)}</dd>
            </div>
            <div className="flex justify-between font-medium text-ink-900">
              <dt>= Realmente gastable este mes</dt>
              <dd>{formatCurrency(spendable.month)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Lo más urgente, si lo hay */}
      {topAlert && (
        <Link
          to="/decisiones"
          className="card block border-l-4 border-l-lavender-400 transition-shadow hover:shadow-md"
        >
          <p className="text-sm font-medium text-ink-900">
            {SEVERITY_ICON[topAlert.severity]} {topAlert.title}
          </p>
          <p className="mt-1 text-sm text-ink-600">{topAlert.message}</p>
          <p className="mt-2 text-sm font-medium text-lavender-700">
            Ver qué hacer
            {overview.alerts.length > 1 ? ` (+${overview.alerts.length - 1} más)` : ''} →
          </p>
        </Link>
      )}

      {/* Cifras secundarias, una por tarjeta, sin gráficos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/deudas" className="card block transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-ink-500">💳 Deudas</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(overview.totalDebt)}
          </p>
          <p className="mt-1 text-xs text-ink-400">Total pendiente activo</p>
        </Link>
        <div className="card">
          <p className="text-sm font-medium text-ink-500">💰 Ingresos del mes</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(realIncomeMonth)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            de ~{formatCurrency(expectedIncomeMonth)} esperados
          </p>
        </div>
        <Link to="/presupuesto" className="card block transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-ink-500">📊 Gastos del mes</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(totalSpentMonth)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {totalPlanned > 0
              ? `de ${formatCurrency(totalPlanned)} presupuestados`
              : 'sin presupuesto este mes'}
          </p>
        </Link>
        <Link to="/calendario" className="card block transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-ink-500">📅 Próximos pagos</p>
          {overview.upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">Nada en los próximos 31 días.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {overview.upcoming.slice(0, 4).map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-ink-700">
                    {formatDate(p.date)} · {p.label}
                  </span>
                  {p.amount > 0 && (
                    <span className="shrink-0 font-medium text-ink-900">
                      {formatCurrency(p.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Link>
      </div>

      {/* ¿Qué necesitas saber? */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink-500">¿Qué necesitas saber?</p>
        <div className="flex flex-wrap gap-2">
          {QUESTIONS.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-700 transition-colors hover:border-lavender-300 hover:bg-lavender-50"
            >
              {q.icon} {q.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
