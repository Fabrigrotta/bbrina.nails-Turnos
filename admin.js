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
  whatsapp: '5491100000000',
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
    return JSON.parse(localStorage.getItem(CFG.storageKey)) || [];
  } catch {
    return [];
  }
}

function setReservas(reservas) {
  localStorage.setItem(CFG.storageKey, JSON.stringify(reservas));
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
  } else {
    badge.textContent = esPasada ? 'Pasada' : 'Próxima';
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
  console.log('[admin] Total reservas en storage:', todas.length);
  console.log('[admin] storageKey usada:', CFG.storageKey);
  console.log('[admin] Primeras 2 reservas:', todas.slice(0, 2));

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

  const confirmarCancelarBtn = $('#btn-confirmar-cancelar');
  if (confirmarCancelarBtn) confirmarCancelarBtn.addEventListener('click', confirmarCancelar);

  const exportarBtn = $('#btn-exportar-csv');
  if (exportarBtn) exportarBtn.addEventListener('click', exportarCSV);
}

function initYear() {
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[admin] window.BBRINA_CONFIG?', !!window.BBRINA_CONFIG);
  console.log('[admin] CFG.storageKey:', CFG.storageKey);
  console.log('[admin] Reservas en localStorage:', (JSON.parse(localStorage.getItem(CFG.storageKey)) || []).length);
  console.log('[admin] ¿Logueado?', estaLogueado());

  if (!estaLogueado()) {
    window.location.href = ADMIN_CONFIG.loginUrl;
    return;
  }

  initLogout();
  initFiltros();
  initFiltroServicio();
  initModales();
  initBotones();
  initBorrarTodo();
  initYear();

  renderTodo();
});

})();  // ← cierre del IIFE