/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — admin.js
   Panel de reservas · v1 mockup (localStorage)
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';


/* ───────────────────────────────────────────────────────────
   CONFIG · viene de window.BBRINA_CONFIG (script.js)
   ─────────────────────────────────────────────────────────── */
const CFG = window.BBRINA_CONFIG || {
  whatsapp: '5493413902715',
  servicios: [
    { id: 'kapping',        nombre: 'Kapping',              duracion: 90,  precio: '$—', emoji: '💅' },
    { id: 'semipermanente', nombre: 'Semipermanente',       duracion: 60,  precio: '$—', emoji: '✨' },
    { id: 'esculpidas',     nombre: 'Esculpidas',           duracion: 120, precio: '$—', emoji: '💎' },
    { id: 'retiro',         nombre: 'Retiro + nuevo',       duracion: 90,  precio: '$—', emoji: '🧴' },
    { id: 'spa',            nombre: 'Spa de manos',         duracion: 45,  precio: '$—', emoji: '🌸' },
    { id: 'diseno',         nombre: 'Diseño personalizado', duracion: 30,  precio: '$—', emoji: '🎨' }
  ],
  horarios: ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30'],
  diasNoLaborables: [0],
  marca: 'bbrina.nails',
  storageKey: 'bbrina.turnos.reservas.v1'
};

const ADMIN_CONFIG = {
  authKey: 'bbrina.admin.auth.v1',
  loginUrl: 'index.html#login'
};

/* ───────────────────────────────────────────────────────────
   ESTADO
   ─────────────────────────────────────────────────────────── */
const adminState = {
  filtro: 'todas',
  filtroServicio: 'todos',
  busqueda: '',
  reservaEditando: null,
  reservaMoviendo: null,
  reservaCancelando: null,
  bloqueoEliminando: null
};

/* Alias: el resto del archivo usa `state`, que apunta a adminState.
   (Así no hay que renombrar todas las referencias). */
const state = adminState;

/* Caché de reservas (capa de compatibilidad con Supabase) */
let reservasCache = [];

async function cargarReservas() {
  try {
    const data = await window.SB.getReservas();
    reservasCache = data || [];
    console.log('[admin] Reservas cargadas desde Supabase:', reservasCache.length);
  } catch (err) {
    console.error('[admin] Error al cargar desde Supabase:', err);
    reservasCache = [];
  }
}

/* Caché de bloqueos */
let bloqueosCache = [];

async function cargarBloqueos() {
  try {
    const data = await window.SB.getBloqueos();
    bloqueosCache = data || [];
    console.log('[admin] Bloqueos cargados desde Supabase:', bloqueosCache.length);
  } catch (err) {
    console.error('[admin] Error al cargar bloqueos:', err);
    bloqueosCache = [];
  }
}

/* ───────────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────────── */

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getReservas() {
  // Lee del caché en memoria (sincrónico).
  return reservasCache;
}

function setReservas(reservas) {
  // Actualiza el caché local.
  reservasCache = reservas;
  // Nota: los cambios específicos se mandan a Supabase desde cada función
  // (guardarEdicion, guardarMover, confirmarCancelar, confirmarBorrarTodo).
}

function getFechaISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatearFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function normalizarCodigo(codigo) {
  return (codigo || '').replace(/\D/g, '').padStart(6, '0');
}

function buscarPorCodigo(codigo) {
  const cod = normalizarCodigo(codigo);
  return getReservas().find(r => normalizarCodigo(r.codigo) === cod) || null;
}

function nombreServicio(id) {
  const s = CFG.servicios.find(s => s.id === id);
  return s ? s.nombre : id;
}

function horarioOcupado(fechaISO, horario, ignorarCodigo = null) {
  const ignorar = normalizarCodigo(ignorarCodigo);
  return getReservas().some(r =>
    r.fecha === fechaISO &&
    r.horario === horario &&
    normalizarCodigo(r.codigo) !== ignorar
  );
}

/* ───────────────────────────────────────────────────────────
   AUTH · guard de sesión (el login vive en index.html)
   ─────────────────────────────────────────────────────────── */

function estaLogueado() {
  return sessionStorage.getItem(ADMIN_CONFIG.authKey) === '1';
}

function cerrarSesion() {
  sessionStorage.removeItem(ADMIN_CONFIG.authKey);
  window.location.replace('index.html');
}

function initLogout() {
  const btn = $('#btn-logout');
  const btnConfirmar = $('#btn-logout-confirmar');

  if (!btn) {
    console.warn('[admin.js] No encontré #btn-logout');
    return;
  }

  // El botón del header abre el modal de confirmación
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirModal('modal-logout');
  });

  // El botón del modal confirma y cierra sesión
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', () => {
      cerrarSesion();
    });
  }
}

/* ───────────────────────────────────────────────────────────
   FILTROS
   ─────────────────────────────────────────────────────────── */
function initFiltroServicio() {
  const select = $('#filtro-servicio');
  if (!select) return;

  CFG.servicios.forEach(serv => {
    const opt = document.createElement('option');
    opt.value = serv.id;
    opt.textContent = serv.nombre;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    state.filtroServicio = select.value;
    renderTodo();
  });
}

function initFiltros() {
  $$('.admin-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filtro = btn.dataset.filtro;
      $$('.admin-filtro').forEach(b => b.classList.toggle('active', b === btn));
      renderTodo();
    });
  });
}

function initBuscador() {
  const input = document.getElementById('admin-buscar');
  const btnLimpiar = document.getElementById('admin-buscar-limpiar');
  if (!input) return;

  // Input de búsqueda
  input.addEventListener('input', () => {
    state.busqueda = input.value;
    if (btnLimpiar) btnLimpiar.hidden = !input.value;
    renderTodo();
  });

  // Botón limpiar
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      input.value = '';
      state.busqueda = '';
      btnLimpiar.hidden = true;
      renderTodo();
      input.focus();
    });
  }
}

