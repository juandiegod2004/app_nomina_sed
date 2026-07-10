const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function insertProfile(authId) {
  const { data: existingProfile, error: profileCheckError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_id', authId)
    .maybeSingle();

  if (profileCheckError) {
    console.error('Error verificando perfil:', profileCheckError.message);
    return;
  }

  if (existingProfile) {
    console.log('El perfil del administrador de nómina ya existe en la base de datos.');
    return;
  }

  console.log('Insertando perfil en base de datos public.usuarios...');
  const { error: dbError } = await supabase
    .from('usuarios')
    .insert({
      auth_id: authId,
      cedula: '1234567890',
      nombre: 'Administrador de Nómina',
      correo_institucional: 'nomina@sedmagdalena.gov.co',
      rol: 'admin_nomina',
      activo: true,
      requiere_cambio_clave: false
    });

  if (dbError) {
    console.error('Error insertando perfil en public.usuarios:', dbError.message);
  } else {
    console.log('Perfil de administrador de nómina local creado con éxito.');
  }
}

async function run() {
  console.log('Registrando administrador de nómina local...');
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'nomina@sedmagdalena.gov.co',
    password: 'AdminMagdalena2026*',
    email_confirm: true,
    user_metadata: { role: 'admin_nomina' }
  });

  if (error) {
    if (error.message.includes('already exists') || error.message.includes('registered')) {
      console.log('El usuario administrador ya está registrado localmente en auth. Obteniendo perfil...');
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listando usuarios:', listError.message);
        return;
      }
      const existingUser = listData.users.find(u => u.email === 'nomina@sedmagdalena.gov.co');
      if (existingUser) {
        await insertProfile(existingUser.id);
      } else {
        console.error('No se pudo encontrar el usuario en la lista de auth.');
      }
    } else {
      console.error('Error creando el administrador en auth:', error.message);
    }
  } else if (data && data.user) {
    await insertProfile(data.user.id);
  }
}

run();
