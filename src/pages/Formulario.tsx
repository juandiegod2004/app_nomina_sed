import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { reportService } from '../services/reportService';
import type { ReportDetail, ReportHeader } from '../services/reportService';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../contexts/AlertContext';
import { enmascararNombre } from '../utils/mask';

interface Teacher {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  tipo: 'docente' | 'administrativo';
  grado_escalafon: string;
}

export const Formulario: React.FC = () => {
  const { profile } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Period Form states
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  
  // Existing report for this period
  const [existingReport, setExistingReport] = useState<ReportHeader | null>(null);

  // Baseline topes for the IED
  const [iedTopesBase, setIedTopesBase] = useState<{
    residuo: number;
    necesidades_docentes: number;
    jornada_unica: number;
    adultos: number;
    nombre: string;
    dias_autorizados: number | null;
  } | null>(null);

  // Matrix of hour inputs: Key is teacher ID, value is ReportDetail columns
  const [hoursMatrix, setHoursMatrix] = useState<Record<string, Omit<ReportDetail, 'personal_id'>>>({});

  // Modal states for adding teacher/admin
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [teacherCedula, setTeacherCedula] = useState('');
  const [teacherNombres, setTeacherNombres] = useState('');
  const [teacherApellidos, setTeacherApellidos] = useState('');
  const [teacherCargo, setTeacherCargo] = useState('');
  const [teacherTipo, setTeacherTipo] = useState<'docente' | 'administrativo'>('docente');
  const [teacherGrado, setTeacherGrado] = useState('');
  const [teacherSubmitting, setTeacherSubmitting] = useState(false);
  const [docenteFound, setDocenteFound] = useState<boolean | null>(null);
  const [docenteSearching, setDocenteSearching] = useState(false);
  const [searchedDocenteId, setSearchedDocenteId] = useState<string | null>(null);

  // Dynamic prorated topes using authorized days of resolution (dias_autorizados)
  const prorratedTopes = useMemo(() => {
    if (!iedTopesBase) return null;
    if (iedTopesBase.dias_autorizados === null || iedTopesBase.dias_autorizados === undefined) {
      return null;
    }
    const dias = iedTopesBase.dias_autorizados;
    return {
      residuo: Math.round(((iedTopesBase.residuo / 5) * dias) * 100) / 100,
      necesidades_docentes: Math.round(((iedTopesBase.necesidades_docentes / 5) * dias) * 100) / 100,
      jornada_unica: Math.round(((iedTopesBase.jornada_unica / 5) * dias) * 100) / 100,
      adultos: Math.round(((iedTopesBase.adultos / 5) * dias) * 100) / 100
    };
  }, [iedTopesBase]);

  // Real-time sum of each column
  const currentSums = useMemo(() => {
    let residuo = 0;
    let necesidades = 0; // sustitucion
    let jornadaUnica = 0;
    let adultos = 0;

    teachers.forEach(t => {
      const h = hoursMatrix[t.id];
      if (h) {
        if (t.tipo === 'docente') {
          residuo += h.residuo || 0;
          necesidades += h.sustitucion || 0;
          jornadaUnica += h.jornada_unica || 0;
          adultos += h.adultos || 0;
        }
      }
    });

    return { residuo, necesidades, jornadaUnica, adultos };
  }, [hoursMatrix, teachers]);

  const checkExceeds = useMemo(() => {
    if (!prorratedTopes) {
      return { residuo_necesidades: false, jornadaUnica: false, adultos: false };
    }
    const sumDocentes = currentSums.residuo + currentSums.necesidades;
    const limitDocentes = prorratedTopes.residuo + prorratedTopes.necesidades_docentes;
    
    // Imprimir en consola para depuración técnica solicitada (solo en desarrollo)
    if (import.meta.env.DEV) {
      console.log('--- VALIDACIÓN DE TOPES EN TIEMPO REAL ---');
      console.log('Días autorizados por resolución:', iedTopesBase?.dias_autorizados);
      console.log('Tope Residuo Base:', iedTopesBase?.residuo, '-> Prorrateado:', prorratedTopes.residuo);
      console.log('Tope Necesidades Docentes Base:', iedTopesBase?.necesidades_docentes, '-> Prorrateado:', prorratedTopes.necesidades_docentes);
      console.log('Tope Combinado Docentes (Residuo + Sustitución):', limitDocentes);
      console.log('Suma Reportada Docentes (Residuo + Sustitución):', sumDocentes);
      console.log('Tope Adultos Base:', iedTopesBase?.adultos, '-> Prorrateado:', prorratedTopes.adultos);
      console.log('Suma Reportada Adultos:', currentSums.adultos);
      console.log('Tope Jornada Única Base:', iedTopesBase?.jornada_unica, '-> Prorrateado:', prorratedTopes.jornada_unica);
      console.log('Suma Reportada Jornada Única:', currentSums.jornadaUnica);
      console.log('Excede Límite Docentes Combinado:', sumDocentes > limitDocentes);
      console.log('Excede Límite Adultos:', currentSums.adultos > prorratedTopes.adultos);
      console.log('Excede Límite Jornada Única:', currentSums.jornadaUnica > prorratedTopes.jornada_unica);
    }
    
    return {
      residuo_necesidades: sumDocentes > limitDocentes,
      jornadaUnica: currentSums.jornadaUnica > prorratedTopes.jornada_unica,
      adultos: currentSums.adultos > prorratedTopes.adultos
    };
  }, [currentSums, prorratedTopes, iedTopesBase]);

  const loadTeachers = async () => {
    if (!profile?.ied_id) return;
    setLoading(true);
    try {
      // 1. Consultar si ya existe un reporte para esta IED en este mes y año
      const { data: reportsData, error: errReport } = await supabase
        .from('reportes_horas_extras')
        .select('*')
        .eq('ied_id', profile.ied_id)
        .eq('mes', selectedMonth)
        .eq('año', selectedYear);

      if (errReport) throw errReport;

      const reportHeader = reportsData && reportsData.length > 0 ? (reportsData[0] as ReportHeader) : null;
      setExistingReport(reportHeader);

      let savedDetails: any[] = [];
      if (reportHeader) {
        // Consultar los detalles cargados del reporte existente
        const { data: detailsData, error: errDetails } = await supabase
          .from('detalle_reporte')
          .select('*')
          .eq('reporte_id', reportHeader.id);
        
        if (errDetails) throw errDetails;
        savedDetails = detailsData || [];
      }

      // 2. Consultar el personal de la IED asignada más el personal incluido en el reporte
      const personalIdsInReport = savedDetails.map(d => d.personal_id);
      
      let query = supabase.from('personal').select('*');
      if (personalIdsInReport.length > 0) {
        // Carga si: (pertenece a esta IED y está activo) O (ya está en el reporte actual)
        query = query.or(`and(ied_id.eq.${profile.ied_id},activo.eq.true),id.in.(${personalIdsInReport.join(',')})`);
      } else {
        query = query.eq('ied_id', profile.ied_id).eq('activo', true);
      }

      const { data: staffData, error: errStaff } = await query;
      if (errStaff) throw errStaff;

      const teacherList = (staffData || []).map((t: any) => ({
        ...t,
        tipo: t.tipo as 'docente' | 'administrativo'
      }));
      setTeachers(teacherList);

      // 3. Consultar topes base de la IED asignada
      const { data: iedData, error: errIedTopes } = await supabase
        .from('ieds')
        .select('nombre, residuo, necesidades_docentes, jornada_unica, adultos, dias_autorizados')
        .eq('id', profile.ied_id)
        .single();

      if (errIedTopes) {
        console.error('Error al obtener topes de la IED:', errIedTopes.message);
      } else if (iedData) {
        setIedTopesBase({
          nombre: iedData.nombre,
          residuo: parseFloat(iedData.residuo) || 0,
          necesidades_docentes: parseInt(iedData.necesidades_docentes) || 0,
          jornada_unica: parseInt(iedData.jornada_unica) || 0,
          adultos: parseInt(iedData.adultos) || 0,
          dias_autorizados: iedData.dias_autorizados !== null ? parseInt(iedData.dias_autorizados) : null
        });
      }

      // 4. Inicializar o poblar matriz de horas
      const newMatrix: Record<string, Omit<ReportDetail, 'personal_id'>> = {};
      teacherList.forEach((t: Teacher) => {
        const found = savedDetails.find(d => d.personal_id === t.id);
        
        newMatrix[t.id] = found ? {
          id: found.id, // Guardar el ID de detalle para subsanar
          residuo: found.residuo || 0,
          sustitucion: found.sustitucion || 0,
          jornada_unica: found.jornada_unica || 0,
          adultos: found.adultos || 0,
          dom_diurno: found.dom_diurno || 0,
          dom_nocturno: found.dom_nocturno || 0,
          fest_diurno: found.fest_diurno || 0,
          fest_nocturno: found.fest_nocturno || 0,
          recargo_nocturno: found.recargo_nocturno || 0
        } : {
          residuo: 0,
          sustitucion: 0,
          jornada_unica: 0,
          adultos: 0,
          dom_diurno: 0,
          dom_nocturno: 0,
          fest_diurno: 0,
          fest_nocturno: 0,
          recargo_nocturno: 0
        };
      });
      setHoursMatrix(newMatrix);

    } catch (err: any) {
      console.error('Error al cargar nómina:', err.message);
      showAlert('error', 'Error de Carga', 'Error al cargar los datos del período: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, [profile, selectedMonth, selectedYear]);

  useEffect(() => {
    if (teacherTipo !== 'docente') {
      setDocenteFound(null);
      setDocenteSearching(false);
      setSearchedDocenteId(null);
      return;
    }

    const cedulaTrimmed = teacherCedula.trim();
    if (cedulaTrimmed.length < 3) {
      setDocenteFound(null);
      setDocenteSearching(false);
      setSearchedDocenteId(null);
      setTeacherNombres('');
      setTeacherApellidos('');
      setTeacherCargo('');
      setTeacherGrado('');
      return;
    }

    setDocenteSearching(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('personal')
          .select('id, nombres, apellidos, cargo, grado_escalafon')
          .eq('cedula', cedulaTrimmed)
          .eq('tipo', 'docente')
          .maybeSingle();

        if (error) {
          console.error('Error buscando docente:', error.message);
          setDocenteFound(false);
          setDocenteSearching(false);
          setSearchedDocenteId(null);
          return;
        }

        if (data) {
          setDocenteFound(true);
          setSearchedDocenteId(data.id);
          setTeacherNombres(data.nombres);
          setTeacherApellidos(data.apellidos);
          setTeacherCargo(data.cargo);
          setTeacherGrado(data.grado_escalafon || '');
        } else {
          setDocenteFound(false);
          setSearchedDocenteId(null);
          setTeacherNombres('');
          setTeacherApellidos('');
          setTeacherCargo('');
          setTeacherGrado('');
        }
      } catch (err) {
        console.error(err);
        setDocenteFound(false);
        setSearchedDocenteId(null);
      } finally {
        setDocenteSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [teacherCedula, teacherTipo]);

  useEffect(() => {
    if (isAddTeacherModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAddTeacherModalOpen]);

  const handleHourChange = (teacherId: string, concept: keyof Omit<ReportDetail, 'personal_id'>, value: number) => {
    const parsedValue = Math.max(0, isNaN(value) ? 0 : value);
    setHoursMatrix(prev => ({
      ...prev,
      [teacherId]: {
        ...prev[teacherId],
        [concept]: parsedValue
      }
    }));
  };

  const calculateDocenteHours = (id: string): number => {
    const h = hoursMatrix[id];
    if (!h) return 0;
    return (h.residuo || 0) + (h.sustitucion || 0) + (h.jornada_unica || 0) + (h.adultos || 0);
  };

  const calculateAdministrativoHours = (id: string): number => {
    const h = hoursMatrix[id];
    if (!h) return 0;
    return (
      (h.dom_diurno || 0) +
      (h.dom_nocturno || 0) +
      (h.fest_diurno || 0) +
      (h.fest_nocturno || 0) +
      (h.recargo_nocturno || 0)
    );
  };

  const handleDeleteRow = async (teacher: Teacher) => {
    const isApproved = existingReport && existingReport.estado === 'aprobado';
    
    if (isApproved) {
      showAlert('warning', 'Acción No Permitida', 'No se pueden eliminar filas de un reporte aprobado.');
      return;
    }

    const detailId = hoursMatrix[teacher.id]?.id;

    // Si tiene ID en la base de datos (ya está guardado) y el reporte está pendiente u observado
    if (detailId && existingReport && (existingReport.estado === 'pendiente' || existingReport.estado === 'observado')) {
      showAlert(
        'warning',
        'Confirmar Eliminación',
        `¿Seguro que deseas quitar a este funcionario (${enmascararNombre(teacher.nombres)} ${enmascararNombre(teacher.apellidos)}) del reporte de ${getMonthName(selectedMonth)}?`,
        async () => {
          try {
            // Eliminar de detalle_reporte en base de datos
            const { error } = await supabase
              .from('detalle_reporte')
              .delete()
              .eq('id', detailId);

            if (error) throw error;

            // Eliminar de los estados locales
            setTeachers(prev => prev.filter(t => t.id !== teacher.id));
            setHoursMatrix(prev => {
              const copy = { ...prev };
              delete copy[teacher.id];
              return copy;
            });
            
            showAlert('success', 'Eliminado', 'Funcionario removido del reporte.');
          } catch (err: any) {
            console.error(err);
            showAlert('error', 'Error al Eliminar', 'No se pudo eliminar el registro: ' + (err.message || err));
          }
        },
        true
      );
    } else {
      // Si está en borrador local (sin guardar) o no tiene registro en base de datos
      setTeachers(prev => prev.filter(t => t.id !== teacher.id));
      setHoursMatrix(prev => {
        const copy = { ...prev };
        delete copy[teacher.id];
        return copy;
      });
      showAlert('success', 'Eliminado', 'Funcionario removido del reporte.');
    }
  };

  const handleOpenAddDocente = () => {
    setTeacherTipo('docente');
    setTeacherCedula('');
    setTeacherNombres('');
    setTeacherApellidos('');
    setTeacherCargo('');
    setTeacherGrado('');
    setDocenteFound(null);
    setDocenteSearching(false);
    setSearchedDocenteId(null);
    setIsAddTeacherModalOpen(true);
  };

  const handleOpenAddAdministrativo = () => {
    setTeacherTipo('administrativo');
    setTeacherCedula('');
    setTeacherNombres('');
    setTeacherApellidos('');
    setTeacherCargo('');
    setTeacherGrado('');
    setDocenteFound(null);
    setDocenteSearching(false);
    setSearchedDocenteId(null);
    setIsAddTeacherModalOpen(true);
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.ied_id) {
      showAlert('error', 'Sesión Inválida', 'No se ha detectado tu IED asignada.');
      return;
    }

    const cedulaTrimmed = teacherCedula.trim().toUpperCase();
    if (!cedulaTrimmed || !/^[A-Z0-9]{1,10}$/.test(cedulaTrimmed)) {
      showAlert('warning', 'Validación', 'Por favor ingrese una cédula alfanumérica válida (máximo 10 caracteres).');
      return;
    }

    if (teacherTipo === 'docente') {
      if (docenteFound !== true || !searchedDocenteId) {
        showAlert('warning', 'Validación', 'Docente no encontrado en la base de personal — verifica el número de cédula.');
        return;
      }

      // Add docente to the local state so they appear in the grid
      setTeachers(prev => {
        if (prev.some(t => t.id === searchedDocenteId)) return prev;
        return [...prev, {
          id: searchedDocenteId,
          cedula: cedulaTrimmed,
          nombres: teacherNombres.trim(),
          apellidos: teacherApellidos.trim(),
          cargo: teacherCargo.trim(),
          tipo: 'docente',
          grado_escalafon: teacherGrado.trim() || null,
          ied_id: null
        }];
      });

      // Initialize their hour input values in hoursMatrix using the UUID
      setHoursMatrix(prev => ({
        ...prev,
        [searchedDocenteId]: {
          residuo: 0,
          sustitucion: 0,
          jornada_unica: 0,
          adultos: 0,
          dom_diurno: 0,
          dom_nocturno: 0,
          fest_diurno: 0,
          fest_nocturno: 0,
          recargo_nocturno: 0
        }
      }));

      showAlert('success', 'Docente Agregado', 'Docente agregado al reporte de este período.');
      setIsAddTeacherModalOpen(false);
      return;
    }

    // For administrativo personal (standard insert into public.personal and assigned to this IED)
    if (!teacherNombres.trim() || !teacherApellidos.trim() || !teacherCargo.trim()) {
      showAlert('warning', 'Validación', 'Por favor complete todos los campos obligatorios.');
      return;
    }

    setTeacherSubmitting(true);
    try {
      const { error } = await supabase
        .from('personal')
        .insert({
          cedula: cedulaTrimmed,
          nombres: teacherNombres.trim(),
          apellidos: teacherApellidos.trim(),
          cargo: teacherCargo.trim(),
          tipo: 'administrativo',
          grado_escalafon: null,
          ied_id: profile.ied_id
        });

      if (error) throw error;

      showAlert('success', 'Registro Exitoso', 'Personal administrativo registrado exitosamente.');
      setIsAddTeacherModalOpen(false);
      await loadTeachers();
    } catch (err: any) {
      console.error(err);
      showAlert('error', 'Error al Guardar', 'No se pudo registrar el personal: ' + (err.message || err));
    } finally {
      setTeacherSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.ied_id || !profile.id) {
      showAlert('error', 'Sesión Inválida', 'Error de sesión: No se identificó su IED o ID de usuario.');
      return;
    }

    // Bloquear envío si excede los topes prorrateados
    const hasExceeded = checkExceeds.residuo_necesidades || checkExceeds.jornadaUnica || checkExceeds.adultos;
    if (hasExceeded) {
      showAlert('error', 'Límite Excedido', 'No se permite enviar el reporte porque supera los topes mensuales autorizados para su IED. Por favor, ajuste las horas.');
      return;
    }

    // Validar estado del reporte existente
    if (existingReport && existingReport.estado !== 'observado') {
      showAlert('warning', 'Acción Inválida', `Este reporte se encuentra en estado: ${existingReport.estado.toUpperCase()} y no puede ser modificado.`);
      return;
    }

    let totalReportedHours = 0;
    const detalles: any[] = [];

    teachers.forEach(t => {
      const h = hoursMatrix[t.id];
      let totalT = 0;
      
      if (t.tipo === 'docente') {
        totalT = calculateDocenteHours(t.id);
        detalles.push({
          id: h.id, // Pasar el ID del detalle existente si lo hay
          personal_id: t.id,
          residuo: h.residuo,
          sustitucion: h.sustitucion,
          jornada_unica: h.jornada_unica,
          adultos: h.adultos,
          dom_diurno: 0,
          dom_nocturno: 0,
          fest_diurno: 0,
          fest_nocturno: 0,
          recargo_nocturno: 0
        });
      } else {
        totalT = calculateAdministrativoHours(t.id);
        detalles.push({
          id: h.id, // Pasar el ID del detalle existente si lo hay
          personal_id: t.id,
          residuo: 0,
          sustitucion: 0,
          jornada_unica: 0,
          adultos: 0,
          dom_diurno: h.dom_diurno,
          dom_nocturno: h.dom_nocturno,
          fest_diurno: h.fest_diurno,
          fest_nocturno: h.fest_nocturno,
          recargo_nocturno: h.recargo_nocturno
        });
      }
      totalReportedHours += totalT;
    });

    if (totalReportedHours === 0) {
      showAlert('warning', 'Sin Novedades', 'Debe reportar al menos una hora extra para enviar.');
      return;
    }

    const isCorrection = existingReport && existingReport.estado === 'observado';

    showAlert(
      'warning',
      isCorrection ? 'Reenviar Corrección' : 'Confirmar Envío',
      `¿Está seguro de enviar ${isCorrection ? 'las correcciones de' : 'las novedades de'} Horas Extras para el mes de ${getMonthName(selectedMonth)} del ${selectedYear}?`,
      async () => {
        setSending(true);
        try {
          if (isCorrection) {
            // Subsanar reporte existente
            await reportService.subsanarReporte(existingReport.id, detalles);
            showAlert('success', 'Corrección Enviada', 'Las observaciones han sido subsanadas y el reporte ha sido reenviado.', () => {
              navigate('/reports-history');
            });
          } else {
            // Crear nuevo reporte mensual
            await reportService.enviarReporteMensual(
              profile.ied_id!,
              profile.id!,
              selectedMonth,
              selectedYear,
              detalles
            );
            showAlert('success', 'Envío Exitoso', 'Reporte mensual enviado con éxito.', () => {
              navigate('/reports-history');
            });
          }
        } catch (err: any) {
          console.error(err);
          showAlert('error', 'Error de Envío', 'Error al enviar el reporte: ' + (err.message || err));
        } finally {
          setSending(false);
        }
      },
      true
    );
  };

  const getMonthName = (num: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[num - 1] || '';
  };

  const docentes = teachers.filter(t => t.tipo === 'docente');
  const administrativos = teachers.filter(t => t.tipo === 'administrativo');

  // Determinar si los campos deben estar bloqueados
  const isFormLocked = existingReport ? (existingReport.estado === 'aprobado' || existingReport.estado === 'pendiente') : false;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn relative font-sans antialiased pb-12">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl p-6 shadow-md select-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Cargar Novedades Mensuales</h2>
          <p className="text-xs text-primary-fixed opacity-90 leading-relaxed">
            Reporte de forma oficial y con validez administrativa las horas extras trabajadas por su personal docente y administrativo.
          </p>
        </div>
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 text-xs font-semibold shrink-0">
          <span className="block text-[10px] uppercase text-white/70">IED Asignada</span>
          <span className="text-white font-bold">{iedTopesBase?.nombre || (profile?.ied_id ? `DANE: ${profile.ied_id}` : 'No identificada')}</span>
        </div>
      </div>

      {/* Dynamic Prorated Topes Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-5 shadow-sm select-none animate-fadeIn">
        {prorratedTopes ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>info</span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                Topes del Período Prorrateados ({iedTopesBase?.dias_autorizados} días autorizados)
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-on-surface-variant">
              <div className={`p-3 rounded-xl border transition-colors ${checkExceeds.residuo_necesidades ? 'bg-rose-50 border-rose-200' : 'bg-surface border-outline-variant/50'}`}>
                <span className={`block text-[10px] uppercase font-semibold mb-0.5 ${checkExceeds.residuo_necesidades ? 'text-rose-700' : 'text-outline'}`}>Residuo (Compartido)</span>
                <span className={`text-sm font-bold ${checkExceeds.residuo_necesidades ? 'text-rose-900' : 'text-on-surface'}`}>{prorratedTopes.residuo} horas</span>
              </div>
              <div className={`p-3 rounded-xl border transition-colors ${checkExceeds.residuo_necesidades ? 'bg-rose-50 border-rose-200' : 'bg-surface border-outline-variant/50'}`}>
                <span className={`block text-[10px] uppercase font-semibold mb-0.5 ${checkExceeds.residuo_necesidades ? 'text-rose-700' : 'text-outline'}`}>Necesidades Docentes</span>
                <span className={`text-sm font-bold ${checkExceeds.residuo_necesidades ? 'text-rose-900' : 'text-on-surface'}`}>{prorratedTopes.necesidades_docentes} horas</span>
              </div>
              <div className={`p-3 rounded-xl border transition-colors ${checkExceeds.jornadaUnica ? 'bg-rose-50 border-rose-200' : 'bg-surface border-outline-variant/50'}`}>
                <span className={`block text-[10px] uppercase font-semibold mb-0.5 ${checkExceeds.jornadaUnica ? 'text-rose-700' : 'text-outline'}`}>Jornada Única</span>
                <span className={`text-sm font-bold ${checkExceeds.jornadaUnica ? 'text-rose-900' : 'text-on-surface'}`}>{prorratedTopes.jornada_unica} horas</span>
              </div>
              <div className={`p-3 rounded-xl border transition-colors ${checkExceeds.adultos ? 'bg-rose-50 border-rose-200' : 'bg-surface border-outline-variant/50'}`}>
                <span className={`block text-[10px] uppercase font-semibold mb-0.5 ${checkExceeds.adultos ? 'text-rose-700' : 'text-outline'}`}>Adultos</span>
                <span className={`text-sm font-bold ${checkExceeds.adultos ? 'text-rose-900' : 'text-on-surface'}`}>{prorratedTopes.adultos} horas</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <span className="material-symbols-outlined text-amber-500 animate-pulse text-2xl">warning</span>
            <div>
              <h4 className="text-xs font-bold uppercase text-amber-800">Tope pendiente de configurar por el administrador</h4>
              <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">No se aplicará validación ni prorrateo de horas hasta que el administrador de nómina configure los días autorizados por resolución para esta institución.</p>
            </div>
          </div>
        )}
      </div>

      {/* Warning block if any tope is exceeded */}
      {prorratedTopes && (checkExceeds.residuo_necesidades || checkExceeds.jornadaUnica || checkExceeds.adultos) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-2 text-xs md:text-sm text-rose-800 shadow-sm animate-fadeIn">
          <div className="flex gap-2 items-center font-bold">
            <span className="material-symbols-outlined text-rose-600 text-xl leading-none">error</span>
            <span>Error: Límite Excedido (Se requiere corrección)</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 mt-1 font-semibold">
            {checkExceeds.residuo_necesidades && (
              <li>Residuo + Sustitución: {currentSums.residuo + currentSums.necesidades}h reportadas / {prorratedTopes.residuo + prorratedTopes.necesidades_docentes}h autorizadas (compartido) — excede el tope por {Math.round((currentSums.residuo + currentSums.necesidades - (prorratedTopes.residuo + prorratedTopes.necesidades_docentes)) * 100) / 100}h</li>
            )}
            {checkExceeds.jornadaUnica && (
              <li>Jornada Única: {currentSums.jornadaUnica}h reportadas / {prorratedTopes.jornada_unica}h autorizadas — excede el tope por {currentSums.jornadaUnica - prorratedTopes.jornada_unica}h</li>
            )}
            {checkExceeds.adultos && (
              <li>Adultos: {currentSums.adultos}h reportadas / {prorratedTopes.adultos}h autorizadas — excede el tope por {currentSums.adultos - prorratedTopes.adultos}h</li>
            )}
          </ul>
          <p className="text-[10.5px] opacity-90 mt-1 italic font-bold text-rose-700 leading-relaxed">
            * El envío de novedades se encuentra bloqueado debido a que supera los límites permitidos para su IED. Por favor ajuste las horas extras en la planilla para poder enviar.
          </p>
        </div>
      )}

      {/* Observación Banner if observed */}
      {existingReport && existingReport.estado === 'observado' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 text-xs md:text-sm text-amber-800 shadow-sm animate-fadeIn">
          <span className="material-symbols-outlined text-amber-600 select-none text-xl leading-none">feedback</span>
          <div>
            <span className="font-bold block text-sm mb-0.5">Reporte Observado (Requiere Corrección)</span>
            <p className="leading-relaxed mb-2 opacity-90">{existingReport.observacion || 'Sin detalles de observación'}</p>
            <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded font-bold uppercase">Editable para Subsanar</span>
          </div>
        </div>
      )}

      {/* Lock Banner if locked */}
      {existingReport && isFormLocked && (
        <div className={`p-4 rounded-2xl flex gap-3 text-xs md:text-sm shadow-sm animate-fadeIn ${
          existingReport.estado === 'aprobado' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <span className="material-symbols-outlined select-none text-xl leading-none">
            {existingReport.estado === 'aprobado' ? 'verified' : 'pending'}
          </span>
          <div>
            <span className="font-bold block text-sm mb-0.5">
              Reporte {existingReport.estado === 'aprobado' ? 'Aprobado' : 'En Revisión'}
            </span>
            <p className="opacity-95 text-xs">
              {existingReport.estado === 'aprobado' 
                ? 'Este reporte ya fue verificado y aprobado por nómina central. Los campos se encuentran bloqueados.' 
                : 'Este reporte se encuentra en cola de revisión para firma. No se permiten modificaciones en este estado.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Period Panel */}
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 select-none">
        <div>
          <h3 className="text-base font-bold text-primary">Información del Período</h3>
          <p className="text-xs text-on-surface-variant">Seleccione el período de nómina a reportar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Mes</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              disabled={loading || sending}
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Año</label>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={loading || sending}
              className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Submit Form wrapper */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1: PERSONAL DOCENTE */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          <div className="p-5 border-b border-outline-variant/40 bg-surface-container-low/20 flex justify-between items-center select-none">
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined">school</span>
                Personal Docente
              </h3>
              <p className="text-[10px] text-on-surface-variant">Reporte exclusivo de conceptos de aula.</p>
            </div>
            {!loading && !isFormLocked && (
              <button
                type="button"
                onClick={handleOpenAddDocente}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-xs rounded-xl shadow-none transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[15px]">person_add</span>
                Agregar Docente
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                <span className="text-xs text-on-surface-variant font-medium">Cargando docentes...</span>
              </div>
            ) : docentes.length === 0 ? (
              <div className="p-10 text-center select-none flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-outline/40 text-4xl">school</span>
                <p className="text-xs text-on-surface-variant font-medium">No hay docentes registrados en esta institución.</p>
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={handleOpenAddDocente}
                    className="px-4 py-2 border border-primary text-primary hover:bg-primary-container/20 rounded-xl font-bold text-xs transition-colors"
                  >
                    Registrar Docente
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-surface-container-low/40 border-b border-outline-variant/60 select-none text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 font-bold text-left sticky left-0 bg-surface-bright shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-w-[200px]">Docente / Cargo</th>
                    <th className={`py-2.5 px-2 text-center w-24 transition-colors ${checkExceeds.residuo_necesidades ? 'bg-rose-100 text-rose-800 font-bold border-x border-rose-200' : ''}`}>Residuo</th>
                    <th className={`py-2.5 px-2 text-center w-24 transition-colors ${checkExceeds.residuo_necesidades ? 'bg-rose-100 text-rose-800 font-bold border-x border-rose-200' : ''}`}>Sustitución</th>
                    <th className={`py-2.5 px-2 text-center w-24 transition-colors ${checkExceeds.jornadaUnica ? 'bg-rose-100 text-rose-800 font-bold border-x border-rose-200' : ''}`}>Jornada Única</th>
                    <th className={`py-2.5 px-2 text-center w-24 transition-colors ${checkExceeds.adultos ? 'bg-rose-100 text-rose-800 font-bold border-x border-rose-200' : ''}`}>Adultos</th>
                    <th className="py-2.5 px-4 text-center font-bold w-28">Total Horas</th>
                    <th className="py-2.5 px-2 text-center font-bold w-14">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 text-xs text-on-surface">
                  {docentes.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-surface-container-low/10 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-primary sticky left-0 bg-surface-bright shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex flex-col">
                          <span className="font-bold">{enmascararNombre(`${teacher.nombres} ${teacher.apellidos}`)}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono">CC: {teacher.cedula} • {teacher.cargo} {teacher.grado_escalafon ? `(Esc. ${teacher.grado_escalafon})` : ''}</span>
                        </div>
                      </td>
                      
                      {/* Docente Concepts Inputs */}
                      {(['residuo', 'sustitucion', 'jornada_unica', 'adultos'] as const).map((concept) => {
                        const isExceeded = (concept === 'residuo' || concept === 'sustitucion') ? checkExceeds.residuo_necesidades 
                                         : concept === 'jornada_unica' ? checkExceeds.jornadaUnica
                                         : checkExceeds.adultos;
                        return (
                          <td key={concept} className={`py-1 px-1 text-center transition-colors ${isExceeded ? 'bg-rose-50/20' : ''}`}>
                            <input 
                              type="number"
                              min="0"
                              value={hoursMatrix[teacher.id]?.[concept] ?? 0}
                              onChange={(e) => handleHourChange(teacher.id, concept, parseInt(e.target.value))}
                              disabled={sending || isFormLocked}
                              className={`w-16 px-1.5 py-1.5 border rounded-lg text-center font-medium bg-surface focus:outline-none text-xs disabled:bg-surface-container-low disabled:text-outline transition-colors ${
                                isExceeded 
                                  ? 'border-rose-400 focus:border-rose-600 focus:ring-1 focus:ring-rose-200 text-rose-900 bg-rose-50/15 font-bold' 
                                  : 'border-outline-variant focus:border-primary'
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Total Horas */}
                      <td className="py-2.5 px-4 text-center font-bold text-xs text-primary select-none">
                        {calculateDocenteHours(teacher.id)}
                      </td>

                      {/* Acción de Eliminar */}
                      <td className="py-2.5 px-2 text-center select-none">
                        {(!existingReport || existingReport.estado === 'pendiente' || existingReport.estado === 'observado') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(teacher)}
                            className="text-outline hover:text-red-600 transition-colors flex items-center justify-center mx-auto"
                            title="Quitar funcionario del reporte"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* SECTION 2: PERSONAL ADMINISTRATIVO */}
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          <div className="p-5 border-b border-outline-variant/40 bg-surface-container-low/20 flex justify-between items-center select-none">
            <div>
              <h3 className="text-sm font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined">badge</span>
                Personal Administrativo
              </h3>
              <p className="text-[10px] text-on-surface-variant">Reporte exclusivo de recargos y festivos.</p>
            </div>
            {!loading && !isFormLocked && (
              <button
                type="button"
                onClick={handleOpenAddAdministrativo}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-xs rounded-xl shadow-none transition-all duration-200"
              >
                <span className="material-symbols-outlined text-[15px]">person_add</span>
                Agregar Administrativo
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                <span className="text-xs text-on-surface-variant font-medium">Cargando administrativos...</span>
              </div>
            ) : administrativos.length === 0 ? (
              <div className="p-10 text-center select-none flex flex-col items-center gap-3">
                <span className="material-symbols-outlined text-outline/40 text-4xl">badge</span>
                <p className="text-xs text-on-surface-variant font-medium">No hay personal administrativo registrado en esta institución.</p>
                {!isFormLocked && (
                  <button
                    type="button"
                    onClick={handleOpenAddAdministrativo}
                    className="px-4 py-2 border border-primary text-primary hover:bg-primary-container/20 rounded-xl font-bold text-xs transition-colors"
                  >
                    Registrar Administrativo
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-surface-container-low/40 border-b border-outline-variant/60 select-none text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 font-bold text-left sticky left-0 bg-surface-bright shadow-[2px_0_5px_rgba(0,0,0,0.02)] min-w-[200px]">Funcionario / Cargo</th>
                    <th className="py-2.5 px-2 text-center w-24">Dom. Diu</th>
                    <th className="py-2.5 px-2 text-center w-24">Dom. Noc</th>
                    <th className="py-2.5 px-2 text-center w-24">Fest. Diu</th>
                    <th className="py-2.5 px-2 text-center w-24">Fest. Noc</th>
                    <th className="py-2.5 px-2 text-center w-24">Recargo Noc</th>
                    <th className="py-2.5 px-4 text-center font-bold w-28">Total Horas</th>
                    <th className="py-2.5 px-2 text-center font-bold w-14">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30 text-xs text-on-surface">
                  {administrativos.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-surface-container-low/10 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-primary sticky left-0 bg-surface-bright shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div className="flex flex-col">
                          <span className="font-bold">{enmascararNombre(`${teacher.nombres} ${teacher.apellidos}`)}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono">CC: {teacher.cedula} • {teacher.cargo}</span>
                        </div>
                      </td>
                      
                      {/* Admin Concepts Inputs */}
                      {(['dom_diurno', 'dom_nocturno', 'fest_diurno', 'fest_nocturno', 'recargo_nocturno'] as const).map((concept) => (
                        <td key={concept} className="py-1 px-1 text-center">
                          <input 
                            type="number"
                            min="0"
                            value={hoursMatrix[teacher.id]?.[concept] ?? 0}
                            onChange={(e) => handleHourChange(teacher.id, concept, parseInt(e.target.value))}
                            disabled={sending || isFormLocked}
                            className="w-16 px-1.5 py-1.5 border border-outline-variant rounded-lg text-center font-medium bg-surface focus:outline-none focus:border-primary text-xs disabled:bg-surface-container-low disabled:text-outline"
                          />
                        </td>
                      ))}

                      {/* Total Horas */}
                      <td className="py-2.5 px-4 text-center font-bold text-xs text-primary select-none">
                        {calculateAdministrativoHours(teacher.id)}
                      </td>

                      {/* Acción de Eliminar */}
                      <td className="py-2.5 px-2 text-center select-none">
                        {(!existingReport || existingReport.estado === 'pendiente' || existingReport.estado === 'observado') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(teacher)}
                            className="text-outline hover:text-red-600 transition-colors flex items-center justify-center mx-auto"
                            title="Quitar funcionario del reporte"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Global Submit/Action Footer */}
        {!loading && (
          <div className="p-6 bg-surface-container-lowest border border-outline-variant/60 rounded-2xl flex justify-end gap-3 select-none shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <button 
              type="button"
              disabled={sending}
              onClick={() => navigate('/reports-history')}
              className="px-5 py-2.5 border border-primary text-primary rounded-xl font-semibold text-xs transition-colors hover:bg-surface-container-low disabled:opacity-55"
            >
              Ver Historial
            </button>
            {!isFormLocked && (
              <button 
                type="submit"
                disabled={sending || !!(prorratedTopes && (checkExceeds.residuo_necesidades || checkExceeds.jornadaUnica || checkExceeds.adultos))}
                className="px-6 py-2.5 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-65"
              >
                {sending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                    <span>{existingReport && existingReport.estado === 'observado' ? 'Reenviar Reporte Subsanado' : 'Enviar Novedades Mensuales'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </form>

      {/* Add Teacher/Admin Modal Dialog */}
      {isAddTeacherModalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-custom-fade-in font-sans">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-custom-scale-up select-none">
            
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-5">
              <h3 className="text-base font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined">
                  {teacherTipo === 'docente' ? 'school' : 'badge'}
                </span>
                Agregar {teacherTipo === 'docente' ? 'Docente' : 'Administrativo'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAddTeacherModalOpen(false)}
                className="text-outline hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Cedula field */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Cédula</label>
                  <input 
                    type="text" 
                    required
                    value={teacherCedula}
                    onChange={(e) => setTeacherCedula(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10))}
                    disabled={teacherSubmitting}
                    placeholder="Máx 10 caracteres"
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40"
                  />
                  {docenteSearching && (
                    <p className="text-[10px] text-primary/70 mt-1 flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando docente...
                    </p>
                  )}
                  {teacherTipo === 'docente' && docenteFound === false && teacherCedula.trim().length >= 3 && (
                    <p className="text-[10px] text-error font-semibold mt-1 flex items-start gap-1 leading-normal">
                      <span className="material-symbols-outlined text-xs mt-[1px]">warning</span>
                      Docente no encontrado en la base de personal — verifica el número de cédula.
                    </p>
                  )}
                </div>

                {/* Tipo readonly display */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Tipo de Personal</label>
                  <div className="w-full px-3 py-2 border border-outline-variant bg-surface-container rounded-xl text-xs font-bold capitalize select-none text-primary">
                    {teacherTipo}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Nombres field */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Nombres</label>
                  <input 
                    type="text" 
                    required
                    value={teacherTipo === 'docente' ? enmascararNombre(teacherNombres) : teacherNombres}
                    onChange={(e) => setTeacherNombres(e.target.value)}
                    disabled={teacherSubmitting || teacherTipo === 'docente'}
                    readOnly={teacherTipo === 'docente'}
                    placeholder={teacherTipo === 'docente' ? 'Autocompletado' : 'Nombres'}
                    className={`w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40 ${teacherTipo === 'docente' ? 'bg-surface-container/60 text-on-surface/70 select-none' : ''}`}
                  />
                </div>

                {/* Apellidos field */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Apellidos</label>
                  <input 
                    type="text" 
                    required
                    value={teacherTipo === 'docente' ? enmascararNombre(teacherApellidos) : teacherApellidos}
                    onChange={(e) => setTeacherApellidos(e.target.value)}
                    disabled={teacherSubmitting || teacherTipo === 'docente'}
                    readOnly={teacherTipo === 'docente'}
                    placeholder={teacherTipo === 'docente' ? 'Autocompletado' : 'Apellidos'}
                    className={`w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40 ${teacherTipo === 'docente' ? 'bg-surface-container/60 text-on-surface/70 select-none' : ''}`}
                  />
                </div>
              </div>

              {/* Cargo field */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">Cargo</label>
                <input 
                  type="text" 
                  required
                  value={teacherCargo}
                  onChange={(e) => setTeacherCargo(e.target.value)}
                  disabled={teacherSubmitting || teacherTipo === 'docente'}
                  readOnly={teacherTipo === 'docente'}
                  placeholder={teacherTipo === 'docente' ? 'Autocompletado' : 'Ej: Auxiliar Administrativo, Celador'}
                  className={`w-full px-3 py-2 border border-outline-variant rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40 ${teacherTipo === 'docente' ? 'bg-surface-container/60 text-on-surface/70 select-none' : ''}`}
                />
              </div>

              {/* Grado Escalafon - Only for teachers */}
              {teacherTipo === 'docente' && (
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">Grado Escalafón</label>
                  <input 
                    type="text" 
                    value={teacherGrado}
                    onChange={(e) => setTeacherGrado(e.target.value)}
                    disabled={teacherSubmitting || true}
                    readOnly={true}
                    placeholder="Autocompletado"
                    className="w-full px-3 py-2 border border-outline-variant bg-surface-container/60 text-on-surface/70 rounded-xl text-xs focus:outline-none focus:border-primary placeholder:text-outline/40 select-none"
                  />
                </div>
              )}

              {/* Modal Buttons Footer */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-outline-variant/40 mt-6 select-none">
                <button
                  type="button"
                  disabled={teacherSubmitting}
                  onClick={() => setIsAddTeacherModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={teacherSubmitting || docenteSearching || (teacherTipo === 'docente' && docenteFound !== true)}
                  className="px-5 py-2 bg-primary hover:bg-[#002f6c] text-on-primary rounded-xl font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-60 flex items-center gap-1.5"
                >
                  {teacherSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    'Guardar Registro'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
