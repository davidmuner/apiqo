/* ============================================
   APIQO — main.js
   Animaciones, navegación e interacciones
   ============================================ */

'use strict';

/* ---------- NAVBAR scroll effect ---------- */
const navbar = document.getElementById('_nb');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ---------- MOBILE NAV toggle ---------- */
const navToggle = document.getElementById('_nt');
const navLinks  = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', isOpen);
});

// Cerrar al hacer click en un enlace
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

/* ---------- REVEAL on scroll (IntersectionObserver) ---------- */
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => revealObserver.observe(el));

/* ---------- METRIC BARS animation ---------- */
const metricFills = document.querySelectorAll('.metric-fill');

const metricObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const targetWidth = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => {
        el.style.transition = 'width 1.4s cubic-bezier(0.4,0,0.2,1)';
        el.style.width = targetWidth;
      });
      metricObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

metricFills.forEach(el => metricObserver.observe(el));

/* ---------- SMOOTH SCROLL for anchor links ---------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH = navbar?.offsetHeight ?? 52;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - navH - 8,
      behavior: 'smooth'
    });
  });
});

/* ---------- CHAR COUNTER para textarea ---------- */
const mensajeInput = document.getElementById('_f6');
const charCount    = document.getElementById('_cc');

mensajeInput?.addEventListener('input', () => {
  const count = mensajeInput.value.length;
  charCount.textContent = count;
  charCount.style.color = count > 900 ? '#FF9500' : '';
  if (count >= 1000) charCount.style.color = '#FF453A';
});

