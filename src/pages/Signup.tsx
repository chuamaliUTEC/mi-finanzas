import { Link, Navigate } from 'react-router-dom'
import { AuthForm } from '@/components/AuthForm'
import { useAuth } from '@/hooks/useAuth'

export default function Signup() {
  const { signUp, session } = useAuth()

  if (session) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-center text-2xl font-semibold text-brand-700">Mi Finanzas</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Crea tu cuenta gratuita</p>
        <AuthForm mode="signup" onSubmit={signUp} />
        <p className="mt-4 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
