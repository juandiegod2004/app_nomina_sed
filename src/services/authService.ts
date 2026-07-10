import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  auth_id: string;
  cedula: string;
  nombre: string;
  correo_institucional: string;
  rol: 'rector' | 'admin_nomina';
  ied_id: string | null;
  activo: boolean;
  requiere_cambio_clave: boolean;
}

export const authService = {
  /**
   * Realiza el inicio de sesión validando el dominio del correo institucional.
   * Acepta tanto el prefijo del correo como el correo institucional completo.
   */
  async login(username: string, password: string) {
    const trimmedUser = username.trim().toLowerCase();
    
    let email = trimmedUser;
    if (!email.includes('@')) {
      email = `${trimmedUser}@sedmagdalena.gov.co`;
    } else if (!email.endsWith('@sedmagdalena.gov.co')) {
      throw new Error('Acceso denegado: Solo se permiten correos institucionales de @sedmagdalena.gov.co');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('No se pudo establecer la sesión del usuario.');
    }

    // Cargar perfil público para obtener roles y estado activo
    const profile = await this.getCurrentProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('El usuario de autenticación existe, pero no tiene perfil asociado en la base de datos de nómina.');
    }

    if (!profile.activo) {
      await supabase.auth.signOut();
      throw new Error('El usuario ha sido desactivado. Por favor, comuníquese con el área de Servicios Informáticos o con el administrador.');
    }

    return { session: data.session, user: data.user, profile };
  },

  /**
   * Cierra la sesión del usuario autenticado en Supabase.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  },

  /**
   * Obtiene el perfil del usuario actual desde la tabla 'public.usuarios'
   * filtrando por el identificador único de autenticación de Supabase (auth_id).
   */
  async getCurrentProfile(authId?: string): Promise<UserProfile | null> {
    let targetAuthId = authId;
    
    if (!targetAuthId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      targetAuthId = user.id;
    }

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', targetAuthId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando el perfil del usuario:', error.message);
      return null;
    }

    return data as UserProfile;
  },

  /**
   * Obtiene la sesión actual almacenada de Supabase Auth
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  },

  /**
   * Actualiza la contraseña en Supabase Auth y desmarca el flag de cambio obligatorio
   * de contraseña en la tabla pública de usuarios.
   */
  async restablecerPassword(newPassword: string): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (authError) {
      console.error('Error al actualizar contraseña en Supabase Auth:', authError.message);
      throw authError;
    }

    if (!user) {
      throw new Error('Sesión inválida al intentar actualizar la contraseña.');
    }

    const { data, error: dbError } = await supabase
      .from('usuarios')
      .update({ requiere_cambio_clave: false })
      .eq('auth_id', user.id)
      .select();

    if (dbError) {
      console.error('Error al actualizar flag requiere_cambio_clave en DB:', dbError.message);
      throw dbError;
    }

    if (!data || data.length === 0) {
      throw new Error('No se pudo actualizar el estado de tu cuenta en la base de datos (0 filas modificadas). Es posible que falten permisos o políticas RLS en la tabla.');
    }
  }
};
