import { supabase } from './supabase';

export interface PersonalRecord {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  tipo: 'docente' | 'administrativo';
  grado_escalafon: string | null;
  ied_id: string | null;
  activo: boolean;
  ied?: {
    nombre: string;
  } | null;
}

export const personalService = {
  // Obtener lista de personal (filtrable por tipo)
  async getPersonal(tipo?: 'docente' | 'administrativo'): Promise<PersonalRecord[]> {
    let query = supabase
      .from('personal')
      .select(`
        id,
        cedula,
        nombres,
        apellidos,
        cargo,
        tipo,
        grado_escalafon,
        ied_id,
        activo,
        ied:ieds(nombre)
      `);

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    // Ordenar alfabéticamente
    query = query.order('apellidos', { ascending: true });

    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener personal:', error.message);
      throw error;
    }

    return (data || []) as unknown as PersonalRecord[];
  },

  // Obtener lista de personal paginado y filtrado en servidor
  async getPersonalPaged(
    tipo: 'docente' | 'administrativo',
    search: string,
    page: number,
    pageSize: number
  ): Promise<{ data: PersonalRecord[]; count: number }> {
    let query = supabase
      .from('personal')
      .select(`
        id,
        cedula,
        nombres,
        apellidos,
        cargo,
        tipo,
        grado_escalafon,
        ied_id,
        activo,
        ied:ieds(nombre)
      `, { count: 'exact' });

    query = query.eq('tipo', tipo);

    if (search.trim()) {
      const q = `%${search.trim().toUpperCase()}%`;
      query = query.or(`cedula.ilike.${q},nombres.ilike.${q},apellidos.ilike.${q},cargo.ilike.${q}`);
    }

    query = query.order('apellidos', { ascending: true });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      console.error('Error al obtener personal paginado:', error.message);
      throw error;
    }

    return {
      data: (data || []) as unknown as PersonalRecord[],
      count: count || 0
    };
  },

  // Crear un registro de personal
  async createPersonal(record: Omit<PersonalRecord, 'id' | 'ied'>): Promise<PersonalRecord> {
    const { data, error } = await supabase
      .from('personal')
      .insert({
        cedula: record.cedula.trim().toUpperCase(),
        nombres: record.nombres.trim().toUpperCase(),
        apellidos: record.apellidos.trim().toUpperCase(),
        cargo: record.cargo.trim(),
        tipo: record.tipo,
        grado_escalafon: record.tipo === 'docente' ? record.grado_escalafon?.trim().toUpperCase() || null : null,
        ied_id: record.ied_id || null,
        activo: record.activo ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear personal:', error.message);
      throw error;
    }

    return data as PersonalRecord;
  },

  // Actualizar un registro de personal
  async updatePersonal(id: string, record: Partial<Omit<PersonalRecord, 'id' | 'ied'>>): Promise<PersonalRecord> {
    const updateData: any = {};
    
    if (record.cedula !== undefined) updateData.cedula = record.cedula.trim().toUpperCase();
    if (record.nombres !== undefined) updateData.nombres = record.nombres.trim().toUpperCase();
    if (record.apellidos !== undefined) updateData.apellidos = record.apellidos.trim().toUpperCase();
    if (record.cargo !== undefined) updateData.cargo = record.cargo.trim();
    if (record.tipo !== undefined) updateData.tipo = record.tipo;
    if (record.grado_escalafon !== undefined) {
      updateData.grado_escalafon = record.tipo === 'docente' ? record.grado_escalafon?.trim().toUpperCase() || null : null;
    }
    if (record.ied_id !== undefined) updateData.ied_id = record.ied_id || null;
    if (record.activo !== undefined) updateData.activo = record.activo;

    const { data, error } = await supabase
      .from('personal')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar personal:', error.message);
      throw error;
    }

    return data as PersonalRecord;
  },

  // Función para procesar y cargar masivamente desde un archivo CSV
  async importPersonalCsv(csvContent: string, tipo: 'docente' | 'administrativo'): Promise<{ successCount: number; errorCount: number }> {
    const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
      throw new Error('El archivo CSV está vacío o no contiene filas de datos.');
    }

    // Identificar delimitador (, o ;)
    const header = lines[0];
    const separator = header.includes(';') ? ';' : ',';
    const cols = header.split(separator).map(c => c.trim().toLowerCase());

    const cedulaIdx = cols.findIndex(c => c.includes('cedula') || c.includes('cédula'));
    const nombreIdx = cols.findIndex(c => c.includes('nombre') || c.includes('completo'));
    const cargoIdx = cols.findIndex(c => c.includes('cargo'));
    const gradoIdx = cols.findIndex(c => c.includes('grado') || c.includes('escalafon') || c.includes('escalafón'));

    if (cedulaIdx === -1 || nombreIdx === -1 || cargoIdx === -1) {
      throw new Error('El archivo CSV debe contener al menos las columnas: "cedula", "nombre_completo" y "cargo".');
    }

    const recordsToUpsert: any[] = [];
    
    // Función auxiliar para dividir nombres y apellidos
    const splitName = (fullName: string) => {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length <= 1) {
        return { nombres: fullName, apellidos: '' };
      }
      if (parts.length === 2) {
        return { nombres: parts[1], apellidos: parts[0] };
      }
      const apellidos = parts.slice(0, 2).join(' ');
      const nombres = parts.slice(2).join(' ');
      return { nombres, apellidos };
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Manejar valores con comillas opcionales
      const parts = line.split(separator).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length < Math.max(cedulaIdx, nombreIdx, cargoIdx) + 1) {
        continue;
      }

      const cedula = parts[cedulaIdx].replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      if (!cedula) continue;

      const nombreCompleto = parts[nombreIdx];
      const { nombres, apellidos } = splitName(nombreCompleto);

      const cargo = parts[cargoIdx];
      const grado = gradoIdx !== -1 && parts[gradoIdx] ? parts[gradoIdx].toUpperCase() : null;

      recordsToUpsert.push({
        cedula,
        nombres: nombres.toUpperCase(),
        apellidos: apellidos.toUpperCase(),
        cargo,
        tipo,
        grado_escalafon: tipo === 'docente' ? grado : null,
        ied_id: null,
        activo: true
      });
    }

    if (recordsToUpsert.length === 0) {
      throw new Error('No se encontraron registros válidos para importar.');
    }

    // Realizar upsert por lotes de 400 registros para evitar sobrecargar la base
    const batchSize = 400;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recordsToUpsert.length; i += batchSize) {
      const batch = recordsToUpsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('personal')
        .upsert(batch, { onConflict: 'cedula' });

      if (error) {
        console.error('Error al insertar lote en personal:', error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
      }
    }

    return { successCount, errorCount };
  }
};
