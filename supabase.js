/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — supabase.js
   Conexión a Supabase + funciones CRUD de reservas
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   CONFIGURACIÓN · Credenciales de Supabase
   ─────────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://mkzsraiflmhdecwbdslz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wpew9F3E6G2f24Yvw9a1zQ_uDe_IicY';

/* ───────────────────────────────────────────────────────────
   CLIENTE
   ─────────────────────────────────────────────────────────── */
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ───────────────────────────────────────────────────────────
   FUNCIONES CRUD · RESERVAS
   ─────────────────────────────────────────────────────────── */

/* Devuelve TODAS las reservas (array). */
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

/* Guarda una reserva nueva (o reemplaza si ya existe el código). */
async function guardarReservaSB(reserva) {
  const { data, error } = await supabaseClient
    .from('reservas')
    .upsert({
      codigo: reserva.codigo,
      servicio: reserva.servicio,
      zona: reserva.zona || null,
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

/* Actualiza una reserva existente por código. */
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

/* Borra una reserva por código. */
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

/* Borra TODAS las reservas. */
async function borrarTodasLasReservasSB() {
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

/* Busca reservas por whatsapp + código. */
async function buscarReservasSB(whatsapp, codigo) {
  const telNorm = (whatsapp || '').replace(/\D/g, '');
  const codNorm = (codigo || '').replace(/\D/g, '').padStart(6, '0');

  const todas = await getReservasSB();

  return todas.filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    const rTel = (r.whatsapp || '').replace(/\D/g, '');
    return rCod === codNorm && rTel === telNorm;
  });
}

/* ───────────────────────────────────────────────────────────
   COMPROBANTES · Storage
   ─────────────────────────────────────────────────────────── */

/* Sube un comprobante al Storage y devuelve la URL pública. */
async function subirComprobanteSB(file) {
  if (!file) return null;

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

  const { data: urlData } = supabaseClient
    .storage
    .from('comprobantes')
    .getPublicUrl(data.path);

  return urlData?.publicUrl || null;
}

/* ───────────────────────────────────────────────────────────
   BLOQUEOS DE HORARIOS
   ─────────────────────────────────────────────────────────── */

/* Devuelve todos los bloqueos. */
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

/* Crea un bloqueo nuevo. */
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

/* Actualiza un bloqueo por id. */
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

/* Borra un bloqueo por id. */
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

/* Borra TODOS los bloqueos. */
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