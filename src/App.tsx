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
import { Deudas } from '@/pages/Deudas'
import { Presupuesto } from '@/pages/Presupuesto'
import { Inicio } from '@/pages/Inicio'
import { Metas } from '@/pages/Metas'
import { MeDeben } from '@/pages/MeDeben'
import { Decisiones } from '@/pages/Decisiones'
import { Reglas } from '@/pages/Reglas'
import { Calendario } from '@/pages/Calendario'
import { Pronostico } from '@/pages/Pronostico'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/ingresar" element={<Login />} />
        <Route path="/crear-cuenta" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Inicio />} />
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/cuentas" element={<Cuentas />} />
            <Route path="/deudas" element={<Deudas />} />
            <Route path="/presupuesto" element={<Presupuesto />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/me-deben" element={<MeDeben />} />
            <Route path="/decisiones" element={<Decisiones />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/pronostico" element={<Pronostico />} />
            <Route path="/reportes" element={<Section />} />
            <Route path="/reglas" element={<Reglas />} />
            <Route path="/configuracion" element={<Section />} />
            <Route path="/mas" element={<Mas />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