function filtrarReservas(reservas) {
  const hoyISO = getFechaISO();
  let filtradas = reservas;

  if (state.filtro === 'proximas') {
    filtradas = filtradas.filter(r => r.fecha >= hoyISO);
  } else if (state.filtro === 'pasadas') {
    filtradas = filtradas.filter(r => r.fecha < hoyISO);
  } else if (state.filtro === 'semana') {
    const { inicio, fin } = getRangoSemanaActual();
    filtradas = filtradas.filter(r => r.fecha >= inicio && r.fecha <= fin);
  } else if (state.filtro === 'mes') {
    const { inicio, fin } = getRangoMesActual();
    filtradas = filtradas.filter(r => r.fecha >= inicio && r.fecha <= fin);
  }

  if (state.filtroServicio && state.filtroServicio !== 'todos') {
    filtradas = filtradas.filter(r => r.servicio === state.filtroServicio);
  }

  // Filtro por búsqueda (nombre, whatsapp o código)
  if (state.busqueda) {
    const q = state.busqueda.toLowerCase().trim();
    const qDigitos = q.replace(/\D/g, '');

    filtradas = filtradas.filter(r => {
      const nombre = (r.nombre || '').toLowerCase();
      const whatsapp = (r.whatsapp || '').replace(/\D/g, '');
      const codigo = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');

      // Si el usuario tipeó solo dígitos, buscamos en whatsapp y código
      if (qDigitos && !/[a-záéíóúñ]/i.test(q)) {
        return whatsapp.includes(qDigitos) || codigo.includes(qDigitos);
      }

      // Si hay texto, buscamos en nombre
      return nombre.includes(q);
    });
  }

  return filtradas;
}

function getRangoSemanaActual() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diaSemana = hoy.getDay();

  const offsetLunes = (diaSemana === 0 ? -6 : 1 - diaSemana);

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + offsetLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return {
    inicio: getFechaISO(lunes),
    fin: getFechaISO(domingo)
  };
}

function getRangoMesActual() {
  const hoy = new Date();
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return {
    inicio: getFechaISO(primerDia),
    fin: getFechaISO(ultimoDia)
  };
}

/* ───────────────────────────────────────────────────────────
   RENDER · LISTA
   ─────────────────────────────────────────────────────────── */
