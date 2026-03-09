/* ============================================
   APIQO — form-security.js
   Proteccion anti-phishing y anti-spam
   para formulario de contacto
   ============================================ */

'use strict';

(function () {

  /* ---- CONFIGURACION ---- */
  const CONFIG = {
    // Tiempo minimo que debe tardar un humano en llenar el form (ms)
    MIN_FILL_TIME_MS: 4000,

    // Dominios de correo desechables / sospechosos (lista parcial)
    DISPOSABLE_DOMAINS: [
      'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
      'throwam.com', 'yopmail.com', 'trashmail.com', 'maildrop.cc',
      'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
      'spam4.me', 'dispostable.com', 'fakeinbox.com', 'mailnull.com',
      'spamgourmet.com', 'trashmail.at', 'throwam.com', 'getairmail.com',
    ],

    // Palabras/patrones tipicos de phishing y spam
    PHISHING_PATTERNS: [
      /https?:\/\//gi,                     // URLs en el mensaje
      /bit\.ly|tinyurl|goo\.gl/gi,         // URL shorteners
      /click\s+here/gi,
      /verify\s+your\s+account/gi,
      /urgent.*account|account.*urgent/gi,
      /bank.*transfer|wire.*transfer/gi,
      /nigerian|lottery.*won|you.*won/gi,
      /free\s+money|cash\s+prize/gi,
      /password|contraseña/gi,
      /ssn|social\s+security/gi,
      /\$\$\$|€€€/g,
      /\bviagra\b|\bcialis\b/gi,
      /crypto.*invest|invest.*bitcoin/gi,
      /make\s+money\s+fast/gi,
      /\[link\]|\[url\]/gi,
    ],

    // Patrones de XSS / inyeccion de codigo
    INJECTION_PATTERNS: [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,           // onclick=, onload=, etc.
      /<iframe/gi,
      /<img[^>]+onerror/gi,
      /document\.cookie/gi,
      /eval\s*\(/gi,
      /\bexec\b|\bsystem\b/gi,
      /--.*drop\s+table/gi,    // SQL injection basico
      /'\s*(OR|AND)\s+['"\d]/gi,
    ],

    // Max intentos antes de bloquear (por sesion)
    MAX_ATTEMPTS: 5,

    // Caracteres especiales excesivos = spam
    MAX_SPECIAL_CHARS_RATIO: 0.3,
  };

  /* ---- ESTADO de sesion ---- */
  const sessionState = {
    attempts: 0,
    blockedUntil: 0,
  };

  /* ---- UTILIDADES ---- */

  /**
   * Verifica si un string contiene patrones de la lista
   */
  function matchesAnyPattern(str, patterns) {
    return patterns.some(p => p.test(str));
  }

  /**
   * Normaliza texto para analisis
   */
  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  /**
   * Calcula ratio de caracteres especiales
   */
  function specialCharRatio(str) {
    if (!str || str.length === 0) return 0;
    const specials = (str.match(/[^a-zA-Z0-9\s.,;:!?áéíóúÁÉÍÓÚñÑüÜ@()-]/g) || []).length;
    return specials / str.length;
  }

  /**
   * Verifica dominio de email
   */
  function isDisposableEmail(email) {
    const parts = (email || '').toLowerCase().split('@');
    if (parts.length !== 2) return false;
    return CONFIG.DISPOSABLE_DOMAINS.includes(parts[1]);
  }

  /**
   * Validacion de formato de email (RFC 5322 simplificado)
   */
  function isValidEmailFormat(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    return re.test(email);
  }

  /**
   * Verifica si el texto luce como spam/phishing
   */
  function analyzeText(text) {
    const issues = [];
    const str = normalize(text);

    if (matchesAnyPattern(str, CONFIG.PHISHING_PATTERNS)) {
      issues.push('phishing_pattern');
    }
    if (matchesAnyPattern(str, CONFIG.INJECTION_PATTERNS)) {
      issues.push('injection_pattern');
    }
    if (specialCharRatio(text) > CONFIG.MAX_SPECIAL_CHARS_RATIO) {
      issues.push('excessive_special_chars');
    }
    return issues;
  }

  /**
   * Verifica campos de texto basicos (longitud, vacios)
   */
  function validateRequired(value, fieldName, min = 2, max = 200) {
    const v = (value || '').trim();
    if (!v) return `El campo ${fieldName} es obligatorio.`;
    if (v.length < min) return `${fieldName} debe tener al menos ${min} caracteres.`;
    if (v.length > max) return `${fieldName} es demasiado largo.`;
    return null;
  }

  /* ---- API PUBLICA ---- */

  /**
   * Funcion principal de validacion.
   * Retorna null si todo esta bien, o un objeto { errors, blocked, blockReason }.
   *
   * @param {Object} params
   * @param {string}  params.honeypot    - Valor del campo honeypot (debe estar vacio)
   * @param {number}  params.elapsed     - Ms transcurridos desde que se cargo el form
   * @param {string}  params.nombre
   * @param {string}  params.empresa
   * @param {string}  params.email
   * @param {string}  params.telefono
   * @param {string}  params.mensaje
   * @param {number}  params.captchaVal  - Respuesta ingresada
   * @param {number}  params.captchaAns  - Respuesta correcta
   * @param {boolean} params.terminos
   */
  function validate(params) {
    const {
      honeypot, elapsed,
      nombre, empresa, email, telefono, mensaje,
      captchaVal, captchaAns,
      terminos,
    } = params;

    const errors  = {};
    let blocked   = false;
    let blockReason = '';

    /* 1. Verificar si esta bloqueado por intentos */
    if (Date.now() < sessionState.blockedUntil) {
      const secsLeft = Math.ceil((sessionState.blockedUntil - Date.now()) / 1000);
      return {
        errors: {},
        blocked: true,
        blockReason: `Demasiados intentos. Por favor espera ${secsLeft} segundos e intenta de nuevo.`,
      };
    }

    /* 2. HONEYPOT — si tiene valor, es un bot */
    if (honeypot && honeypot.trim() !== '') {
      return {
        errors: {},
        blocked: true,
        blockReason: 'Actividad sospechosa detectada. Por favor recarga la pagina.',
      };
    }

    /* 3. TIMING — muy rapido = bot */
    if (elapsed < CONFIG.MIN_FILL_TIME_MS) {
      return {
        errors: {},
        blocked: true,
        blockReason: 'Por favor completa el formulario con cuidado antes de enviarlo.',
      };
    }

    /* 4. NOMBRE */
    const nombreErr = validateRequired(nombre, 'Nombre', 2, 80);
    if (nombreErr) {
      errors.nombre = nombreErr;
    } else {
      const issues = analyzeText(nombre);
      if (issues.length > 0) errors.nombre = 'El nombre contiene contenido no permitido.';
    }

    /* 5. EMPRESA */
    const empresaErr = validateRequired(empresa, 'Empresa', 2, 100);
    if (empresaErr) {
      errors.empresa = empresaErr;
    } else {
      const issues = analyzeText(empresa);
      if (issues.length > 0) errors.empresa = 'El nombre de empresa contiene contenido no permitido.';
    }

    /* 6. EMAIL */
    if (!email || !email.trim()) {
      errors.email = 'El correo electronico es obligatorio.';
    } else if (!isValidEmailFormat(email)) {
      errors.email = 'Por favor ingresa un correo electronico valido.';
    } else if (isDisposableEmail(email)) {
      errors.email = 'Por favor usa un correo corporativo. No se aceptan correos temporales.';
    } else {
      const issues = analyzeText(email);
      if (issues.length > 0) errors.email = 'El correo contiene caracteres no permitidos.';
    }

    /* 7. TELEFONO (opcional, pero si se ingresa validar) */
    if (telefono && telefono.trim()) {
      const tel = telefono.trim();
      if (!/^[\d\s\+\-\(\)\.]{7,20}$/.test(tel)) {
        errors.telefono = 'Por favor ingresa un numero de telefono valido.';
      }
    }

    /* 8. MENSAJE */
    const mensajeErr = validateRequired(mensaje, 'Mensaje', 10, 1000);
    if (mensajeErr) {
      errors.mensaje = mensajeErr;
    } else {
      const issues = analyzeText(mensaje);
      if (issues.includes('phishing_pattern')) {
        errors.mensaje = 'El mensaje contiene enlaces o contenido sospechoso. Por favor revisa tu texto.';
      } else if (issues.includes('injection_pattern')) {
        errors.mensaje = 'El mensaje contiene contenido no permitido.';
      } else if (issues.includes('excessive_special_chars')) {
        errors.mensaje = 'El mensaje contiene demasiados caracteres especiales.';
      }
    }

    /* 9. CAPTCHA */
    if (isNaN(captchaVal) || captchaVal !== captchaAns) {
      errors.captcha = 'Respuesta incorrecta. Por favor verifica la operacion.';
    }

    /* 10. TERMINOS */
    if (!terminos) {
      errors.terminos = 'Debes aceptar la politica de privacidad para continuar.';
    }

    /* Contabilizar intento fallido */
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors || blocked) {
      sessionState.attempts++;
      if (sessionState.attempts >= CONFIG.MAX_ATTEMPTS) {
        sessionState.blockedUntil = Date.now() + 60_000; // 1 minuto
        sessionState.attempts = 0;
        return {
          errors: {},
          blocked: true,
          blockReason: 'Has superado el numero de intentos permitidos. Espera 60 segundos.',
        };
      }
    } else {
      // Exito — reiniciar intentos
      sessionState.attempts = 0;
    }

    return { errors, blocked, blockReason };
  }

  /* ---- EXPORTAR ---- */
  window.FormSecurity = { validate };

})();
