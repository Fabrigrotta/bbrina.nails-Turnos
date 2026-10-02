/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — script.js
   v1 · mockup funcional
   ═══════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   CONFIG · editá acá los datos reales cuando estén
   ─────────────────────────────────────────────────────────── */
const CONFIG = {
  // Número de WhatsApp en formato internacional SIN "+" ni espacios.
  // Ejemplo Argentina: 5491123456789
  whatsapp: '5491100000000', // ⚠️ PLACEHOLDER · reemplazar

  // Duración por defecto de cada turno (minutos)
  duracionTurno: 60,

  // Servicios disponibles (mockup · editar libremente)
  servicios: [
    { id: 'kapping',       nombre: 'Kapping',           duracion: 90, precio: '$—' },
    { id: 'semipermanente',nombre: 'Semipermanente',    duracion: 60, precio: '$—' },
    { id: 'esculpidas',    nombre: 'Esculpidas',        duracion: 120, precio: '$—' },
    { id: 'retiro',        nombre: 'Retiro + nuevo',    duracion: 90, precio: '$—' },
    { id: 'spa',           nombre: 'Spa de manos',      duracion: 45, precio: '$—' },
    { id: 'diseno',        nombre: 'Diseño personalizado', duracion: 30, precio: '$—' }
  ],

  // Horarios disponibles (mockup · editar libremente)
  horarios: ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00', '18:30'],

  // Días no laborables (0 = domingo, 6 = sábado). Por ahora domingo.
  diasNoLaborables: [0],

  // Textos de la marca (por si después querés cambiarlos desde acá)
  marca: 'bbrina.nails',
  subMarca: 'Turnos',

  // Umbrales de disponibilidad (porcentaje de horarios LIBRES)
  // Verde ≥ alto, amarillo entre medio y alto, rojo < medio
  umbralDisponibilidad: {
    verde: 60,     // ≥ 60% libres → verde
    amarillo: 30   // ≥ 30% libres → amarillo · menos → rojo
  },

  // Storage key para las reservas
  storageKey: 'bbrina.turnos.reservas.v1'
};

/* ───────────────────────────────────────────────────────────
   ESTADO
   ─────────────────────────────────────────────────────────── */
const state = {
  servicioSeleccionado: null,
  fechaSeleccionada: null,
  horarioSeleccionado: null,
  // Edición: guarda el código de una reserva que estamos editando
  codigoEnEdicion: null
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

function generarCodigoReserva() {
  const existentes = new Set(
    getReservas().map(r => (r.codigo || '').trim())
  );

  let codigo;
  let intentos = 0;

  do {
    // 6 dígitos aleatorios seguros (000000–999999)
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    const num = bytes[0] % 1000000;
    codigo = String(num).padStart(6, '0');
    intentos++;
  } while (existentes.has(codigo) && intentos < 50);

  return codigo;
}

function guardarReserva(reserva) {
  const reservas = getReservas();
  reservas.push(reserva);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(reservas));
}

