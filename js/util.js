/* The Eze'Rhi'El — shared helpers (number formatting, maths, small utilities). */
(function (root) {
  'use strict';
  const EZ = (root.EZ = root.EZ || {});

  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
    'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

  EZ.notation = 'suffix';

  /** Format a number for display. */
  EZ.fmt = function (n, opts) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    if (n < 0) return '-' + EZ.fmt(-n, opts);
    const whole = opts && opts.whole;
    if (n < 1000) {
      if (whole || Number.isInteger(n)) return String(Math.floor(n));
      if (n < 10) return trimZeros(n.toFixed(2));
      if (n < 100) return trimZeros(n.toFixed(1));
      return String(Math.floor(n));
    }
    const exp = Math.floor(Math.log10(n));
    const tier = Math.floor(exp / 3);
    if (EZ.notation === 'sci' || tier >= SUFFIXES.length) {
      let m = n / Math.pow(10, exp);
      if (m >= 9.995) { m = 1; return '1.00e' + (exp + 1); }
      return m.toFixed(2) + 'e' + exp;
    }
    let m = n / Math.pow(10, tier * 3);
    let digits = m >= 100 ? 0 : m >= 10 ? 1 : 2;
    let str = m.toFixed(digits);
    if (parseFloat(str) >= 1000) { return EZ.fmt(Math.pow(10, (tier + 1) * 3), opts); }
    return str + ' ' + SUFFIXES[tier];
  };

  function trimZeros(s) {
    return s.indexOf('.') >= 0 ? s.replace(/\.?0+$/, '') : s;
  }

  EZ.fmtInt = function (n) { return EZ.fmt(Math.floor(n), { whole: true }); };

  EZ.fmtMult = function (m) {
    if (m >= 1000) return '×' + EZ.fmt(m);
    if (m >= 10) return '×' + m.toFixed(1).replace(/\.0$/, '');
    return '×' + trimZeros(m.toFixed(2));
  };

  EZ.fmtPct = function (p) { return trimZeros((p * 100).toFixed(p < 0.1 ? 1 : 0)) + '%'; };

  EZ.fmtTime = function (sec) {
    if (!isFinite(sec)) return '∞';
    sec = Math.max(0, sec);
    if (sec < 1) return sec.toFixed(1) + 's';
    if (sec < 60) return Math.floor(sec) + 's';
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
      m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm ' + s + 's';
  };

  const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  EZ.roman = function (n) {
    n = Math.floor(n);
    if (n <= 0) return '—';
    if (n > 3999) return String(n);
    let out = '';
    for (const [v, r] of ROMAN) { while (n >= v) { out += r; n -= v; } }
    return out;
  };

  EZ.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  EZ.log10 = (x) => Math.log10(Math.max(1, x));
  EZ.rand = (a, b) => a + Math.random() * (b - a);
  EZ.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /** Level lookup in one of the state's level maps. */
  EZ.L = function (s, store, id) { return (s[store] && s[store][id]) || 0; };

  EZ.escape = function (str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
})(typeof window !== 'undefined' ? window : globalThis);
