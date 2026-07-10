import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../contexts/AlertContext';

export const ResetPassword: React.FC = () => {
  const { showAlert } = useAlert();
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones de seguridad de contraseña (.gov std)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('La contraseña debe incluir al menos un número.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('La contraseña debe incluir al menos una letra mayúscula.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      // 1. Llamar al servicio para actualizar contraseña en Auth y flag en DB
      await authService.restablecerPassword(password);
      
      // 2. Refrescar el perfil global en el contexto para actualizar requiere_cambio_clave a false
      await refreshProfile();
      
      showAlert('success', 'Contraseña Actualizada', 'Contraseña actualizada con éxito. Bienvenido al sistema.', () => {
        // 3. Redirigir al panel correspondiente según rol
        if (profile?.rol === 'admin_nomina') {
          navigate('/dashboard');
        } else {
          navigate('/formulario');
        }
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-[#f8f9fa] font-sans antialiased selection:bg-secondary selection:text-white">
      
      {/* GOV.CO Header Bar */}
      <div className="fixed top-0 inset-x-0 bg-[#002f6c] text-white py-1.5 px-8 text-[11px] font-semibold flex justify-between items-center select-none shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></span>
          <span>GOBIERNO DE COLOMBIA</span>
        </div>
        <span className="opacity-80">Portal de Nómina - SED Magdalena</span>
      </div>

      <div className="w-full max-w-[450px] bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)] transition-shadow duration-300">
        
        {/* Form Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl mb-4 shadow-sm select-none">
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>security</span>
          </div>
          <h2 className="font-bold text-2xl text-primary mb-2">Cambio de Clave Obligatorio</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed max-w-sm mx-auto">
            Por motivos de seguridad y de acuerdo a las directivas de seguridad digital, debe cambiar la contraseña temporal asignada antes de poder acceder al portal.
          </p>
        </div>

        {/* User Account Notification */}
        <div className="mb-6 p-3 bg-surface-container rounded-xl flex items-center gap-3 border border-outline-variant/30 select-none">
          <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-xs">
            {profile?.correo_institucional.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-on-surface truncate">{profile?.nombre}</span>
            <span className="text-[10px] text-on-surface-variant truncate font-medium">{profile?.correo_institucional}</span>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 bg-error-container border border-error/15 text-on-error-container text-xs rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-error select-none shrink-0" style={{ fontSize: '18px' }}>error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Reset Password Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password field */}
          <div>
            <label className="block font-semibold text-xs text-on-surface mb-2" htmlFor="new-password">
              Nueva Contraseña
            </label>
            <div className="relative border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden bg-surface transition-all duration-200 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
              </div>
              <input 
                id="new-password"
                type={showPasswords ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border-none py-3 pl-11 pr-12 text-sm focus:ring-0 placeholder:text-outline/40 outline-none"
                placeholder="Mínimo 8 caracteres, 1 número y 1 mayúscula"
              />
            </div>
          </div>

          {/* Confirm Password field */}
          <div>
            <label className="block font-semibold text-xs text-on-surface mb-2" htmlFor="confirm-password">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden bg-surface transition-all duration-200 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock_reset</span>
              </div>
              <input 
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-transparent border-none py-3 pl-11 pr-12 text-sm focus:ring-0 placeholder:text-outline/40 outline-none"
                placeholder="Repita la nueva contraseña"
              />
              <button 
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface focus:outline-none transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {showPasswords ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-[#002f6c] text-on-primary font-semibold text-sm py-3.5 rounded-xl mt-4 transition-all duration-200 shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Actualizando contraseña...</span>
              </>
            ) : (
              'Establecer Nueva Contraseña'
            )}
          </button>
        </form>

        {/* Logout Fallback Action */}
        <div className="mt-6 pt-5 border-t border-outline-variant/40 text-center select-none">
          <button 
            onClick={handleLogout}
            disabled={loading}
            className="text-xs text-error hover:underline font-semibold flex items-center justify-center gap-1.5 mx-auto"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Cancelar y Salir
          </button>
        </div>

      </div>
    </div>
  );
};