function crearCardReserva(reserva) {
  const hoyISO = getFechaISO();
  const esPasada = reserva.fecha < hoyISO;
  const esHoy = reserva.fecha === hoyISO;

  const card = document.createElement('article');
  card.className = 'admin-card';
  if (esPasada) card.classList.add('admin-card-pasada');

  const header = document.createElement('div');
  header.className = 'admin-card-header';

  const codigo = document.createElement('span');
  codigo.className = 'admin-card-codigo';
  codigo.textContent = `#${reserva.codigo || '—'}`;

  const badge = document.createElement('span');
  badge.className = 'admin-card-badge';

  if (esHoy) {
    badge.classList.add('admin-card-badge-hoy');
    badge.textContent = 'Hoy';
  } else if (esPasada) {
    badge.textContent = 'Pasada';
  } else {
    // Calcular cuántos días faltan para el turno
    const [y, m, d] = reserva.fecha.split('-').map(Number);
    const fechaReserva = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaReserva.setHours(0, 0, 0, 0);

    const diffMs = fechaReserva - hoy;
    const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (dias === 1) {
      badge.classList.add('admin-card-badge-hoy');
      badge.textContent = 'Mañana';
    } else if (dias <= 7) {
      badge.classList.add('admin-card-badge-semana');
      badge.textContent = `En ${dias} días`;
    } else {
      badge.textContent = `En ${dias} días`;
    }
  }

  header.appendChild(codigo);
  header.appendChild(badge);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'admin-card-body';

  const lineas = [
    ['Servicio', nombreServicio(reserva.servicio)],
    ['Fecha', formatearFecha(reserva.fecha)],
    ['Horario', `${reserva.horario} hs`],
    ['Nombre', reserva.nombre || '—'],
    ['WhatsApp', reserva.whatsapp || '—']
  ];

  // Seña (si aplica)
  if (reserva.sena_monto) {
    lineas.push(['Seña', `$${reserva.sena_monto}`]);
  }

  if (reserva.nota) lineas.push(['Nota', reserva.nota]);

  lineas.forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    const kEl = document.createElement('span');
    kEl.className = 'admin-row-key';
    kEl.textContent = k;
    const vEl = document.createElement('span');
    vEl.className = 'admin-row-val';
    vEl.textContent = v;
    row.appendChild(kEl);
    row.appendChild(vEl);
    body.appendChild(row);
  });

  // Link al comprobante (si existe)
  if (reserva.sena_comprobante_url) {
    const linkComprobante = document.createElement('a');
    linkComprobante.href = reserva.sena_comprobante_url;
    linkComprobante.target = '_blank';
    linkComprobante.rel = 'noopener';
    linkComprobante.className = 'admin-card-comprobante';
    linkComprobante.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Ver comprobante de seña
    `;
    card.appendChild(linkComprobante);
  }

  card.appendChild(body);

  const acciones = document.createElement('div');
  acciones.className = 'admin-card-acciones';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-secondary admin-btn-sm';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => abrirMover(reserva.codigo));

  const btnCancelar = document.createElement('button');
  btnCancelar.type = 'button';
  btnCancelar.className = 'btn btn-secondary admin-btn-sm admin-btn-danger';
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.addEventListener('click', () => abrirCancelar(reserva.codigo));

  acciones.appendChild(btnEditar);
  acciones.appendChild(btnCancelar);

  card.appendChild(acciones);
  return card;
}

function renderRecientes() {
  const cont = $('#admin-lista-recientes');
  const vacio = $('#admin-vacio-recientes');
  const contador = $('#admin-contador-recientes');
  if (!cont) return;

  const todas = getReservas();

  const ordenadas = [...todas].sort((a, b) => {
    const ta = a.creadaEn ? new Date(a.creadaEn).getTime() : 0;
    const tb = b.creadaEn ? new Date(b.creadaEn).getTime() : 0;
    return tb - ta;
  });

  const ultimas = ordenadas.slice(0, 5);

  cont.innerHTML = '';

  if (!ultimas.length) {
    if (vacio) vacio.hidden = false;
    if (contador) contador.textContent = `0 reservas`;
    return;
  }
  if (vacio) vacio.hidden = true;
  if (contador) contador.textContent = `${ultimas.length} ${ultimas.length === 1 ? 'reserva' : 'reservas'}`;

  ultimas.forEach(reserva => {
    cont.appendChild(crearCardReserva(reserva));
  });
}

function renderLista() {
  const cont = $('#admin-lista');
  const vacio = $('#admin-vacio');
  const contador = $('#admin-contador');
  if (!cont) return;

  const todas = getReservas();
  const filtradas = filtrarReservas(todas);

  filtradas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return (a.horario || '').localeCompare(b.horario || '');
  });

  cont.innerHTML = '';

  if (!filtradas.length) {
    if (vacio) vacio.hidden = false;
    if (contador) contador.textContent = `0 reservas`;
    return;
  }
  if (vacio) vacio.hidden = true;
  if (contador) contador.textContent = `${filtradas.length} ${filtradas.length === 1 ? 'reserva' : 'reservas'}`;

  filtradas.forEach(reserva => {
    cont.appendChild(crearCardReserva(reserva));
  });
}

function renderTodo() {
  const todas = getReservas();
  console.log('[admin] Total reservas en caché:', todas.length);

  renderRecientes();
  renderLista();
}

/* ───────────────────────────────────────────────────────────
   RENDER · BLOQUEOS
   ─────────────────────────────────────────────────────────── */
function crearCardBloqueo(bloqueo) {
  const card = document.createElement('article');
  card.className = 'admin-bloqueo-card';
  if (bloqueo.tipo === 'completo') {
    card.classList.add('admin-bloqueo-card-completo');
  }

  // Header: fecha + badge
  const header = document.createElement('div');
  header.className = 'admin-bloqueo-header';

  const fecha = document.createElement('span');
  fecha.className = 'admin-bloqueo-fecha';
  fecha.textContent = formatearFecha(bloqueo.fecha);

  const badge = document.createElement('span');
  badge.className = 'admin-bloqueo-badge';
  if (bloqueo.tipo === 'completo') {
    badge.classList.add('admin-bloqueo-badge-completo');
    badge.textContent = 'Día completo';
  } else {
    badge.classList.add('admin-bloqueo-badge-parcial');
    badge.textContent = 'Parcial';
  }

  header.appendChild(fecha);
  header.appendChild(badge);
  card.appendChild(header);

  // Horarios
  if (Array.isArray(bloqueo.horarios) && bloqueo.horarios.length > 0) {
    const horarios = document.createElement('div');
    horarios.className = 'admin-bloqueo-horarios';
    bloqueo.horarios.forEach(h => {
      const chip = document.createElement('span');
      chip.className = 'admin-bloqueo-horario';
      chip.textContent = h;
      horarios.appendChild(chip);
    });
    card.appendChild(horarios);
  }

  // Nota
  if (bloqueo.nota) {
    const nota = document.createElement('p');
    nota.className = 'admin-bloqueo-nota';
    nota.textContent = `"${bloqueo.nota}"`;
    card.appendChild(nota);
  }

  // Botón eliminar
  const acciones = document.createElement('div');
  acciones.className = 'admin-bloqueo-acciones';

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-secondary admin-btn-sm admin-btn-danger';
  btnEliminar.textContent = 'Eliminar bloqueo';
  btnEliminar.addEventListener('click', () => eliminarBloqueo(bloqueo));

  acciones.appendChild(btnEliminar);
  card.appendChild(acciones);

  return card;
}

function renderBloqueos() {
  const cont = document.getElementById('admin-lista-bloqueos');
  const vacio = document.getElementById('admin-vacio-bloqueos');
  const contador = document.getElementById('admin-contador-bloqueos');
  if (!cont) return;

  cont.innerHTML = '';

  if (!bloqueosCache.length) {
    if (vacio) vacio.hidden = false;
    if (contador) contador.textContent = '0 bloqueos';
    return;
  }

  if (vacio) vacio.hidden = true;
  if (contador) contador.textContent = `${bloqueosCache.length} ${bloqueosCache.length === 1 ? 'bloqueo' : 'bloqueos'}`;

  // Ordenar por fecha ascendente
  const ordenados = [...bloqueosCache].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return 0;
  });

  ordenados.forEach(b => cont.appendChild(crearCardBloqueo(b)));
}

/* ───────────────────────────────────────────────────────────
   MODALES · helpers
   ─────────────────────────────────────────────────────────── */
function abrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = false;
}

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.hidden = true;

  // Si estamos cerrando el modal de cancelar, reseteamos al paso 1
  // para que la próxima vez que se abra arranque limpio.
  if (id === 'modal-cancelar') {
    irAPasoCancelar(1);
  }
}

function initModales() {
  $$('[data-close]').forEach(el => {
    el.addEventListener('click', () => cerrarModal(el.dataset.close));
  });
}

/* ───────────────────────────────────────────────────────────
   EDITAR
   ─────────────────────────────────────────────────────────── */
function abrirEditar(codigo) {
  const reserva = buscarPorCodigo(codigo);
  if (!reserva) return;
  state.reservaEditando = reserva;

  $('#modal-editar-codigo').textContent = `#${reserva.codigo}`;
  $('#edit-nombre').value = reserva.nombre || '';
  $('#edit-whatsapp').value = reserva.whatsapp || '';
  $('#edit-nota').value = reserva.nota || '';
  const err = $('#edit-error');
  if (err) err.hidden = true;

  abrirModal('modal-editar');
}

