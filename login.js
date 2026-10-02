/* ═══════════════════════════════════════════════════════════
   bbrina.nails · Turnos — login.js
   Modal de login para el panel de administración
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

  function init() {
    console.log('[login.js] init OK');

    const btnCuenta = $('#btn-cuenta');
    const form = $('#form-login');

    if (!btnCuenta) {
      console.warn('[login.js] No encontré #btn-cuenta');
    } else {
      btnCuenta.addEventListener('click', () => {
        console.log('[login.js] click en #btn-cuenta');
        if (sessionStorage.getItem(AUTH.storageKey) === '1') {
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // El DOM ya está listo (por ejemplo, si el script se carga tarde)
    init();
  }
})();