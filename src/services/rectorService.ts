import { supabase } from './supabase';

export interface RectorRecord {
  id: string;
  auth_id: string;
  cedula: string;
  nombre: string;
  correo_institucional: string;
  rol: 'rector';
  ied_id: string;
  ied_nombre?: string;
  activo: boolean;
}

export interface IedOption {
  id: string; // Código DANE (12 dígitos)
  nombre: string;
  residuo?: number;
  necesidades_docentes?: number;
  jornada_unica?: number;
  adultos?: number;
  total_he?: number;
  dias_autorizados: number | null;
}

export const rectorService = {
  /**
   * Obtiene todos los usuarios con rol 'rector', incluyendo el nombre de su IED asignada.
   * Reservado para administradores de nómina.
   */
  async getRectors(): Promise<RectorRecord[]> {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        auth_id,
        cedula,
        nombre,
        correo_institucional,
        rol,
        ied_id,
        activo,
        ieds (
          nombre
        )
      `)
      .eq('rol', 'rector');

    if (error) {
      console.error('Error al listar los rectores:', error.message);
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      auth_id: row.auth_id,
      cedula: row.cedula,
      nombre: row.nombre,
      correo_institucional: row.correo_institucional,
      rol: row.rol,
      ied_id: row.ied_id,
      ied_nombre: row.ieds?.nombre || 'No asignada',
      activo: row.activo,
    }));
  },

  /**
   * Registra un nuevo directivo de manera automática desde el frontend.
   * Utiliza un cliente secundario temporal de Supabase sin persistencia de sesión 
   * para evitar desloguear al administrador activo.
   */
  async crearRector(
    cedula: string,
    nombre: string,
    correoPrefix: string,
    contrasenaInicial: string,
    iedId: string
  ): Promise<void> {
    const fullEmail = `${correoPrefix.trim().toLowerCase()}@sedmagdalena.gov.co`;
    
    // 1. Inicializar cliente temporal sin persistencia de sesión
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    
    const tempClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // 2. Registrar el usuario en auth.users
    const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
      email: fullEmail,
      password: contrasenaInicial
    });

    if (signUpError) {
      console.error('Error al registrar usuario en Supabase Auth:', signUpError.message);
      throw new Error(`Error en el registro del correo: ${signUpError.message}`);
    }

    if (!signUpData.user) {
      throw new Error('No se pudo obtener el ID único de autenticación del rector.');
    }

    // 3. Insertar el perfil en public.usuarios usando el cliente del administrador autenticado
    const { error: dbError } = await supabase
      .from('usuarios')
      .insert({
        auth_id: signUpData.user.id,
        cedula: cedula.trim(),
        nombre: nombre.trim(),
        correo_institucional: fullEmail,
        rol: 'rector',
        ied_id: iedId,
        activo: true,
        requiere_cambio_clave: true // Obligación de cambio de clave en primer ingreso
      });

    if (dbError) {
      // Intentar limpiar en auth si falla el insert
      console.error('Error al insertar perfil de rector (limpiando registro en auth):', dbError.message);
      throw dbError;
    }
  },

  /**
   * Actualiza el perfil del rector.
   * Modificar el rol o la IED desencadenará automáticamente el trigger de sincronización de claims del JWT.
   */
  async updateRector(
    id: string,
    updates: { nombre?: string; ied_id?: string; activo?: boolean }
  ): Promise<void> {
    const { error } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar rector:', error.message);
      throw error;
    }
  },

  /**
   * Obtiene la lista completa de IEDs asociadas para mostrar en listas desplegables y gestión.
   */
  async getIeds(): Promise<IedOption[]> {
    const { data, error } = await supabase
      .from('ieds')
      .select('id, nombre, residuo, necesidades_docentes, jornada_unica, adultos, total_he, dias_autorizados')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al consultar IEDs:', error.message);
      throw error;
    }

    return (data || []) as IedOption[];
  },

  /**
   * Actualiza los días autorizados de una IED.
   */
  async updateIedDiasAutorizados(iedId: string, dias: number | null): Promise<void> {
    const { error } = await supabase
      .from('ieds')
      .update({ dias_autorizados: dias })
      .eq('id', iedId);

    if (error) {
      console.error('Error al actualizar días autorizados:', error.message);
      throw error;
    }
  }
};