function guardarEdicion() {
  const reserva = state.reservaEditando;
  if (!reserva) return;

  const nombre = $('#edit-nombre')?.value.trim() || '';
  const whatsapp = $('#edit-whatsapp')?.value.trim() || '';
  const nota = $('#edit-nota')?.value.trim() || '';
  const err = $('#edit-error');

  if (nombre.length < 2) {
    if (err) { err.textContent = 'Nombre inválido.'; err.hidden = false; }
    return;
  }
  if (whatsapp.replace(/\D/g, '').length < 8) {
    if (err) { err.textContent = 'WhatsApp inválido.'; err.hidden = false; }
    return;
  }

  const todas = getReservas();
  const cod = normalizarCodigo(reserva.codigo);
  const nuevas = todas.map(r =>
    normalizarCodigo(r.codigo) === cod
      ? { ...r, fecha, horario }
      : r
  );
  setReservas(nuevas);

  // Sincronizar con Supabase
  window.SB.actualizarReserva(reserva.codigo, { fecha, horario })
    .catch(err => console.error('[Supabase] Error al mover:', err));

  state.reservaMoviendo = null;
  cerrarModal('modal-mover');
  renderTodo();
}

/* ───────────────────────────────────────────────────────────
   MOVER
   ─────────────────────────────────────────────────────────── */
function abrirMover(codigo) {
  const reserva = buscarPorCodigo(codigo);
  if (!reserva) return;
  state.reservaMoviendo = reserva;

  // Código de reserva
  $('#modal-mover-codigo').textContent = `#${reserva.codigo}`;

  // Nombre de la clienta (nuevo)
  const infoCliente = $('#modal-mover-cliente');
  if (infoCliente) {
    infoCliente.textContent = `${reserva.nombre || '—'} · ${reserva.whatsapp || '—'}`;
  }

  // Resumen de la reserva actual (nuevo)
  const infoActual = $('#modal-mover-actual');
  if (infoActual) {
    infoActual.textContent = `Actualmente: ${formatearFecha(reserva.fecha)} · ${reserva.horario} hs`;
  }

  // Fecha
  const inputFecha = $('#mover-fecha');
  if (inputFecha) {
    inputFecha.min = getFechaISO();
    inputFecha.value = reserva.fecha;
  }

  // Horario
  const selectHorario = $('#mover-horario');
  if (selectHorario) {
    selectHorario.innerHTML = '';
    CFG.horarios.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === reserva.horario) opt.selected = true;
      selectHorario.appendChild(opt);
    });
  }

  const err = $('#mover-error');
  if (err) err.hidden = true;

  abrirModal('modal-mover');
}

function guardarMover() {
  const reserva = state.reservaMoviendo;
  if (!reserva) return;

  const fecha = $('#mover-fecha')?.value || '';
  const horario = $('#mover-horario')?.value || '';
  const err = $('#mover-error');

  if (!fecha || !horario) {
    if (err) { err.textContent = 'Completá fecha y horario.'; err.hidden = false; }
    return;
  }

  if (horarioOcupado(fecha, horario, reserva.codigo)) {
    if (err) { err.textContent = 'Ese horario ya está reservado.'; err.hidden = false; }
    return;
  }

  // Guardamos los datos originales para el mensaje del aviso
  const fechaOriginal = reserva.fecha;
  const horarioOriginal = reserva.horario;
  const codigoReserva = reserva.codigo;

  // Actualizamos el caché local
  const todas = getReservas();
  const cod = normalizarCodigo(reserva.codigo);
  const nuevas = todas.map(r =>
    normalizarCodigo(r.codigo) === cod
      ? { ...r, fecha, horario }
      : r
  );
  setReservas(nuevas);

  state.reservaMoviendo = null;
  cerrarModal('modal-mover');
  renderTodo();

  // Sincronizamos con Supabase y mostramos aviso según el resultado
  window.SB.actualizarReserva(codigoReserva, { fecha, horario })
    .then(result => {
      if (result) {
        mostrarAviso({
          titulo: 'Turno actualizado',
          texto: `Se movió el turno #${codigoReserva} del ${formatearFecha(fechaOriginal)} a las ${horarioOriginal} hs al ${formatearFecha(fecha)} a las ${horario} hs.`,
          tipo: 'success'
        });
      } else {
        mostrarAviso({
          titulo: 'No se pudo sincronizar',
          texto: 'El cambio se aplicó localmente, pero no se pudo guardar en el servidor. Intentá de nuevo.',
          tipo: 'warning'
        });
      }
    })
    .catch(error => {
      console.error('[Supabase] Error al mover reserva:', error);
      mostrarAviso({
        titulo: 'Error al guardar',
        texto: 'Hubo un problema al conectar con el servidor. Intentá de nuevo.',
        tipo: 'danger'
      });
    });
}

/* ───────────────────────────────────────────────────────────
   CANCELAR
   ─────────────────────────────────────────────────────────── */
function abrirCancelar(codigo) {
  const reserva = buscarPorCodigo(codigo);
  if (!reserva) return;
  state.reservaCancelando = reserva;

  // Paso 1: código + nombre
  const codigoEl = document.getElementById('modal-cancelar-codigo');
  if (codigoEl) {
    codigoEl.textContent = `#${reserva.codigo} · ${reserva.nombre || ''}`;
  }

  // Paso 2: info que se muestra en la confirmación final
  const infoEl = document.getElementById('modal-cancelar-info');
  if (infoEl) {
    infoEl.textContent = `Turno #${reserva.codigo} · ${reserva.nombre || '—'} · ${formatearFecha(reserva.fecha)} a las ${reserva.horario} hs`;
  }

  // Siempre arrancamos en el paso 1
  irAPasoCancelar(1);

  abrirModal('modal-cancelar');
}

