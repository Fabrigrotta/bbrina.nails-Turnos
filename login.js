/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — login.js
   Modal de login + badge de sesión activa en la home
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const AUTH = {
    email: 'bbrina.nails@admin.com',
    password: 'bbrina2026',
    storageKey: 'bbrina.admin.auth.v1',
    redirectTo: 'admin.html'
  };

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function estaLogueado() {
    return sessionStorage.getItem(AUTH.storageKey) === '1';
  }

  function abrirLogin() {
    const m = $('#modal-login');
    if (!m) {
      console.warn('[login.js] No encontré #modal-login');
      return;
    }
    m.hidden = false;
    const err = $('#login-error');
    if (err) err.hidden = true;
    const form = $('#form-login');
    if (form) form.reset();
    setTimeout(() => $('#input-login-email')?.focus(), 50);
  }

  function cerrarLogin() {
    const m = $('#modal-login');
    if (m) m.hidden = true;
  }

  /* Muestra el badge "Modo administrador" centrado en la navbar si hay sesión activa */
  function actualizarBadgeSesion() {
    const headerInner = document.querySelector('.header-inner');
    const btnCuenta = $('#btn-cuenta');
    if (!headerInner || !btnCuenta) return;

    // Sacamos un badge previo si ya existía
    const previo = headerInner.querySelector('.admin-badge');
    if (previo) previo.remove();

    if (!estaLogueado()) return;

    // Creamos el badge "Modo administrador" (no clickeable, solo informativo)
    const badge = document.createElement('span');
    badge.className = 'admin-badge';
    badge.innerHTML = `
      <span class="admin-badge-dot" aria-hidden="true"></span>
      Modo administrador
    `;
    badge.setAttribute('aria-label', 'Sesión de administrador activa');
    headerInner.appendChild(badge);
  }

  function init() {
    console.log('[login.js] init OK');

    const btnCuenta = $('#btn-cuenta');
    const form = $('#form-login');

    if (!btnCuenta) {
      console.warn('[login.js] No encontré #btn-cuenta');
    } else {
      btnCuenta.addEventListener('click', () => {
        console.log('[login.js] click en #btn-cuenta');
        if (estaLogueado()) {
          window.location.href = AUTH.redirectTo;
          return;
        }
        abrirLogin();
      });
    }

    // Cerrar modal
    $$('[data-close="modal-login"]').forEach(el => {
      el.addEventListener('click', cerrarLogin);
    });

    // Escape cierra el modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrarLogin();
    });

    // Submit
    if (!form) {
      console.warn('[login.js] No encontré #form-login');
    } else {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const err = $('#login-error');
        if (err) err.hidden = true;

        const email = ($('#input-login-email')?.value || '').trim().toLowerCase();
        const password = $('#input-login-password')?.value || '';

        if (email === AUTH.email.toLowerCase() && password === AUTH.password) {
          sessionStorage.setItem(AUTH.storageKey, '1');
          window.location.href = AUTH.redirectTo;
        } else {
          if (err) {
            err.textContent = 'Email o contraseña incorrectos.';
            err.hidden = false;
          }
        }
      });
    }

    // Si la URL tiene #login, abrimos el modal automáticamente
    if (window.location.hash === '#login') abrirLogin();

    // Actualizamos el badge de sesión al cargar
    actualizarBadgeSesion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();