import { useState, type FormEvent } from 'react'

interface AuthFormProps {
  mode: 'login' | 'signup'
  onSubmit: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await onSubmit(email, password, mode === 'signup' ? fullName : undefined)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <p className="text-center text-sm text-gray-600">
        Cuenta creada. Revisa tu correo para confirmar el registro antes de iniciar sesión.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
      {mode === 'signup' && (
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </button>
    </form>
  )
}
