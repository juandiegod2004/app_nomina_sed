import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { useAlert } from '../contexts/AlertContext';
import { useNavigate } from 'react-router-dom';

interface ReportHistoryRecord {
  id: string; // Report UUID
  mes: number;
  año: number;
  sentDate: string;
  iedName: string;
  rectorName: string;
  totalHours: number;
  status: 'pendiente' | 'aprobado' | 'observado';
  observation?: string;
}

interface DetailRecord {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo: string;
  tipo: 'docente' | 'administrativo';
  grado_escalafon?: string;
  residuo: number;
  sustitucion: number;
  jornada_unica: number;
  adultos: number;
  dom_diurno: number;
  dom_nocturno: number;
  fest_diurno: number;
  fest_nocturno: number;
  recargo_nocturno: number;
}

export const ReportsHistory: React.FC = () => {
  const { profile } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();

  const [records, setRecords] = useState<ReportHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter input states
  const [monthInput, setMonthInput] = useState('');
  const [statusInput, setStatusInput] = useState('');

  // Active filters applied states
  const [appliedFilters, setAppliedFilters] = useState({
    month: '',
    status: ''
  });

  // Selected report detail modal state
  const [selectedReport, setSelectedReport] = useState<ReportHistoryRecord | null>(null);
  const [reportDetails, setReportDetails] = useState<DetailRecord[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'docente' | 'administrativo'>('docente');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const getMonthName = (num: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[num - 1] || '';
  };

  const loadHistory = async () => {
    if (!profile?.ied_id) return;
    setLoading(true);
    try {
      // 1. Fetch report headers
      const { data: reportsData, error: errRep } = await supabase
        .from('reportes_horas_extras')
        .select(`
          id,
          mes,
          año,
          estado,
          observacion,
          creado_en,
          ieds (nombre),
          usuarios (nombre)
        `)
        .eq('ied_id', profile.ied_id)
        .order('creado_en', { ascending: false });

      if (errRep) throw errRep;

      // 2. Fetch all details to sum hours
      const { data: detailsData, error: errDet } = await supabase
        .from('detalle_reporte')
        .select('reporte_id, residuo, sustitucion, jornada_unica, adultos, dom_diurno, dom_nocturno, fest_diurno, fest_nocturno, recargo_nocturno');
      
      if (errDet) throw errDet;

      const hoursMap: Record<string, number> = {};
      (detailsData || []).forEach((d: any) => {
        const sum = (d.residuo || 0) + (d.sustitucion || 0) + (d.jornada_unica || 0) + (d.adultos || 0) +
                    (d.dom_diurno || 0) + (d.dom_nocturno || 0) + (d.fest_diurno || 0) + (d.fest_nocturno || 0) +
                    (d.recargo_nocturno || 0);
        hoursMap[d.reporte_id] = (hoursMap[d.reporte_id] || 0) + sum;
      });

      const mapped: ReportHistoryRecord[] = (reportsData || []).map((r: any) => ({
        id: r.id,
        mes: r.mes,
        año: r.año,
        sentDate: new Date(r.creado_en).toLocaleString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        iedName: r.ieds?.nombre || 'IED Asignada',
        rectorName: r.usuarios?.nombre || profile.nombre,
        totalHours: hoursMap[r.id] || 0,
        status: r.estado as 'pendiente' | 'aprobado' | 'observado',
        observation: r.observacion || undefined
      }));

      setRecords(mapped);
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Cargar', 'No se pudo cargar el historial: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [profile]);

  const loadReportDetails = async (reportId: string) => {
    setDetailsLoading(true);
    try {
      const { data, error } = await supabase
        .from('detalle_reporte')
        .select(`
          id,
          residuo,
          sustitucion,
          jornada_unica,
          adultos,
          dom_diurno,
          dom_nocturno,
          fest_diurno,
          fest_nocturno,
          recargo_nocturno,
          personal (
            cedula,
            nombres,
            apellidos,
            cargo,
            tipo,
            grado_escalafon
          )
        `)
        .eq('reporte_id', reportId);

      if (error) throw error;

      const mapped: DetailRecord[] = (data || []).map((d: any) => ({
        id: d.id,
        nombres: d.personal?.nombres || '',
        apellidos: d.personal?.apellidos || '',
        cedula: d.personal?.cedula || '',
        cargo: d.personal?.cargo || '',
        tipo: (d.personal?.tipo || 'docente') as 'docente' | 'administrativo',
        grado_escalafon: d.personal?.grado_escalafon || undefined,
        residuo: d.residuo || 0,
        sustitucion: d.sustitucion || 0,
        jornada_unica: d.jornada_unica || 0,
        adultos: d.adultos || 0,
        dom_diurno: d.dom_diurno || 0,
        dom_nocturno: d.dom_nocturno || 0,
        fest_diurno: d.fest_diurno || 0,
        fest_nocturno: d.fest_nocturno || 0,
        recargo_nocturno: d.recargo_nocturno || 0
      }));

      setReportDetails(mapped);
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Cargar Detalle', 'No se pudieron cargar los detalles: ' + err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenDetails = (report: ReportHistoryRecord) => {
    setSelectedReport(report);
    loadReportDetails(report.id);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      month: monthInput,
      status: statusInput
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setMonthInput('');
    setStatusInput('');
    setAppliedFilters({
      month: '',
      status: ''
    });
    setCurrentPage(1);
  };

  // Filtered records calculation
  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      if (appliedFilters.month) {
        const [year, month] = appliedFilters.month.split('-');
        if (rec.año !== parseInt(year) || rec.mes !== parseInt(month)) {
          return false;
        }
      }
      if (appliedFilters.status && rec.status !== appliedFilters.status) {
        return false;
      }
      return true;
    });
  }, [records, appliedFilters]);

  // Paginated records calculation
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));

  // Style badge helpers
  const getBadgeClass = (status: ReportHistoryRecord['status']) => {
    switch (status) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'observado':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      case 'pendiente':
      default:
        return 'bg-blue-100 text-blue-900 border border-blue-200';
    }
  };

  const getStatusIcon = (status: ReportHistoryRecord['status']) => {
    switch (status) {
      case 'aprobado':
        return 'check_circle';
      case 'observado':
        return 'error';
      case 'pendiente':
      default:
        return 'schedule';
    }
  };

  const modalDocentes = reportDetails.filter(d => d.tipo === 'docente');
  const modalAdministrativos = reportDetails.filter(d => d.tipo === 'administrativo');

  return (
    <div className="flex flex-col gap-6 animate-fadeIn font-sans pb-12">
      
      {/* Description Header */}
      <div>
        <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
          Consulte la bitácora histórica de novedades de Horas Extras enviadas por su institución educativa y revise las observaciones técnicas emitidas por el administrador.
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-1.5 select-none">
          <span className="material-symbols-outlined text-[#006492]" style={{ fontSize: '18px' }}>filter_alt</span>
          Filtros de Historial
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Month Input */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Mes de Reporte
            </label>
            <input 
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Estado de la Novedad
            </label>
            <select 
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="">Todos los Estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="observado">Observado</option>
              <option value="aprobado">Aprobado</option>
            </select>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mt-5 flex justify-end gap-2.5 border-t border-outline-variant/40 pt-4 select-none">
          <button 
            onClick={handleClearFilters}
            className="px-4 py-2 border border-primary text-primary hover:bg-surface-container rounded-xl font-semibold text-xs transition-colors"
          >
            Limpiar Filtros
          </button>
          <button 
            onClick={handleApplyFilters}
            className="px-5 py-2 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-colors shadow-sm active:scale-[0.98]"
          >
            Filtrar Historial
          </button>
        </div>
      </div>

      {/* Table Records Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm">
        
        {/* Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              <span className="text-xs text-on-surface-variant font-medium">Cargando historial de reportes...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-surface-container-low/60 border-b border-outline-variant/80 select-none text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                <tr>
                  <th className="py-3 px-4 font-bold text-left">Período de Novedades</th>
                  <th className="py-3 px-3 text-center">Fecha de Envío</th>
                  <th className="py-3 px-3 text-center">Horas Extras Totales</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-outline-variant/40 text-xs text-on-surface">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-on-surface-variant text-xs font-semibold">
                      No se encontraron reportes históricos en este período.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((report) => (
                    <tr key={report.id} className="hover:bg-surface-container-low/10 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-primary">
                        Horas Extras — {getMonthName(report.mes)} {report.año}
                      </td>
                      <td className="py-3.5 px-3 text-center text-on-surface-variant font-semibold">
                        {report.sentDate}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-on-surface">{report.totalHours} horas</td>
                      <td className="py-3.5 px-3 select-none">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${getBadgeClass(report.status)}`}>
                          <span className="material-symbols-outlined text-[12px] font-bold leading-none">{getStatusIcon(report.status)}</span>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button 
                          onClick={() => handleOpenDetails(report)}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl font-bold text-[10px] transition-colors"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Card Footer */}
        {!loading && filteredRecords.length > 0 && (
          <div className="p-4 border-t border-outline-variant/60 flex flex-col sm:flex-row gap-3 justify-between items-center bg-surface-container-lowest select-none">
            <span className="text-xs text-on-surface-variant font-medium">
              Mostrando {Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredRecords.length, currentPage * itemsPerPage)} de {filteredRecords.length} resultados
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-outline-variant rounded-lg hover:bg-surface-container-low disabled:opacity-40 text-xs font-semibold transition-colors"
              >
                Anterior
              </button>
              
              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNumber = index + 1;
                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      currentPage === pageNumber 
                        ? 'bg-primary text-on-primary shadow-sm' 
                        : 'border border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-outline-variant rounded-lg hover:bg-surface-container-low disabled:opacity-40 text-xs font-semibold transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details / Correction Overlay Modal Popup */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-custom-fade-in font-sans">
          {/* Backdrop */}
          <div 
            onClick={() => setSelectedReport(null)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40 transition-opacity"
          ></div>

          {/* Modal Panel content */}
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl max-w-4xl w-full p-6 shadow-2xl animate-custom-scale-up select-none flex flex-col max-h-[85vh] z-50">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40">
              <div>
                <span className="text-[10px] font-bold text-[#006492] uppercase tracking-wider">Reporte Histórico</span>
                <h3 className="text-base font-bold text-primary">
                  Horas Extras — {getMonthName(selectedReport.mes)} {selectedReport.año}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Modal Body Info Block */}
            <div className="grid grid-cols-2 gap-4 py-4 border-b border-outline-variant/30 text-xs select-none">
              <div>
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Institución Educativa</span>
                <span className="font-bold text-primary">{selectedReport.iedName}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Rector</span>
                <span className="font-semibold text-on-surface">{selectedReport.rectorName}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Fecha Envío</span>
                <span className="font-medium text-on-surface">{selectedReport.sentDate}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Estado</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase mt-1 ${getBadgeClass(selectedReport.status)}`}>
                  {selectedReport.status}
                </span>
              </div>
            </div>

            {/* Stored Observation Details if observed */}
            {selectedReport.observation && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 text-xs text-red-800 my-4 select-text">
                <span className="font-bold block mb-1">Observaciones de Auditoría de Nómina:</span>
                <p className="leading-relaxed">{selectedReport.observation}</p>
              </div>
            )}

            {/* Modal Tabs Selection */}
            <div className="flex border-b border-outline-variant/30 text-xs font-semibold select-none">
              <button
                onClick={() => setModalTab('docente')}
                className={`px-4 py-2 border-b-2 transition-all ${modalTab === 'docente' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant'}`}
              >
                Personal Docente
              </button>
              <button
                onClick={() => setModalTab('administrativo')}
                className={`px-4 py-2 border-b-2 transition-all ${modalTab === 'administrativo' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant'}`}
              >
                Personal Administrativo
              </button>
            </div>

            {/* Modal Content / Tables */}
            <div className="flex-1 overflow-y-auto mt-4 min-h-[200px]">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center h-full p-8 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  <span className="text-xs text-on-surface-variant font-semibold">Cargando desglose...</span>
                </div>
              ) : modalTab === 'docente' ? (
                modalDocentes.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">No se reportaron horas docentes.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-container-low/55 border-b border-outline-variant/60 uppercase tracking-wider text-[9px] font-bold text-on-surface-variant">
                      <tr>
                        <th className="py-2 px-3">Cédula</th>
                        <th className="py-2 px-3">Docente</th>
                        <th className="py-2 px-3">Cargo</th>
                        <th className="py-2 px-2 text-center">Residuo</th>
                        <th className="py-2 px-2 text-center">Sustitución</th>
                        <th className="py-2 px-2 text-center">Jornada U.</th>
                        <th className="py-2 px-2 text-center">Adultos</th>
                        <th className="py-2 px-3 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                      {modalDocentes.map((det) => (
                        <tr key={det.id} className="hover:bg-surface-container-low/10">
                          <td className="py-2 px-3 font-mono font-semibold">{det.cedula}</td>
                          <td className="py-2 px-3 font-bold text-primary">{det.nombres} {det.apellidos}</td>
                          <td className="py-2 px-3 text-on-surface-variant font-medium">{det.cargo} {det.grado_escalafon ? `(Esc. ${det.grado_escalafon})` : ''}</td>
                          <td className="py-2 px-2 text-center">{det.residuo}</td>
                          <td className="py-2 px-2 text-center">{det.sustitucion}</td>
                          <td className="py-2 px-2 text-center">{det.jornada_unica}</td>
                          <td className="py-2 px-2 text-center">{det.adultos}</td>
                          <td className="py-2 px-3 text-center font-bold text-primary">
                            {det.residuo + det.sustitucion + det.jornada_unica + det.adultos}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                modalAdministrativos.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">No se reportaron horas administrativas.</div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-container-low/55 border-b border-outline-variant/60 uppercase tracking-wider text-[9px] font-bold text-on-surface-variant">
                      <tr>
                        <th className="py-2 px-3">Cédula</th>
                        <th className="py-2 px-3">Funcionario</th>
                        <th className="py-2 px-3">Cargo</th>
                        <th className="py-2 px-2 text-center">Dom. Diu</th>
                        <th className="py-2 px-2 text-center">Dom. Noc</th>
                        <th className="py-2 px-2 text-center">Fest. Diu</th>
                        <th className="py-2 px-2 text-center">Fest. Noc</th>
                        <th className="py-2 px-2 text-center">Recargo Noc</th>
                        <th className="py-2 px-3 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 text-on-surface">
                      {modalAdministrativos.map((det) => (
                        <tr key={det.id} className="hover:bg-surface-container-low/10">
                          <td className="py-2 px-3 font-mono font-semibold">{det.cedula}</td>
                          <td className="py-2 px-3 font-bold text-primary">{det.nombres} {det.apellidos}</td>
                          <td className="py-2 px-3 text-on-surface-variant font-medium">{det.cargo}</td>
                          <td className="py-2 px-2 text-center">{det.dom_diurno}</td>
                          <td className="py-2 px-2 text-center">{det.dom_nocturno}</td>
                          <td className="py-2 px-2 text-center">{det.fest_diurno}</td>
                          <td className="py-2 px-2 text-center">{det.fest_nocturno}</td>
                          <td className="py-2 px-2 text-center">{det.recargo_nocturno}</td>
                          <td className="py-2 px-3 text-center font-bold text-primary">
                            {det.dom_diurno + det.dom_nocturno + det.fest_diurno + det.fest_nocturno + det.recargo_nocturno}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>

            {/* Modal Footer / Correct actions if observed */}
            <div className="p-4 border-t border-outline-variant/40 flex justify-end bg-surface-container-lowest select-none gap-2">
              <button 
                onClick={() => setSelectedReport(null)}
                className="px-5 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cerrar Ventana
              </button>
              {selectedReport.status === 'observado' && (
                <button 
                  onClick={() => {
                    setSelectedReport(null);
                    // Redirigir a Cargar Novedades para corregir
                    navigate('/formulario');
                  }}
                  className="px-5 py-2 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">edit_document</span>
                  Corregir en Formulario
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
