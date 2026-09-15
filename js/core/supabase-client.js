// ═════════════════════════════════════════════════════════════════
// supabase-client.js
//
// Punto único de conexión a Supabase para toda la app web.
//
// Qué hace este archivo:
//   • Crea una sola instancia del cliente de Supabase, usando las
//     mismas credenciales (URL + anon key) que ya usa la app Flutter
//     en main.dart, y la expone como export nombrado.
//   • Cualquier módulo que necesite hablar con Supabase (auth, feed,
//     chat, marketplace, admin, etc.) importa `supabaseClient` desde
//     aquí en vez de crear su propia instancia — así toda la app
//     comparte la misma sesión activa y el mismo caché interno del
//     SDK, evitando llamadas de login duplicadas o sesiones
//     desincronizadas entre módulos.
//
// Requisito: el SDK de Supabase (@supabase/supabase-js) debe estar
// cargado ANTES de este script, vía CDN en index.html:
//
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//
// Ese script expone la función global `supabase.createClient(...)`,
// que es lo único que se usa aquí para construir el cliente.
// ═════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://dlrhbxhrnznrhnvryzcl.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscmhieGhybnpucmhudnJ5emNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzU0NTMsImV4cCI6MjA5NzMxMTQ1M30' +
  '.3PI8GpF0JCs78RC5ehnnb59Pr5YDNPFYEoAastslv-8';

// `detectSessionInUrl: true` es lo que permite que, cuando el
// usuario abre el enlace de recuperación de contraseña que Supabase
// envía por correo, el propio SDK detecte el token en la URL y
// dispare el evento 'PASSWORD_RECOVERY' automáticamente — sin esto,
// recuperar-contrasena.js tendría que parsear el hash de la URL a
// mano (ver ese archivo para el listener correspondiente).
export const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);