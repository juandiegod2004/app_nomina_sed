import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const NotFound = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (!profile) {
      navigate('/login');
    } else if (profile.rol === 'admin_nomina') {
      navigate('/dashboard');
    } else {
      navigate('/formulario');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 selection:bg-secondary selection:text-white antialiased font-sans">
      
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#009BDE]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#69B75E]/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main card */}
      <div className="w-full max-w-[480px] bg-surface-container-lowest border border-outline-variant/60 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.03)] overflow-hidden relative text-center">
        
        {/* Institutional Chromatic Stripe */}
        <div className="w-full h-2 flex select-none absolute top-0 left-0 right-0">
          <div className="flex-1 h-full bg-[#A28034]"></div>
          <div className="flex-1 h-full bg-[#FEC800]"></div>
          <div className="flex-1 h-full bg-[#F7003C]"></div>
          <div className="flex-1 h-full bg-[#0071BB]"></div>
          <div className="flex-1 h-full bg-[#00B7D9]"></div>
          <div className="flex-1 h-full bg-[#9FD7E5]"></div>
          <div className="flex-1 h-full bg-[#69B75E]"></div>
        </div>

        <div className="p-8 md:p-12 pt-14 md:pt-16 flex flex-col items-center">
          {/* Logo */}
          <div className="w-24 h-24 flex items-center justify-center mb-6 select-none">
            <img 
              alt="Logo SED Magdalena" 
              className="w-full h-full object-contain filter drop-shadow-sm" 
              src="/logo_sed.png" 
            />
          </div>

          <span className="text-[10px] font-['Arial_Black',_Arial,_sans-serif] font-black text-brand-orange uppercase tracking-[0.25em] mb-3">
            Gobernación del Magdalena
          </span>

          <h1 className="text-5xl font-black text-primary tracking-tight mb-2">
            404
          </h1>
          
          <h2 className="text-lg font-bold text-on-surface mb-4">
            Recurso No Encontrado o Restringido
          </h2>
          
          <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed mb-8 max-w-[340px]">
            La página solicitada no existe, no está disponible en este momento o sus permisos actuales no permiten el acceso.
          </p>

          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-primary hover:bg-primary/95 text-on-primary text-xs font-black rounded-xl transition-all duration-200 shadow-md shadow-primary/10 active:scale-[0.98] flex items-center gap-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>home</span>
            Volver al Panel de Control
          </button>
        </div>
      </div>
      
      {/* Small brand signet footer */}
      <div className="mt-8 text-center select-none opacity-40">
        <span className="text-[10px] font-bold text-on-surface-variant font-sans tracking-widest uppercase">
          Secretaría de Educación Departamental
        </span>
      </div>
    </div>
  );
};
