import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/layouts/ProtectedRoute'
import { AppShell } from '@/layouts/AppShell'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { Onboarding } from '@/pages/Onboarding'
import { Mas } from '@/pages/Mas'
import { Cuentas } from '@/pages/Cuentas'
import { Ingresos } from '@/pages/Ingresos'
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
import { Configuracion } from '@/pages/Configuracion'
import { Reportes } from '@/pages/Reportes'
import { MiSituacion } from '@/pages/MiSituacion'

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
            <Route path="/ingresos" element={<Ingresos />} />
            <Route path="/deudas" element={<Deudas />} />
            <Route path="/presupuesto" element={<Presupuesto />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/me-deben" element={<MeDeben />} />
            <Route path="/decisiones" element={<Decisiones />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/pronostico" element={<Pronostico />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/mi-situacion" element={<MiSituacion />} />
            <Route path="/reglas" element={<Reglas />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/mas" element={<Mas />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
