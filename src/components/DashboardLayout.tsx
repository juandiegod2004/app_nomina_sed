import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Footer } from './Footer';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return 'Panel de Control';
      case '/validation':
        return 'Validación de Reportes';
      case '/rectors':
        return 'Gestión de Rectores';
      case '/personal':
        return 'Gestión de Personal';
      case '/reports-history':
        return 'Historial de Reportes';
      case '/formulario':
        return 'Cargar Novedades';
      default:
        return 'Sistema de Gestión';
    }
  };

  // Definir ítems de menú filtrados por el rol institucional
  const navItems: NavItem[] = [];
  if (profile?.rol === 'admin_nomina') {
    navItems.push(
      { path: '/dashboard', label: 'Panel de Control', icon: 'dashboard' },
      { path: '/validation', label: 'Validación de Reportes', icon: 'check_circle' },
      { path: '/rectors', label: 'Gestión de Rectores', icon: 'group' },
      { path: '/personal', label: 'Gestión de Personal', icon: 'badge' }
    );
  } else if (profile?.rol === 'rector') {
    navItems.push(
      { path: '/formulario', label: 'Cargar Novedades', icon: 'edit_document' },
      { path: '/reports-history', label: 'Historial de Reportes', icon: 'analytics' }
    );
  }

  const handleLogoutClick = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err.message);
    }
  };

  const userEmail = profile?.correo_institucional || 'usuario@sedmagdalena.gov.co';

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans text-on-background selection:bg-secondary selection:text-white antialiased">
      
      {/* Franja cromática institucional de la Gobernación del Magdalena */}
      <div className="w-full h-1.5 flex fixed top-0 left-0 right-0 z-[60] select-none">
        <div className="flex-1 h-full bg-[#A28034]"></div>
        <div className="flex-1 h-full bg-[#FEC800]"></div>
        <div className="flex-1 h-full bg-[#F7003C]"></div>
        <div className="flex-1 h-full bg-[#0071BB]"></div>
        <div className="flex-1 h-full bg-[#00B7D9]"></div>
        <div className="flex-1 h-full bg-[#9FD7E5]"></div>
        <div className="flex-1 h-full bg-[#69B75E]"></div>
      </div>

      {/* Header Superior Completo */}
      <header className="w-full bg-surface border-b border-outline-variant/60 sticky top-[6px] z-50 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col">
        
        {/* Fila 1: Logo + Nombre Entidad e Info de Usuario */}
        <div className="max-w-container-max mx-auto w-full px-6 md:px-8 py-3.5 flex justify-between items-center">
          
          {/* Logo y Nombre */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 shadow-sm border border-outline-variant/10">
              <img 
                alt="Logo SED Magdalena" 
                className="w-full h-full object-contain" 
                src="/logo_sed.png" 
              />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold text-primary leading-tight font-sans">
                Gestión Nómina
              </h1>
              <p className="text-[9px] md:text-[10px] text-on-surface-variant font-black tracking-widest uppercase opacity-80 leading-none">
                SED Magdalena
              </p>
            </div>
          </div>

          {/* Acciones de la derecha: Dropdown de Usuario */}
          <div className="flex items-center gap-3">

            {/* Dropdown del perfil */}
            <div className="relative">
              <button 
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-container rounded-xl transition-all border border-transparent hover:border-outline-variant/30 select-none cursor-pointer"
              >
                <div className="w-7 h-7 bg-secondary text-white rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left min-w-0">
                  <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">
                    {profile?.nombre || userEmail.split('@')[0]}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform duration-200">
                  {isUserDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Menú Dropdown de Usuario */}
              {isUserDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsUserDropdownOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-surface border border-outline-variant rounded-xl shadow-lg py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-outline-variant/60">
                      <p className="text-xs font-bold text-on-surface truncate">
                        {profile?.nombre || userEmail.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate font-medium mt-0.5">
                        {userEmail}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        handleLogoutClick();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-error hover:bg-error-container/10 flex items-center gap-2 transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                      Cerrar Sesión
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Hamburguesa para menú responsive de navegación */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-primary p-2 hover:bg-surface-container rounded-lg transition-colors shrink-0"
              aria-label="Abrir menú de navegación"
            >
              <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>

        </div>

        {/* Fila 2: Navegación Horizontal (Escritorio) y Dropdown (Móvil) */}
        <div className="border-t border-outline-variant/30 bg-surface-container-lowest">
          <div className="max-w-container-max mx-auto w-full px-6 md:px-8">
            
            {/* Menú de Escritorio (Horizontal) */}
            <nav className="hidden md:flex items-center gap-1.5 py-2.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                      isActive 
                        ? 'bg-primary text-on-primary shadow-sm shadow-primary/10' 
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Menú de Móvil (Vertical colapsable) */}
            {isMobileMenuOpen && (
              <nav className="md:hidden flex flex-col gap-1 py-3 border-t border-outline-variant/30 animate-fadeIn">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary text-on-primary shadow-sm shadow-primary/10' 
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            )}

          </div>
        </div>

      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 max-w-container-max mx-auto w-full flex flex-col gap-6">
        
        {/* Internal Title Section */}
        <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4 select-none">
          <div>
            <nav className="text-[10px] md:text-xs text-on-surface-variant font-medium flex items-center gap-1 mb-1">
              <span>Portal Nómina</span>
              <span>/</span>
              <span className="text-[#006492] font-semibold">{getPageTitle()}</span>
            </nav>
            <h2 className="text-2xl font-bold text-primary">{getPageTitle()}</h2>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="flex-grow">
          {children}
        </div>
      </main>

      {/* Global Footer */}
      <Footer />

    </div>
  );
};
