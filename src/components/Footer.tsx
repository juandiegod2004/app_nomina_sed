import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#001A3D] text-white relative select-none mt-auto border-t border-outline/10">
      {/* Franja delgada con los colores institucionales (igual patrón que la franja del header) */}
      <div className="w-full h-1 flex select-none">
        <div className="flex-1 h-full bg-[#A28034]"></div>
        <div className="flex-1 h-full bg-[#FEC800]"></div>
        <div className="flex-1 h-full bg-[#F7003C]"></div>
        <div className="flex-1 h-full bg-[#0071BB]"></div>
        <div className="flex-1 h-full bg-[#00B7D9]"></div>
        <div className="flex-1 h-full bg-[#9FD7E5]"></div>
        <div className="flex-1 h-full bg-[#69B75E]"></div>
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Columna 1 — Institucional */}
          <div className="space-y-3">
            <span className="block font-['Arial_Black',_Arial,_sans-serif] font-black text-sm text-white/95 uppercase tracking-wide">
              Gobernación del Magdalena
            </span>
            <span className="block text-xs font-bold text-white/80 leading-snug">
              Secretaría de Educación Departamental
            </span>
            <div className="text-[11px] text-white/50 space-y-1 font-medium pt-2">
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                Cra 22 #15-100, Santa Marta D.T.C.H.
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">phone</span>
                Teléfono Conmutador: +57 (605) 4209645 Ext 200 y 201
              </p>
            </div>
          </div>

          {/* Columna 2 — Contacto */}
          <div className="space-y-3">
            <span className="block text-xs font-bold text-[#EF7D00] uppercase tracking-wider">
              Canales de Atención
            </span>
            <div className="text-[11px] text-white/70 space-y-2 pt-1 font-medium">
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">mail</span>
                <span>Correo: </span>
                <a href="mailto:sac1@sedmagdalena.gov.co" className="hover:text-white transition-colors underline">
                  sac1@sedmagdalena.gov.co
                </a>
              </p>
              <p className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">language</span>
                <span>Sitio Web: </span>
                <a href="https://gobernaciondelmagdalena.gov.co" target="_blank" rel="noreferrer" className="hover:text-white transition-colors underline">
                  gobernaciondelmagdalena.gov.co
                </a>
              </p>
            </div>

            {/* Redes Sociales */}
            <div className="flex gap-3 pt-3">
              {/* Facebook */}
              <a
                href="https://www.facebook.com/secretariadeeducacionmagdalena"
                target="_blank"
                rel="noreferrer"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
                title="Facebook Oficial"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                </svg>
              </a>
              {/* X */}
              <a
                href="https://x.com/sedmagdalena1"
                target="_blank"
                rel="noreferrer"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
                title="X (Twitter) Oficial"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/sedmagdalena/"
                target="_blank"
                rel="noreferrer"
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
                title="Instagram Oficial"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>

        </div>

        {/* Footer Copyright */}
        <div className="mt-8 pt-6 border-t border-white/10 text-center text-[10px] text-white/40 font-medium">
          <p>© {currentYear} Gobernación del Magdalena. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
