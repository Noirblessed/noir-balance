/* Noir Balance · arranque, PIN, bloqueo y eventos globales */
(function () {
  const NB = window.NB;
  const $ = NB.$;
  const A = NB.act;

  /* ---------- Tema ---------- */
  NB.applyTheme = () => {
    const th = (NB.state && NB.state.settings.theme) || 'auto';
    const dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    const eff = th === 'auto' ? (dark ? 'dark' : 'light') : th;
    document.documentElement.setAttribute('data-theme', eff);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', eff === 'dark' ? '#0A0A0C' : '#F4F3F8');
  };
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const h = () => NB.state && NB.applyTheme();
    if (mq.addEventListener) mq.addEventListener('change', h);
  }

  /* ---------- PIN (con sal, SHA-256) ---------- */
  const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  NB.hashPin = async (pin, salt) => {
    const txt = salt + ':' + pin + ':noir';
    try {
      if (window.crypto && crypto.subtle) return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)));
    } catch (e) {}
    let h = 5381;
    for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0;
    return 'x' + (h >>> 0).toString(16);
  };
  const newSalt = () => {
    const a = new Uint8Array(12);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => (a[i] = Math.floor(Math.random() * 256)));
    return hex(a);
  };
  NB.setPin = async (pin) => {
    const salt = newSalt();
    NB.state.settings.pinSalt = salt;
    NB.state.settings.pinHash = await NB.hashPin(pin, salt);
    NB.save();
  };
  NB.checkPin = async (pin) => (await NB.hashPin(pin, NB.state.settings.pinSalt)) === NB.state.settings.pinHash;

  const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']];
  let padKeyHandler = null;

  /* Pide un PIN de 6 dígitos. check(pin) -> true | false | 'mensaje'. Devuelve el PIN o null si cancelan. */
  NB.pinAsk = (o) =>
    new Promise((resolve) => {
      const root = $('#lock');
      root.className = 'lock show';
      let val = '';
      let busy = false;
      const keyHtml = KEYS.map((k) => '<button type="button" class="key" data-k="' + k[0] + '"><b>' + k[0] + '</b><span>' + k[1] + '</span></button>').join('');
      root.innerHTML =
        '<div class="lock-in"><div class="lock-logo">' + NB.logo(46) + '</div><h1>' + NB.esc(o.title) + '</h1><p class="mut" id="pinSub">' + NB.esc(o.sub || '') + '</p>' +
        '<div class="pin-dots" id="pinDots">' + '<i></i>'.repeat(6) + '</div>' +
        '<div class="keypad">' + keyHtml + '<span class="key ghost-key">' + (o.cancel ? '<button type="button" class="txt" data-k="cancel">Cancelar</button>' : '') + '</span>' +
        '<button type="button" class="key" data-k="0"><b>0</b><span></span></button>' +
        '<span class="key ghost-key"><button type="button" class="txt del" data-k="del" aria-label="Borrar">' + NB.icon('backspace', 26) + '</button></span></div>' +
        (o.forgot ? '<button type="button" class="forgot" data-k="forgot">¿Olvidaste tu PIN?</button>' : '') + '</div>';
      const dots = () => $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < val.length));
      const $$ = NB.$$;
      const finish = (v) => {
        document.removeEventListener('keydown', padKeyHandler);
        padKeyHandler = null;
        resolve(v);
      };
      const press = async (k) => {
        if (busy) return;
        if (k === 'del') val = val.slice(0, -1);
        else if (k === 'cancel') return finish(null);
        else if (k === 'forgot') {
          return NB.confirm('Si no recuerdas tu PIN, la única forma de entrar es borrar todos los datos de este iPhone (clientes, pagos, gastos y fotos). ¿Quieres borrarlos y empezar de nuevo?', 'Borrar todo', async () => {
            await NB.wipe();
            location.reload();
          });
        } else if (/^\d$/.test(k) && val.length < 6) val += k;
        dots();
        if (val.length === 6) {
          busy = true;
          const r = await o.check(val);
          if (r === true) {
            await new Promise((x) => setTimeout(x, 120));
            return finish(val);
          }
          const d = $('#pinDots');
          d.classList.add('shake');
          if (navigator.vibrate) navigator.vibrate(60);
          $('#pinSub').textContent = typeof r === 'string' ? r : 'PIN incorrecto';
          $('#pinSub').classList.add('err');
          setTimeout(() => {
            d.classList.remove('shake');
            val = '';
            dots();
            busy = false;
          }, 480);
        }
      };
      root.onclick = (e) => {
        const b = e.target.closest('[data-k]');
        if (b) press(b.dataset.k);
      };
      if (padKeyHandler) document.removeEventListener('keydown', padKeyHandler);
      padKeyHandler = (e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace') press('del');
      };
      document.addEventListener('keydown', padKeyHandler);
    });

  const hideLock = () => {
    const root = $('#lock');
    root.classList.add('out');
    setTimeout(() => {
      root.className = 'lock';
      root.innerHTML = '';
    }, 380);
  };

  NB.createPin = async () => {
    for (;;) {
      const p1 = await NB.pinAsk({ title: 'Crea tu PIN', sub: 'Elige 6 dígitos para proteger tu dinero', check: () => true });
      const p2 = await NB.pinAsk({ title: 'Confírmalo', sub: 'Escribe el mismo PIN otra vez', check: (p) => p === p1 || 'No coincide, intenta de nuevo' });
      if (p2) return p1;
    }
  };

  NB.pinFlow = {};
  A.changepin = async () => {
    const cur = await NB.pinAsk({ title: 'PIN actual', sub: 'Escríbelo para continuar', cancel: true, check: (p) => NB.checkPin(p).then((ok) => ok || 'PIN incorrecto') });
    if (!cur) return hideLock();
    const p1 = await NB.pinAsk({ title: 'PIN nuevo', sub: '6 dígitos', cancel: true, check: () => true });
    if (!p1) return hideLock();
    const p2 = await NB.pinAsk({ title: 'Confirma el nuevo PIN', sub: 'Escríbelo otra vez', cancel: true, check: (p) => p === p1 || 'No coincide, intenta de nuevo' });
    if (!p2) return hideLock();
    await NB.setPin(p1);
    hideLock();
    NB.toast('PIN actualizado');
  };

  /* ---------- Primer uso ---------- */
  NB.onboard = () =>
    new Promise((resolve) => {
      const root = $('#lock');
      root.className = 'lock show scroll';
      root.innerHTML =
        '<form class="lock-in onb" data-form="onboard" autocomplete="off"><div class="lock-logo">' + NB.logo(46) + '</div><h1>Bienvenido</h1><p class="mut">Dos datos y listo. Todo se guarda solo en tu iPhone.</p>' +
        NB.f.text('¿Cómo te llamas?', 'name', NB.state.settings.name || '', 'autocapitalize="words"') +
        NB.f.money('¿Cuánto dinero tienes hoy?', 'amount', '', 'class="big-in"') +
        '<p class="mut small">Es solo tu referencia para calcular el balance. No se conecta a ningún banco.</p>' +
        '<button class="btn primary wide" type="submit">Empezar</button></form>';
      NB._onboardDone = () => {
        root.className = 'lock';
        root.innerHTML = '';
        resolve();
      };
    });
  NB.forms.onboard = (_, form) => {
    const f = new FormData(form);
    const s = NB.state.settings;
    s.name = (f.get('name') || '').toString().trim() || 'José';
    s.startBalance = NB.num(f.get('amount'));
    s.startDate = NB.ymd(NB.today());
    s.onboarded = true;
    NB.save();
    if (NB._onboardDone) NB._onboardDone();
  };

  /* ---------- Splash ---------- */
  const asterisk = (cx, delay) => {
    let o = '<g transform="translate(' + cx + ' 50)" class="sp-ast" style="--d:' + delay + 's">';
    [0, 60, 120].forEach((a) => {
      o += '<line pathLength="1" x1="0" y1="-22" x2="0" y2="22" transform="rotate(' + a + ')"/>';
    });
    return o + '</g>';
  };
  const splash = () =>
    new Promise((resolve) => {
      const el = $('#splash');
      el.innerHTML =
        '<div class="sp-in"><svg viewBox="0 0 240 100" width="240" height="100" aria-hidden="true">' + asterisk(40, 0.15) + asterisk(120, 0.55) + asterisk(200, 0.95) + '</svg>' +
        '<h1 class="sp-t">NOIR BALANCE</h1><p class="sp-s">Tus finanzas, en orden.</p><p class="sp-c">Creado por José García</p></div>';
      el.classList.add('show');
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        el.classList.add('out');
        setTimeout(() => {
          el.className = 'splash';
          el.innerHTML = '';
          resolve();
        }, 450);
      };
      el.onclick = end;
      setTimeout(end, 2900);
    });

  /* ---------- Bloqueo ---------- */
  let hiddenAt = 0;
  let locked = true;
  NB.lockNow = async () => {
    if (locked || !NB.state || !NB.state.settings.pinHash) return;
    locked = true;
    NB.closeSheet();
    NB.closeDialog();
    $('#app').classList.add('blur');
    await NB.pinAsk({ title: 'Noir Balance', sub: 'Escribe tu PIN', forgot: true, check: (p) => NB.checkPin(p) });
    locked = false;
    $('#app').classList.remove('blur');
    hideLock();
    NB.render();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60000) NB.lockNow();
    if (!document.hidden) hiddenAt = 0;
  });

  /* ---------- Arranque ---------- */
  NB.boot = async () => {
    NB.load();
    NB.applyTheme();
    $('#app').classList.add('blur');
    await splash();
    const s = NB.state.settings;
    if (!s.pinHash) {
      const pin = await NB.createPin();
      await NB.setPin(pin);
    } else {
      await NB.pinAsk({ title: 'Noir Balance', sub: 'Escribe tu PIN', forgot: true, check: (p) => NB.checkPin(p) });
    }
    if (!s.onboarded) {
      await NB.onboard();
    } else {
      hideLock();
    }
    locked = false;
    $('#app').classList.remove('blur');
    NB.render();
    // El día 1 (o la primera vez del mes) se ofrece elegir el plan
    const ym = NB.ym(NB.today());
    if (!s.plans[ym] && s.planPrompted !== ym && NB.act.plans) {
      s.planPrompted = ym;
      NB.save();
      setTimeout(() => NB.act.plans(), 700);
    }
  };

  /* ---------- Eventos globales ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = A[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = NB.forms[f.dataset.form];
    if (fn) fn(null, f, e);
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'photoCam' || t.id === 'photoGal') {
      NB.onPhotoFile(t.files && t.files[0]);
      t.value = '';
    } else if (t.id === 'logoIn') {
      NB.onLogoFile(t.files && t.files[0]);
      t.value = '';
    } else if (t.id === 'importIn') {
      NB.onImportFile(t.files && t.files[0]);
      t.value = '';
    } else if (t.name === 'freq') {
      const f = t.closest('form');
      if (f) f.setAttribute('data-freq', t.value);
    } else if (t.dataset && t.dataset.input) {
      NB.flt[t.dataset.input] = t.value;
      NB.render();
    }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.input === 'q') {
      NB.flt.q = t.value;
      const pos = t.selectionStart;
      NB.render();
      const n = $('input[data-input="q"]');
      if (n) {
        n.focus();
        try {
          n.setSelectionRange(pos, pos);
        } catch (er) {}
      }
    }
  });
  const scrubTarget = (e) => (e.target.closest ? e.target.closest('svg.scrub') : null);
  document.addEventListener('pointerdown', (e) => {
    const s = scrubTarget(e);
    if (s) NB.charts.scrubMove(s, e);
  });
  document.addEventListener('pointermove', (e) => {
    const s = scrubTarget(e);
    if (s && (e.buttons || e.pointerType === 'mouse' || e.pointerType === 'touch' || e.pointerType === 'pen')) NB.charts.scrubMove(s, e);
  });
  document.addEventListener('pointerout', (e) => {
    const s = scrubTarget(e);
    if (s && e.pointerType === 'mouse' && !s.contains(e.relatedTarget)) NB.charts.scrubReset(s);
  });
  document.addEventListener(
    'scroll',
    (e) => {
      const car = e.target;
      if (!car || car.id !== 'car') return;
      const w = car.firstElementChild ? car.firstElementChild.offsetWidth + 12 : 1;
      const i = Math.max(0, Math.min(5, Math.round(car.scrollLeft / w)));
      NB._carIdx = i;
      NB.$$('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    },
    true
  );

  window.addEventListener('DOMContentLoaded', () => {
    NB.boot();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  });
})();
