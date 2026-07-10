import { supabase } from './supabase';

export interface ReportHeader {
  id: string;
  radicado: string;
  ied_id: string;
  ied_nombre?: string;
  rector_id: string;
  rector_nombre?: string;
  mes: number;
  año: number;
  estado: 'pendiente' | 'aprobado' | 'observado';
  observacion?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface ReportDetail {
  id?: string;
  personal_id: string;
  personal_cedula?: string;
  personal_nombres?: string;
  personal_apellidos?: string;
  personal_cargo?: string;
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

export interface ConsolidatedRecord {
  cedula: string;
  codigo_concepto: string;
  fecha_ocurrencia: string;
  fecha_liquidacion: string;
  valor: number;
  centro_costo: string;
}

export const reportService = {
  /**
   * Obtiene la lista de reportes de horas extras con filtros aplicables.
   * Por políticas RLS, los rectores solo podrán ver los reportes de su IED,
   * mientras que los administradores de nómina verán todos los registros.
   */
  async getReports(filters?: {
    iedId?: string;
    mes?: number;
    año?: number;
    estado?: string;
    search?: string;
  }): Promise<ReportHeader[]> {
    let query = supabase
      .from('reportes_horas_extras')
      .select(`
        id,
        radicado,
        ied_id,
        rector_id,
        mes,
        año,
        estado,
        observacion,
        creado_en,
        actualizado_en,
        ieds (
          nombre
        ),
        usuarios (
          nombre
        )
      `);

    if (filters?.iedId) {
      query = query.eq('ied_id', filters.iedId);
    }
    if (filters?.mes) {
      query = query.eq('mes', filters.mes);
    }
    if (filters?.año) {
      query = query.eq('año', filters.año);
    }
    if (filters?.estado) {
      query = query.eq('estado', filters.estado.toLowerCase());
    }

    const { data, error } = await query.order('creado_en', { ascending: false });

    if (error) {
      console.error('Error al obtener reportes:', error.message);
      throw error;
    }

    let records: ReportHeader[] = (data || []).map((row: any) => ({
      id: row.id,
      radicado: row.radicado || 'Pendiente radicación',
      ied_id: row.ied_id,
      ied_nombre: row.ieds?.nombre,
      rector_id: row.rector_id,
      rector_nombre: row.usuarios?.nombre,
      mes: row.mes,
      año: row.año,
      estado: row.estado as ReportHeader['estado'],
      observacion: row.observacion,
      creado_en: row.creado_en,
      actualizado_en: row.actualizado_en,
    }));

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase().trim();
      records = records.filter(r => 
        r.radicado.toLowerCase().includes(searchLower) ||
        (r.ied_nombre && r.ied_nombre.toLowerCase().includes(searchLower)) ||
        (r.rector_nombre && r.rector_nombre.toLowerCase().includes(searchLower))
      );
    }

    return records;
  },

  /**
   * Obtiene los detalles de un reporte específico, incluyendo la información de cédula y nombres de cada docente.
   */
  async getReportDetails(reportId: string): Promise<ReportDetail[]> {
    const { data, error } = await supabase
      .from('detalle_reporte')
      .select(`
        id,
        personal_id,
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
          cargo
        )
      `)
      .eq('reporte_id', reportId);

    if (error) {
      console.error('Error al obtener detalles del reporte:', error.message);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      personal_id: row.personal_id,
      personal_cedula: row.personal?.cedula,
      personal_nombres: row.personal?.nombres,
      personal_apellidos: row.personal?.apellidos,
      personal_cargo: row.personal?.cargo,
      residuo: row.residuo,
      sustitucion: row.sustitucion,
      jornada_unica: row.jornada_unica,
      adultos: row.adultos,
      dom_diurno: row.dom_diurno,
      dom_nocturno: row.dom_nocturno,
      fest_diurno: row.fest_diurno,
      fest_nocturno: row.fest_nocturno,
      recargo_nocturno: row.recargo_nocturno,
    }));
  },

  /**
   * Envía un reporte mensual completo junto con sus detalles en una transacción.
   */
  async enviarReporteMensual(
    iedId: string,
    rectorId: string,
    mes: number,
    año: number,
    detalles: Omit<ReportDetail, 'personal_cedula' | 'personal_nombres' | 'personal_apellidos' | 'personal_cargo'>[]
  ): Promise<string> {
    // 1. Crear cabecera del reporte
    const { data: header, error: headerError } = await supabase
      .from('reportes_horas_extras')
      .insert({
        ied_id: iedId,
        rector_id: rectorId,
        mes,
        año,
        estado: 'pendiente'
      })
      .select('id')
      .single();

    if (headerError) {
      console.error('Error al crear cabecera del reporte:', headerError.message);
      throw headerError;
    }

    const reportId = header.id;

    // 2. Mapear y preparar detalles
    const detailsToInsert = detalles.map(d => ({
      reporte_id: reportId,
      personal_id: d.personal_id,
      residuo: d.residuo,
      sustitucion: d.sustitucion,
      jornada_unica: d.jornada_unica,
      adultos: d.adultos,
      dom_diurno: d.dom_diurno,
      dom_nocturno: d.dom_nocturno,
      fest_diurno: d.fest_diurno,
      fest_nocturno: d.fest_nocturno,
      recargo_nocturno: d.recargo_nocturno,
    }));

    // 3. Insertar detalles
    const { error: detailsError } = await supabase
      .from('detalle_reporte')
      .insert(detailsToInsert);

    if (detailsError) {
      console.error('Error al insertar detalles (haciendo rollback manual de cabecera):', detailsError.message);
      await supabase.from('reportes_horas_extras').delete().eq('id', reportId);
      throw detailsError;
    }

    return reportId;
  },

  /**
   * Cambia el estado de un reporte de horas extras (Aprobar u Observar)
   * Reservado para administradores de nómina.
   */
  async validarReporte(
    reportId: string,
    estado: 'aprobado' | 'observado',
    observacion?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('reportes_horas_extras')
      .update({
        estado,
        observacion: observacion || null
      })
      .eq('id', reportId);

    if (error) {
      console.error('Error al validar reporte:', error.message);
      throw error;
    }
  },

  /**
   * Permite re-enviar un reporte que fue observado.
   * Cambia el estado de vuelta a 'pendiente' y elimina/actualiza observaciones previas.
   */
  async subsanarReporte(
    reportId: string,
    detallesActualizados: ReportDetail[]
  ): Promise<void> {
    // 1. Actualizar el estado del reporte de vuelta a 'pendiente'
    const { error: updateHeaderError } = await supabase
      .from('reportes_horas_extras')
      .update({
        estado: 'pendiente',
        observacion: null
      })
      .eq('id', reportId);

    if (updateHeaderError) {
      console.error('Error al reiniciar estado del reporte:', updateHeaderError.message);
      throw updateHeaderError;
    }

    // 2. Actualizar los detalles
    for (const d of detallesActualizados) {
      if (!d.id) continue;
      const { error: updateDetailError } = await supabase
        .from('detalle_reporte')
        .update({
          residuo: d.residuo,
          sustitucion: d.sustitucion,
          jornada_unica: d.jornada_unica,
          adultos: d.adultos,
          dom_diurno: d.dom_diurno,
          dom_nocturno: d.dom_nocturno,
          fest_diurno: d.fest_diurno,
          fest_nocturno: d.fest_nocturno,
          recargo_nocturno: d.recargo_nocturno,
        })
        .eq('id', d.id);

      if (updateDetailError) {
        console.error(`Error al actualizar detalle ${d.id}:`, updateDetailError.message);
        throw updateDetailError;
      }
    }
  },

  /**
   * Llama a la RPC 'exportar_consolidado_mensual' para recuperar el consolidado de horas extras aprobado
   * listo para nómina.
   */
  async exportarConsolidadoMensual(
    mes: number,
    año: number
  ): Promise<ConsolidatedRecord[]> {
    const { data, error } = await supabase.rpc('exportar_consolidado_mensual', {
      p_mes: mes,
      p_año: año
    });

    if (error) {
      console.error('Error al exportar consolidado de nómina:', error.message);
      throw error;
    }

    return (data || []) as ConsolidatedRecord[];
  }
};