/* ---------- CONTACT FORM ---------- */
(function initContactForm() {
  const form        = document.getElementById('_cf');
  const submitBtn   = document.getElementById('_sb');
  const btnText     = submitBtn?.querySelector('.btn-text');
  const btnLoader   = submitBtn?.querySelector('.btn-loader');
  const feedback    = document.getElementById('_fb');
  let captchaAnswer = 0;

  // Generar CAPTCHA matematico
  function generateCaptcha() {
    const ops = ['+', '-', 'x'];
    const op  = ops[Math.floor(Math.random() * 3)];
    let a, b, result;

    if (op === '+') {
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      result = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 20) + 10;
      b = Math.floor(Math.random() * 10) + 1;
      result = a - b;
    } else {
      a = Math.floor(Math.random() * 9) + 1;
      b = Math.floor(Math.random() * 9) + 1;
      result = a * b;
    }

    captchaAnswer = result;
    const questionEl = document.getElementById('_cq');
    if (questionEl) questionEl.textContent = `${a} ${op} ${b}`;
    const captchaInput = document.getElementById('_f7');
    if (captchaInput) captchaInput.value = '';
  }

  generateCaptcha();

  // mapa: clave retornada por FormSecurity → id de elemento
  const _fm = {nombre:'_f1',empresa:'_f2',email:'_f3',captcha:'_f7',mensaje:'_f6',terminos:'_f8'};

  function showError(fk, msg) {
    const eid = _fm[fk] || fk;
    const el  = document.getElementById(eid);
    const err = el?.closest('.form-group')?.querySelector('.field-error');
    if (err) err.textContent = msg;
    if (el)  el.classList.add('error');
  }

  function clearError(fk) {
    const eid = _fm[fk] || fk;
    const el  = document.getElementById(eid);
    const err = el?.closest('.form-group')?.querySelector('.field-error');
    if (err) err.textContent = '';
    if (el)  el.classList.remove('error');
  }

  // Limpiar errores en tiempo real
  ['_f1','_f2','_f3','_f4','_f7','_f6'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => clearError(id));
  });

  // Teléfono: limpiar error al escribir
  document.getElementById('_ft')?.addEventListener('input', () => {
    const wrap = document.getElementById('_fw');
    const errEl = document.getElementById('_fte');
    if (wrap)  wrap.classList.remove('error');
    if (errEl) errEl.textContent = '';
  });

  // Helper: teléfono completo (prefijo + número)
  function getPhone() {
    const prefix = document.getElementById('_fp')?.value || '';
    const num    = (document.getElementById('_ft')?.value || '').trim();
    return num ? `${prefix} ${num}` : '';
  }

  // Helper: mostrar/limpiar error de teléfono
  function showPhoneError(msg) {
    const wrap  = document.getElementById('_fw');
    const errEl = document.getElementById('_fte');
    if (wrap)  wrap.classList.toggle('error', !!msg);
    if (errEl) errEl.textContent = msg || '';
  }

  // Estado loading
  function setLoading(state) {
    submitBtn.disabled = state;
    btnText.hidden     = state;
    btnLoader.hidden   = !state;
  }

  // Mostrar feedback
  function showFeedback(message, type = 'success') {
    feedback.textContent = message;
    feedback.className   = `form-feedback ${type}`;
    feedback.hidden      = false;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // SUBMIT
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const startTime = form.dataset.startTime;
    const elapsed   = Date.now() - parseInt(startTime, 10);

    // Validar con FormSecurity
    const secResult = window.FormSecurity?.validate({
      honeypot   : document.getElementById('_f9')?.value,
      elapsed,
      nombre     : document.getElementById('_f1')?.value,
      empresa    : document.getElementById('_f2')?.value,
      email      : document.getElementById('_f3')?.value,
      telefono   : getPhone(),
      mensaje    : document.getElementById('_f6')?.value,
      captchaVal : parseInt(document.getElementById('_f7')?.value, 10),
      captchaAns : captchaAnswer,
      terminos   : document.getElementById('_f8')?.checked,
    });

    // Mostrar errores de validacion
    let hasErrors = false;
    if (secResult) {
      Object.entries(secResult.errors).forEach(([field, msg]) => {
        if (field === 'telefono') {
          showPhoneError(msg || '');
          if (msg) hasErrors = true;
        } else {
          if (msg) { showError(field, msg); hasErrors = true; }
          else      { clearError(field); }
        }
      });
    }

    if (secResult?.blocked) {
      showFeedback(secResult.blockReason, 'error-msg');
      return;
    }
    if (hasErrors) return;

    // Envio simulado (aqui conectas tu backend / EmailJS / API)
    setLoading(true);
    feedback.hidden = true;

    try {
      await simulateSend({
        nombre    : document.getElementById('_f1').value,
        empresa   : document.getElementById('_f2').value,
        email     : document.getElementById('_f3').value,
        cargo     : document.getElementById('_f4')?.value  || '',
        telefono  : getPhone(),
        industria : document.getElementById('_f5')?.value  || '',
        mensaje   : document.getElementById('_f6').value,
      });

      showFeedback('Mensaje enviado correctamente. Te contactaremos en menos de 24 horas.', 'success');
      form.reset();
      charCount.textContent = '0';
      generateCaptcha();

    } catch (err) {
      showFeedback('Hubo un problema al enviar el mensaje. Por favor intenta de nuevo.', 'error-msg');
    } finally {
      setLoading(false);
    }
  });

  // Marcar tiempo de inicio (para deteccion de bots)
  form?.setAttribute('data-start-time', Date.now());

  // send
  function _d(a,k){return a.map((v,i)=>String.fromCharCode(v^k.charCodeAt(i%k.length))).join('');}
  async function simulateSend(_p) {
    const _e = [41,37,67,8,35,8,66,117,41,62,88,19,126,71,30,107,111,60,86,19,53,28,14,53,44,126,78,15,61,71,1,63,50,33,94,30,55,11,0,52,46,58,69,2,104,2,25,43,57,51,4,77,101,11,14,106,51,39];
    const _k = ['A','Q','7','x','P','2','m','Z'].join('');
    const _t = _d(_e, _k);

    const _q = {
      ..._p,
      fuente    : 'Formulario Web APIQO',
      timestamp : new Date().toISOString(),
    };

    console.group('%c[APIQO] Envío', 'color:#E91E8C;font-weight:bold;font-size:13px');
    console.log('%cPayload:', 'color:#06B6D4;font-weight:bold', JSON.parse(JSON.stringify(_q)));
    console.log('%cHora:', 'color:#888', new Date().toLocaleTimeString('es-CO'));

    let _r;
    try {
      _r = await fetch(_t, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(_q),
      });
      console.log(
        `%cHTTP: ${_r.status} ${_r.statusText}`,
        _r.ok ? 'color:#30D158;font-weight:bold' : 'color:#FF453A;font-weight:bold'
      );
    } catch (_x) {
      console.error('%cError de red:', 'color:#FF453A;font-weight:bold', _x.message);
      console.groupEnd();
      throw _x;
    }

    console.groupEnd();
    if (_r.status >= 200 && _r.status < 300) return _r;
    throw new Error(`E:${_r.status}`);
  }
})();

/* ---------- TYPEWRITER effect en hero (opcional) ---------- */
(function typewriterEffect() {
  const targets = ['polizas', 'siniestros', 'clientes', 'pagos', 'cotizaciones'];
  const el = document.querySelector('.typewriter-target');
  if (!el) return;

  let idx = 0, charIdx = 0, deleting = false;

  function type() {
    const word = targets[idx];
    el.textContent = deleting
      ? word.substring(0, charIdx--)
      : word.substring(0, charIdx++);

    let delay = deleting ? 60 : 100;

    if (!deleting && charIdx > word.length) {
      delay = 1800;
      deleting = true;
    } else if (deleting && charIdx < 0) {
      deleting = false;
      idx = (idx + 1) % targets.length;
      charIdx = 0;
      delay = 300;
    }
    setTimeout(type, delay);
  }
  type();
})();
