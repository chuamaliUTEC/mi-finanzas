import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// Pantalla de diagnóstico, accesible sin iniciar sesión. Sirve para saber
// POR QUÉ falla el registro en lugar de adivinar: prueba la conexión, la
// existencia de cada tabla y el propio alta de usuario, y traduce el error
// de Supabase a qué hay que hacer.

type State = 'ok' | 'fail' | 'warn' | 'pending'

interface Check {
  name: string
  state: State
  detail: string
  fix?: string
}

const ICON: Record<State, string> = { ok: '✅', fail: '❌', warn: '⚠️', pending: '⏳' }

/** Traduce los errores típicos de Supabase a una instrucción accionable. */
function explain(message: string): { detail: string; fix: string } {
  const m = message.toLowerCase()
  if (m.includes('database error saving new user') || m.includes('unexpected_failure')) {
    return {
      detail: 'Supabase creó el usuario pero un disparador de la base de datos falló, así que canceló todo el registro.',
      fix: 'Ejecuta la migración 20260101000700_robust_signup.sql en el SQL Editor de Supabase. Esa migración impide justamente que esto bloquee el registro.',
    }
  }
  if (m.includes('email address') && m.includes('invalid')) {
    return {
      detail: 'Supabase rechaza este correo por su formato o por restricciones del proyecto.',
      fix: 'Prueba con otro correo, o revisa Authentication → Providers → Email si hay dominios restringidos.',
    }
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return {
      detail: 'Este correo YA tiene una cuenta creada.',
      fix: 'No necesitas registrarte: usa "Ingresar". Si no puedes entrar, es la confirmación de correo lo que falta desactivar.',
    }
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return {
      detail: 'El registro de usuarios nuevos está desactivado en tu proyecto.',
      fix: 'Supabase → Authentication → Sign In / Providers → activa "Allow new users to sign up".',
    }
  }
  if (m.includes('password')) {
    return {
      detail: 'La contraseña no cumple los requisitos del proyecto.',
      fix: 'Usa al menos 6 caracteres (o los que exija Authentication → Policies).',
    }
  }
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return {
      detail: 'Supabase agotó su cuota de correos por hora. Esto solo ocurre cuando la confirmación por correo está ACTIVADA: cada intento de registro dispara un envío.',
      fix: 'Supabase → Authentication → Sign In / Providers → Email → desactiva "Confirm email". Sin confirmación no se envía correo, el límite deja de aplicar y podrás registrarte y entrar de una vez.',
    }
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return {
      detail: 'El navegador no logró contactar con Supabase.',
      fix: 'Revisa que la URL del proyecto sea correcta y que el proyecto no esté pausado en supabase.com.',
    }
  }
  return { detail: message, fix: 'Copia este mensaje y compártelo para diagnosticarlo.' }
}

