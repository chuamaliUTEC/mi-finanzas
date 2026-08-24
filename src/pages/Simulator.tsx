import { useMemo, useState } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { useCalculatorMemory } from '@/hooks/useCalculatorMemory'
import { totalOutstandingDebt } from '@/algorithms/debt'
import { projectDepartamento } from '@/algorithms/goals/departamento'
import { projectRetiro } from '@/algorithms/goals/retiro'
import type { Debt } from '@/types/database'
import { formatCurrency } from '@/utils/format'

const DEPARTAMENTO_DEFAULTS = {
  precioObjetivo: '', cuotaInicialPct: '20', gastosCompra: '', ahorroActual: '', ahorroMensual: '',
  mesesHastaObjetivo: '60', tasaRendimientoAnual: '5', tasaHipotecaAnual: '9', plazoHipotecaMeses: '240',
}
const RETIRO_DEFAULTS = {
  edadActual: '25', edadObjetivo: '60', capitalActual: '', aporteMensual: '', tasaRendimientoAnual: '6',
  inflacionAnual: '3', ingresoDeseadoMensualRetiro: '', aniosEsperadosDeRetiro: '25',
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}

function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-brand-700">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-brand-600"
      />
    </div>
  )
}

export default function Simulator() {
  const { data: debts } = useSupabaseTable<Debt>('debts')
  const { params: departamentoParams } = useCalculatorMemory('departamento_parametros', DEPARTAMENTO_DEFAULTS)
  const { params: retiroParams } = useCalculatorMemory('retiro_parametros', RETIRO_DEFAULTS)

  const [ahorroExtra, setAhorroExtra] = useState(0)
  const [aporteRetiroExtra, setAporteRetiroExtra] = useState(0)
  const [pagoDeudaExtra, setPagoDeudaExtra] = useState(0)
  const [mesesExtra, setMesesExtra] = useState(0)

  const baseDeuda = useMemo(() => totalOutstandingDebt(debts), [debts])
  const deudaSimulada = Math.max(baseDeuda - pagoDeudaExtra * 12, 0)

  const departamentoBase = useMemo(() => {
    if (!Number(departamentoParams.precioObjetivo)) return null
    return projectDepartamento({
      precioObjetivo: Number(departamentoParams.precioObjetivo) || 0,
      cuotaInicialPct: (Number(departamentoParams.cuotaInicialPct) || 0) / 100,
      gastosCompra: Number(departamentoParams.gastosCompra) || 0,
      ahorroActual: Number(departamentoParams.ahorroActual) || 0,
      ahorroMensual: Number(departamentoParams.ahorroMensual) || 0,
      mesesHastaObjetivo: Number(departamentoParams.mesesHastaObjetivo) || 1,
      tasaRendimientoAnual: (Number(departamentoParams.tasaRendimientoAnual) || 0) / 100,
      tasaHipotecaAnual: (Number(departamentoParams.tasaHipotecaAnual) || 0) / 100,
      plazoHipotecaMeses: Number(departamentoParams.plazoHipotecaMeses) || 1,
    })
  }, [departamentoParams])

  const departamentoSimulado = useMemo(() => {
    if (!Number(departamentoParams.precioObjetivo)) return null
    return projectDepartamento({
      precioObjetivo: Number(departamentoParams.precioObjetivo) || 0,
      cuotaInicialPct: (Number(departamentoParams.cuotaInicialPct) || 0) / 100,
      gastosCompra: Number(departamentoParams.gastosCompra) || 0,
      ahorroActual: Number(departamentoParams.ahorroActual) || 0,
      ahorroMensual: (Number(departamentoParams.ahorroMensual) || 0) + ahorroExtra,
      mesesHastaObjetivo: (Number(departamentoParams.mesesHastaObjetivo) || 1) + mesesExtra,
      tasaRendimientoAnual: (Number(departamentoParams.tasaRendimientoAnual) || 0) / 100,
      tasaHipotecaAnual: (Number(departamentoParams.tasaHipotecaAnual) || 0) / 100,
      plazoHipotecaMeses: Number(departamentoParams.plazoHipotecaMeses) || 1,
    })
  }, [departamentoParams, ahorroExtra, mesesExtra])

  const retiroBase = useMemo(
    () =>
      projectRetiro({
        edadActual: Number(retiroParams.edadActual) || 0,
        edadObjetivo: Number(retiroParams.edadObjetivo) || 0,
        capitalActual: Number(retiroParams.capitalActual) || 0,
        aporteMensual: Number(retiroParams.aporteMensual) || 0,
        tasaRendimientoAnual: (Number(retiroParams.tasaRendimientoAnual) || 0) / 100,
        inflacionAnual: (Number(retiroParams.inflacionAnual) || 0) / 100,
        ingresoDeseadoMensualRetiro:
          retiroParams.ingresoDeseadoMensualRetiro === '' ? null : Number(retiroParams.ingresoDeseadoMensualRetiro),
        aniosEsperadosDeRetiro: Number(retiroParams.aniosEsperadosDeRetiro) || 1,
      }),
    [retiroParams],
  )

  const retiroSimulado = useMemo(
    () =>
      projectRetiro({
        edadActual: Number(retiroParams.edadActual) || 0,
        edadObjetivo: Number(retiroParams.edadObjetivo) || 0,
        capitalActual: Number(retiroParams.capitalActual) || 0,
        aporteMensual: (Number(retiroParams.aporteMensual) || 0) + aporteRetiroExtra,
        tasaRendimientoAnual: (Number(retiroParams.tasaRendimientoAnual) || 0) / 100,
        inflacionAnual: (Number(retiroParams.inflacionAnual) || 0) / 100,
        ingresoDeseadoMensualRetiro:
          retiroParams.ingresoDeseadoMensualRetiro === '' ? null : Number(retiroParams.ingresoDeseadoMensualRetiro),
        aniosEsperadosDeRetiro: Number(retiroParams.aniosEsperadosDeRetiro) || 1,
      }),
    [retiroParams, aporteRetiroExtra],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🔮 ¿Qué pasaría si...?</h2>
        <p className="text-sm text-gray-500">
          Simulación en vivo. No cambia tus datos reales — solo explora escenarios sobre tus supuestos
          guardados en Departamento y Retiro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <Slider
          label="Ahorro mensual extra para departamento"
          value={ahorroExtra}
          min={0}
          max={2000}
          step={50}
          onChange={setAhorroExtra}
          format={formatCurrency}
        />
        <Slider
          label="Meses adicionales de plazo para departamento"
          value={mesesExtra}
          min={-24}
          max={24}
          step={1}
          onChange={setMesesExtra}
        />
        <Slider
          label="Aporte mensual extra para retiro"
          value={aporteRetiroExtra}
          min={0}
          max={1000}
          step={25}
          onChange={setAporteRetiroExtra}
          format={formatCurrency}
        />
        <Slider
          label="Pago extra anual a deuda"
          value={pagoDeudaExtra}
          min={0}
          max={500}
          step={10}
          onChange={setPagoDeudaExtra}
          format={(v) => formatCurrency(v * 12) + '/año'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Deuda total (saldo conocido)</p>
          <p className="text-sm text-gray-400 line-through">{formatCurrency(baseDeuda)}</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(deudaSimulada)}</p>
        </div>
        {departamentoBase && departamentoSimulado && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Capital proyectado — departamento</p>
            <p className="text-sm text-gray-400 line-through">{formatCurrency(departamentoBase.capitalProyectado)}</p>
            <p className="text-lg font-semibold text-brand-700">
              {formatCurrency(departamentoSimulado.capitalProyectado)}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Capital proyectado — retiro (real)</p>
          <p className="text-sm text-gray-400 line-through">{formatCurrency(retiroBase.capitalReal)}</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(retiroSimulado.capitalReal)}</p>
        </div>
      </div>

      {!departamentoBase && (
        <p className="text-xs text-gray-400">
          Configura un precio objetivo en la calculadora de Departamento para simular ese escenario.
        </p>
      )}
    </div>
  )
}