function getFechaISO(date = new Date()) {
  // Devuelve YYYY-MM-DD en hora local
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

function horarioOcupado(fechaISO, horario) {
  return getReservas().some(r => r.fecha === fechaISO && r.horario === horario);
}

function mostrarError(msg) {
  const el = $('#form-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function ocultarError() {
  const el = $('#form-error');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

/* ───────────────────────────────────────────────────────────
   RENDER · SERVICIOS
   ─────────────────────────────────────────────────────────── */
function renderServicios() {
  const grid = $('#servicios-grid');
  if (!grid) return;

  grid.innerHTML = '';

  CONFIG.servicios.forEach(serv => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'servicio-item';
    btn.dataset.id = serv.id;
    btn.innerHTML = `
      <span class="servicio-nombre">${serv.nombre}</span>
      <span class="servicio-meta">${serv.duracion} min · ${serv.precio}</span>
    `;

    btn.addEventListener('click', () => seleccionarServicio(serv.id));
    grid.appendChild(btn);
  });
}

function seleccionarServicio(id) {
  state.servicioSeleccionado = id;
  ocultarError();

  $$('.servicio-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === id);
  });
}

/* ───────────────────────────────────────────────────────────
   RENDER · HORARIOS
   ─────────────────────────────────────────────────────────── */
function renderHorarios() {
  const grid = $('#horarios-grid');
  if (!grid) return;

  // Sin fecha → mensaje de ayuda
  if (!state.fechaSeleccionada) {
    grid.innerHTML = `<p class="hint">Elegí primero una fecha para ver los horarios disponibles.</p>`;
    return;
  }

  // Validar día no laborable
  const [y, m, d] = state.fechaSeleccionada.split('-').map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay();

  if (CONFIG.diasNoLaborables.includes(diaSemana)) {
    grid.innerHTML = `<p class="hint">Ese día no atendemos. Probá con otra fecha 💅</p>`;
    state.horarioSeleccionado = null;
    return;
  }

  grid.innerHTML = '';

  CONFIG.horarios.forEach(hora => {
    const ocupado = horarioOcupado(state.fechaSeleccionada, hora);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'horario-item';
    btn.textContent = hora;
    btn.disabled = ocupado;
    if (ocupado) btn.title = 'Ya reservado';

    if (state.horarioSeleccionado === hora && !ocupado) {
      btn.classList.add('selected');
    }

    btn.addEventListener('click', () => seleccionarHorario(hora));
    grid.appendChild(btn);
  });
}

function seleccionarHorario(hora) {
  state.horarioSeleccionado = hora;
  ocultarError();

  $$('.horario-item').forEach(el => {
    el.classList.toggle('selected', el.textContent === hora);
  });
}

/* ───────────────────────────────────────────────────────────
   CALENDARIO
   ─────────────────────────────────────────────────────────── */
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

// Mes visible actual del calendario (Date apuntando al 1° del mes)
let mesVisible = (() => {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
})();

function contarLibres(fechaISO) {
  return CONFIG.horarios.filter(h => !horarioOcupado(fechaISO, h)).length;
}

function colorDisponibilidad(fechaISO) {
  const total = CONFIG.horarios.length;
  if (total === 0) return 'gris';
  const libres = contarLibres(fechaISO);
  const pct = (libres / total) * 100;

  if (pct >= CONFIG.umbralDisponibilidad.verde) return 'verde';
  if (pct >= CONFIG.umbralDisponibilidad.amarillo) return 'amarillo';
  return 'rojo';
}

function esDiaNoLaborable(date) {
  return CONFIG.diasNoLaborables.includes(date.getDay());
}

function esFechaPasada(date) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return d < hoy;
}

