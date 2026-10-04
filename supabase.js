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
      nota: reserva.nota || null
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

/* ───────────────────────────────────────────────────────────
   EXPONER AL SCOPE GLOBAL
   ─────────────────────────────────────────────────────────── */
window.SB = {
  getReservas: getReservasSB,
  guardarReserva: guardarReservaSB,
  actualizarReserva: actualizarReservaSB,
  borrarReserva: borrarReservaSB,
  borrarTodasLasReservas: borrarTodasLasReservasSB,
  buscarReservas: buscarReservasSB
};