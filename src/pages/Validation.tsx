import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAlert } from '../contexts/AlertContext';

interface ReportRecord {
  id: string; // Report database UUID
  iedId: string;
  iedName: string;
  mes: number;
  año: number;
  creado_en: string;
  estado: 'pendiente' | 'aprobado' | 'observado';
  observacion?: string;
  total_horas: number;
  exportado: boolean;
  excede_tope: boolean;
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

export const Validation: React.FC = () => {
  const { showAlert } = useAlert();

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [iedList, setIedList] = useState<{ id: string; name: string }[]>([]);

  // Filter states (initialized with current month for convenience)
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [filterIed, setFilterIed] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentMonthStr);
  const [filterStatus, setFilterStatus] = useState('');

  // Active filters applied state
  const [appliedFilters, setAppliedFilters] = useState({
    ied: '',
    month: currentMonthStr,
    status: ''
  });

  // Modal detail states
  const [selectedReport, setSelectedReport] = useState<ReportRecord | null>(null);
  const [reportDetails, setReportDetails] = useState<DetailRecord[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [modalTab, setModalTab] = useState<'docente' | 'administrativo'>('docente');

  // Inline observation inputs (keyed by report ID)
  const [obsInputs, setObsInputs] = useState<Record<string, string>>({});
  const [expandedObsRow, setExpandedObsRow] = useState<string | null>(null);
  
  // Custom observation modal states
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [obsReportId, setObsReportId] = useState<string | null>(null);
  const [obsText, setObsText] = useState('');

  useEffect(() => {
    if (isObsModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isObsModalOpen]);

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

  const loadReports = async () => {
    setLoading(true);
    try {
      // 1. Fetch reports
      const { data: reportsData, error: errRep } = await supabase
        .from('reportes_horas_extras')
        .select(`
          id,
          mes,
          año,
          estado,
          observacion,
          exportado,
          excede_tope,
          creado_en,
          ieds (id, nombre)
        `)
        .order('creado_en', { ascending: false });
      
      if (errRep) throw errRep;

      // 2. Fetch details to sum hours per report
      const { data: detailsData, error: errDet } = await supabase
        .from('detalle_reporte')
        .select('reporte_id, residuo, sustitucion, jornada_unica, adultos, dom_diurno, dom_nocturno, fest_diurno, fest_nocturno, recargo_nocturno');
      
      if (errDet) throw errDet;

      // Map total hours to each report
      const hoursMap: Record<string, number> = {};
      (detailsData || []).forEach((d: any) => {
        const sum = (d.residuo || 0) + (d.sustitucion || 0) + (d.jornada_unica || 0) + (d.adultos || 0) +
                    (d.dom_diurno || 0) + (d.dom_nocturno || 0) + (d.fest_diurno || 0) + (d.fest_nocturno || 0) +
                    (d.recargo_nocturno || 0);
        hoursMap[d.reporte_id] = (hoursMap[d.reporte_id] || 0) + sum;
      });

      const mapped: ReportRecord[] = (reportsData || []).map((r: any) => ({
        id: r.id,
        iedId: r.ieds?.id || '',
        iedName: r.ieds?.nombre || 'IED Desconocida',
        mes: r.mes,
        año: r.año,
        creado_en: new Date(r.creado_en).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }),
        estado: r.estado as 'pendiente' | 'aprobado' | 'observado',
        observacion: r.observacion || undefined,
        total_horas: hoursMap[r.id] || 0,
        exportado: r.exportado || false,
        excede_tope: r.excede_tope || false
      }));

      setReports(mapped);

      // Load distinct IED list for filters
      const uniqueIeds: { id: string; name: string }[] = [];
      const seenIds = new Set<string>();
      mapped.forEach(m => {
        if (m.iedId && !seenIds.has(m.iedId)) {
          seenIds.add(m.iedId);
          uniqueIeds.push({ id: m.iedId, name: m.iedName });
        }
      });
      setIedList(uniqueIeds);

    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Cargar', 'No se pudieron cargar los reportes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

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

  const handleOpenDetails = (report: ReportRecord) => {
    setSelectedReport(report);
    loadReportDetails(report.id);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      ied: filterIed,
      month: filterMonth,
      status: filterStatus
    });
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilterIed('');
    setFilterMonth('');
    setFilterStatus('');
    setAppliedFilters({
      ied: '',
      month: '',
      status: ''
    });
    setCurrentPage(1);
  };