export function Diagnostico() {
  const [checks, setChecks] = useState<Check[]>([])
  const [running, setRunning] = useState(true)
  const [signupResult, setSignupResult] = useState<Check | null>(null)
  const [testingSignup, setTestingSignup] = useState(false)

  useEffect(() => {
    async function run() {
      const results: Check[] = []

      // 1. Variables de entorno
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      results.push({
        name: 'Credenciales de Supabase',
        state: url && key ? 'ok' : 'fail',
        detail: url
          ? `Proyecto: ${url.replace('https://', '').split('.')[0]} · clave de ${key?.length ?? 0} caracteres`
          : 'No llegaron al navegador.',
        fix: url
          ? undefined
          : 'En Vercel: Settings → Environment Variables, agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y vuelve a desplegar.',
      })

      // 2. Conexión y sesión
      try {
        const { error } = await supabase.auth.getSession()
        results.push({
          name: 'Conexión con Supabase',
          state: error ? 'fail' : 'ok',
          detail: error ? error.message : 'El navegador se comunica con tu proyecto.',
          fix: error ? explain(error.message).fix : undefined,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        results.push({
          name: 'Conexión con Supabase',
          state: 'fail',
          ...explain(msg),
        })
      }

      // 3. Tablas: si falta alguna, la migración no se ejecutó.
      const tablas = [
        'profiles', 'accounts', 'debts', 'credit_cards', 'financial_rules',
        'pending_verifications', 'spending_ranges',
      ]
      for (const tabla of tablas) {
        const { error } = await supabase.from(tabla).select('id').limit(1)
        // Sin sesión, RLS devuelve vacío SIN error: eso significa que la
        // tabla existe y está protegida, que es exactamente lo correcto.
        // "schema cache" no significa que falte la tabla: la API de Supabase
        // guarda una copia de la lista de tablas y puede estar desactualizada
        // tras crear tablas nuevas. Se distingue del caso real de tabla
        // inexistente para no mandar a repetir una migración ya ejecutada.
        const cacheDesactualizado = error?.message.includes('schema cache') ?? false
        const noExiste =
          (error?.message.includes('does not exist') ?? false) || error?.code === '42P01'

        results.push({
          name: `Tabla ${tabla}`,
          state: noExiste ? 'fail' : cacheDesactualizado ? 'warn' : 'ok',
          detail: noExiste
            ? 'No existe: falta correr su migración.'
            : cacheDesactualizado
              ? 'La tabla puede existir, pero la API de Supabase aún no la ve.'
              : 'Existe y está protegida por RLS.',
          fix: noExiste
            ? 'Ejecuta supabase/SETUP_COMPLETO.sql en el SQL Editor.'
            : cacheDesactualizado
              ? "Ejecuta en el SQL Editor:  notify pgrst, 'reload schema';  y recarga esta página en 30 segundos."
              : undefined,
        })
      }

      setChecks(results)
      setRunning(false)
    }
    void run()
  }, [])

  /** Intenta un alta real con un correo desechable para ver el error exacto. */
  async function probarRegistro() {
    setTestingSignup(true)
    setSignupResult(null)
    const email = `prueba.${Date.now()}@mifinanzas-test.com`
    const { data, error } = await supabase.auth.signUp({
      email,
      password: `Prueba-${Date.now()}`,
    })
    if (error) {
      const { detail, fix } = explain(error.message)
      setSignupResult({
        name: 'Registro de prueba',
        state: 'fail',
        detail: `${error.message} → ${detail}`,
        fix,
      })
    } else if (data.user && !data.session) {
      setSignupResult({
        name: 'Registro de prueba',
        state: 'warn',
        detail:
          'El usuario SÍ se creó, pero Supabase no inició sesión: está esperando que confirmes el correo.',
        fix: 'Supabase → Authentication → Sign In / Providers → Email → desactiva "Confirm email". Después podrás registrarte y entrar de una vez.',
      })
    } else {
      setSignupResult({
        name: 'Registro de prueba',
        state: 'ok',
        detail: 'El registro funciona correctamente. Ya puedes crear tu cuenta real.',
      })
    }
    setTestingSignup(false)
  }

  const fallos = checks.filter((c) => c.state === 'fail')
  const avisos = checks.filter((c) => c.state === 'warn')

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 bg-ink-50 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Diagnóstico</h1>
        <p className="mt-1 text-sm text-ink-500">
          Qué funciona y qué no, para no tener que adivinar.
        </p>
      </div>

      {running && <p className="text-sm text-ink-400">Revisando…</p>}

      {!running && (
        <div
          className={`card ${
            fallos.length === 0 ? 'border-positive/40 bg-positive/5' : 'border-critical/40 bg-critical/5'
          }`}
        >
          <p className="font-medium text-ink-900">
            {fallos.length === 0 && avisos.length === 0
              ? '✅ La base de datos y la conexión están bien'
              : fallos.length > 0
                ? `❌ ${fallos.length} ${fallos.length === 1 ? 'problema encontrado' : 'problemas encontrados'}`
                : `⚠️ ${avisos.length} ${avisos.length === 1 ? 'tabla que la API aún no ve' : 'tablas que la API aún no ve'}`}
          </p>
          {avisos.length > 0 && fallos.length === 0 && (
            <p className="mt-2 text-sm text-ink-700">
              Las tablas existen pero la API de Supabase tiene la lista en caché. Ejecuta en el
              SQL Editor <code className="rounded bg-ink-100 px-1">notify pgrst, 'reload schema';</code>{' '}
              y recarga esta página.
            </p>
          )}
          {fallos.length === 0 && avisos.length === 0 && (
            <p className="mt-1 text-sm text-ink-600">
              Si aun así no puedes registrarte, usa el botón de abajo: hará un alta real y te dirá
              el error exacto.
            </p>
          )}
        </div>
      )}

      {/* Prueba de registro real */}
      <div className="card space-y-3">
        <div>
          <h2 className="font-medium text-ink-900">Probar el registro</h2>
          <p className="mt-1 text-sm text-ink-500">
            Crea una cuenta de prueba con un correo inventado para ver qué responde Supabase. No
            afecta a tu cuenta real.
          </p>
        </div>
        <button className="btn-primary" onClick={() => void probarRegistro()} disabled={testingSignup}>
          {testingSignup ? 'Probando…' : 'Hacer la prueba'}
        </button>
        {signupResult && (
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-sm font-medium text-ink-900">
              {ICON[signupResult.state]} {signupResult.detail}
            </p>
            {signupResult.fix && (
              <p className="mt-2 text-sm text-lavender-700">
                <strong>Solución:</strong> {signupResult.fix}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Detalle de cada comprobación */}
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.name} className="card !p-4">
            <p className="text-sm font-medium text-ink-900">
              {ICON[check.state]} {check.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">{check.detail}</p>
            {check.fix && <p className="mt-1 text-xs text-lavender-700">→ {check.fix}</p>}
          </div>
        ))}
      </div>

      <Link to="/ingresar" className="btn-secondary inline-flex">
        Volver a ingresar
      </Link>
    </div>
  )
}
