import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/layouts/ProtectedRoute'
import { AppShell } from '@/layouts/AppShell'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { Onboarding } from '@/pages/Onboarding'
import { Section } from '@/pages/Section'
import { Mas } from '@/pages/Mas'
import { Cuentas } from '@/pages/Cuentas'
import { Registrar } from '@/pages/Registrar'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/ingresar" element={<Login />} />
        <Route path="/crear-cuenta" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Section />} />
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/cuentas" element={<Cuentas />} />
            <Route path="/deudas" element={<Section />} />
            <Route path="/presupuesto" element={<Section />} />
            <Route path="/metas" element={<Section />} />
            <Route path="/decisiones" element={<Section />} />
            <Route path="/calendario" element={<Section />} />
            <Route path="/pronostico" element={<Section />} />
            <Route path="/reportes" element={<Section />} />
            <Route path="/reglas" element={<Section />} />
            <Route path="/configuracion" element={<Section />} />
            <Route path="/mas" element={<Mas />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