function renderCalendario() {
  const cont = $('#calendario');
  if (!cont) return;

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();

  // Header
  const titulo = `${MESES[mes]} ${anio}`;

  // ¿Se puede ir al mes anterior? (siempre y cuando no sea antes del mes actual)
  const hoy = new Date();
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const puedeIrAtras = mesVisible > mesActual;

  cont.innerHTML = `
    <div class="calendario-header">
      <span class="calendario-titulo">${titulo}</span>
      <div class="calendario-nav">
        <button type="button" class="calendario-nav-btn" id="cal-prev" ${puedeIrAtras ? '' : 'disabled'} aria-label="Mes anterior">‹</button>
        <button type="button" class="calendario-nav-btn" id="cal-next" aria-label="Mes siguiente">›</button>
      </div>
    </div>
    <div class="calendario-grid">
      ${DIAS_SEMANA.map(d => `<span class="calendario-dia-semana">${d}</span>`).join('')}
    </div>
  `;

  const grid = cont.querySelector('.calendario-grid');

  // Día de la semana del 1° (0=domingo → queremos 0=lunes)
  const primerDia = new Date(anio, mes, 1).getDay();
  const offset = (primerDia + 6) % 7;

  // Días del mes
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  // Celdas vacías al inicio
  for (let i = 0; i < offset; i++) {
    const span = document.createElement('span');
    span.className = 'calendario-dia vacio';
    grid.appendChild(span);
  }

  // Días del mes
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(anio, mes, dia);
    const fechaISO = getFechaISO(fecha);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'calendario-dia';
    btn.dataset.fecha = fechaISO;

    const noLaborable = esDiaNoLaborable(fecha);
    const pasada = esFechaPasada(fecha);

    if (noLaborable || pasada) {
      btn.disabled = true;
    }

    if (state.fechaSeleccionada === fechaISO) {
      btn.classList.add('selected');
    }

    // Número del día
    const num = document.createElement('span');
    num.textContent = dia;
    btn.appendChild(num);

    // Dot de disponibilidad
    const dot = document.createElement('span');
    dot.className = 'calendario-dot';
    if (noLaborable || pasada) {
      dot.classList.add('gris');
    } else {
      dot.classList.add(colorDisponibilidad(fechaISO));
    }
    btn.appendChild(dot);

    btn.addEventListener('click', () => seleccionarFecha(fechaISO));
    grid.appendChild(btn);
  }

  // Eventos de navegación
  const prev = cont.querySelector('#cal-prev');
  const next = cont.querySelector('#cal-next');

  if (prev) {
    prev.addEventListener('click', () => {
      mesVisible = new Date(anio, mes - 1, 1);
      renderCalendario();
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      mesVisible = new Date(anio, mes + 1, 1);
      renderCalendario();
    });
  }
}

function seleccionarFecha(fechaISO) {
  state.fechaSeleccionada = fechaISO;
  state.horarioSeleccionado = null;
  ocultarError();
  renderCalendario();
  renderHorarios();
}

function initCalendario() {
  renderCalendario();
}

/* ───────────────────────────────────────────────────────────
   VALIDACIÓN + SUBMIT
   ─────────────────────────────────────────────────────────── */
function validarFormulario(datos) {
  if (!datos.servicio) return 'Elegí un servicio.';
  if (!datos.fecha) return 'Elegí una fecha.';
  if (!datos.horario) return 'Elegí un horario.';
  if (!datos.nombre || datos.nombre.trim().length < 2) return 'Ingresá tu nombre.';
  if (!datos.whatsapp || datos.whatsapp.replace(/\D/g, '').length < 8) return 'Ingresá un WhatsApp válido.';

  const [y, m, d] = datos.fecha.split('-').map(Number);
  const diaSemana = new Date(y, m - 1, d).getDay();
  if (CONFIG.diasNoLaborables.includes(diaSemana)) {
    return 'Ese día no atendemos, elegí otro.';
  }

  if (horarioOcupado(datos.fecha, datos.horario)) {
    return 'Ese horario ya fue reservado, elegí otro.';
  }

  return null;
}

function armarMensaje(reserva) {
  const serv = CONFIG.servicios.find(s => s.id === reserva.servicio);
  const nombreServ = serv ? serv.nombre : reserva.servicio;

  return [
    `Hola ${CONFIG.marca} 💅`,
    ``,
    `Quiero reservar un turno:`,
    `• Servicio: ${nombreServ}`,
    `• Fecha: ${formatearFecha(reserva.fecha)}`,
    `• Horario: ${reserva.horario} hs`,
    `• Nombre: ${reserva.nombre}`,
    `• WhatsApp: ${reserva.whatsapp}`,
    reserva.nota ? `• Nota: ${reserva.nota}` : null,
    ``,
    `¿Me confirmás? ¡Gracias!`
  ].filter(Boolean).join('\n');
}

