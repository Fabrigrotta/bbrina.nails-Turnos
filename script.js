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
  whatsapp: '5493413902715',

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

/* Exponer CONFIG a nivel global para que admin.js (u otros scripts)
   puedan leerlo sin duplicar datos. Se accede como window.BBRINA_CONFIG. */
window.BBRINA_CONFIG = CONFIG;

/* ───────────────────────────────────────────────────────────
   ESTADO
   ─────────────────────────────────────────────────────────── */
const state = {
  servicioSeleccionado: null,
  fechaSeleccionada: null,
  horarioSeleccionado: null,
  codigoEnEdicion: null,
  reservaEnEdicion: null
};

/* ───────────────────────────────────────────────────────────
   CACHÉ DE RESERVAS · capa de compatibilidad con Supabase
   ───────────────────────────────────────────────────────────
   Mantenemos las reservas en memoria para que getReservas() siga
   siendo sincrónico. Al cargar la página se llena desde Supabase. */

let reservasCache = [];

async function cargarReservas() {
  try {
    const data = await window.SB.getReservas();
    reservasCache = data || [];
    console.log('[Cache] Reservas cargadas desde Supabase:', reservasCache.length);
  } catch (err) {
    console.error('[Cache] Error al cargar desde Supabase:', err);
    reservasCache = [];
  }
}

/* Caché de bloqueos · se llena desde Supabase al cargar la página */
let bloqueosCache = [];

async function cargarBloqueos() {
  try {
    const data = await window.SB.getBloqueos();
    bloqueosCache = data || [];
    console.log('[Cache] Bloqueos cargados desde Supabase:', bloqueosCache.length);
  } catch (err) {
    console.error('[Cache] Error al cargar bloqueos:', err);
    bloqueosCache = [];
  }
}

