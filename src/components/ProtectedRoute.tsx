import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('rector' | 'admin_nomina')[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth();
  const location = useLocation();

  // Prevenir parpadeo de contenido protegido mostrando un loader limpio
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-on-surface-variant tracking-wide uppercase">
            Verificando credenciales gubernamentales...
          </p>
        </div>
      </div>
    );
  }

  // Redirigir a login si no hay sesión activa
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Si requiere cambio de clave obligatorio y no está en la página de reseteo, forzar redirección
  if (profile.requiere_cambio_clave && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  // Si ya cambió la clave e intenta acceder a /reset-password, redirigir a su panel
  if (!profile.requiere_cambio_clave && location.pathname === '/reset-password') {
    if (profile.rol === 'admin_nomina') {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/formulario" replace />;
    }
  }

  // Redirigir a sus paneles por defecto si el rol no coincide con el permitido
  if (allowedRoles && !allowedRoles.includes(profile.rol)) {
    if (profile.rol === 'rector') {
      return <Navigate to="/formulario" replace />;
    } else if (profile.rol === 'admin_nomina') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
