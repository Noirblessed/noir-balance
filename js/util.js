/* Noir Balance · utilidades · Creado por José García */
(function () {
  const NB = (window.NB = window.NB || {});
  const pad = (n) => String(n).padStart(2, '0');
  NB.pad = pad;
  NB.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  NB.ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  NB.parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  NB.today = () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  };
  NB.addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  NB.daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  NB.ym = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  NB.addMonthsYM = (ym, n) => NB.ym(new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1));
  NB.diffDays = (a, b) =>
    Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  NB.sameDay = (a, b) => NB.ymd(a) === NB.ymd(b);
  NB.weekStart = (d) => NB.addDays(d, -((d.getDay() + 6) % 7)); // lunes

  NB.MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  NB.MON3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  NB.DOW3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  NB.DOWL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  NB.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  NB.fmtShort = (s) => {
    const d = typeof s === 'string' ? NB.parse(s) : s;
    return d.getDate() + ' ' + NB.MON3[d.getMonth()];
  };
  NB.fmtLong = (s) => {
    const d = typeof s === 'string' ? NB.parse(s) : s;
    return NB.cap(NB.DOWL[d.getDay()]) + ' ' + d.getDate() + ' de ' + NB.MONTHS[d.getMonth()];
  };

  NB.num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  };
  NB.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  NB.money = (n) => {
    n = NB.num(n);
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-$' : '$') + s;
  };
  NB.money0 = (n) => {
    n = NB.num(n);
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (n < 0 ? '-$' : '$') + s;
  };
  NB.esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  NB.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  NB.greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  };
  NB.plural = (n, a, b) => (n === 1 ? a : b);
})();