  const handleApprove = async (reportId: string) => {
    showAlert('warning', 'Aprobar Reporte', '¿Está seguro de aprobar este reporte de novedades mensuales de horas extras?', async () => {
      try {
        const { error } = await supabase
          .from('reportes_horas_extras')
          .update({ estado: 'aprobado', observacion: null })
          .eq('id', reportId);

        if (error) throw error;

        showAlert('success', 'Reporte Aprobado', 'El reporte ha sido aprobado con éxito.');
        await loadReports();
        setSelectedReport(null);
      } catch (err: any) {
        showAlert('error', 'Error', 'No se pudo aprobar el reporte: ' + err.message);
      }
    }, true);
  };

  const handleSendObservation = async (reportId: string) => {
    const text = obsInputs[reportId]?.trim();
    if (!text) {
      showAlert('warning', 'Validación', 'Por favor, ingrese un comentario u observación antes de enviar.');
      return;
    }

    try {
      const { error } = await supabase
        .from('reportes_horas_extras')
        .update({ estado: 'observado', observacion: text })
        .eq('id', reportId);

      if (error) throw error;

      showAlert('success', 'Observación Enviada', 'El reporte ha sido observado y notificado al rector.');
      setExpandedObsRow(null);
      await loadReports();
      setSelectedReport(null);
    } catch (err: any) {
      showAlert('error', 'Error', 'No se pudo registrar la observación: ' + err.message);
    }
  };

  const handleSendObsDirect = async () => {
    if (!obsReportId) return;
    const text = obsText.trim();
    if (!text) {
      showAlert('warning', 'Validación', 'Por favor, ingrese un comentario u observación antes de enviar.');
      return;
    }

    try {
      const { error } = await supabase
        .from('reportes_horas_extras')
        .update({ estado: 'observado', observacion: text })
        .eq('id', obsReportId);

      if (error) throw error;

      showAlert('success', 'Observación Enviada', 'El reporte ha sido observado y notificado al rector.');
      setIsObsModalOpen(false);
      setSelectedReport(null);
      await loadReports();
    } catch (err: any) {
      showAlert('error', 'Error', 'No se pudo registrar la observación: ' + err.message);
    }
  };