function abrirWhatsApp(mensaje) {
  const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

function mostrarRevision(reserva) {
  const rev = $('#revision-turno');
  const resumen = $('#revision-resumen');
  const form = $('#form-turno');
  const header = $('#reservar-header');

  if (!rev || !resumen || !form) return;

  const serv = CONFIG.servicios.find(s => s.id === reserva.servicio);
  const nombreServ = serv ? serv.nombre : reserva.servicio;
  const duracion = serv ? ` (${serv.duracion} min)` : '';

  resumen.textContent =
    `Servicio: ${nombreServ}${duracion}\n` +
    `Fecha: ${formatearFecha(reserva.fecha)}\n` +
    `Horario: ${reserva.horario} hs\n` +
    `Nombre: ${reserva.nombre}\n` +
    `WhatsApp: ${reserva.whatsapp}` +
    (reserva.nota ? `\nNota: ${reserva.nota}` : '');

  form.hidden = true;
  if (header) header.hidden = true;

  const card = $('#reserva-exitosa');
  if (card) card.hidden = true;

  rev.hidden = false;
  rev.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarReservaExitosa(reserva) {
  const card = $('#reserva-exitosa');
  const resumen = $('#reserva-resumen');
  const codigoEl = $('#reserva-codigo-valor');
  const form = $('#form-turno');
  const header = $('#reservar-header');
  const rev = $('#revision-turno');

  if (!card || !resumen || !form) return;

  const serv = CONFIG.servicios.find(s => s.id === reserva.servicio);
  const nombreServ = serv ? serv.nombre : reserva.servicio;

  resumen.textContent =
    `Servicio: ${nombreServ}\n` +
    `Fecha: ${formatearFecha(reserva.fecha)}\n` +
    `Horario: ${reserva.horario} hs\n` +
    `A nombre de: ${reserva.nombre}`;

  if (codigoEl) codigoEl.textContent = reserva.codigo || '—';

  form.hidden = true;
  if (header) header.hidden = true;
  if (rev) rev.hidden = true;
  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Guarda la última reserva confirmada para poder editarla desde el cartel de éxito
let ultimaReservaConfirmada = null;

function editarReserva() {
  if (!ultimaReservaConfirmada) return;

  const reserva = ultimaReservaConfirmada;

  // 1) Liberamos el turno: quitamos la reserva del localStorage
  const reservas = getReservas();
  const filtradas = reservas.filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    const codNorm = (reserva.codigo || '').replace(/\D/g, '').padStart(6, '0');
    return rCod !== codNorm;
  });
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(filtradas));

  // 2) Precargamos el form con los datos originales
  state.servicioSeleccionado = reserva.servicio;
  state.fechaSeleccionada = reserva.fecha;
  state.horarioSeleccionado = reserva.horario;
  state.codigoEnEdicion = reserva.codigo;

  const inputNombre = $('#input-nombre');
  const inputWhats = $('#input-whatsapp');
  const inputNota = $('#input-nota');
  if (inputNombre) inputNombre.value = reserva.nombre || '';
  if (inputWhats)  inputWhats.value  = reserva.whatsapp || '';
  if (inputNota)   inputNota.value   = reserva.nota || '';

  // 3) Refrescamos calendario, servicios y horarios con la selección restaurada
  renderServicios();
  renderCalendario();
  renderHorarios();

  // 4) Ocultamos el cartel de éxito y mostramos el form
  const card = $('#reserva-exitosa');
  const form = $('#form-turno');
  const header = $('#reservar-header');
  if (card) card.hidden = true;
  if (form) form.hidden = false;
  if (header) header.hidden = false;

  // 5) Limpiamos la referencia a la reserva confirmada (ya no aplica)
  ultimaReservaConfirmada = null;

  const reservar = document.querySelector('#reservar');
  if (reservar) reservar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFormulario() {
  const form = $('#form-turno');
  const card = $('#reserva-exitosa');
  const header = $('#reservar-header');
  const rev = $('#revision-turno');

  state.servicioSeleccionado = null;
  state.fechaSeleccionada = null;
  state.horarioSeleccionado = null;
  state.codigoEnEdicion = null;
  ultimaReservaConfirmada = null;

  if (form) {
    form.reset();
    form.hidden = false;
  }
  if (header) header.hidden = false;
  if (card) card.hidden = true;
  if (rev) rev.hidden = true;

  ocultarError();
  renderServicios();
  renderCalendario();
  renderHorarios();

  const reservar = document.querySelector('#reservar');
  if (reservar) reservar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initFormulario() {
  const form = $('#form-turno');
  if (!form) return;

  // Guardamos los datos armados en el paso de revisión,
  // para no tener que releer el DOM cuando confirma.
  let reservaPendiente = null;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ocultarError();

    const datos = {
      servicio: state.servicioSeleccionado,
      fecha: state.fechaSeleccionada,
      horario: state.horarioSeleccionado,
      nombre: $('#input-nombre')?.value.trim() || '',
      whatsapp: $('#input-whatsapp')?.value.trim() || '',
      nota: $('#input-nota')?.value.trim() || ''
    };

    const error = validarFormulario(datos);
    if (error) {
      mostrarError(error);
      return;
    }

    // Si venimos de "Editar turno", reusamos el código original.
    // Si no, generamos uno nuevo.
    const codigo = state.codigoEnEdicion || generarCodigoReserva();
    state.codigoEnEdicion = null; // se consume una sola vez

    reservaPendiente = {
      ...datos,
      codigo,
      creadaEn: new Date().toISOString()
    };

    mostrarRevision(reservaPendiente);
  });

  // Botón "Volver" → vuelve al form sin perder lo cargado
  const btnVolver = $('#btn-volver-revision');
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      const rev = $('#revision-turno');
      if (rev) rev.hidden = true;
      form.hidden = false;
      const header = $('#reservar-header');
      if (header) header.hidden = false;
      const reservar = document.querySelector('#reservar');
      if (reservar) reservar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Botón "Confirmar por WhatsApp" → guarda, abre WhatsApp y muestra éxito
  const btnConfirmar = $('#btn-confirmar-whatsapp');
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', () => {
      if (!reservaPendiente) return;

      guardarReserva(reservaPendiente);
      abrirWhatsApp(armarMensaje(reservaPendiente));
      mostrarReservaExitosa(reservaPendiente);

      // Guardamos la reserva confirmada para poder editarla desde el cartel
      ultimaReservaConfirmada = reservaPendiente;

      reservaPendiente = null;
    });
  }

  const btnConfirmarFinal = $('#btn-confirmar-final');
  if (btnConfirmarFinal) {
    btnConfirmarFinal.addEventListener('click', resetFormulario);
  }

  const btnEditar = $('#btn-editar-reserva');
  if (btnEditar) {
    btnEditar.addEventListener('click', editarReserva);
  }
}

