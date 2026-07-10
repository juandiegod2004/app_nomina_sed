import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface DashboardHomeProps {
  onNavigate: (view: string) => void;
}

interface ActivityItem {
  id: string;
  iedNombre: string;
  mes: number;
  año: number;
  estado: string;
  actualizadoEn: string;
}



export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    activeIeds: 0,
    registeredRectors: 0,
    validatedPercentage: 0,
    pendingReports: 0
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getMonthName = (num: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[num - 1] || '';
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Conteo de IEDs Activas
      const { count: iedsCount, error: errIeds } = await supabase
        .from('ieds')
        .select('*', { count: 'exact', head: true });
      if (errIeds) throw errIeds;

      // 2. Conteo de Rectores Registrados
      const { count: rectorsCount, error: errRectors } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('rol', 'rector');
      if (errRectors) throw errRectors;

      // 3. Reportes de Horas Extras (General)
      const { data: reports, error: errReports } = await supabase
        .from('reportes_horas_extras')
        .select('estado');
      if (errReports) throw errReports;

      const totalReports = reports?.length || 0;
      const validatedCount = reports?.filter(r => r.estado === 'aprobado' || r.estado === 'observado').length || 0;
      const pendingCount = reports?.filter(r => r.estado === 'pendiente').length || 0;

      const pct = totalReports > 0 ? Math.round((validatedCount / totalReports) * 100) : 0;

      setStats({
        activeIeds: iedsCount || 0,
        registeredRectors: rectorsCount || 0,
        validatedPercentage: pct,
        pendingReports: pendingCount
      });

      // 4. Actividad Reciente (últimos 5 reportes creados o actualizados)
      const { data: recent, error: errRecent } = await supabase
        .from('reportes_horas_extras')
        .select('id, mes, año, estado, actualizado_en, ieds(nombre)')
        .order('actualizado_en', { ascending: false })
        .limit(5);
      if (errRecent) throw errRecent;

      const mappedActivities: ActivityItem[] = (recent || []).map((r: any) => ({
        id: r.id,
        iedNombre: r.ieds?.nombre || 'Institución Educativa',
        mes: r.mes,
        año: r.año,
        estado: r.estado,
        actualizadoEn: new Date(r.actualizado_en).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      setActivities(mappedActivities);

    } catch (err: any) {
      console.error('Error al cargar datos del dashboard:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn font-sans">
      
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl p-6 shadow-md select-none">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-1.5">¡Bienvenido(a) al Portal de Nómina!</h2>
        <p className="text-xs md:text-sm text-primary-fixed opacity-95 max-w-2xl leading-relaxed">
          Desde este panel centralizado podrá gestionar las nóminas docentes, validar reportes cargados por rectores de las instituciones educativas del Magdalena y realizar la fiscalización de novedades.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        
        {/* Card 1: Instituciones Activas */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>school</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Instituciones</span>
            <span className="text-xl font-bold text-primary">{loading ? '...' : stats.activeIeds}</span>
          </div>
        </div>

        {/* Card 2: Rectores Registrados */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>group</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Rectores Activos</span>
            <span className="text-xl font-bold text-primary">{loading ? '...' : stats.registeredRectors}</span>
          </div>
        </div>

        {/* Card 3: Reportes Validados */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>check_circle</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Tasa Validación</span>
            <span className="text-xl font-bold text-primary">{loading ? '...' : `${stats.validatedPercentage}%`}</span>
          </div>
        </div>

        {/* Card 4: Pendientes de Revisión */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>pending_actions</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Pendientes</span>
            <span className="text-xl font-bold text-amber-700">{loading ? '...' : stats.pendingReports}</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="w-full">
        
        {/* Recent Activity Feed */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5 select-none">
              <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006492]" style={{ fontSize: '18px' }}>history</span>
                Actividad Reciente
              </h3>
              <button 
                onClick={() => onNavigate('validacion')}
                className="text-xs text-[#006492] font-semibold hover:underline"
              >
                Ver todos
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">Cargando actividades...</div>
            ) : activities.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">No se registran reportes en el sistema.</div>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {activities.map((item, idx) => (
                    <li key={item.id}>
                      <div className="relative pb-8">
                        {idx !== activities.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-outline-variant/50" aria-hidden="true"></span>
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-lg flex items-center justify-center ring-8 ring-white ${
                              item.estado === 'aprobado' ? 'bg-emerald-50 text-emerald-700' :
                              item.estado === 'observado' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              <span className="material-symbols-outlined text-sm">
                                {item.estado === 'aprobado' ? 'task_alt' :
                                 item.estado === 'observado' ? 'rate_review' :
                                 'cloud_upload'}
                              </span>
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-xs text-on-surface">
                                Reporte de <span className="font-bold text-primary">{item.iedNombre}</span> ({getMonthName(item.mes)} {item.año}) pasó a estado: <span className={`font-semibold capitalize ${
                                  item.estado === 'aprobado' ? 'text-emerald-700' :
                                  item.estado === 'observado' ? 'text-amber-700' :
                                  'text-blue-700'
                                }`}>{item.estado}</span>
                              </p>
                            </div>
                            <div className="text-right text-[10px] whitespace-nowrap text-on-surface-variant font-medium">
                              <span>{item.actualizadoEn}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