/* Muestra un paso del modal de cancelar y oculta el otro */
function irAPasoCancelar(paso) {
  const paso1 = document.getElementById('cancelar-paso-1');
  const paso2 = document.getElementById('cancelar-paso-2');

  if (paso1) paso1.hidden = paso !== 1;
  if (paso2) paso2.hidden = paso !== 2;
}

function confirmarCancelar() {
  const reserva = state.reservaCancelando;
  if (!reserva) return;

  // Guardamos los datos para el mensaje del aviso
  const codigoReserva = reserva.codigo;
  const fechaReserva = reserva.fecha;
  const horarioReserva = reserva.horario;
  const nombreClienta = reserva.nombre || '—';

  // Actualizamos el caché local
  const todas = getReservas();
  const cod = normalizarCodigo(reserva.codigo);
  const nuevas = todas.filter(r => normalizarCodigo(r.codigo) !== cod);
  setReservas(nuevas);

  state.reservaCancelando = null;
  cerrarModal('modal-cancelar');
  renderTodo();

  // Sincronizamos con Supabase y mostramos aviso según el resultado
  window.SB.borrarReserva(codigoReserva)
    .then(ok => {
      if (ok) {
        mostrarAviso({
          titulo: 'Turno cancelado',
          texto: `Se canceló el turno #${codigoReserva} de ${nombreClienta} del ${formatearFecha(fechaReserva)} a las ${horarioReserva} hs. El horario quedó libre.`,
          tipo: 'success'
        });
      } else {
        mostrarAviso({
          titulo: 'No se pudo sincronizar',
          texto: 'El turno se canceló localmente, pero no se pudo eliminar del servidor. Intentá de nuevo.',
          tipo: 'warning'
        });
      }
    })
    .catch(error => {
      console.error('[Supabase] Error al cancelar reserva:', error);
      mostrarAviso({
        titulo: 'Error al cancelar',
        texto: 'Hubo un problema al conectar con el servidor. Intentá de nuevo.',
        tipo: 'danger'
      });
    });
}

/* ───────────────────────────────────────────────────────────
   BLOQUEAR HORARIOS · modal
   ─────────────────────────────────────────────────────────── */

function poblarCheckboxesHorarios() {
  const cont = document.getElementById('bloquear-horarios-grid');
  if (!cont) return;

  cont.innerHTML = '';

  CFG.horarios.forEach(hora => {
    const label = document.createElement('label');
    label.className = 'bloquear-checkbox';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = hora;

    const span = document.createElement('span');
    span.textContent = hora;

    label.appendChild(input);
    label.appendChild(span);
    cont.appendChild(label);
  });
}

function abrirModalBloquear() {
  const modal = document.getElementById('modal-bloquear');
  if (!modal) return;

  // Refrescar bloqueos desde Supabase antes de abrir
  // (para evitar duplicados si se crearon en otra pestaña)
  window.SB.getBloqueos().then(data => {
    if (Array.isArray(data)) bloqueosCache = data;
    _abrirModalBloquearAhora();
  }).catch(err => {
    console.warn('[admin] No se pudo refrescar bloqueos:', err);
    _abrirModalBloquearAhora();
  });
}

function _abrirModalBloquearAhora() {
  const modal = document.getElementById('modal-bloquear');
  if (!modal) return;

  // Resetear
  const inputFecha = document.getElementById('bloquear-fecha');
  const inputNota = document.getElementById('bloquear-nota');
  const err = document.getElementById('bloquear-error');

  if (inputFecha) {
    inputFecha.min = getFechaISO();
    inputFecha.value = getFechaISO();
  }
  if (inputNota) inputNota.value = '';
  if (err) err.hidden = true;

  poblarCheckboxesHorarios();

  // Al cambiar la fecha, actualizar los checkboxes y la nota
  // según si ya existe un bloqueo para esa fecha.
  if (inputFecha) {
    // Removemos listener previo (por si lo abren varias veces)
    inputFecha.onchange = null;
    inputFecha.onchange = () => cargarBloqueoExistente(inputFecha.value);
    // Cargar el de hoy (o el que esté por defecto)
    cargarBloqueoExistente(inputFecha.value);
  }

  // Refrescar caché mientras el modal está abierto
  // (para que cargarBloqueoExistente use datos frescos)
  window.SB.getBloqueos().then(data => {
    if (Array.isArray(data)) {
      bloqueosCache = data;
      // Re-evaluar el bloqueo existente con datos frescos
      if (inputFecha) cargarBloqueoExistente(inputFecha.value);
    }
  }).catch(e => console.warn('[admin] No se pudo refrescar bloqueos:', e));

  abrirModal('modal-bloquear');
}

/* Si hay un bloqueo para esa fecha, pre-carga los checkboxes y la nota.
   Si no, limpia todo. */
function cargarBloqueoExistente(fecha) {
  const inputNota = document.getElementById('bloquear-nota');
  const checkboxes = document.querySelectorAll('#bloquear-horarios-grid input[type="checkbox"]');

  // Buscar TODOS los bloqueos para esa fecha (puede haber duplicados)
  const existentes = bloqueosCache.filter(b => b.fecha === fecha);

  if (existentes.length > 0) {
    // Combinar los horarios de TODOS los bloqueos de esa fecha
    const horariosBloqueados = new Set();
    existentes.forEach(b => {
      (b.horarios || []).forEach(h => horariosBloqueados.add(h));
    });

    // Pre-marcar los horarios
    checkboxes.forEach(cb => {
      cb.checked = horariosBloqueados.has(cb.value);
    });

    // Cargar la nota del primero que tenga nota
    const conNota = existentes.find(b => b.nota);
    if (inputNota) inputNota.value = conNota ? conNota.nota : '';
  } else {
    // Limpiar todo
    checkboxes.forEach(cb => { cb.checked = false; });
    if (inputNota) inputNota.value = '';
  }

  // Actualizar el título del modal
  actualizarTituloModalBloqueo(existentes.length > 0 ? existentes[0] : null);
}

