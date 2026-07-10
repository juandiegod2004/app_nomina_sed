import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAlert } from '../contexts/AlertContext';

interface LoginProps {
  onLoginSuccess: (email: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { showAlert } = useAlert();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Por favor, ingrese su correo electrónico.');
      return;
    }
    if (!password) {
      setError('Por favor, ingrese su contraseña.');
      return;
    }

    setLoading(true);

    try {
      const profile = await login(username, password);
      onLoginSuccess(profile.correo_institucional);
    } catch (err: any) {
      const errMsg = err.message || 'Error al iniciar sesión. Verifique sus credenciales.';
      setError(errMsg);
      if (errMsg.includes('desactivado')) {
        showAlert('error', 'Usuario Desactivado', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row antialiased overflow-x-hidden selection:bg-secondary selection:text-white bg-[#f8f9fa]">
          {/* Left Branding Pane (Clean, premium light/slate gradient) - Oculto en móvil */}
      <div className="relative hidden md:flex md:w-5/12 lg:w-1/2 min-h-screen flex-col justify-center items-center overflow-hidden p-stack-lg md:p-margin-desktop bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0] md:border-r border-outline-variant/30 select-none">
        
        {/* Soft decorative glowing blobs in light blue tones */}
        <div className="absolute top-[-25%] left-[-20%] w-[70%] h-[70%] bg-[#009BDE]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-25%] right-[-20%] w-[70%] h-[70%] bg-[#45baff]/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* Centered Content Container */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-md gap-6">
          
          {/* Logo & Crest */}
          <div className="flex flex-col items-center gap-6">
            <div className="w-36 h-36 md:w-44 md:h-44 flex items-center justify-center transition-transform duration-500 hover:scale-105 select-none">
              <img 
                alt="Logo Secretaría de Educación del Magdalena" 
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.06)]" 
                src="/logo_sed.png" 
              />
            </div>
            <div className="flex flex-col items-center">
              <h1 className="font-black text-3xl md:text-4xl text-primary leading-tight font-sans tracking-tight mb-2">
                Sistema de Novedades
              </h1>
              <p className="text-sm text-on-surface-variant font-medium max-w-[280px] leading-relaxed">
                Gestión de horas extras docentes y administrativas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Form Pane */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-margin-desktop bg-[#f8f9fa] md:bg-surface relative z-10 min-h-screen transition-all duration-300">
        <div className="w-full max-w-[450px] bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-shadow duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative">
          
          {/* Franja cromática institucional sobre la tarjeta de Login */}
          <div className="w-full h-1.5 flex select-none absolute top-0 left-0 right-0">
            <div className="flex-1 h-full bg-[#A28034]"></div>
            <div className="flex-1 h-full bg-[#FEC800]"></div>
            <div className="flex-1 h-full bg-[#F7003C]"></div>
            <div className="flex-1 h-full bg-[#0071BB]"></div>
            <div className="flex-1 h-full bg-[#00B7D9]"></div>
            <div className="flex-1 h-full bg-[#9FD7E5]"></div>
            <div className="flex-1 h-full bg-[#69B75E]"></div>
          </div>
          
          <div className="p-8 md:p-10 pt-10 md:pt-12">
            {/* Form Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center mb-4 select-none">
                <img 
                  alt="Logo SED" 
                  className="w-16 h-16 object-contain" 
                  src="/logo_sed.png" 
                />
              </div>
              <h2 className="font-bold text-2xl text-primary mb-2">Acceso Institucional</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Ingrese sus credenciales corporativas autorizadas.
              </p>
            </div>

          {/* Error Message Box */}
          {error && (
            <div className="mb-6 p-4 bg-error-container border border-error/15 text-on-error-container text-sm rounded-xl flex items-start gap-2.5 animate-fadeIn">
              <span className="material-symbols-outlined text-error select-none shrink-0" style={{ fontSize: '20px' }}>error</span>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field (Restricted Domain) */}
            <div>
              <label className="block font-semibold text-sm text-on-surface mb-2" htmlFor="email">
                Correo Electrónico
              </label>
              <div className="flex items-stretch border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden bg-surface transition-all duration-200 group">
                <div className="flex items-center pl-4 pr-1 text-outline group-focus-within:text-primary shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mail</span>
                </div>
                <input 
                  autoComplete="username" 
                  className="w-full bg-transparent border-none py-3 px-4 text-on-surface font-body-md text-sm md:text-base focus:ring-0 placeholder:text-outline/50 outline-none" 
                  id="email" 
                  name="email" 
                  placeholder="ejemplo@sedmagdalena.gov.co" 
                  required 
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block font-semibold text-sm text-on-surface" htmlFor="password">
                  Contraseña
                </label>
                <a 
                  className="text-xs text-secondary hover:text-primary transition-colors hover:underline font-semibold" 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    showAlert('info', 'Restablecer Contraseña', 'Por favor contacte al administrador del sistema de la Secretaría de Educación para restablecer su contraseña.');
                  }}
                >
                  ¿Olvidó su contraseña?
                </a>
              </div>
              <div className="relative border border-outline-variant rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden bg-surface transition-all duration-200 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-outline group-focus-within:text-primary">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock</span>
                </div>
                <input 
                  autoComplete="current-password" 
                  className="w-full bg-transparent border-none py-3 pl-11 pr-12 text-on-surface font-body-md text-sm md:text-base focus:ring-0 placeholder:text-outline/50 outline-none" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••" 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button 
                  aria-label="Mostrar contraseña" 
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface focus:outline-none transition-colors" 
                  id="togglePassword" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <span className="material-symbols-outlined" id="toggleIcon" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              className={`w-full bg-primary hover:bg-[#002f6c] text-on-primary font-semibold text-sm md:text-base py-3.5 rounded-xl mt-2 transition-all duration-200 shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          {/* Legal/Footer Info within card */}
          <div className="mt-8 pt-6 border-t border-outline-variant/40 text-center">
            <p className="text-xs text-on-surface-variant flex items-center justify-center gap-1.5 font-medium select-none">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>gavel</span>
              Uso exclusivo para personal de la entidad.
            </p>
          </div>
        </div>
      </div>

      {/* Global Minimal Footer */}
      <div className="mt-8 text-center opacity-85">
          <p className="text-[11px] md:text-xs text-on-surface-variant font-medium">
            © 2026 Secretaría de Educación del Magdalena.<br className="md:hidden"/> Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};
