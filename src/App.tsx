import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { Rectors } from './pages/Rectors';
import { Validation } from './pages/Validation';
import { Personal } from './pages/Personal';
import { ReportsHistory } from './pages/ReportsHistory';
import { Formulario } from './pages/Formulario';
import { ResetPassword } from './pages/ResetPassword';
import { NotFound } from './pages/NotFound';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-on-surface-variant tracking-wide uppercase">
            Cargando sesión institucional...
          </p>
        </div>
      </div>
    );
  }

  // Redirección si el usuario ya está autenticado
  const LoginWrapper = () => {
    if (profile) {
      if (profile.requiere_cambio_clave) {
        return <Navigate to="/reset-password" replace />;
      }
      if (profile.rol === 'admin_nomina') {
        return <Navigate to="/dashboard" replace />;
      } else {
        return <Navigate to="/formulario" replace />;
      }
    }
    return <Login onLoginSuccess={() => {}} />;
  };

  // Redirección de la raíz '/'
  const RootRedirector = () => {
    if (!profile) {
      return <Navigate to="/login" replace />;
    }
    if (profile.requiere_cambio_clave) {
      return <Navigate to="/reset-password" replace />;
    }
    if (profile.rol === 'admin_nomina') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/formulario" replace />;
    }
  };


  return (
    <Router>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<LoginWrapper />} />

        {/* Ruta raíz */}
        <Route path="/" element={<RootRedirector />} />

        {/* Ruta de cambio obligatorio de clave */}
        <Route 
          path="/reset-password" 
          element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          } 
        />

        {/* Rutas Protegidas de Administración de Nómina */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['admin_nomina']}>
              <DashboardLayout>
                <DashboardHome onNavigate={() => {}} />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/rectors" 
          element={
            <ProtectedRoute allowedRoles={['admin_nomina']}>
              <DashboardLayout>
                <Rectors />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/personal" 
          element={
            <ProtectedRoute allowedRoles={['admin_nomina']}>
              <DashboardLayout>
                <Personal />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/validation" 
          element={
            <ProtectedRoute allowedRoles={['admin_nomina']}>
              <DashboardLayout>
                <Validation />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />

        {/* Rutas del Rector */}
        <Route 
          path="/formulario" 
          element={
            <ProtectedRoute allowedRoles={['rector']}>
              <DashboardLayout>
                <Formulario />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />

        {/* Rutas compartidas (acceso restringido a nivel RLS en base de datos) */}
        <Route 
          path="/reports-history" 
          element={
            <ProtectedRoute allowedRoles={['rector']}>
              <DashboardLayout>
                <ReportsHistory />
              </DashboardLayout>
            </ProtectedRoute>
          } 
        />

        {/* Captura de rutas inválidas */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