function actualizarTituloModalBloqueo(bloqueoExistente) {
  const titulo = document.querySelector('#modal-bloquear .modal-titulo');
  const subtitulo = document.querySelector('#modal-bloquear .modal-subtitulo');

  if (titulo) {
    titulo.textContent = bloqueoExistente ? 'Editar bloqueo' : 'Bloquear horarios';
  }
  if (subtitulo) {
    subtitulo.textContent = bloqueoExistente
      ? `Ya hay un bloqueo el ${formatearFecha(bloqueoExistente.fecha)}. Modificalo o eliminalo.`
      : 'Elegí una fecha y qué horarios bloquear.';
  }
}

function toggleTodosLosHorarios(checked) {
  const checkboxes = document.querySelectorAll('#bloquear-horarios-grid input[type="checkbox"]');
  checkboxes.forEach(cb => { cb.checked = checked; });
}

function limpiarSeleccionHorarios() {
  const checkboxes = document.querySelectorAll('#bloquear-horarios-grid input[type="checkbox"]');
  checkboxes.forEach(cb => { cb.checked = false; });
}

async function confirmarBloqueo() {
  const fecha = document.getElementById('bloquear-fecha')?.value || '';
  const nota = document.getElementById('bloquear-nota')?.value.trim() || '';
  const err = document.getElementById('bloquear-error');

  if (!fecha) {
    if (err) { err.textContent = 'Elegí una fecha.'; err.hidden = false; }
    return;
  }

  // Recolectar horarios seleccionados
  const checkboxes = document.querySelectorAll('#bloquear-horarios-grid input[type="checkbox"]:checked');
  const horarios = Array.from(checkboxes).map(cb => cb.value);

  // Feedback visual
  const btn = document.getElementById('btn-confirmar-bloqueo');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  // Refrescar bloqueos desde Supabase antes de operar
  // (por si se crearon desde otra pestaña o el caché está desactualizado)
  try {
    const bloqueosFrescos = await window.SB.getBloqueos();
    if (Array.isArray(bloqueosFrescos)) {
      bloqueosCache = bloqueosFrescos;
    }
  } catch (e) {
    console.warn('[admin] No se pudo refrescar bloqueos:', e);
  }

  // Buscar TODOS los bloqueos de esa fecha (puede haber duplicados)
  const existentes = bloqueosCache.filter(b => b.fecha === fecha);

  // CASO 1: sin horarios y existen bloqueos → BORRAR TODOS
  if (!horarios.length && existentes.length > 0) {
    // Borrar todos los bloqueos de esa fecha (por las dudas haya duplicados)
    const resultados = await Promise.all(
      existentes.map(b => window.SB.borrarBloqueo(b.id))
    );

    const todosOk = resultados.every(r => r === true);

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar bloqueo';
    }

    if (!todosOk) {
      if (err) { err.textContent = 'Error al eliminar alguno. Intentá de nuevo.'; err.hidden = false; }
      return;
    }

    bloqueosCache = bloqueosCache.filter(b => b.fecha !== fecha);
    cerrarModal('modal-bloquear');
    renderBloqueos();

    mostrarAviso({
      titulo: '🔓 Desbloqueo exitoso',
      texto: `Se liberaron todos los horarios del ${formatearFecha(fecha)}.`,
      tipo: 'success'
    });
    return;
  }

  // CASO 2: sin horarios y NO existe bloqueo → simplemente no hacer nada
  // (el usuario deseleccionó todo en un día que no tenía bloqueo,
  // no hay nada que guardar ni borrar)
  if (!horarios.length) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar bloqueo';
    }
    cerrarModal('modal-bloquear');
    return;
  }

  // CASO 3: con horarios → crear o actualizar
  const tipo = horarios.length === CFG.horarios.length ? 'completo' : 'parcial';

  let result;
  let accion;

  if (existentes.length > 0) {
    // Si hay duplicados, primero eliminamos todos los que sobren
    // (nos quedamos con el primero para actualizarlo)
    const principal = existentes[0];
    const duplicados = existentes.slice(1);

    if (duplicados.length > 0) {
      // Borrar los duplicados en paralelo
      await Promise.all(duplicados.map(b => window.SB.borrarBloqueo(b.id)));
      // Quitarlos del caché
      const idsDuplicados = new Set(duplicados.map(b => b.id));
      bloqueosCache = bloqueosCache.filter(b => !idsDuplicados.has(b.id));
    }

    // Actualizar el principal
    result = await window.SB.actualizarBloqueo(principal.id, {
      horarios,
      tipo,
      nota
    });
    accion = 'actualizado';

    if (result) {
      const idx = bloqueosCache.findIndex(b => b.id === principal.id);
      if (idx >= 0) bloqueosCache[idx] = result;
    }
  } else {
    // Crear nuevo
    result = await window.SB.crearBloqueo({
      fecha,
      horarios,
      tipo,
      nota
    });
    accion = 'creado';

    if (result) {
      bloqueosCache.push(result);
    }
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Guardar bloqueo';
  }

  if (!result) {
    if (err) { err.textContent = 'Error al guardar. Intentá de nuevo.'; err.hidden = false; }
    return;
  }

  cerrarModal('modal-bloquear');
  renderBloqueos();

  const verbo = accion === 'actualizado' ? 'actualizó' : 'bloqueó';
  const icono = accion === 'actualizado' ? '✏️' : '🔒';
  const cantidad = horarios.length === CFG.horarios.length
    ? 'todo el día'
    : `${horarios.length} ${horarios.length === 1 ? 'horario' : 'horarios'}`;

  mostrarAviso({
    titulo: `${icono} ${accion === 'actualizado' ? 'Bloqueo actualizado' : 'Bloqueo creado'}`,
    texto: `Se ${verbo} ${cantidad} del ${formatearFecha(fecha)} con éxito.`,
    tipo: 'success'
  });
}
function eliminarBloqueo(bloqueo) {
  // Guardamos el bloqueo y abrimos el modal de confirmación
  state.bloqueoEliminando = bloqueo;

  const subtitulo = document.getElementById('modal-eliminar-bloqueo-fecha');
  if (subtitulo) {
    subtitulo.textContent = `Bloqueo del ${formatearFecha(bloqueo.fecha)}`;
  }

  abrirModal('modal-eliminar-bloqueo');
}

