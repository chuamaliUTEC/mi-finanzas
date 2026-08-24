import { annualToMonthlyRate, futureValue, loanMonthlyPayment, monthsToReach } from './finance'

export interface DepartamentoInputs {
  precioObjetivo: number
  cuotaInicialPct: number // e.g. 0.2 for 20%
  gastosCompra: number
  ahorroActual: number
  ahorroMensual: number
  mesesHastaObjetivo: number
  tasaRendimientoAnual: number // expected return on savings, e.g. 0.05
  tasaHipotecaAnual: number // assumption for mortgage scenario, e.g. 0.09
  plazoHipotecaMeses: number // e.g. 240 (20 years)
}

export interface DepartamentoScenario {
  nombre: string
  factible: boolean
  detalle: string
  cuotaMensualEstimada?: number
}

export interface DepartamentoProjection {
  cuotaInicialObjetivo: number
  capitalProyectado: number
  scenarios: DepartamentoScenario[]
}

export function projectDepartamento(inputs: DepartamentoInputs): DepartamentoProjection {
  const monthlyRate = annualToMonthlyRate(inputs.tasaRendimientoAnual)
  const capitalProyectado = futureValue(
    inputs.ahorroActual,
    inputs.ahorroMensual,
    monthlyRate,
    inputs.mesesHastaObjetivo,
  )
  const cuotaInicialObjetivo = inputs.precioObjetivo * inputs.cuotaInicialPct + inputs.gastosCompra

  const scenarios: DepartamentoScenario[] = []

  // Comprar al contado
  const totalContado = inputs.precioObjetivo + inputs.gastosCompra
  scenarios.push({
    nombre: 'Comprar al contado',
    factible: capitalProyectado >= totalContado,
    detalle:
      capitalProyectado >= totalContado
        ? 'Tu capital proyectado cubre el precio total más gastos de compra.'
        : `Te faltarían ${(totalContado - capitalProyectado).toFixed(2)} para comprar al contado en la fecha objetivo.`,
  })

  // Comprar con hipoteca (cuota inicial + financiar el resto)
  const montoHipoteca = inputs.precioObjetivo * (1 - inputs.cuotaInicialPct)
  const cuotaMensualHipoteca = loanMonthlyPayment(montoHipoteca, inputs.tasaHipotecaAnual, inputs.plazoHipotecaMeses)
  scenarios.push({
    nombre: 'Comprar con hipoteca',
    factible: capitalProyectado >= cuotaInicialObjetivo,
    detalle:
      capitalProyectado >= cuotaInicialObjetivo
        ? `Tu capital cubre la cuota inicial (${inputs.cuotaInicialPct * 100}%) más gastos. Cuota mensual estimada del préstamo.`
        : `Te faltarían ${(cuotaInicialObjetivo - capitalProyectado).toFixed(2)} para la cuota inicial.`,
    cuotaMensualEstimada: cuotaMensualHipoteca,
  })

  // Aumentar cuota inicial: cuánto ahorro mensual extra se necesitaría
  const faltante = Math.max(cuotaInicialObjetivo - capitalProyectado, 0)
  scenarios.push({
    nombre: 'Aumentar cuota inicial',
    factible: faltante === 0,
    detalle:
      faltante === 0
        ? 'Ya proyectas cubrir una cuota inicial mayor si decides aumentarla.'
        : `Necesitarías ahorrar aprox. ${(faltante / Math.max(inputs.mesesHastaObjetivo, 1)).toFixed(2)} adicionales por mes para cerrar la brecha en la fecha objetivo.`,
  })

  // Postergar compra: meses adicionales necesarios
  const mesesNecesarios = monthsToReach(cuotaInicialObjetivo, inputs.ahorroActual, inputs.ahorroMensual, monthlyRate)
  scenarios.push({
    nombre: 'Postergar compra',
    factible: mesesNecesarios !== null,
    detalle:
      mesesNecesarios === null
        ? 'Con el ahorro mensual actual, no se proyecta alcanzar la cuota inicial.'
        : mesesNecesarios <= inputs.mesesHastaObjetivo
          ? 'Ya alcanzas la cuota inicial antes de la fecha objetivo.'
          : `Alcanzarías la cuota inicial en ${mesesNecesarios} meses (${mesesNecesarios - inputs.mesesHastaObjetivo} meses después de tu fecha objetivo).`,
  })

  return { cuotaInicialObjetivo, capitalProyectado, scenarios }
}