/* ───────────────────────────────────────────────────────────
   FOOTER · año dinámico
   ─────────────────────────────────────────────────────────── */
function initFooter() {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
}

/* ───────────────────────────────────────────────────────────
   CONSULTAR TURNO
   ─────────────────────────────────────────────────────────── */
function normalizarWhatsapp(tel) {
  return (tel || '').replace(/\D/g, '');
}

function buscarReservas(whatsapp, codigo) {
  const telNorm = normalizarWhatsapp(whatsapp);
  // Solo dígitos y rellenamos con ceros a la izquierda por si el usuario
  // tipea "4821" en lugar de "004821".
  const codNorm = (codigo || '').replace(/\D/g, '').padStart(6, '0');

  return getReservas().filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    return normalizarWhatsapp(r.whatsapp) === telNorm && rCod === codNorm;
  });
}

function renderConsulta(reservas) {
  const cont = $('#consultar-resultado');
  if (!cont) return;

  cont.innerHTML = '';

  if (!reservas.length) {
    const p = document.createElement('p');
    p.className = 'consultar-vacio';
    p.textContent = 'No encontramos una reserva con esos datos. Verificá el WhatsApp y el código.';
    cont.appendChild(p);
    cont.hidden = false;
    return;
  }

  const hoyISO = getFechaISO();
  const futuras = reservas.filter(r => r.fecha >= hoyISO);
  const pasadas = reservas.filter(r => r.fecha < hoyISO);

  [...futuras, ...pasadas].forEach(reserva => {
    const serv = CONFIG.servicios.find(s => s.id === reserva.servicio);
    const nombreServ = serv ? serv.nombre : reserva.servicio;
    const esPasada = reserva.fecha < hoyISO;

    const card = document.createElement('div');
    card.className = 'consultar-card';
    if (esPasada) card.style.opacity = '0.65';

    const resumen = document.createElement('p');
    resumen.className = 'consultar-resumen';
    resumen.textContent =
      `Código: ${reserva.codigo || '—'}\n` +
      `Servicio: ${nombreServ}\n` +
      `Fecha: ${formatearFecha(reserva.fecha)}\n` +
      `Horario: ${reserva.horario} hs\n` +
      `A nombre de: ${reserva.nombre}` +
      (reserva.nota ? `\nNota: ${reserva.nota}` : '') +
      (esPasada ? `\n\n(Esta reserva ya pasó.)` : '');

    card.appendChild(resumen);

    if (!esPasada) {
      const acciones = document.createElement('div');
      acciones.className = 'consultar-acciones';

      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'btn btn-secondary';
      btnCancelar.textContent = 'Cancelar turno';
      btnCancelar.addEventListener('click', () => {
        const ok = window.confirm('¿Seguro que querés cancelar este turno? Esta acción no se puede deshacer.');
        if (!ok) return;
        cancelarReserva(reserva.codigo);
      });

      acciones.appendChild(btnCancelar);
      card.appendChild(acciones);
    }

    cont.appendChild(card);
  });

  cont.hidden = false;
  cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelarReserva(codigo) {
  const reservas = getReservas();
  const codNorm = (codigo || '').replace(/\D/g, '').padStart(6, '0');

  const filtradas = reservas.filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    return rCod !== codNorm;
  });

  localStorage.setItem(CONFIG.storageKey, JSON.stringify(filtradas));

  const form = $('#form-consultar');
  const cont = $('#consultar-resultado');
  const error = $('#consultar-error');

  if (form) form.reset();
  if (error) error.hidden = true;
  if (cont) {
    cont.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'consultar-vacio';
    p.textContent = 'Tu turno fue cancelado. Si querés, podés reservar otro horario.';
    cont.appendChild(p);
    cont.hidden = false;
  }

  // Refrescar calendario/horarios para que el horario liberado vuelva a estar disponible
  if (typeof renderCalendario === 'function') renderCalendario();
  if (typeof renderHorarios === 'function') renderHorarios();
}

function initConsultar() {
  const form = $('#form-consultar');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const error = $('#consultar-error');
    if (error) error.hidden = true;

    const whatsapp = $('#input-consultar-whatsapp')?.value.trim() || '';
    const codigo = $('#input-consultar-codigo')?.value.trim() || '';

    if (normalizarWhatsapp(whatsapp).length < 8) {
      if (error) {
        error.textContent = 'Ingresá un WhatsApp válido.';
        error.hidden = false;
      }
      return;
    }

    const codigoLimpio = codigo.replace(/\D/g, '');
    if (codigoLimpio.length === 0) {
      if (error) {
        error.textContent = 'Ingresá el código de reserva (solo números).';
        error.hidden = false;
      }
      return;
    }

    const encontradas = buscarReservas(whatsapp, codigo);
    renderConsulta(encontradas);
  });
}


/* ───────────────────────────────────────────────────────────
   INIT
   ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderServicios();
  initCalendario();
  renderHorarios();
  initFormulario();
  initConsultar();
  initFooter();
});