  const handleExportConsolidadoGeneral = async (forceReexport: boolean = false) => {
    // 1. Validar que filterMonth (Mes de reporte) no esté vacío
    if (!appliedFilters.month) {
      showAlert('warning', 'Período Requerido', 'Por favor, aplique el filtro de Mes de Reporte antes de generar la exportación consolidada masiva.');
      return;
    }

    const [yearStr, monthStr] = appliedFilters.month.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    setExporting(true);
    try {
      // 2. Ejecutar la RPC atómica en Supabase
      const { data, error } = await supabase.rpc('exportar_consolidado_mensual_v2', {
        p_mes: month,
        p_anio: year,
        p_incluir_ya_exportados: forceReexport
      });

      if (error) {
        // Controlar mensaje de exclusión por defecto
        if (error.message.includes('No se encontraron reportes aprobados')) {
          if (!forceReexport) {
            showAlert(
              'warning',
              'Re-exportar Período',
              'No se encontraron reportes aprobados pendientes de enviar a nómina para este mes. ¿Desea descargar nuevamente el consolidado con los reportes ya exportados anteriormente?',
              () => {
                handleExportConsolidadoGeneral(true); // Forzar re-exportación
              },
              true
            );
          } else {
            showAlert('info', 'Sin Datos', 'No hay ningún reporte aprobado para consolidar en el período seleccionado.');
          }
          return;
        }
        throw error;
      }

      // 3. Filtrar localmente en base a filtros activos del frontend (IED/Institución)
      let finalRows = data || [];
      if (appliedFilters.ied) {
        const targetIed = iedList.find(i => i.id === appliedFilters.ied);
        if (targetIed) {
          finalRows = finalRows.filter((r: any) => r.centrocosto === targetIed.name);
        }
      }

      if (finalRows.length === 0) {
        showAlert('info', 'Sin Datos', 'No se encontraron registros aprobados para exportar con la combinación de filtros aplicada.');
        return;
      }

      // 4. Traducir a formato plano CSV
      const header = 'CODEMPLEADO,CODCONCEPTO,FECHAOCURRENCIA,FECHALIQUIDACION,VALOR,CENTROCOSTO\n';
      const rows = finalRows.map((row: any) => 
        `${row.codempleado},${row.codconcepto},${row.fechaocurrencia},${row.fechaliquidacion},${row.valor},${row.centrocosto}`
      ).join('\n');

      const csvContent = header + rows;

      // 5. Descarga del archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `consolidado_nomina_masivo_${month}_${year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showAlert('success', 'Exportación Masiva Exitosa', `Consolidado de nómina generado correctamente. Se procesaron los reportes del período ${getMonthName(month)} ${year}.`);
      await loadReports(); // Recargar para ver los badges actualizados
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Consolidar', 'Ocurrió un error durante la generación del consolidado: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Filtrado de reportes en memoria
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (appliedFilters.ied && report.iedId !== appliedFilters.ied) {
        return false;
      }
      if (appliedFilters.status && report.estado !== appliedFilters.status) {
        return false;
      }
      if (appliedFilters.month) {
        const [year, month] = appliedFilters.month.split('-');
        if (report.año !== parseInt(year) || report.mes !== parseInt(month)) {
          return false;
        }
      }
      return true;
    });
  }, [reports, appliedFilters]);

  // Paginación
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredReports, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));

  const getBadgeClass = (status: ReportRecord['estado']) => {
    switch (status) {
      case 'aprobado':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'observado':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'pendiente':
      default:
        return 'bg-blue-100 text-blue-900 border border-blue-200';
    }
  };

  // Separar detalles del modal
  const modalDocentes = reportDetails.filter(d => d.tipo === 'docente');
  const modalAdministrativos = reportDetails.filter(d => d.tipo === 'administrativo');

  return (
    <div className="flex flex-col gap-6 animate-fadeIn font-sans pb-12">
      
      {/* Description Header */}
      <div>
        <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed">
          Revise, audite y dictamine los reportes de horas extras reportados por los directivos de las Instituciones Educativas Departamentales (IED).
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-primary mb-4 flex items-center gap-1.5 select-none">
          <span className="material-symbols-outlined text-[#006492]" style={{ fontSize: '18px' }}>filter_alt</span>
          Filtros de Búsqueda
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* IED Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Institución Educativa (IED)
            </label>
            <select 
              value={filterIed}
              onChange={(e) => setFilterIed(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="">Todas las Instituciones</option>
              {iedList.map(ied => (
                <option key={ied.id} value={ied.id}>{ied.name}</option>
              ))}
            </select>
          </div>

          {/* Month Input */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Mes de Reporte
            </label>
            <input 
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-primary"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">
              Estado del Reporte
            </label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="">Todos los Estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="observado">Observado</option>
              <option value="aprobado">Aprobado</option>
            </select>
          </div>
        </div>

        {/* Filter & Export Buttons */}
        <div className="mt-5 flex flex-wrap justify-between items-center border-t border-outline-variant/40 pt-4 select-none gap-3">
          {/* Masive Export button */}
          <button 
            type="button"
            disabled={exporting}
            onClick={() => handleExportConsolidadoGeneral(false)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-55 rounded-xl font-semibold text-xs transition-all shadow-sm active:scale-[0.98] flex items-center gap-1.5"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generando Consolidado...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] font-bold">download</span>
                <span>Exportar Consolidado General</span>
              </>
            )}
          </button>

          <div className="flex gap-2">
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
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Table Records Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-sm">
        
        {/* Table View */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              <span className="text-xs text-on-surface-variant font-medium">Cargando novedades reportadas...</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-surface-container-low/60 border-b border-outline-variant/80 select-none text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                <tr>
                  <th className="py-3 px-4 font-bold text-left">Institución (IED)</th>
                  <th className="py-3 px-3 text-center">Período</th>
                  <th className="py-3 px-3 text-center">Fecha Envío</th>
                  <th className="py-3 px-3 text-center">Total Horas</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-outline-variant/40 text-xs text-on-surface">
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-on-surface-variant text-xs font-semibold">
                      No se encontraron reportes con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => {
                    const isObsExpanded = expandedObsRow === report.id;
                    return (
                      <React.Fragment key={report.id}>
                        {/* Main Data Row */}
                        <tr className="hover:bg-surface-container-low/10 transition-colors group">
                          <td className="py-3.5 px-4 font-bold text-primary">{report.iedName}</td>
                          <td className="py-3.5 px-3 text-center font-semibold text-on-surface-variant">
                            {getMonthName(report.mes)} {report.año}
                          </td>
                          <td className="py-3.5 px-3 text-center text-on-surface-variant font-medium">{report.creado_en}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-on-surface">{report.total_horas}</td>
                          <td className="py-3.5 px-3 select-none">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${getBadgeClass(report.estado)}`}>
                                {report.estado}
                              </span>
                              {report.exportado && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-full text-[8.5px] font-bold uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                                  Enviado a Nómina
                                </span>
                              )}
                              {report.excede_tope && (
                                <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 bg-rose-100 border border-rose-200 text-rose-800 rounded-full text-[8.5px] font-bold uppercase tracking-wider animate-pulse">
                                  <span className="material-symbols-outlined text-[10px] font-bold">warning</span>
                                  Excede Tope
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right select-none">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ver detalle */}
                              <button
                                onClick={() => handleOpenDetails(report)}
                                className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary rounded-lg font-bold text-[10px] transition-colors"
                                title="Ver Detalle"
                              >
                                Ver Detalle
                              </button>

                              {/* Approve */}
                              {report.estado !== 'aprobado' && (
                                <button 
                                  onClick={() => handleApprove(report.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-outline-variant/40" 
                                  title="Aprobar Reporte"
                                >
                                  <span className="material-symbols-outlined font-bold text-[16px]">check</span>
                                </button>
                              )}
                              
                              {/* Observe toggler */}
                              {report.estado !== 'aprobado' && (
                                <button 
                                  onClick={() => setExpandedObsRow(isObsExpanded ? null : report.id)}
                                  className={`p-1.5 rounded-lg transition-colors border border-outline-variant/40 ${isObsExpanded ? 'bg-amber-100 text-amber-700' : 'text-amber-600 hover:bg-amber-50'}`} 
                                  title="Observar con Comentarios"
                                >
                                  <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline Observation Form */}
                        {isObsExpanded && (
                          <tr className="bg-surface-container-low/20">
                            <td className="p-4 border-l-2 border-l-amber-500" colSpan={6}>
                              <div className="flex flex-col gap-2 max-w-2xl animate-fadeIn">
                                <label className="block text-[11px] font-bold text-on-surface-variant">
                                  Observación Técnica Obligatoria (se requiere para devolver al Rector)
                                </label>
                                <div className="flex gap-2 items-end">
                                  <textarea 
                                    value={obsInputs[report.id] || ''}
                                    onChange={(e) => setObsInputs({ ...obsInputs, [report.id]: e.target.value })}
                                    className="w-full bg-surface border border-outline-variant rounded-xl p-2.5 text-xs focus:outline-none focus:border-primary outline-none resize-none" 
                                    placeholder="Describa el motivo de la observación para que el rector realice los cambios..." 
                                    rows={2}
                                  />
                                  <button 
                                    onClick={() => handleSendObservation(report.id)}
                                    className="bg-primary hover:bg-[#002f6c] text-white rounded-xl px-4 py-2 font-bold text-xs whitespace-nowrap transition-colors shadow-sm self-stretch flex items-center justify-center"
                                  >
                                    Enviar Observación
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Display existing observation */}
                        {report.observacion && !isObsExpanded && (
                          <tr className="bg-amber-50/20">
                            <td className="p-2" colSpan={6}>
                              <div className="text-xs text-amber-800 bg-amber-50/70 border border-amber-100 rounded-lg p-2 flex items-start gap-2 mx-4">
                                <span className="material-symbols-outlined text-amber-600 text-sm">info</span>
                                <div className="flex-1">
                                  <span className="font-bold block mb-0.5">Observación enviada:</span>
                                  <span className="italic">{report.observacion}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Card Footer */}
        {!loading && filteredReports.length > 0 && (
          <div className="p-4 border-t border-outline-variant/60 flex flex-col sm:flex-row gap-3 justify-between items-center bg-surface-container-lowest select-none">
            <span className="text-xs text-on-surface-variant font-medium">
              Mostrando {Math.min(filteredReports.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredReports.length, currentPage * itemsPerPage)} de {filteredReports.length} registros
            </span>
            <div className="flex gap-1">
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

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-custom-fade-in font-sans">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl max-w-4xl w-full p-6 shadow-2xl animate-custom-scale-up select-none flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40">
              <div>
                <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined">analytics</span>
                  Detalle del Reporte de Horas Extras
                </h3>
                <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                  {selectedReport.iedName} • Período: {getMonthName(selectedReport.mes)} {selectedReport.año}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedReport(null)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            {/* Modal Tabs Selection */}
            <div className="flex border-b border-outline-variant/30 mt-4 text-xs font-semibold">
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
            <div className="flex-1 overflow-y-auto mt-4 min-h-[250px]">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center h-full p-12 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  <span className="text-xs text-on-surface-variant font-semibold">Cargando desglose...</span>
                </div>
              ) : modalTab === 'docente' ? (
                /* Tab Docentes Table */
                modalDocentes.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">No hay horas reportadas para docentes en este reporte.</div>
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
                /* Tab Administrativos Table */
                modalAdministrativos.length === 0 ? (
                  <div className="p-8 text-center text-xs text-on-surface-variant">No hay horas reportadas para administrativos en este reporte.</div>
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

            {/* Modal Footer / Audit Decisions */}
            <div className="flex justify-end items-center pt-4 border-t border-outline-variant/40 mt-4 select-none gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cerrar Detalle
              </button>
              {selectedReport.estado !== 'aprobado' && (
                <>
                  <button
                    onClick={() => {
                      setObsReportId(selectedReport.id);
                      setObsText('');
                      setIsObsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-xs transition-colors active:scale-[0.98]"
                  >
                    Observar
                  </button>
                  <button
                    onClick={() => handleApprove(selectedReport.id)}
                    className="px-4 py-2 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-colors active:scale-[0.98]"
                  >
                    Aprobar Reporte
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Custom Technical Observation Modal */}
      {isObsModalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60] animate-custom-fade-in font-sans">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-custom-scale-up select-none">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-4">
              <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500">feedback</span>
                Registrar Observación Técnica
              </h3>
              <button 
                type="button" 
                onClick={() => setIsObsModalOpen(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Por favor, describa detalladamente el motivo de la observación. El rector de la institución educativa recibirá esta retroalimentación para corregir y volver a enviar el reporte.
              </p>
              
              <textarea
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                placeholder="Ej: Se observa un exceso de horas extras reportadas en el personal de docentes para el rubro de Residuo. Favor verificar y corregir..."
                rows={4}
                autoFocus
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface resize-none placeholder:text-outline/40 font-medium"
              />
              
              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant/40 mt-6">
                <button
                  type="button"
                  onClick={() => setIsObsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendObsDirect}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-xs transition-colors active:scale-[0.98]"
                >
                  Enviar Observación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