async function confirmarEliminarBloqueo() {
  const bloqueo = state.bloqueoEliminando;
  if (!bloqueo) return;

  const btn = document.getElementById('btn-confirmar-eliminar-bloqueo');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Eliminando...';
  }

  const result = await window.SB.borrarBloqueo(bloqueo.id);

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Sí, eliminar';
  }

  state.bloqueoEliminando = null;
  cerrarModal('modal-eliminar-bloqueo');

  if (!result) {
    mostrarAviso({
      titulo: 'Error',
      texto: 'No se pudo eliminar el bloqueo.',
      tipo: 'danger'
    });
    return;
  }

  // Actualizar caché
  bloqueosCache = bloqueosCache.filter(b => b.id !== bloqueo.id);
  renderBloqueos();

  mostrarAviso({
    titulo: 'Bloqueo eliminado',
    texto: `Se liberó el bloqueo del ${formatearFecha(bloqueo.fecha)}.`,
    tipo: 'success'
  });
}

function initBloqueos() {
  const btnAbrir = document.getElementById('btn-bloquear-horarios');
  const btnTodoDia = document.getElementById('btn-bloquear-todo-dia');
  const btnLimpiar = document.getElementById('btn-bloquear-limpiar');
  const btnConfirmar = document.getElementById('btn-confirmar-bloqueo');
  const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar-bloqueo');

  if (btnAbrir) {
    btnAbrir.addEventListener('click', abrirModalBloquear);
  }

  if (btnTodoDia) {
    btnTodoDia.addEventListener('click', () => toggleTodosLosHorarios(true));
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarSeleccionHorarios);
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', confirmarBloqueo);
  }

  if (btnConfirmarEliminar) {
    btnConfirmarEliminar.addEventListener('click', confirmarEliminarBloqueo);
  }
}

/* ───────────────────────────────────────────────────────────
   BORRAR TODO · doble confirmación con captcha
   ─────────────────────────────────────────────────────────── */
let captchaResultado = 0;

function generarCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  captchaResultado = a + b;

  const pregunta = document.getElementById('captcha-pregunta');
  if (pregunta) pregunta.textContent = `${a} + ${b}`;

  const input = document.getElementById('captcha-input');
  if (input) input.value = '';

  const err = document.getElementById('captcha-error');
  if (err) err.hidden = true;

  const btnConfirmar = document.getElementById('btn-borrar-confirmar');
  if (btnConfirmar) btnConfirmar.disabled = true;
}

function abrirBorrarTodo() {
  const paso1 = document.getElementById('borrar-paso-1');
  const paso2 = document.getElementById('borrar-paso-2');
  const acc1 = document.getElementById('borrar-acciones-1');
  const acc2 = document.getElementById('borrar-acciones-2');

  if (paso1) paso1.hidden = false;
  if (paso2) paso2.hidden = true;
  if (acc1) acc1.hidden = false;
  if (acc2) acc2.hidden = true;

  generarCaptcha();

  abrirModal('modal-borrar-todo');
}

function irAPasoBorrar() {
  const paso1 = document.getElementById('borrar-paso-1');
  const paso2 = document.getElementById('borrar-paso-2');
  const acc1 = document.getElementById('borrar-acciones-1');
  const acc2 = document.getElementById('borrar-acciones-2');

  if (paso1) paso1.hidden = true;
  if (paso2) paso2.hidden = false;
  if (acc1) acc1.hidden = true;
  if (acc2) acc2.hidden = false;

  generarCaptcha();

  const input = document.getElementById('captcha-input');
  if (input) setTimeout(() => input.focus(), 50);
}

function volverAPaso1Borrar() {
  const paso1 = document.getElementById('borrar-paso-1');
  const paso2 = document.getElementById('borrar-paso-2');
  const acc1 = document.getElementById('borrar-acciones-1');
  const acc2 = document.getElementById('borrar-acciones-2');

  if (paso1) paso1.hidden = false;
  if (paso2) paso2.hidden = true;
  if (acc1) acc1.hidden = false;
  if (acc2) acc2.hidden = true;
}

function verificarCaptcha() {
  const input = document.getElementById('captcha-input');
  const err = document.getElementById('captcha-error');
  const btnConfirmar = document.getElementById('btn-borrar-confirmar');
  if (!input || !err || !btnConfirmar) return;

  const valor = parseInt(input.value.trim(), 10);

  if (isNaN(valor)) {
    btnConfirmar.disabled = true;
    return;
  }

  if (valor === captchaResultado) {
    btnConfirmar.disabled = false;
    err.hidden = true;
  } else {
    btnConfirmar.disabled = true;
    err.hidden = true;
  }
}

