import { createClient } from '@supabase/supabase-js';

// Usar variables de entorno de Vite sin exponer credenciales críticas en el repositorio
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan las variables de entorno de Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'Por favor, configure su archivo .env basándose en .env.example'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
