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

interface MissingIed {
  id: string;
  nombre: string;
}

interface OverLimitAlert {
  docente: string;
  ied: string;
  mes: number;
  total: number;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    activeIeds: 0,
    registeredRectors: 0,
    validatedPercentage: 0,
    pendingReports: 0
  });

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [missingIeds, setMissingIeds] = useState<MissingIed[]>([]);
  const [overLimitAlerts, setOverLimitAlerts] = useState<OverLimitAlert[]>([]);
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

      // 5. Alertas: IEDs que no han reportado en el mes actual
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = 2026; // Año del sistema

      const { data: allIeds, error: errAllIeds } = await supabase
        .from('ieds')
        .select('id, nombre');
      if (errAllIeds) throw errAllIeds;

      const { data: monthReports, error: errMonthReports } = await supabase
        .from('reportes_horas_extras')
        .select('ied_id')
        .eq('mes', currentMonth)
        .eq('año', currentYear);
      if (errMonthReports) throw errMonthReports;

      const reportedIeds = new Set((monthReports || []).map(r => r.ied_id));
      const missing = (allIeds || [])
        .filter(ied => !reportedIeds.has(ied.id))
        .map(ied => ({ id: ied.id, nombre: ied.nombre }))
        .slice(0, 5); // Mostrar máximo 5
      setMissingIeds(missing);

      // 6. Alertas: Docentes con horas por encima del tope de resolución (80 horas)
      const { data: details, error: errDetails } = await supabase
        .from('detalle_reporte')
        .select(`
          reporte_id,
          residuo,
          sustitucion,
          jornada_unica,
          adultos,
          dom_diurno,
          dom_nocturno,
          fest_diurno,
          fest_nocturno,
          recargo_nocturno,
          personal (nombres, apellidos),
          reportes_horas_extras (
            mes,
            ieds (nombre)
          )
        `);
      if (errDetails) throw errDetails;

      const overLimit: OverLimitAlert[] = [];
      (details || []).forEach((det: any) => {
        const total = 
          (det.residuo || 0) +
          (det.sustitucion || 0) +
          (det.jornada_unica || 0) +
          (det.adultos || 0) +
          (det.dom_diurno || 0) +
          (det.dom_nocturno || 0) +
          (det.fest_diurno || 0) +
          (det.fest_nocturno || 0) +
          (det.recargo_nocturno || 0);

        if (total > 80) {
          overLimit.push({
            docente: `${det.personal?.nombres || ''} ${det.personal?.apellidos || ''}`,
            ied: det.reportes_horas_extras?.ieds?.nombre || 'IED Asignada',
            mes: det.reportes_horas_extras?.mes || currentMonth,
            total
          });
        }
      });
      setOverLimitAlerts(overLimit.slice(0, 5)); // Mostrar máximo 5

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Recent Activity Feed */}
        <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
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

        {/* Right Column: Alerts & Reminders */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Section: Alertas de Atención */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-1.5 select-none">
              <span className="material-symbols-outlined text-[#006492]" style={{ fontSize: '18px' }}>notification_important</span>
              Alertas del Sistema
            </h3>
            
            <div className="space-y-3">
              {loading ? (
                <div className="text-center text-xs text-on-surface-variant p-4">Analizando alertas...</div>
              ) : (
                <>
                  {/* Alerta 1: Exceso de horas extras (> 80 horas) */}
                  {overLimitAlerts.length > 0 && (
                    <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-xs text-rose-800">
                      <span className="material-symbols-outlined text-rose-600 select-none text-lg">warning</span>
                      <div className="space-y-1">
                        <span className="font-bold block">Tope de Horas Excedido (&gt;80h)</span>
                        <ul className="list-disc list-inside space-y-0.5 opacity-90 text-[11px]">
                          {overLimitAlerts.map((alert, i) => (
                            <li key={i}>
                              <strong>{alert.docente}</strong> ({alert.total}h) en {alert.ied}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Alerta 2: IEDs sin reporte en el mes en curso */}
                  {missingIeds.length > 0 ? (
                    <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-xs text-amber-800">
                      <span className="material-symbols-outlined text-amber-600 select-none text-lg">emergency_home</span>
                      <div className="space-y-1">
                        <span className="font-bold block">Falta Carga de Novedades (Mes Actual)</span>
                        <p className="text-[11px] opacity-90 mb-1.5">Las siguientes instituciones no han reportado novedades de Horas Extras:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                          {missingIeds.map((ied) => (
                            <li key={ied.id} className="truncate max-w-[280px]">{ied.nombre}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 text-xs text-emerald-800">
                      <span className="material-symbols-outlined text-emerald-600 select-none text-lg">check_circle</span>
                      <div>
                        <span className="font-bold block">Todas las IED reportadas</span>
                        <span>Todas las instituciones del departamento cargaron novedades en el mes.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