function mostrarAviso({ titulo, texto, tipo = 'success' }) {
  const modal = document.getElementById('modal-aviso');
  const icono = document.getElementById('modal-aviso-icono');
  const tituloEl = document.getElementById('modal-aviso-titulo');
  const textoEl = document.getElementById('modal-aviso-texto');
  if (!modal || !tituloEl || !textoEl) return;

  // Resetear clases de tipo
  modal.classList.remove(
    'modal-aviso-success',
    'modal-aviso-warning',
    'modal-aviso-danger'
  );
  modal.classList.add(`modal-aviso-${tipo}`);

  // Ícono según tipo
  if (icono) {
    if (tipo === 'success') {
      icono.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (tipo === 'warning') {
      icono.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (tipo === 'danger') {
      icono.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }
  }

  tituloEl.textContent = titulo;
  textoEl.textContent = texto;

  abrirModal('modal-aviso');
}

function confirmarBorrarTodo() {
  const input = document.getElementById('captcha-input');
  const err = document.getElementById('captcha-error');
  if (!input || !err) return;

  const valor = parseInt(input.value.trim(), 10);

  if (valor !== captchaResultado) {
    err.textContent = 'El resultado no es correcto. Probá de nuevo.';
    err.hidden = false;

    generarCaptcha();
    setTimeout(() => document.getElementById('captcha-input')?.focus(), 50);
    return;
  }

  setReservas([]);

  // Sincronizar con Supabase
  window.SB.borrarTodasLasReservas()
    .catch(err => console.error('[Supabase] Error al borrar todo:', err));

  cerrarModal('modal-borrar-todo');
  renderTodo();

  mostrarAviso({
    titulo: '¡Listo!',
    texto: 'Se borraron todos los turnos del sistema.',
    tipo: 'success'
  });
}

function initBorrarTodo() {
  const btnAbrir = document.getElementById('btn-borrar-todo');
  const btnSiguiente = document.getElementById('btn-borrar-siguiente');
  const btnVolver = document.getElementById('btn-borrar-volver');
  const btnConfirmar = document.getElementById('btn-borrar-confirmar');
  const inputCaptcha = document.getElementById('captcha-input');

  if (btnAbrir) {
    btnAbrir.addEventListener('click', abrirBorrarTodo);
  }

  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', irAPasoBorrar);
  }

  if (btnVolver) {
    btnVolver.addEventListener('click', volverAPaso1Borrar);
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', confirmarBorrarTodo);
  }

  if (inputCaptcha) {
    inputCaptcha.addEventListener('input', verificarCaptcha);
    inputCaptcha.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const btn = document.getElementById('btn-borrar-confirmar');
        if (btn && !btn.disabled) confirmarBorrarTodo();
      }
    });
  }
}

/* ───────────────────────────────────────────────────────────
   EXPORTAR CSV
   ─────────────────────────────────────────────────────────── */
function escaparCSV(valor) {
  const s = String(valor ?? '');
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportarCSV() {
  const reservas = getReservas();

  if (!reservas.length) {
    mostrarAviso({
      titulo: 'Sin reservas',
      texto: 'No hay reservas para exportar.',
      tipo: 'warning'
    });
    return;
  }

  reservas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return (a.horario || '').localeCompare(b.horario || '');
  });

  const encabezados = [
    'Código',
    'Servicio',
    'Fecha',
    'Horario',
    'Nombre',
    'WhatsApp',
    'Nota',
    'Creada'
  ];

  const filas = reservas.map(r => {
    const serv = CFG.servicios.find(s => s.id === r.servicio);
    const nombreServ = serv ? serv.nombre : (r.servicio || '');
    const creada = r.creadaEn
      ? new Date(r.creadaEn).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : '';

    return [
      r.codigo || '',
      nombreServ,
      r.fecha || '',
      r.horario || '',
      r.nombre || '',
      r.whatsapp || '',
      r.nota || '',
      creada
    ].map(escaparCSV).join(';');
  });

  const contenido = '\uFEFF' + encabezados.join(';') + '\n' + filas.join('\n');

  const hoy = getFechaISO();
  const nombreArchivo = `bbrina-turnos-${hoy}.csv`;

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/* ───────────────────────────────────────────────────────────
   INIT
   ─────────────────────────────────────────────────────────── */
function initBotones() {
  const guardarEdicionBtn = $('#btn-guardar-edicion');
  if (guardarEdicionBtn) guardarEdicionBtn.addEventListener('click', guardarEdicion);

  const guardarMoverBtn = $('#btn-guardar-mover');
  if (guardarMoverBtn) guardarMoverBtn.addEventListener('click', guardarMover);

  // Modal cancelar: paso 1 → paso 2
  const cancelarSiguienteBtn = $('#btn-cancelar-siguiente');
  if (cancelarSiguienteBtn) {
    cancelarSiguienteBtn.addEventListener('click', () => irAPasoCancelar(2));
  }

  // Modal cancelar: paso 2 → paso 1
  const cancelarVolverBtn = $('#btn-cancelar-volver');
  if (cancelarVolverBtn) {
    cancelarVolverBtn.addEventListener('click', () => irAPasoCancelar(1));
  }

  // Modal cancelar: paso 2 → ejecuta la cancelación real
  const confirmarCancelarBtn = $('#btn-confirmar-cancelar');
  if (confirmarCancelarBtn) confirmarCancelarBtn.addEventListener('click', confirmarCancelar);

  const exportarBtn = $('#btn-exportar-csv');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarCSV);
}

function initYear() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[admin] window.BBRINA_CONFIG?', !!window.BBRINA_CONFIG);
  console.log('[admin] ¿Logueado?', estaLogueado());

  if (!estaLogueado()) {
    window.location.href = ADMIN_CONFIG.loginUrl;
    return;
  }

  // Cargar reservas Y bloqueos desde Supabase ANTES de inicializar
  await cargarReservas();
  await cargarBloqueos();

  initLogout();
  initFiltros();
  initFiltroServicio();
  initBuscador();
  initModales();
  initBotones();
  initBorrarTodo();
  initBloqueos();
  initYear();

  renderTodo();
  renderBloqueos();
});

})();  // ← cierre del IIFE