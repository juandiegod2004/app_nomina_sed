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
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans text-on-background selection:bg-secondary selection:text-white antialiased">
      
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

      {/* Mobile Header */}
      <header className="md:hidden w-full bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6 py-4 fixed top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <img 
            alt="Logo SED Magdalena" 
            className="w-8 h-8 object-contain" 
            src="/logo_sed.png" 
          />
          <h1 className="font-bold text-base text-primary leading-tight">SED Magdalena</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-primary p-1 rounded-lg hover:bg-surface-container transition-colors"
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        ></div>
      )}

      {/* Sidebar - Desktop and Mobile Drawer */}
      <aside className={`fixed inset-y-0 left-0 pt-6 bg-surface-container-low border-r border-outline-variant flex flex-col w-64 h-full py-stack-md z-50 transform md:transform-none transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Sidebar Header */}
        <div className="px-5 mb-8 flex items-center gap-4 select-none">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-md border border-outline-variant/10">
            <img 
              alt="Logo SED Magdalena" 
              className="w-full h-full object-contain" 
              src="/logo_sed.png" 
            />
          </div>
          <div>
            <h2 className="text-base font-bold text-primary leading-tight">Gestión Nómina</h2>
            <p className="text-[11px] text-on-surface-variant font-medium uppercase tracking-wider">SED Magdalena</p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 rounded-xl font-semibold text-xs md:text-sm transition-all duration-200 relative ${
                  isActive 
                    ? 'bg-primary text-on-primary shadow-sm shadow-primary/10' 
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-brand-orange rounded-r-full"></span>
                )}
                <span className="material-symbols-outlined mr-3.5 select-none" style={{ fontSize: '20px' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User Section & Actions */}
        <div className="mt-auto px-3 border-t border-outline-variant/60 pt-4 space-y-3">
          {/* User Widget */}
          <div className="flex items-center gap-3 px-3 py-2 bg-surface-container rounded-xl border border-outline-variant/20 select-none">
            <div className="w-9 h-9 bg-secondary text-white rounded-lg flex items-center justify-center font-bold text-sm">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-on-surface truncate">
                {profile?.nombre || userEmail.split('@')[0]}
              </span>
              <span className="text-[10px] text-on-surface-variant truncate font-medium">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Logout Action */}
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm text-error hover:bg-error-container/20 transition-all duration-200 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined mr-3.5" style={{ fontSize: '20px' }}>logout</span>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen pt-[72px] md:pt-0 md:ml-64 transition-all duration-300">
        
        {/* TopAppBar - Desktop Header */}
        <header className="bg-surface border-b border-outline-variant/60 sticky top-0 z-30 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hidden md:block">

          {/* Navigation Bar Header */}
          <div className="flex justify-between items-center px-8 py-4 max-w-container-max mx-auto w-full">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-primary tracking-wide">
                Secretaría de Educación del Magdalena
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                className="text-primary p-2 hover:bg-surface-container rounded-full transition-all active:scale-95"
                title="Notificaciones"
                onClick={() => alert('No tiene notificaciones pendientes')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>notifications</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-margin-mobile md:p-8 max-w-container-max mx-auto w-full flex flex-col gap-6">
          
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
    </div>
  );
};