/* ───────────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function getReservas() {
  // Devuelve el caché en memoria (sincrónico).
  // Se llena al cargar la página con cargarReservas().
  return reservasCache;
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
  // 1) Actualizamos el caché local (sincrónico, para que se vea al toque)
  const codNuevo = (reserva.codigo || '').replace(/\D/g, '').padStart(6, '0');
  const existenteIdx = reservasCache.findIndex(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    return rCod === codNuevo;
  });

  if (existenteIdx >= 0) {
    reservasCache[existenteIdx] = reserva;
  } else {
    reservasCache.push(reserva);
  }

  // 2) Mandamos a Supabase en paralelo (no bloqueamos el UI)
  window.SB.guardarReserva(reserva).catch(err => {
    console.error('[Supabase] Error al guardar reserva:', err);
  });
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
  // Si estamos editando una reserva, ignoramos esa reserva
  // en la validación (así el propio turno no aparece como "ocupado").
  const codEnEdicion = state.codigoEnEdicion
    ? state.codigoEnEdicion.replace(/\D/g, '').padStart(6, '0')
    : null;

  return getReservas().some(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    if (codEnEdicion && rCod === codEnEdicion) return false;
    return r.fecha === fechaISO && r.horario === horario;
  });
}

function horarioBloqueado(fechaISO, horario) {
  // Devuelve true si el horario está bloqueado por la manicura.
  // Los bloqueos tienen: { fecha, horarios: [...], tipo: 'parcial'|'completo' }
  return bloqueosCache.some(b =>
    b.fecha === fechaISO &&
    Array.isArray(b.horarios) &&
    b.horarios.includes(horario)
  );
}

/* Un horario está disponible si NO está reservado Y NO está bloqueado */
function horarioNoDisponible(fechaISO, horario) {
  return horarioOcupado(fechaISO, horario) || horarioBloqueado(fechaISO, horario);
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
  // Si el usuario cambia de servicio, ya no está editando:
  // limpiamos el código y la reserva en edición.
  // (Salvo que sea el mismo servicio que ya tenía precargado.)
  if (state.reservaEnEdicion && state.reservaEnEdicion.servicio !== id) {
    state.codigoEnEdicion = null;
    state.reservaEnEdicion = null;
  }

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

  // Sin fecha → no mostramos nada (el título del paso ya explica qué hacer)
  if (!state.fechaSeleccionada) {
    grid.innerHTML = '';
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
    const reservado = horarioOcupado(state.fechaSeleccionada, hora);
    const bloqueado = horarioBloqueado(state.fechaSeleccionada, hora);
    const noDisponible = reservado || bloqueado;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'horario-item';
    btn.textContent = hora;
    btn.disabled = noDisponible;

    if (reservado) {
      btn.title = 'Ya reservado';
    } else if (bloqueado) {
      btn.title = 'No disponible';
    }

    if (state.horarioSeleccionado === hora && !noDisponible) {
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
  return CONFIG.horarios.filter(h => !horarioNoDisponible(fechaISO, h)).length;
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

  // ¿Ya estamos en el mes actual? → el botón "Hoy" se deshabilita
  const enMesActual = mesVisible.getFullYear() === hoy.getFullYear()
                    && mesVisible.getMonth() === hoy.getMonth();

  cont.innerHTML = `
    <div class="calendario-header">
      <span class="calendario-titulo">${titulo}</span>
      <div class="calendario-nav">
        <button type="button" class="calendario-nav-btn" id="cal-prev" ${puedeIrAtras ? '' : 'disabled'} aria-label="Mes anterior">‹</button>
        <button type="button" class="calendario-nav-btn" id="cal-next" aria-label="Mes siguiente">›</button>
        <button type="button" class="calendario-hoy-btn" id="cal-hoy" ${enMesActual ? 'disabled' : ''} aria-label="Ir al mes actual">Hoy</button>
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

    // Día urgente → guardamos cuántos horarios libres quedan
    // (el tooltip lo lee de acá al hover/tap)
    if (!noLaborable && !pasada) {
      const libres = contarLibres(fechaISO);
      if (libres > 0 && libres <= 3) {
        btn.classList.add('calendario-dia-urgente');
        btn.dataset.quedan = String(libres);
      }
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

    // Tooltip de urgencia: aparece al hover (desktop) o al primer tap (mobile)
    if (btn.classList.contains('calendario-dia-urgente')) {
      btn.setAttribute('aria-label',
        `${dia} · Últimos ${btn.dataset.quedan} turnos disponibles`);
    }

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

  const btnHoy = cont.querySelector('#cal-hoy');
  if (btnHoy) {
    btnHoy.addEventListener('click', () => {
      const ahora = new Date();
      mesVisible = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
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
  initTooltipUrgencia();
}

function initTooltipUrgencia() {
  const cont = document.getElementById('calendario');
  if (!cont) return;

  // Creamos el tooltip UNA sola vez y lo reutilizamos.
  let tooltip = document.getElementById('calendario-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'calendario-tooltip';
    tooltip.className = 'calendario-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
  }

  let tooltipTimer = null;

  function mostrarTooltip(btn) {
    const quedan = btn.dataset.quedan;
    if (!quedan) return;

    const n = parseInt(quedan, 10);
    const texto = n === 1
      ? 'Último turno disponible'
      : `Últimos ${n} turnos disponibles`;

    tooltip.textContent = texto;
    tooltip.hidden = false;
    tooltip.classList.remove('calendario-tooltip-visible');

    // Posicionar arriba del día, centrado
    const rect = btn.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = rect.top + window.scrollY - tooltipRect.height - 10;
    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);

    // Si se sale por la izquierda, lo pegamos al borde
    if (left < 8) left = 8;
    // Si se sale por la derecha, lo pegamos al borde
    const maxLeft = window.scrollX + document.documentElement.clientWidth - tooltipRect.width - 8;
    if (left > maxLeft) left = maxLeft;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Forzamos reflow para que la animación se dispare bien
    void tooltip.offsetWidth;
    tooltip.classList.add('calendario-tooltip-visible');
  }

  function ocultarTooltip() {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
    tooltip.classList.remove('calendario-tooltip-visible');
    // Esperamos a que termine la transición antes de ocultar
    tooltipTimer = setTimeout(() => {
      tooltip.hidden = true;
    }, 180);
  }

  // Delegación de eventos: sirve aunque el calendario se re-renderice
  cont.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('.calendario-dia-urgente');
    if (!btn || btn.disabled) return;
    mostrarTooltip(btn);
  });

  cont.addEventListener('mouseout', (e) => {
    const btn = e.target.closest('.calendario-dia-urgente');
    if (!btn) return;
    // Solo ocultamos si realmente salimos del botón
    const related = e.relatedTarget;
    if (related && btn.contains(related)) return;
    ocultarTooltip();
  });

  // En mobile: al primer tap mostramos el tooltip; al segundo, seleccionamos
  cont.addEventListener('touchstart', (e) => {
    const btn = e.target.closest('.calendario-dia-urgente');
    if (!btn || btn.disabled) return;

    const yaMostrado = tooltip.hidden === false
      && tooltip.dataset.targetFecha === btn.dataset.fecha;

    if (!yaMostrado) {
      // Primer tap: solo mostramos el tooltip
      e.preventDefault();
      tooltip.dataset.targetFecha = btn.dataset.fecha;
      mostrarTooltip(btn);
      // Auto-ocultar a los 3s
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => {
        ocultarTooltip();
        delete tooltip.dataset.targetFecha;
      }, 3000);
    } else {
      // Segundo tap: dejamos que el click normal seleccione el día
      delete tooltip.dataset.targetFecha;
      ocultarTooltip();
    }
  }, { passive: false });

  // Ocultar tooltip si se scrollea o se cambia el tamaño
  window.addEventListener('scroll', ocultarTooltip, { passive: true });
  window.addEventListener('resize', ocultarTooltip);
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

  if (horarioBloqueado(datos.fecha, datos.horario)) {
    return 'Ese horario no está disponible. Elegí otro.';
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

  const senaTexto = reserva.sena_monto
    ? `\nSeña: $${reserva.sena_monto} (comprobante adjunto)`
    : '';

  resumen.textContent =
    `Servicio: ${nombreServ}${duracion}\n` +
    `Fecha: ${formatearFecha(reserva.fecha)}\n` +
    `Horario: ${reserva.horario} hs\n` +
    `Nombre: ${reserva.nombre}\n` +
    `WhatsApp: ${reserva.whatsapp}` +
    senaTexto +
    (reserva.nota ? `\nNota: ${reserva.nota}` : '');

  form.hidden = true;
  if (header) header.hidden = true;

  const card = $('#reserva-exitosa');
  if (card) card.hidden = true;

  rev.hidden = false;
  // Disparar animación (sacamos y ponemos la clase para reiniciarla cada vez)
  rev.classList.remove('anim-fade-up');
  void rev.offsetWidth; // force reflow
  rev.classList.add('anim-fade-up');
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

  const senaTexto = reserva.sena_monto
    ? `\nSeña: $${reserva.sena_monto} (comprobante adjunto)`
    : '';

  resumen.textContent =
    `Servicio: ${nombreServ}\n` +
    `Fecha: ${formatearFecha(reserva.fecha)}\n` +
    `Horario: ${reserva.horario} hs\n` +
    `A nombre de: ${reserva.nombre}` +
    senaTexto;

  if (codigoEl) codigoEl.textContent = reserva.codigo || '—';

  form.hidden = true;
  if (header) header.hidden = true;
  if (rev) rev.hidden = true;
  card.hidden = false;
  card.classList.remove('anim-fade-up');
  void card.offsetWidth;
  card.classList.add('anim-fade-up');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Guarda la última reserva confirmada para poder editarla desde el cartel de éxito
let ultimaReservaConfirmada = null;

function editarReserva(reservaParam) {
  const reserva = reservaParam || ultimaReservaConfirmada;
  if (!reserva) return;

  // 1) Guardar la reserva en edición (NO la borramos del storage)
  state.reservaEnEdicion = reserva;

  // 2) Precargar el estado con los datos originales
  state.servicioSeleccionado = reserva.servicio;
  state.fechaSeleccionada = reserva.fecha;
  state.horarioSeleccionado = reserva.horario;
  state.codigoEnEdicion = reserva.codigo;

  // 3) Precargar los inputs
  const inputNombre = $('#input-nombre');
  const inputWhats  = $('#input-whatsapp');
  const inputNota   = $('#input-nota');
  if (inputNombre) inputNombre.value = reserva.nombre || '';
  if (inputWhats)  inputWhats.value  = reserva.whatsapp || '';
  if (inputNota)   inputNota.value   = reserva.nota || '';

  // 4) Refrescar el wizard con la selección restaurada
  renderServicios();
  renderCalendario();
  renderHorarios();

  // 5) Mostrar el form, ocultar el modal de éxito (por si veníamos de ahí)
  const card = $('#reserva-exitosa');
  const form = $('#form-turno');
  const header = $('#reservar-header');
  if (card) card.hidden = true;
  if (form) form.hidden = false;
  if (header) header.hidden = false;

  // 6) Ocultar el resultado de consulta (ya estamos en modo edición)
  const contConsultar = $('#consultar-resultado');
  if (contConsultar) contConsultar.hidden = true;

  // 7) Limpiar la referencia temporal
  ultimaReservaConfirmada = null;

  // 8) Volver al paso 1 del wizard
  if (typeof irAPasoDesdeEdicion === 'function') {
    irAPasoDesdeEdicion(1);
  }

  // 9) Scroll al formulario
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
  state.reservaEnEdicion = null;
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

  // Volver al paso 1 usando la función interna del wizard
  // (que resetea `pasoActual` y los botones correctamente)
  if (typeof window.irAPasoDesdeEdicion === 'function') {
    window.irAPasoDesdeEdicion(1);
  } else {
    // Fallback: si por alguna razón no está expuesta, hacemos la manipulación manual
    const wizardPasos = document.querySelectorAll('.wizard-paso');
    wizardPasos.forEach(el => { el.hidden = el.dataset.paso !== '1'; });

    const wizardSteps = document.querySelectorAll('.wizard-step');
    wizardSteps.forEach(el => {
      el.classList.toggle('active', el.dataset.step === '1');
      el.classList.remove('completed');
    });

    const btnPrev = document.querySelector('#btn-wizard-prev');
    const btnNext = document.querySelector('#btn-wizard-next');
    if (btnPrev) btnPrev.hidden = true;
    if (btnNext) {
      btnNext.textContent = 'Continuar';
      btnNext.disabled = true;
    }
  }

  const reservar = document.querySelector('#reservar');
  if (reservar) reservar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initFormulario() {
  const form = $('#form-turno');
  if (!form) return;

  // ── Wizard: estado del paso actual ──
  let pasoActual = 1;
  const TOTAL_PASOS = 3;

  // Guardamos los datos armados en el paso de revisión,
  // para no tener que releer el DOM cuando confirma.
  let reservaPendiente = null;

  function irAPaso(n, opciones = {}) {
    const { scroll = true } = opciones;

    pasoActual = Math.max(1, Math.min(TOTAL_PASOS, n));
    ocultarError();

    // Mostrar solo el paso actual
    $$('.wizard-paso').forEach(el => {
      const num = Number(el.dataset.paso);
      el.hidden = num !== pasoActual;
    });

    // Actualizar barra de progreso
    $$('.wizard-step').forEach(el => {
      const num = Number(el.dataset.step);
      el.classList.toggle('active', num === pasoActual);
      el.classList.toggle('completed', num < pasoActual);
    });

    // Botones
    const btnPrev = $('#btn-wizard-prev');
    const btnNext = $('#btn-wizard-next');
    if (btnPrev) btnPrev.hidden = pasoActual === 1;
    if (btnNext) btnNext.textContent = pasoActual === TOTAL_PASOS ? 'Revisar turno' : 'Continuar';

    // Refrescar estado del botón "Continuar"
    actualizarBotonContinuar();

    // Scroll suave al inicio del form (solo si `scroll` es true)
    if (scroll) {
      const reservar = document.querySelector('#reservar');
      if (reservar) reservar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function pasoEstaCompleto(n) {
    if (n === 1) return !!state.servicioSeleccionado;
    if (n === 2) return !!state.fechaSeleccionada && !!state.horarioSeleccionado;
    if (n === 3) {
      const nombre = $('#input-nombre')?.value.trim() || '';
      const whatsapp = $('#input-whatsapp')?.value.trim() || '';

      if (nombre.length < 2) return false;
      if (whatsapp.replace(/\D/g, '').length < 8) return false;

      // Si eligió "Sí" en seña, validar monto y comprobante
      const senaSeleccionada = document.querySelector('input[name="sena"]:checked')?.value || 'no';
      if (senaSeleccionada === 'si') {
        const monto = $('#input-sena-monto')?.value.trim() || '';
        const comprobante = $('#input-sena-comprobante')?.files?.[0];
        if (!monto || monto.replace(/\D/g, '').length === 0) return false;
        if (!comprobante) return false;
      }

      return true;
    }
    return false;
  }

  function actualizarBotonContinuar() {
    const btnNext = $('#btn-wizard-next');
    if (!btnNext) return;
    btnNext.disabled = !pasoEstaCompleto(pasoActual);
  }

  // Escuchar cambios que afectan la validez del paso actual
  document.addEventListener('click', (e) => {
    if (e.target.closest('.servicio-item') ||
        e.target.closest('.horario-item') ||
        e.target.closest('.calendario-dia')) {
      actualizarBotonContinuar();
    }
  });

  ['input-nombre', 'input-whatsapp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', actualizarBotonContinuar);
  });

  // Botón "Continuar" / "Revisar turno"
  const btnNext = $('#btn-wizard-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!pasoEstaCompleto(pasoActual)) return;

      if (pasoActual < TOTAL_PASOS) {
        irAPaso(pasoActual + 1);
        return;
      }

      // Estamos en el último paso → armar reserva y mostrar revisión
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

      const codigo = state.codigoEnEdicion || generarCodigoReserva();
      state.codigoEnEdicion = null;

      reservaPendiente = {
        ...datos,
        codigo,
        creadaEn: new Date().toISOString()
      };

      mostrarRevision(reservaPendiente);
    });
  }

  // Botón "Volver"
  const btnPrev = $('#btn-wizard-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (pasoActual > 1) {
        // Si el usuario vuelve al paso 1, ya no está editando:
        // limpiamos la reserva en edición (así si confirma,
        // se crea una nueva en vez de reemplazar la original).
        if (pasoActual === 2) {
          // Solo limpiamos si vuelve al paso 1 desde el 2.
          // Si vuelve del 3 al 2, seguimos en modo edición.
        }
        if (pasoActual - 1 === 1) {
          state.codigoEnEdicion = null;
          state.reservaEnEdicion = null;
        }
        irAPaso(pasoActual - 1);
      }
    });
  }

  // Botón "Volver" del paso de revisión → vuelve al último paso del wizard
  const btnVolverRevision = $('#btn-volver-revision');
  if (btnVolverRevision) {
    btnVolverRevision.addEventListener('click', () => {
      const rev = $('#revision-turno');
      if (rev) rev.hidden = true;
      const header = $('#reservar-header');
      if (header) header.hidden = false;
      form.hidden = false;
      irAPaso(TOTAL_PASOS);
    });
  }

  // Botón "Confirmar turno" del paso de revisión
  const btnConfirmar = $('#btn-confirmar-whatsapp');
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', async () => {
      if (!reservaPendiente) return;

      activarSpinner(btnConfirmar);

      // Si hay seña, subir comprobante ANTES de guardar la reserva
      const senaSeleccionada = document.querySelector('input[name="sena"]:checked')?.value || 'no';
      if (senaSeleccionada === 'si') {
        const archivo = $('#input-sena-comprobante')?.files?.[0];
        if (archivo) {
          const url = await window.SB.subirComprobante(archivo);
          if (url) {
            reservaPendiente.sena_comprobante_url = url;
          }
        }
        reservaPendiente.sena_monto = $('#input-sena-monto')?.value.trim() || '';
      }

      // Pequeño delay para que se sienta "trabajando"
      setTimeout(() => {
        guardarReserva(reservaPendiente);

        console.log('[Reserva] Mensaje que se enviaría por WhatsApp:\n' + armarMensaje(reservaPendiente));

        mostrarReservaExitosa(reservaPendiente);

        ultimaReservaConfirmada = reservaPendiente;
        reservaPendiente = null;

        // Ya no estamos editando: limpiamos la referencia
        state.reservaEnEdicion = null;
        state.codigoEnEdicion = null;

        desactivarSpinner(btnConfirmar);
      }, 400);
    });
  }

  // Botón "Confirmar" final del cartel de éxito
  const btnConfirmarFinal = $('#btn-confirmar-final');
  if (btnConfirmarFinal) {
    btnConfirmarFinal.addEventListener('click', resetFormulario);
  }

  // Botón "Editar turno" del cartel de éxito
  const btnEditar = $('#btn-editar-reserva');
  if (btnEditar) {
    btnEditar.addEventListener('click', () => editarReserva());
  }

  // Exponer irAPaso para que editarReserva() pueda resetear el wizard
  // cuando se llama desde "Consultar turno".
  window.irAPasoDesdeEdicion = irAPaso;

  // Mostrar/ocultar bloque de seña según el radio seleccionado
  const radiosSena = $$('input[name="sena"]');
  const bloqueSena = $('#bloque-sena');
  const inputSenaMonto = $('#input-sena-monto');
  const inputSenaComprobante = $('#input-sena-comprobante');

  function actualizarBloqueSena() {
    if (!bloqueSena) return;
    const seleccionado = document.querySelector('input[name="sena"]:checked')?.value || 'no';
    if (seleccionado === 'si') {
      bloqueSena.hidden = false;
    } else {
      bloqueSena.hidden = true;
      // Limpiar campos al ocultar
      if (inputSenaMonto) inputSenaMonto.value = '';
      if (inputSenaComprobante) inputSenaComprobante.value = '';
    }
    actualizarBotonContinuar();
  }

  radiosSena.forEach(radio => {
    radio.addEventListener('change', actualizarBloqueSena);
  });

  // Init: arrancamos en el paso 1 SIN scrollear (para que la página
  // cargue en el hero, no en la sección de reservar)
  irAPaso(1, { scroll: false });
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
    p.className = 'consultar-vacio anim-fade-up';
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
    const senaTexto = reserva.sena_monto
      ? `\nSeña: $${reserva.sena_monto} (comprobante adjunto)`
      : '';

    resumen.textContent =
      `Código: ${reserva.codigo || '—'}\n` +
      `Servicio: ${nombreServ}\n` +
      `Fecha: ${formatearFecha(reserva.fecha)}\n` +
      `Horario: ${reserva.horario} hs\n` +
      `A nombre de: ${reserva.nombre}` +
      senaTexto +
      (reserva.nota ? `\nNota: ${reserva.nota}` : '') +
      (esPasada ? `\n\n(Esta reserva ya pasó.)` : '');

    card.appendChild(resumen);

        if (!esPasada) {
      const acciones = document.createElement('div');
      acciones.className = 'consultar-acciones';

      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn btn-secondary';
      btnEditar.textContent = 'Editar turno';
      btnEditar.addEventListener('click', () => editarReserva(reserva));

      const btnCalendario = document.createElement('button');
      btnCalendario.type = 'button';
      btnCalendario.className = 'btn btn-secondary';
      btnCalendario.textContent = 'Agregar al calendario';
      btnCalendario.addEventListener('click', () => descargarICS(reserva));

      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'btn btn-secondary admin-btn-danger';
      btnCancelar.textContent = 'Cancelar turno';
      btnCancelar.addEventListener('click', () => abrirConfirmCancelar(card, reserva.codigo));

      acciones.appendChild(btnEditar);
      acciones.appendChild(btnCalendario);
      acciones.appendChild(btnCancelar);
      card.appendChild(acciones);
    }

    card.classList.add('anim-fade-up');
    cont.appendChild(card);
  });

  cont.hidden = false;
  cont.classList.remove('anim-fade');
  void cont.offsetWidth;
  cont.classList.add('anim-fade');
  cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function abrirConfirmCancelar(card, codigo) {
  // Si ya hay un panel abierto, lo cerramos y salimos (toggle)
  const existente = card.querySelector('.consultar-confirm');
  if (existente) {
    existente.remove();
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'consultar-confirm anim-fade-up';

  const texto = document.createElement('p');
  texto.className = 'consultar-confirm-texto';
  texto.textContent = '¿Seguro que querés cancelar este turno? Esta acción no se puede deshacer.';

  const botones = document.createElement('div');
  botones.className = 'consultar-confirm-botones';

  const btnNo = document.createElement('button');
  btnNo.type = 'button';
  btnNo.className = 'btn btn-secondary';
  btnNo.textContent = 'Volver';
  btnNo.addEventListener('click', () => panel.remove());

  const btnSi = document.createElement('button');
  btnSi.type = 'button';
  btnSi.className = 'btn btn-primary';
  btnSi.textContent = 'Sí, cancelar';
  btnSi.addEventListener('click', () => {
    cancelarReserva(codigo);
  });

  botones.appendChild(btnNo);
  botones.appendChild(btnSi);

  panel.appendChild(texto);
  panel.appendChild(botones);
  card.appendChild(panel);
}

function cancelarReserva(codigo) {
  const codNorm = (codigo || '').replace(/\D/g, '').padStart(6, '0');

  // 1) Actualizamos el caché local
  reservasCache = reservasCache.filter(r => {
    const rCod = (r.codigo || '').replace(/\D/g, '').padStart(6, '0');
    return rCod !== codNorm;
  });

  // 2) Mandamos a Supabase en paralelo
  window.SB.borrarReserva(codigo).catch(err => {
    console.error('[Supabase] Error al borrar reserva:', err);
  });

  const form = $('#form-consultar');
  const cont = $('#consultar-resultado');
  const error = $('#consultar-error');

  if (form) form.reset();
  if (error) error.hidden = true;
  if (cont) {
    cont.innerHTML = '';

    const cartel = document.createElement('div');
    cartel.className = 'consultar-exito anim-fade-up';

    // Ícono check en círculo verde
    const icono = document.createElement('span');
    icono.className = 'consultar-exito-icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // Textos
    const titulo = document.createElement('h3');
    titulo.className = 'consultar-exito-titulo';
    titulo.textContent = 'Turno cancelado';

    const texto = document.createElement('p');
    texto.className = 'consultar-exito-texto';
    texto.textContent = 'Tu reserva fue eliminada. Si querés, podés reservar otro horario.';

    // Botón para reservar otro
    const btnReservar = document.createElement('a');
    btnReservar.className = 'btn btn-primary consultar-exito-btn';
    btnReservar.href = '#reservar';
    btnReservar.textContent = 'Reservar otro turno';

    cartel.appendChild(icono);
    cartel.appendChild(titulo);
    cartel.appendChild(texto);
    cartel.appendChild(btnReservar);

    cont.appendChild(cartel);
    cont.hidden = false;
  }

  if (typeof renderCalendario === 'function') renderCalendario();
  if (typeof renderHorarios === 'function') renderHorarios();
}

/* ───────────────────────────────────────────────────────────
   UI · spinner en botones
   ─────────────────────────────────────────────────────────── */
function activarSpinner(btn) {
  if (!btn) return;
  btn.classList.add('is-loading');
  btn.disabled = true;
}

function desactivarSpinner(btn) {
  if (!btn) return;
  btn.classList.remove('is-loading');
  btn.disabled = false;
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

    // Simulamos un mini delay + spinner para que se sienta "trabajando"
    const btn = form.querySelector('button[type="submit"]');
    activarSpinner(btn);

    setTimeout(() => {
      const encontradas = buscarReservas(whatsapp, codigo);
      renderConsulta(encontradas);
      desactivarSpinner(btn);
    }, 400);
  });
}

/* ───────────────────────────────────────────────────────────
   INIT
   ─────────────────────────────────────────────────────────── */

/* ───────────────────────────────────────────────────────────
   COPIAR CÓDIGO AL PORTAPAPELES
   ─────────────────────────────────────────────────────────── */
function copiarAlPortapapeles(texto) {
  // Método moderno
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(texto);
  }
  // Fallback: textarea temporal
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function initCopiarCodigo() {
  const btn = document.getElementById('btn-copiar-codigo');
  const hint = document.getElementById('reserva-codigo-hint');
  if (!btn) return;

  const hintOriginal = hint ? hint.textContent : '';

  btn.addEventListener('click', async () => {
    const codigoEl = document.getElementById('reserva-codigo-valor');
    const codigo = codigoEl ? codigoEl.textContent.trim() : '';
    if (!codigo || codigo === '—') return;

    try {
      await copiarAlPortapapeles(codigo);

      btn.classList.add('copiado');
      if (hint) hint.textContent = '¡Copiado!';

      setTimeout(() => {
        btn.classList.remove('copiado');
        if (hint) hint.textContent = hintOriginal;
      }, 2000);
    } catch (err) {
      console.warn('[Copiar] No se pudo copiar:', err);
      if (hint) hint.textContent = 'No se pudo copiar. Anotalo manualmente.';
      setTimeout(() => {
        if (hint) hint.textContent = hintOriginal;
      }, 2500);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const esHome = !!document.querySelector('#form-turno');
  if (!esHome) return;

  // Cargamos reservas Y bloqueos desde Supabase ANTES de renderizar
  await cargarReservas();
  await cargarBloqueos();

  renderServicios();
  initCalendario();
  renderHorarios();
  initFormulario();
  initConsultar();
  initCopiarCodigo();
  initFooter();
});