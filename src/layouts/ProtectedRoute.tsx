import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-400">
        Cargando…
      </div>
    )
  }

  if (!session) return <Navigate to="/ingresar" replace />

  return <Outlet />
}
