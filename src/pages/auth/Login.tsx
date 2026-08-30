import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/authContext'

const schema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to="/" replace />

  async function onSubmit(values: FormValues) {
    setFormError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setFormError(error)
      return
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-semibold text-ink-900">Mi Finanzas</h1>
        <p className="mt-1 text-sm text-ink-500">Inicia sesión para ver tu situación financiera.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="label" htmlFor="email">
              Correo
            </label>
            <input id="email" type="email" className="input" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-critical">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <input id="password" type="password" className="input" {...register('password')} />
            {errors.password && (
              <p className="mt-1 text-xs text-critical">{errors.password.message}</p>
            )}
          </div>
          {formError && <p className="text-sm text-critical">{formError}</p>}
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          ¿No tienes cuenta?{' '}
          <Link to="/crear-cuenta" className="font-medium text-lavender-700">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
