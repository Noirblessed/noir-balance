/* Noir Balance · base de la interfaz: íconos, hojas, avisos, formularios */
(function () {
  const NB = window.NB;
  NB.$ = (s, r) => (r || document).querySelector(s);
  NB.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  NB.views = {};
  NB.act = {};
  NB.forms = {};

  const ICONS = {
    home: '<path d="M3.5 10.8L12 3.5l8.5 7.3V19a1.5 1.5 0 0 1-1.5 1.5h-4v-5.5h-6v5.5H5A1.5 1.5 0 0 1 3.5 19z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18M7 15.5h3"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5"/>',
    alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14"/>',
    bank: '<path d="M3.5 9L12 4l8.5 5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17"/>',
    repeat: '<path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    chart: '<path d="M4 4v14.5A1.5 1.5 0 0 0 5.5 20H20M8 15l3.5-4.5 3 3L20 7"/>',
    dollar: '<path d="M12 3.5v17M16 7.5c-.6-1.3-2-2-4-2-2.4 0-4 1.1-4 2.9 0 4.4 8.2 1.9 8.2 6.3 0 1.8-1.6 2.9-4.2 2.9-2.1 0-3.7-.8-4.3-2.3"/>',
    list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h10a4 4 0 0 1 0 8h-3"/>',
    backspace: '<path d="M9.2 5h11.3A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9.2L3 12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>'
  };
  NB.icon = (n, sz) => {
    sz = sz || 22;
    return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  };
  NB.logo = (sz) =>
    '<svg viewBox="0 0 100 100" width="' + (sz || 34) + '" height="' + (sz || 34) + '" role="img" aria-label="Noir Balance"><g fill="#E8474A"><rect x="40" y="4" width="20" height="92"/><rect x="40" y="4" width="20" height="92" transform="rotate(60 50 50)"/><rect x="40" y="4" width="20" height="92" transform="rotate(120 50 50)"/></g></svg>';

  /* ---------- Hojas (modales) ---------- */
  NB.sheet = (html, o) => {
    o = o || {};
    const el = NB.$('#sheet');
    el.innerHTML =
      '<div class="backdrop" data-act="close"></div><div class="sheet' + (o.full ? ' full' : '') + '" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
    el.classList.add('show');
    document.body.classList.add('noscroll');
    const sc = NB.$('.sheet', el);
    if (sc) sc.scrollTop = 0;
  };
  NB.closeSheet = () => {
    const el = NB.$('#sheet');
    el.classList.remove('show');
    el.innerHTML = '';
    document.body.classList.remove('noscroll');
    NB._photo = null;
    NB._editing = null;
  };
  NB.sheetHead = (title, sub, back) =>
    '<div class="sh-head">' +
    (back ? '<button class="icon-btn" data-act="' + back + '" aria-label="Atrás">' + NB.icon('back') + '</button>' : '<span></span>') +
    '<div class="sh-title"><h2>' + NB.esc(title) + '</h2>' + (sub ? '<span class="mut small">' + NB.esc(sub) + '</span>' : '') + '</div>' +
    '<button class="icon-btn" data-act="close" aria-label="Cerrar">' + NB.icon('x') + '</button></div>';

  NB.confirm = (msg, okLabel, fn, danger) => {
    NB._confirmFn = fn;
    const el = NB.$('#dialog');
    el.innerHTML =
      '<div class="backdrop" data-act="dlg-no"></div><div class="dlg" role="alertdialog" aria-modal="true"><p>' + NB.esc(msg) + '</p>' +
      '<div class="dlg-btns"><button class="btn ghost" data-act="dlg-no">Cancelar</button><button class="btn ' + (danger === false ? 'primary' : 'danger') + '" data-act="dlg-yes">' + NB.esc(okLabel || 'Aceptar') + '</button></div></div>';
    el.classList.add('show');
  };
  NB.closeDialog = () => {
    const el = NB.$('#dialog');
    el.classList.remove('show');
    el.innerHTML = '';
  };

  let toastT;
  NB.toast = (msg) => {
    const el = NB.$('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 3200);
  };

  /* ---------- Piezas de formulario ---------- */
  NB.f = {
    text: (label, name, val, attrs) =>
      '<label class="fld"><span>' + label + '</span><input name="' + name + '" value="' + NB.esc(val == null ? '' : val) + '" ' + (attrs || '') + '></label>',
    money: (label, name, val, attrs) =>
      '<label class="fld"><span>' + label + '</span><input name="' + name + '" value="' + NB.esc(val ? val : '') + '" inputmode="decimal" placeholder="0.00" autocomplete="off" ' + (attrs || '') + '></label>',
    num: (label, name, val, attrs) =>
      '<label class="fld"><span>' + label + '</span><input name="' + name + '" value="' + NB.esc(val ? val : '') + '" inputmode="numeric" autocomplete="off" ' + (attrs || '') + '></label>',
    date: (label, name, val) => '<label class="fld"><span>' + label + '</span><input type="date" name="' + name + '" value="' + NB.esc(val || '') + '"></label>',
    select: (label, name, opts, val) =>
      '<label class="fld"><span>' + label + '</span><select name="' + name + '">' +
      opts.map((o) => '<option value="' + NB.esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + NB.esc(o[1]) + '</option>').join('') +
      '</select></label>',
    check: (label, name, val) => '<label class="chk"><input type="checkbox" name="' + name + '"' + (val ? ' checked' : '') + '><span class="box">' + NB.icon('check', 16) + '</span><span>' + label + '</span></label>'
  };
  NB.seg = (act, opts, val) =>
    '<div class="seg" role="tablist">' + opts.map((o) => '<button type="button" role="tab" aria-selected="' + (o[0] === val) + '" class="' + (o[0] === val ? 'on' : '') + '" data-act="' + act + '" data-v="' + NB.esc(o[0]) + '">' + NB.esc(o[1]) + '</button>').join('') + '</div>';

  NB.catById = (id) => NB.state.categories.find((c) => c.id === id) || { id: 'otros', name: 'Otros', color: '#94A3B8' };

  /* ---------- Fotos: reducir tamaño ---------- */
  NB.readPhoto = (file, max) =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('No se pudo leer la foto'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => rej(new Error('Foto no válida'));
        img.onload = () => {
          const k = Math.min(1, (max || 1280) / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });

  /* ---------- Lector de tickets (opcional, necesita internet la primera vez) ---------- */
  NB.parseTicket = (text) => {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const numRe = /\d{1,3}(?:,\d{3})*\.\d{2}/g;
    let amount = 0;
    lines.forEach((l) => {
      if (/total|importe|a pagar|monto|pagar/i.test(l)) {
        (l.match(numRe) || []).forEach((m) => {
          amount = Math.max(amount, NB.num(m));
        });
      }
    });
    if (!amount) (text.match(numRe) || []).forEach((m) => (amount = Math.max(amount, NB.num(m))));
    let place = '';
    for (const l of lines) {
      const letters = (l.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]/g) || []).length;
      if (letters >= 4 && letters / l.length > 0.6) {
        place = l.replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ0-9 .&'-]/g, '').trim().slice(0, 40);
        break;
      }
    }
    let cat = '';
    if (/gasolin|magna|premium|diesel|pemex|litros|combustible/i.test(text)) cat = 'gasolina';
    else if (/restaur|taco|caf[eé]|pizza|burger|sushi|comida|oxxo|super|walmart|soriana|panader/i.test(text)) cat = 'comida';
    return { amount, place, cat };
  };
  NB.ocr = async (dataUrl) => {
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = res;
        s.onerror = () => rej(new Error('sin internet'));
        document.head.appendChild(s);
      });
    }
    const worker = await window.Tesseract.createWorker('spa');
    try {
      const out = await worker.recognize(dataUrl);
      return NB.parseTicket(out.data.text || '');
    } finally {
      try {
        await worker.terminate();
      } catch (e) {}
    }
  };
})();
