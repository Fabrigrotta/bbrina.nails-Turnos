/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — supabase.js
   Conexión a Supabase + funciones CRUD de reservas
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   CONFIGURACIÓN · Pegá acá tus credenciales de Supabase
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://mkzsraiflmhdecwbdslz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wpew9F3E6G2f24Yvw9a1zQ_uDe_IicY';

/* ───────────────────────────────────────────────────────────
   CLIENTE
   ─────────────────────────────────────────────────────────── */
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ───────────────────────────────────────────────────────────
   FUNCIONES CRUD
   ─────────────────────────────────────────────────────────── */

/* Devuelve TODAS las reservas (array).
   Uso: const reservas = await getReservasSB(); */
async function getReservasSB() {
  const { data, error } = await supabaseClient
    .from('reservas')
    .select('*')
    .order('fecha', { ascending: true });

  if (error) {
    console.error('[Supabase] Error al leer reservas:', error);
    return [];
  }

  return data || [];
}

/* Guarda una reserva nueva (o reemplaza si ya existe el código).
   Uso: await guardarReservaSB({ codigo, servicio, fecha, ... }); */
async function guardarReservaSB(reserva) {
  const { data, error } = await supabaseClient
    .from('reservas')
    .upsert({
      codigo: reserva.codigo,
      servicio: reserva.servicio,
      fecha: reserva.fecha,
      horario: reserva.horario,
      nombre: reserva.nombre,
      whatsapp: reserva.whatsapp,
      nota: reserva.nota || null,
      sena_monto: reserva.sena_monto || null,
      sena_comprobante_url: reserva.sena_comprobante_url || null
    }, { onConflict: 'codigo' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error al guardar reserva:', error);
    return null;
  }

  return data;
}

/* Actualiza una reserva existente por código.
   Uso: await actualizarReservaSB('123456', { nombre: 'Nuevo', ... }); */
async function actualizarReservaSB(codigo, cambios) {
  const { data, error } = await supabaseClient
    .from('reservas')
    .update(cambios)
    .eq('codigo', codigo)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error al actualizar reserva:', error);
    return null;
  }

  return data;
}

/* Borra una reserva por código.
   Uso: await borrarReservaSB('123456'); */
async function borrarReservaSB(codigo) {
  const { error } = await supabaseClient
    .from('reservas')
    .delete()
    .eq('codigo', codigo);

  if (error) {
    console.error('[Supabase] Error al borrar reserva:', error);
    return false;
  }

  return true;
}

/* Borra TODAS las reservas.
   Uso: await borrarTodasLasReservasSB(); */
async function borrarTodasLasReservasSB() {
  // Supabase requiere un WHERE para DELETE, pero con esto borra todo:
  const { error } = await supabaseClient
    .from('reservas')
    .delete()
    .neq('codigo', '');

  if (error) {
    console.error('[Supabase] Error al borrar todas:', error);
    return false;
  }

  return true;
}

/* Busca reservas por whatsapp + código (para "Consultar turno").
   Uso: const encontradas = await buscarReservasSB('3415922559', '123456'); */
async function buscarReservasSB(whatsapp, codigo) {
  const telNorm = (whatsapp || '').replace(/\D/g, '');
  const codNorm = (codigo || '').replace(/\D/g, '').padStart(6, '0');

  // Traemos todas y filtramos en JS (más simple que pelear con la query)
  const todas = await getReservasSB();

  return todas.filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    const rTel = (r.whatsapp || '').replace(/\D/g, '');
    return rCod === codNorm && rTel === telNorm;
  });
}

/* Sube un comprobante al Storage y devuelve la URL pública.
   Uso: const url = await subirComprobanteSB(file); */
async function subirComprobanteSB(file) {
  if (!file) return null;

  // Generar nombre único: timestamp + nombre original sanitizado
  const timestamp = Date.now();
  const nombreLimpio = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const path = `${timestamp}_${nombreLimpio}`;

  const { data, error } = await supabaseClient
    .storage
    .from('comprobantes')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('[Supabase] Error al subir comprobante:', error);
    return null;
  }

  // Obtener URL pública
  const { data: urlData } = supabaseClient
    .storage
    .from('comprobantes')
    .getPublicUrl(data.path);

  return urlData?.publicUrl || null;
}

/* ───────────────────────────────────────────────────────────
   BLOQUEOS DE HORARIOS
   ─────────────────────────────────────────────────────────── */

/* Devuelve todos los bloqueos.
   Uso: const bloqueos = await getBloqueosSB(); */
async function getBloqueosSB() {
  const { data, error } = await supabaseClient
    .from('bloqueos')
    .select('*')
    .order('fecha', { ascending: true });

  if (error) {
    console.error('[Supabase] Error al leer bloqueos:', error);
    return [];
  }

  return data || [];
}

/* Crea un bloqueo nuevo.
   Uso: await crearBloqueoSB({ fecha, horarios, tipo, nota }); */
async function crearBloqueoSB(bloqueo) {
  const { data, error } = await supabaseClient
    .from('bloqueos')
    .insert({
      fecha: bloqueo.fecha,
      horarios: bloqueo.horarios || [],
      tipo: bloqueo.tipo || 'parcial',
      nota: bloqueo.nota || null
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error al crear bloqueo:', error);
    return null;
  }

  return data;
}

/* Actualiza un bloqueo por id.
   Uso: await actualizarBloqueoSB(1, { horarios: [...], tipo: 'completo' }); */
async function actualizarBloqueoSB(id, cambios) {
  const { data, error } = await supabaseClient
    .from('bloqueos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error al actualizar bloqueo:', error);
    return null;
  }

  return data;
}

/* Borra un bloqueo por id.
   Uso: await borrarBloqueoSB(1); */
async function borrarBloqueoSB(id) {
  const { error } = await supabaseClient
    .from('bloqueos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error al borrar bloqueo:', error);
    return false;
  }

  return true;
}

/* Borra TODOS los bloqueos.
   Uso: await borrarTodosLosBloqueosSB(); */
async function borrarTodosLosBloqueosSB() {
  const { error } = await supabaseClient
    .from('bloqueos')
    .delete()
    .neq('id', 0);

  if (error) {
    console.error('[Supabase] Error al borrar todos los bloqueos:', error);
    return false;
  }

  return true;
}

/* ───────────────────────────────────────────────────────────
   EXPONER AL SCOPE GLOBAL
   ─────────────────────────────────────────────────────────── */
window.SB = {
  // Reservas
  getReservas: getReservasSB,
  guardarReserva: guardarReservaSB,
  actualizarReserva: actualizarReservaSB,
  borrarReserva: borrarReservaSB,
  borrarTodasLasReservas: borrarTodasLasReservasSB,
  buscarReservas: buscarReservasSB,

  // Comprobantes
  subirComprobante: subirComprobanteSB,

  // Bloqueos
  getBloqueos: getBloqueosSB,
  crearBloqueo: crearBloqueoSB,
  actualizarBloqueo: actualizarBloqueoSB,
  borrarBloqueo: borrarBloqueoSB,
  borrarTodosLosBloqueos: borrarTodosLosBloqueosSB
};