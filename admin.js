/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — admin.js
   Panel de reservas · v1 mockup (localStorage)
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   CONFIG · misma config que script.js (debe estar sincronizada)
   ─────────────────────────────────────────────────────────── */
const CONFIG = {
  whatsapp: '5491100000000',
  servicios: [
    { id: 'kapping',        nombre: 'Kapping',              duracion: 90,  precio: '$—' },
    { id: 'semipermanente', nombre: 'Semipermanente',       duracion: 60,  precio: '$—' },
    { id: 'esculpidas',     nombre: 'Esculpidas',           duracion: 120, precio: '$—' },
    { id: 'retiro',         nombre: 'Retiro + nuevo',       duracion: 90,  precio: '$—' },
    { id: 'spa',            nombre: 'Spa de manos',         duracion: 45,  precio: '$—' },
    { id: 'diseno',         nombre: 'Diseño personalizado', duracion: 30,  precio: '$—' }
  ],
  horarios: ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30'],
  diasNoLaborables: [0],
  marca: 'bbrina.nails',
  storageKey: 'bbrina.turnos.reservas.v1',
  authKey: 'bbrina.admin.auth.v1',
  loginUrl: 'index.html#login'
};

/* ───────────────────────────────────────────────────────────
   ESTADO
   ─────────────────────────────────────────────────────────── */
const state = {
  filtro: 'todas',
  reservaEditando: null,
  reservaMoviendo: null,
  reservaCancelando: null
};

/* ───────────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getReservas() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
  } catch {
    return [];
  }
}

function setReservas(reservas) {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(reservas));
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
  const s = CONFIG.servicios.find(s => s.id === id);
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
  return sessionStorage.getItem(CONFIG.authKey) === '1';
}

function cerrarSesion() {
  sessionStorage.removeItem(CONFIG.authKey);
  window.location.href = 'index.html';
}

function initLogout() {
  const btn = $('#btn-logout');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }
}

/* ───────────────────────────────────────────────────────────
   FILTROS
   ─────────────────────────────────────────────────────────── */
function initFiltros() {
  $$('.admin-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filtro = btn.dataset.filtro;
      $$('.admin-filtro').forEach(b => b.classList.toggle('active', b === btn));
      renderTodo();
    });
  });
}

function filtrarReservas(reservas) {
  const hoyISO = getFechaISO();
  if (state.filtro === 'proximas') return reservas.filter(r => r.fecha >= hoyISO);
  if (state.filtro === 'pasadas')  return reservas.filter(r => r.fecha < hoyISO);
  return reservas;
}

/* ───────────────────────────────────────────────────────────
   RENDER · LISTA
   ─────────────────────────────────────────────────────────── */
/* Construye el nodo <article> de una reserva */
function crearCardReserva(reserva) {
  const hoyISO = getFechaISO();
  const esPasada = reserva.fecha < hoyISO;

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
  badge.textContent = esPasada ? 'Pasada' : 'Próxima';

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

  card.appendChild(body);

  const acciones = document.createElement('div');
  acciones.className = 'admin-card-acciones';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'btn btn-secondary admin-btn-sm';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => abrirEditar(reserva.codigo));

  const btnMover = document.createElement('button');
  btnMover.type = 'button';
  btnMover.className = 'btn btn-secondary admin-btn-sm';
  btnMover.textContent = 'Mover';
  btnMover.addEventListener('click', () => abrirMover(reserva.codigo));

  const btnCancelar = document.createElement('button');
  btnCancelar.type = 'button';
  btnCancelar.className = 'btn btn-secondary admin-btn-sm admin-btn-danger';
  btnCancelar.textContent = 'Cancelar';
  btnCancelar.addEventListener('click', () => abrirCancelar(reserva.codigo));

  acciones.appendChild(btnEditar);
  acciones.appendChild(btnMover);
  acciones.appendChild(btnCancelar);

  card.appendChild(acciones);
  return card;
}

/* Bloque 1: últimos 5 reservados (por creadaEn descendente) */
function renderRecientes() {
  const cont = $('#admin-lista-recientes');
  const vacio = $('#admin-vacio-recientes');
  const contador = $('#admin-contador-recientes');
  if (!cont) return;

  const todas = getReservas();

  // Ordenar por creadaEn desc; si no hay creadaEn, van al final
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

/* Bloque 2: todos los turnos (con filtros) */
function renderLista() {
  const cont = $('#admin-lista');
  const vacio = $('#admin-vacio');
  const contador = $('#admin-contador');
  if (!cont) return;

  const todas = getReservas();
  const filtradas = filtrarReservas(todas);

  // Orden: por fecha ascendente, luego horario
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

/* Render maestro: se llama después de cualquier cambio (editar/mover/cancelar) */
function renderTodo() {
  renderRecientes();
  renderLista();
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
  state.reservaEditando = null;
  cerrarModal('modal-editar');
  renderTodo();
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
      ? { ...r, nombre, whatsapp, nota }
      : r
  );
  setReservas(nuevas);

  state.reservaEditando = null;
  cerrarModal('modal-editar');
  renderTodo();
}

/* ───────────────────────────────────────────────────────────
   MOVER
   ─────────────────────────────────────────────────────────── */
function abrirMover(codigo) {
  const reserva = buscarPorCodigo(codigo);
  if (!reserva) return;
  state.reservaMoviendo = reserva;

  $('#modal-mover-codigo').textContent = `#${reserva.codigo}`;

  const inputFecha = $('#mover-fecha');
  const selectHorario = $('#mover-horario');
  if (inputFecha) {
    inputFecha.min = getFechaISO();
    inputFecha.value = reserva.fecha;
  }
  if (selectHorario) {
    selectHorario.innerHTML = '';
    CONFIG.horarios.forEach(h => {
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
}

/* ───────────────────────────────────────────────────────────
   CANCELAR
   ─────────────────────────────────────────────────────────── */
function abrirCancelar(codigo) {
  const reserva = buscarPorCodigo(codigo);
  if (!reserva) return;
  state.reservaCancelando = reserva;

  $('#modal-cancelar-codigo').textContent = `#${reserva.codigo} · ${reserva.nombre || ''}`;
  abrirModal('modal-cancelar');
}

function confirmarCancelar() {
  const reserva = state.reservaCancelando;
  if (!reserva) return;

  const todas = getReservas();
  const cod = normalizarCodigo(reserva.codigo);
  const nuevas = todas.filter(r => normalizarCodigo(r.codigo) !== cod);
  setReservas(nuevas);

  state.reservaCancelando = null;
  cerrarModal('modal-cancelar');
  renderTodo();
}

/* ───────────────────────────────────────────────────────────
   INIT
   ─────────────────────────────────────────────────────────── */
function initBotones() {
  const guardarEdicionBtn = $('#btn-guardar-edicion');
  if (guardarEdicionBtn) guardarEdicionBtn.addEventListener('click', guardarEdicion);

  const guardarMoverBtn = $('#btn-guardar-mover');
  if (guardarMoverBtn) guardarMoverBtn.addEventListener('click', guardarMover);

  const confirmarCancelarBtn = $('#btn-confirmar-cancelar');
  if (confirmarCancelarBtn) confirmarCancelarBtn.addEventListener('click', confirmarCancelar);
}

function initYear() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  // Guard de sesión: si no está logueado, redirige al index con el modal abierto
  if (!estaLogueado()) {
    window.location.href = CONFIG.loginUrl;
    return;
  }

  initLogout();
  initFiltros();
  initModales();
  initBotones();
  initYear();

  renderTodo();
});