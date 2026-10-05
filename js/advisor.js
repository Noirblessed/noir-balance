/* Noir Balance · Asesor v2
   Responde con tus datos y una base de conocimientos, hace acciones con confirmación,
   recuerda contexto y preferencias, y detecta hallazgos. Todo local, sin internet. */
(function () {
  const NB = window.NB;
  const money = (n) => NB.money(n);
  const m0 = (n) => NB.money0(n);
  const T = () => NB.today();

  /* ====================== TEXTO ====================== */
  const norm = (t) =>
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\bku/g, 'cu').replace(/\bk(?=[aou])/g, 'c').replace(/\bq\b/g, 'que').replace(/[^a-z0-9$%.,\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const STOP = new Set('de la el los las un una unos unas y o a en por para con sin que es son me mi mis tu tus su se lo le al del como cual cuales cuanto cuantos cuanta cuantas esto esta este estos mas muy ya si no hay tengo tiene puedo puede debo quiero quisiera favor porfa dime dame hola'.split(' '));
  const stem = (w) => {
    let s = w.replace(/[.,$%]/g, '');
    if (s.length > 4) { const r = s.replace(/(mente|ciones|cion|adores|ador|ando|iendo|aron|ieron|ado|ido|ares|eres|ar|er|ir|es|s)$/, ''); if (r.length >= 4) s = r; }
    if (s.length > 3) s = s.replace(/[aeiou]$/, '');
    s = s.replace(/gu$/, 'g').replace(/qu$/, 'c');
    return s;
  };
  const toks = (t) =>
    norm(t)
      .split(' ')
      .filter((w) => w && !STOP.has(w))
      .map(stem)
      .filter((w) => w.length > 0);
  const lev = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const same = (a, b) => {
    if (a === b) return true;
    const mn = Math.min(a.length, b.length);
    const mx = Math.max(a.length, b.length);
    if (mn >= 4 && mx - mn <= (mn === 4 ? 1 : 2) && (a.startsWith(b) || b.startsWith(a))) return true;
    return mn >= 6 && lev(a, b) <= 1;
  };

  /* ====================== MEMORIA ====================== */
  const mem = () => {
    const s = NB.state.settings;
    if (!s.memory) s.memory = { facts: [], prefs: {}, asks: {} };
    if (!s.memory.facts) s.memory.facts = [];
    if (!s.memory.prefs) s.memory.prefs = {};
    if (!s.memory.asks) s.memory.asks = {};
    return s.memory;
  };
  const chatLog = () => {
    if (!Array.isArray(NB.state.chat)) NB.state.chat = [];
    return NB.state.chat;
  };
  NB._ctx = NB._ctx || {};
  NB._pending = null;

  /* ====================== HECHOS ====================== */
  NB.advisorFacts = (t) => {
    t = t || T();
    const s = NB.state;
    const bal = NB.balanceAt(t);
    const apart = NB.apartados();
    const free = NB.round2(bal - apart);
    const items = NB.orderedInstances(t)
      .filter((i) => i.remaining > 0.005)
      .map((i) => {
        const weeksLeft = i.days <= 0 ? 1 : Math.max(1, Math.ceil(i.days / 7));
        return Object.assign({}, i, { weeksLeft, perWeek: NB.round2(i.remaining / weeksLeft) });
      });
    const weekNeed = NB.round2(NB.sum(items, (i) => i.perWeek));
    const expectedWeek = NB.sum(NB.expectedIncomes(t, NB.addDays(t, 6)), (e) => e.amount);
    const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    const expectedMonth = NB.sum(NB.expectedIncomes(t, end), (e) => e.amount);
    const pk = NB.currentPlanKey(t);
    const pct = NB.num(s.settings.savings[pk]);
    let baseIncome = expectedWeek;
    if (!baseIncome) {
      const from = NB.ymd(NB.addDays(t, -28));
      baseIncome = NB.sum(s.incomes.filter((x) => x.date >= from), (x) => NB.num(x.amount)) / 4;
    }
    const saveWeek = NB.round2((baseIncome * pct) / 100);
    const spendWeek = NB.weeklyEstimate(t);
    const daysLeft = Math.max(1, NB.diffDays(t, end) + 1);
    return { t, bal, apart, free, items, weekNeed, expectedWeek, expectedMonth, pk, pct, saveWeek, spendWeek, daysLeft, fund: NB.savingsFund(), rec: NB.recommend(t), baseIncome };
  };
  const due = (i) => (i.days < 0 ? 'ya venció' : i.days === 0 ? 'vence hoy' : i.days === 1 ? 'vence mañana' : 'vence el ' + NB.fmtShort(i.due));
  const prioNote = () => {
    const p = NB.priorityActive(T());
    if (!p) return null;
    return 'Usas un orden de prioridad personalizado' + (p.until ? ' hasta el ' + NB.fmtShort(p.until) : ' (hasta que lo cambies)') + '.';
  };

  /* ====================== ENTIDADES ====================== */
  const CATSYN = {
    gasolina: 'gasolina gas combustible pemex gasolinera diesel',
    comida: 'comida comer restaurante taco tacos super despensa cafe desayuno cena almuerzo pizza hamburguesa sushi',
    servicios: 'servicio servicios luz agua internet telefono',
    entretenimiento: 'entretenimiento cine netflix spotify hbo amazon streaming',
    transporte: 'transporte uber taxi camion didi estacionamiento casetas',
    ocio: 'ocio salida fiesta antro diversion',
    otros: 'otros otro'
  };
  const matchEntity = (qt, words) => {
    let n = 0;
    words.forEach((w) => {
      if (w.length >= 3 && qt.some((x) => same(x, w))) n++;
    });
    return n;
  };
  const GENERIC = new Set(['pago', 'tarjeta', 'credito', 'prestamo', 'suscripcion', 'servicio', 'renta', 'banco', 'oro']);
  const findDebts = (text) => {
    const qt = toks(text);
    const out = [];
    NB.state.debts.forEach((d) => {
      const words = toks(d.name + ' ' + (d.bank || '')).filter((w) => !GENERIC.has(w) || toks(d.name).length === 1);
      const n = matchEntity(qt, words);
      if (n > 0) {
        // posición aproximada para ordenar menciones
        const nn = norm(text);
        const first = norm(d.name).split(' ')[0];
        out.push({ d, n, pos: Math.max(0, nn.indexOf(first.slice(0, 4))) });
      }
    });
    return out.sort((a, b) => a.pos - b.pos);
  };
  const findClient = (text) => {
    const qt = toks(text);
    let best = null;
    NB.state.clients.forEach((c) => {
      const n = matchEntity(qt, toks(c.name));
      if (n > 0 && (!best || n > best.n)) best = { c, n };
    });
    return best && best.c;
  };
  const findCat = (text) => {
    const qt = toks(text);
    let best = null;
    NB.state.categories.forEach((c) => {
      const words = toks(c.name).concat(toks(CATSYN[c.id] || ''));
      const n = matchEntity(qt, words);
      if (n > 0 && (!best || n > best.n)) best = { c, n };
    });
    return best && best.c;
  };
  const parseAmount = (raw) => {
    let t = String(raw).toLowerCase().replace(/(\d)\s?(mil)\b/g, (m, a) => a + '000').replace(/\b(\d+(?:\.\d+)?)\s*k\b/g, (m, a) => String(+a * 1000));
    const m = t.match(/\$?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
    if (!m) return 0;
    return NB.round2(parseFloat(m[1].replace(/,/g, '')));
  };
  const parseDate = (t) => {
    const n = norm(t);
    if (/\banteayer\b/.test(n)) return NB.ymd(NB.addDays(T(), -2));
    if (/\bayer\b/.test(n)) return NB.ymd(NB.addDays(T(), -1));
    return NB.ymd(T());
  };
  const periodOf = (t) => {
    const n = norm(t);
    const today = T();
    const ws = NB.weekStart(today);
    if (/\bhoy\b/.test(n)) return { from: NB.ymd(today), to: NB.ymd(today), label: 'hoy' };
    if (/\bayer\b/.test(n)) return { from: NB.ymd(NB.addDays(today, -1)), to: NB.ymd(NB.addDays(today, -1)), label: 'ayer' };
    if (/semana (pasada|anterior)/.test(n)) return { from: NB.ymd(NB.addDays(ws, -7)), to: NB.ymd(NB.addDays(ws, -1)), label: 'la semana pasada' };
    if (/semana/.test(n)) return { from: NB.ymd(ws), to: NB.ymd(today), label: 'esta semana' };
    if (/mes (pasado|anterior)/.test(n)) {
      const pm = NB.addMonthsYM(NB.ym(today), -1);
      return { from: pm + '-01', to: pm + '-31', label: 'el mes pasado' };
    }
    if (/(30|treinta) dias|ultimo mes/.test(n)) return { from: NB.ymd(NB.addDays(today, -30)), to: NB.ymd(today), label: 'los últimos 30 días' };
    if (/\ba[nñ]o\b/.test(n)) return { from: today.getFullYear() + '-01-01', to: NB.ymd(today), label: 'este año' };
    return { from: NB.ym(today) + '-01', to: NB.ymd(today), label: 'este mes' };
  };
  const spent = (catId, from, to) =>
    NB.round2(NB.sum(NB.state.expenses.filter((e) => !e.pending && e.date >= from && e.date <= to && (!catId || e.category === catId)), (e) => NB.num(e.amount)));

  /* ====================== HALLAZGOS ====================== */
  NB.advisorInsights = (t) => {
    t = t || T();
    const s = NB.state;
    const f = NB.advisorFacts(t);
    const out = [];
    const add = (tone, title, text, tip, ask) => out.push({ tone, title, text, tip, ask });
    const ws = NB.weekStart(t);
    const today = NB.ymd(t);

    // 1. Ritmo de gasto de la semana
    const prevFrom = NB.ymd(NB.addDays(ws, -28));
    const prevTo = NB.ymd(NB.addDays(ws, -1));
    const prevN = s.expenses.filter((e) => !e.pending && e.date >= prevFrom && e.date <= prevTo).length;
    const prevAvg = spent(null, prevFrom, prevTo) / 4;
    const wk = spent(null, NB.ymd(ws), today);
    const dEl = NB.diffDays(ws, t) + 1;
    if (prevN >= 6 && prevAvg > 0 && wk > 0) {
      const pace = (wk / dEl) * 7;
      if (dEl >= 2 && pace > prevAvg * 1.25) add('warn', 'Vas gastando más de lo normal', 'Llevas ' + m0(wk) + ' esta semana; a este ritmo cerrarías en ~' + m0(pace) + ' contra tu promedio de ' + m0(prevAvg) + '.', 'Frena gastos no esenciales hasta el domingo para no tocar lo apartado.', '¿Cuánto puedo gastar?');
      else if (dEl >= 3 && pace < prevAvg * 0.8) add('good', 'Vas por debajo de tu promedio', 'Llevas ' + m0(wk) + ' esta semana, menos que tu promedio de ' + m0(prevAvg) + '.', 'Buen momento para mandar la diferencia a tu fondo de ahorro.', '¿Cuánto ahorro?');
    }

    // 2. Categoría que más subió (últimos 14 días vs 28 anteriores)
    let bestCat = null;
    s.categories.forEach((c) => {
      const rec = spent(c.id, NB.ymd(NB.addDays(t, -13)), today);
      const base = spent(c.id, NB.ymd(NB.addDays(t, -41)), NB.ymd(NB.addDays(t, -14))) / 2;
      const delta = rec - base;
      if (rec > base * 1.3 && delta >= 150 && (!bestCat || delta > bestCat.delta)) bestCat = { c, rec, base, delta };
    });
    if (bestCat) add('warn', bestCat.c.name + ' subió', 'En 2 semanas gastaste ' + m0(bestCat.rec) + ' en ' + bestCat.c.name + ' contra ~' + m0(bestCat.base) + ' de lo habitual (+' + m0(bestCat.delta) + ').', 'Ponle un límite semanal en Ajustes > Categorías o dime "cambia el límite de ' + bestCat.c.name.toLowerCase() + ' a ' + Math.round(bestCat.base / 2 / 10) * 10 + '".', '¿Cuánto gasté en ' + bestCat.c.name.toLowerCase() + ' este mes?');

    // 3. Lugar con más gasto
    const from60 = NB.ymd(NB.addDays(t, -60));
    const byPlace = {};
    let tot60 = 0;
    s.expenses.filter((e) => !e.pending && e.date >= from60).forEach((e) => {
      tot60 += NB.num(e.amount);
      if (e.place) {
        const k = e.place.trim().toLowerCase();
        byPlace[k] = byPlace[k] || { n: 0, v: 0, label: e.place.trim() };
        byPlace[k].n++;
        byPlace[k].v += NB.num(e.amount);
      }
    });
    const topP = Object.values(byPlace).sort((a, b) => b.v - a.v)[0];
    if (topP && topP.n >= 3 && tot60 > 0 && topP.v / tot60 >= 0.3) add('info', 'Un lugar concentra tu gasto', topP.label + ' se lleva ' + Math.round((topP.v / tot60) * 100) + '% de tus gastos de 60 días (' + m0(topP.v) + ' en ' + topP.n + ' visitas).', 'Si es gasolina o comida básica es normal; si es antojo, ahí hay ahorro fácil.');

    // 4. Suscripciones vs ingreso
    const subs = s.debts.filter((d) => d.active !== false && d.type === 'suscripcion');
    const subsTot = NB.sum(subs, (d) => NB.targetOf(d));
    const inc60 = NB.sum(s.incomes.filter((x) => x.date >= from60), (x) => NB.num(x.amount)) / 2;
    const monthlyInc = inc60 > 0 ? inc60 : f.expectedMonth;
    if (subsTot > 0 && monthlyInc > 0 && subsTot / monthlyInc > 0.15) {
      const nonWork = subs.filter((d) => d.work === false).sort((a, b) => NB.targetOf(b) - NB.targetOf(a))[0];
      add('warn', 'Suscripciones pesadas', 'Tus suscripciones suman ' + m0(subsTot) + ' al mes: ' + Math.round((subsTot / monthlyInc) * 100) + '% de tu ingreso mensual.', nonWork ? 'Considera pausar ' + nonWork.name + ' (' + m0(NB.targetOf(nonWork)) + ') si no la usas.' : 'Revisa si todas las herramientas se están usando.', 'Pausa ' + (nonWork ? nonWork.name : 'una suscripción'));
    }

    // 5. Tarjetas: utilización e intereses
    s.debts.filter((d) => d.active !== false && d.type === 'tarjeta').forEach((d) => {
      const lim = NB.num(d.limit);
      const bal = NB.num(d.balance);
      if (lim > 0 && bal > 0) {
        const u = bal / lim;
        if (u >= 0.7) add('warn', d.name + ' casi al límite', 'Usas ' + Math.round(u * 100) + '% de su límite (' + m0(bal) + ' de ' + m0(lim) + '). Arriba de 70% pesa en tu historial y te deja sin margen.', 'Bájala a menos de 30%: abona extra cuando te sobre.', 'Mis tarjetas');
      }
      const mn = NB.num(d.min);
      const ni = NB.num(d.noInterest);
      if (NB.num(d.rate) > 0 && bal > mn && mn > 0 && ni > mn) {
        const int = (bal - mn) * (NB.num(d.rate) / 1200) * 1.16;
        if (int >= 100) add('info', 'Intereses evitables en ' + d.name, 'Pagar solo el mínimo te costaría ~' + m0(int) + ' de intereses este mes.', 'Paga ' + m0(ni) + ' antes de la fecha límite para evitarlos.');
      }
    });

    // 6. Clientes atrasados
    const late = Object.keys(s.confirmations)
      .filter((k) => s.confirmations[k] === 'late')
      .map((k) => {
        const [cid, date] = k.split('|');
        const c = s.clients.find((x) => x.id === cid);
        return c ? { c, date } : null;
      })
      .filter(Boolean);
    if (late.length) {
      const l = late.sort((a, b) => (a.date < b.date ? -1 : 1))[0];
      add('warn', late.length === 1 ? l.c.name + ' está atrasado' : late.length + ' clientes atrasados', (late.length === 1 ? l.c.name + ' debía pagar el ' + NB.fmtShort(l.date) : 'El más antiguo es ' + l.c.name + ' (' + NB.fmtShort(l.date) + ')') + '. Son ' + m0(NB.sum(late, (x) => NB.num(x.c.amount))) + ' esperados.', 'Mándale un recordatorio hoy; con atrasos conviene usar el plan Liquidez.', '¿Qué clientes me deben?');
    }

    // 7. Colchón
    if (f.spendWeek > 0 && (f.fund > 0 || s.allocs.length)) {
      const weeks = f.fund / Math.max(1, f.spendWeek + f.weekNeed * 0.5);
      if (weeks < 2) add('warn', 'Colchón delgado', 'Tu fondo (' + m0(f.fund) + ') cubre menos de 2 semanas de gastos.', 'Meta inicial: 1 mes de gastos básicos; luego 3 a 6.', '¿Cuántos meses de colchón tengo?');
      else if (weeks >= 12) add('good', 'Colchón sólido', 'Tu fondo alcanza para ~' + Math.floor(weeks) + ' semanas de gastos.', 'Puedes bajar el % de ahorro y acelerar el pago de deudas.');
    }

    // 8. Proyección del mes
    const ser = NB.monthSeries(t);
    let minV = Infinity;
    let minI = -1;
    ser.vals.forEach((v, i) => {
      if (i > ser.todayIdx && v < minV) {
        minV = v;
        minI = i;
      }
    });
    if (minI >= 0 && minV < 0) add('bad', 'Podrías quedar en negativo', 'Según tus cobros y pagos esperados, el día ' + (minI + 1) + ' tu saldo bajaría a ' + money(minV) + '.', 'Adelanta cobros, recorta gastos o mueve a "último" un pago no urgente (dime "pon X al final").', '¿Cuánto tendré a fin de mes?');

    // 9. Pagos próximos sin cubrir
    const soon = f.items.filter((i) => i.days <= 7);
    const needSoon = NB.sum(soon, (i) => i.remaining);
    if (soon.length && f.free < needSoon) add('warn', 'Pagos esta semana sin cubrir', 'Vencen ' + soon.length + ' en 7 días y faltan ' + m0(needSoon) + ' por apartar; tu dinero libre es ' + m0(Math.max(0, f.free)) + '.', 'Empieza por ' + soon[0].debt.name + '. Pregúntame "dame una estrategia".', 'Dame una estrategia para pagar todo');

    // 10. Tasa de ahorro
    const from28 = NB.ymd(NB.addDays(t, -28));
    const inc28 = NB.sum(s.incomes.filter((x) => x.date >= from28), (x) => NB.num(x.amount));
    const sav28 = NB.sum(s.allocs.filter((a) => a.debtId === 'ahorro' && a.date >= from28), (a) => NB.num(a.amount));
    if (inc28 > 0) {
      const r = sav28 / inc28;
      if (r < 0.05) add('info', 'Ahorro bajo', 'Estás ahorrando ' + Math.round(r * 100) + '% de lo que cobras (últimos 28 días).', 'Intenta llegar a 10%; en ajustes del plan puedes subirlo.');
    }

    const rank = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  };

  /* ====================== RESPUESTAS CON DATOS ====================== */
  const A = {
    intro: () => ['Hola, soy tu asesor. Conozco tus pagos, clientes, gastos y plan, y también puedo explicarte finanzas, impuestos para freelance y cómo usar la app.', 'Puedo **responder** y también **hacer cosas** con tu confirmación (registrar gastos e ingresos, cambiar prioridades...). Toca **Temas** para ver ejemplos.'],
    resumen: (f) => {
      const o = ['Hoy tienes **' + money(f.bal) + '**. De eso, **' + m0(f.apart) + '** ya está apartado y **' + m0(f.free) + '** es libre.'];
      if (f.items.length) o.push('Lo más cercano: **' + f.items[0].debt.name + '** (' + due(f.items[0]) + ', faltan ' + m0(f.items[0].remaining) + ').');
      else o.push('No tienes pagos pendientes registrados. Agrégalos en la pestaña Pagos.');
      return o;
    },
    aparta: (f) => {
      if (!f.items.length) return ['No tienes pagos pendientes por apartar. Agrega tus tarjetas, préstamos y suscripciones en Pagos y te digo cuánto separar.'];
      const total = NB.round2(f.weekNeed + f.saveWeek);
      const o = ['Esta semana aparta **' + m0(total) + '**: **' + m0(f.weekNeed) + '** para pagos' + (f.saveWeek > 0 ? ' y **' + m0(f.saveWeek) + '** para tu ahorro (' + f.pct + '%).' : '.')];
      f.items.slice(0, 6).forEach((i) => o.push('• ' + i.debt.name + ': **' + m0(i.perWeek) + '** (faltan ' + m0(i.remaining) + ', ' + due(i) + ')'));
      const cover = f.free + f.expectedWeek;
      if (cover < f.weekNeed) o.push('Ojo: entre tu dinero libre (' + m0(f.free) + ') y lo que esperas cobrar esta semana (' + m0(f.expectedWeek) + ') faltan **' + m0(f.weekNeed - cover) + '**. Empieza por **' + f.items[0].debt.name + '**.');
      else o.push('Te alcanza: entre tu dinero libre y lo que esperas cobrar tienes ' + m0(cover) + '.');
      const pn = prioNote();
      if (pn) o.push(pn);
      o.push('La app solo organiza; tú separas el dinero en tu banco o efectivo.');
      return o;
    },
    alcanza: (f) => {
      const r = f.rec;
      const supply = f.free + f.expectedMonth;
      const reserve = NB.round2((f.spendWeek * f.daysLeft) / 7);
      const left = NB.round2(supply - r.obligations - reserve);
      if (!f.items.length) return ['No tienes pagos pendientes este mes, así que sí te alcanza. Tu dinero libre es ' + m0(f.free) + '.'];
      if (left >= 0) return ['Sí, este mes te alcanza para todos tus pagos.', 'Entre dinero libre (' + m0(f.free) + ') y cobros esperados (' + m0(f.expectedMonth) + ') tienes **' + m0(supply) + '**. Pagos pendientes: ' + m0(r.obligations) + ' y gastos estimados: ' + m0(reserve) + '.', 'Te sobrarían alrededor de **' + m0(left) + '**.'];
      const o = ['Con lo que tienes hoy no alcanza para todo. Te faltarían alrededor de **' + m0(-left) + '** este mes.'];
      let pool = Math.max(0, supply - reserve);
      const uncovered = [];
      f.items.forEach((i) => {
        if (pool >= i.remaining) pool -= i.remaining;
        else {
          uncovered.push(i.debt.name + ' (faltan ' + m0(i.remaining - pool) + ')');
          pool = 0;
        }
      });
      if (uncovered.length) o.push('Siguiendo tu orden de prioridad, quedarían sin completar: ' + uncovered.join(', ') + '.');
      o.push('Qué puedes hacer: cobrar clientes pendientes, pagar solo el mínimo en alguna tarjeta o pausar una suscripción que no uses. Pídeme "dame una estrategia" para ver montos.');
      return o;
    },
    primero: (f) => {
      if (!f.items.length) return ['No tienes pagos pendientes. Todo al día.'];
      const why = ['Tarjeta de crédito: genera intereses', 'Herramienta de trabajo: sin ella no produces', 'Préstamo', 'Renta o servicio'];
      const p = NB.priorityActive(T());
      const o = [p ? 'Este es tu orden **personalizado**:' : 'Este es tu orden de prioridad:'];
      f.items.slice(0, 6).forEach((i, k) => o.push(k + 1 + '. **' + i.debt.name + '** · ' + m0(i.remaining) + ' · ' + due(i) + (p ? '' : ' (' + why[i.group] + ')')));
      const pn = prioNote();
      if (pn) o.push(pn + ' Dime "restablece el orden" para volver al automático.');
      else o.push('Puedes cambiarlo: "pon CapCut antes que Adobe".');
      return o;
    },
    gastar: (f) => {
      const room = NB.round2(f.free + f.expectedWeek - f.weekNeed - f.saveWeek);
      if (!f.items.length) return ['Sin pagos pendientes, puedes usar tu dinero libre (' + m0(f.free) + ') con calma. Tu gasto normal por semana ronda ' + m0(f.spendWeek) + '.'];
      if (room <= 0) return ['Esta semana conviene gastar lo mínimo: tu dinero libre y lo que esperas cobrar apenas cubren tus apartados.', 'Cuida gasolina y comida (normalmente ' + m0(f.spendWeek) + ' por semana) y evita compras extra.'];
      return ['Después de apartar para pagos y ahorro, te quedan **' + m0(room) + '** para esta semana.', 'Tu gasto normal (gasolina y comida) es ' + m0(f.spendWeek) + ', así que ' + (room >= f.spendWeek ? 'te sobran ' + m0(room - f.spendWeek) + ' para gustos.' : 'te faltarían ' + m0(f.spendWeek - room) + ' para cubrirlo completo: ve con cuidado.')];
    },
    ahorro: (f) => {
      const o = ['Tu fondo de ahorro tiene **' + money(f.fund) + '**.'];
      if (f.saveWeek > 0) o.push('Con el plan ' + NB.PLANS[f.pk].name + ' (' + f.pct + '%) conviene guardar **' + m0(f.saveWeek) + '** esta semana.');
      else o.push('Aún no tengo ingresos para calcular tu ahorro semanal. Registra un cobro y te digo.');
      o.push('Puedes pedirme: "cambia mi ahorro a 12%".');
      return o;
    },
    plan: (f) => {
      const p = NB.PLANS[f.rec.plan];
      return ['Por tus números te conviene **' + p.name + '** (' + p.tag + ').', 'Pagos pendientes: ' + m0(f.rec.obligations) + '. Dinero libre más cobros esperados: ' + m0(f.rec.supply) + '.', 'Dime "elige el plan ' + p.name.toLowerCase() + '" y lo dejo para este mes.'];
    },
    tarjetas: () => {
      const cards = NB.state.debts.filter((d) => d.type === 'tarjeta' && d.active !== false);
      if (!cards.length) return ['No tienes tarjetas registradas. Agrégalas en Pagos > Tarjetas.'];
      const o = ['Con tus tarjetas:'];
      cards.forEach((d) => o.push(cardLine(d)));
      return o;
    },
    colchon: (f) => {
      const base = f.spendWeek + f.weekNeed * 0.5;
      const weeks = base > 0 ? f.fund / base : 0;
      return ['Tu fondo de ahorro es **' + money(f.fund) + '**. Con tu gasto semanal normal (~' + m0(f.spendWeek) + ') y tus pagos, te cubriría ~**' + weeks.toFixed(1) + ' semanas** (' + (weeks / 4.3).toFixed(1) + ' meses).', 'Meta recomendada: de 3 a 6 meses (6 si tus ingresos varían). ' + (weeks / 4.3 < 3 ? 'Te faltan ~' + m0(Math.max(0, 3 * 4.3 * base - f.fund)) + ' para llegar a 3 meses.' : 'Ya pasaste la meta mínima.')];
    },
    finmes: (f) => {
      const ser = NB.monthSeries(T());
      const last = ser.vals[ser.vals.length - 1];
      let minV = Infinity;
      let minI = -1;
      ser.vals.forEach((v, i) => {
        if (i >= ser.todayIdx && v < minV) {
          minV = v;
          minI = i;
        }
      });
      const o = ['A fin de mes tendrías alrededor de **' + money(last) + '** (proyección con tus cobros y pagos esperados y tu gasto promedio).'];
      if (minV < 0) o.push('Ojo: el día ' + (minI + 1) + ' bajarías a ' + money(minV) + '. Revisa pagos ese día.');
      else o.push('Tu punto más bajo sería ' + money(minV) + ' el día ' + (minI + 1) + '.');
      return o;
    },
    clientes: (f) => {
      const s = NB.state;
      const o = [];
      const late = Object.keys(s.confirmations)
        .filter((k) => s.confirmations[k] === 'late')
        .map((k) => {
          const [cid, date] = k.split('|');
          const c = s.clients.find((x) => x.id === cid);
          return c ? c.name + ' (' + NB.fmtShort(date) + ', ' + m0(c.amount) + ')' : null;
        })
        .filter(Boolean);
      if (late.length) o.push('Atrasados: **' + late.join(', ') + '**.');
      else o.push('No tienes cobros marcados como atrasados.');
      const exp = NB.expectedIncomes(T(), NB.addDays(T(), 13));
      if (exp.length) {
        o.push('Próximos 14 días esperas **' + m0(NB.sum(exp, (e) => e.amount)) + '**:');
        exp.slice(0, 6).forEach((e) => o.push('• ' + (e.client ? e.client.name : 'Ingreso estimado') + ' · ' + m0(e.amount) + ' · ' + NB.fmtShort(e.date)));
      } else o.push('No tienes cobros esperados en 14 días. Agrega clientes en Ajustes > Clientes.');
      return o;
    }
  };
  const cardLine = (d) => {
    const ni = NB.num(d.noInterest);
    const mn = NB.num(d.min);
    let t = '• **' + d.name + '**: ';
    if (ni > 0) t += 'paga **' + m0(ni) + '** antes de su fecha límite (día ' + (d.dueDay || '—') + ') para no generar intereses';
    else t += 'registra tu "pago para no generar intereses" para decirte más';
    if (mn > 0) t += ' (mínimo ' + m0(mn) + ')';
    if (NB.num(d.rate) > 0 && NB.num(d.balance) > mn && mn > 0) t += '. Pagando solo el mínimo pagarías ~' + m0((NB.num(d.balance) - mn) * (NB.num(d.rate) / 1200) * 1.16) + ' de intereses este mes';
    if (NB.num(d.limit) > 0 && NB.num(d.balance) > 0) t += '. Usas ' + Math.round((NB.num(d.balance) / NB.num(d.limit)) * 100) + '% del límite';
    return t + '.';
  };

  const debtDetail = (d) => {
    const t = T();
    const i = NB.instances(t).find((x) => x.debt.id === d.id);
    const o = ['**' + d.name + '** (' + (NB.TYPE_NAMES[d.type] || d.type).toLowerCase() + '):'];
    if (d.active === false) o.push('Está en pausa: la app no aparta para él.');
    if (i) {
      o.push('Toca pagar **' + money(i.target) + '** · ' + due(i) + '.');
      o.push('Llevas apartado ' + money(Math.min(i.allocated, i.target)) + ' y faltan **' + money(i.remaining) + '**.');
    }
    if (d.type === 'tarjeta') {
      o.push(cardLine(d));
      if (d.cutDay) o.push('Su corte es el día ' + d.cutDay + '.');
    } else if (NB.num(d.balance) > 0) o.push('Saldo pendiente: ' + m0(d.balance) + (NB.num(d.rate) ? ', tasa ' + d.rate + '% anual' : '') + '.');
    return o;
  };

  const reparto = (amount, label) => {
    const t = T();
    const pk = NB.currentPlanKey(t);
    const res = NB.computeAllocation(amount, pk, t);
    const o = ['Con **' + m0(amount) + '**' + (label ? ' (' + label + ')' : '') + ' y el plan ' + NB.PLANS[pk].name + ' te sugiero:'];
    if (res.savings > 0) o.push('• Ahorro: **' + m0(res.savings) + '** (' + res.pct + '%)');
    res.lines.forEach((l) => {
      if (l.amount > 0) o.push('• ' + l.debt.name + ': **' + m0(l.amount) + '** (vence ' + NB.fmtShort(l.due) + ', faltan ' + m0(l.remaining) + ')');
    });
    if (res.expenseReserve > 0) o.push('• Gastos de la semana (gasolina y comida): **' + m0(res.expenseReserve) + '**');
    if (res.free > 0) o.push('• Libre para ti: **' + m0(res.free) + '**');
    if (res.shortfall.length) o.push('No alcanza para todo: ' + res.shortfall.map((x) => x.name + ' (faltan ' + m0(x.missing) + ')').join(', ') + '.');
    const pn = prioNote();
    if (pn) o.push(pn);
    return o;
  };

  const strategy = (f) => {
    const s = NB.state;
    if (!f.items.length) return ['No tienes pagos pendientes, no necesitas estrategia por ahora. Mantén tu ahorro y revisa Pagos cuando se acerque un vencimiento.'];
    const o = ['**Tu situación:** libre ' + m0(Math.max(0, f.free)) + ', cobros esperados esta semana ' + m0(f.expectedWeek) + ', y por apartar ' + m0(f.rec.obligations) + ' en el mes.'];
    let cash = Math.max(0, f.free);
    const lines = [];
    f.items.forEach((i) => {
      const need = i.days <= 7 ? i.remaining : i.perWeek;
      const give = Math.min(need, cash);
      cash -= give;
      lines.push({ i, need, give });
    });
    o.push('**Paso 1 · Con tu dinero libre hoy:**');
    lines.forEach((l) => {
      if (l.give > 0) o.push('• ' + l.i.debt.name + ': aparta **' + m0(l.give) + '**' + (l.give < l.need ? ' (necesita ' + m0(l.need) + ' esta semana)' : ' ✔'));
    });
    const short = lines.filter((l) => l.give < l.need - 0.5);
    if (short.length) {
      const miss = NB.sum(short, (l) => l.need - l.give);
      o.push('Faltan **' + m0(miss) + '** para cubrir lo de esta semana (' + short.map((l) => l.i.debt.name).join(', ') + ').');
      o.push('**Paso 2 · Cómo cubrir el faltante:**');
      if (f.expectedWeek > 0) o.push('• Tus cobros esperados (' + m0(f.expectedWeek) + ') ' + (f.expectedWeek >= miss ? 'alcanzan: apártalos apenas lleguen.' : 'cubren una parte; cobra pendientes lo antes posible.'));
      const subs = s.debts.filter((d) => d.active !== false && d.type === 'suscripcion' && d.work === false);
      if (subs.length) o.push('• Pausa suscripciones que no son de trabajo: ' + subs.map((d) => d.name + ' (' + m0(NB.targetOf(d)) + ')').join(', ') + '.');
      o.push('• Usa el plan **Liquidez** o baja temporal tu ahorro a 5% para liberar flujo.');
      const cards = s.debts.filter((d) => d.active !== false && d.type === 'tarjeta' && NB.num(d.min) > 0);
      if (cards.length) o.push('• Si aún falta, en tarjetas paga el mínimo (' + cards.map((d) => d.name + ' ' + m0(d.min)).join(', ') + ') y no te atrases; negocia el resto.');
    } else o.push('Con eso cubres esta semana sin problema.');
    const cc = s.debts.filter((d) => d.active !== false && d.type === 'tarjeta' && NB.num(d.balance) > 0 && NB.num(d.rate) > 0).sort((a, b) => NB.num(b.rate) - NB.num(a.rate));
    if (cc.length >= 2) o.push('**Para bajar intereses (avalancha):** después de cubrir mínimos, manda todo extra a **' + cc[0].name + '** (' + cc[0].rate + '% anual), luego ' + cc[1].name + '.');
    else if (cc.length === 1 && NB.num(cc[0].noInterest) < NB.num(cc[0].balance)) o.push('Tu saldo en ' + cc[0].name + ' (' + m0(cc[0].balance) + ') supera el pago para no generar intereses (' + m0(cc[0].noInterest) + '): intenta acercarte al saldo total poco a poco.');
    o.push('Pregúntame "dime exactamente cuánto dar a cada cosa" cuando te llegue un cobro, o "pon X primero" si quieres otro orden.');
    return o;
  };

  const statQuery = (text) => {
    const p = periodOf(text);
    const cat = findCat(text);
    const total = spent(cat && cat.id, p.from, p.to);
    const list = NB.state.expenses.filter((e) => !e.pending && e.date >= p.from && e.date <= p.to && (!cat || e.category === cat.id));
    NB._ctx.catId = cat && cat.id;
    const o = ['En ' + (cat ? '**' + cat.name + '**' : 'todo') + ' ' + p.label + ' llevas **' + money(total) + '** en ' + list.length + ' ' + NB.plural(list.length, 'gasto', 'gastos') + '.'];
    if (!list.length) return ['No tengo gastos registrados' + (cat ? ' de ' + cat.name : '') + ' para ' + p.label + '.'];
    if (!cat) {
      const by = {};
      list.forEach((e) => (by[e.category] = (by[e.category] || 0) + NB.num(e.amount)));
      Object.keys(by)
        .sort((a, b) => by[b] - by[a])
        .slice(0, 4)
        .forEach((k) => o.push('• ' + NB.catById(k).name + ': ' + m0(by[k]) + ' (' + Math.round((by[k] / total) * 100) + '%)'));
    } else {
      const lim = NB.num(cat.weekly);
      if (lim > 0 && /semana/.test(p.label)) o.push('Tu límite semanal es ' + m0(lim) + ': ' + (total > lim ? 'te pasaste por ' + m0(total - lim) : 'te quedan ' + m0(lim - total)) + '.');
      const pl = {};
      list.forEach((e) => {
        if (e.place) pl[e.place.trim()] = (pl[e.place.trim()] || 0) + NB.num(e.amount);
      });
      const top = Object.keys(pl).sort((a, b) => pl[b] - pl[a])[0];
      if (top) o.push('Donde más: ' + top + ' (' + m0(pl[top]) + ').');
    }
    return o;
  };

  /* ====================== ACCIONES (con confirmación) ====================== */
  const newPending = (p) => {
    p.id = NB.uid();
    NB._pending = p;
    return p;
  };
  const ask = (summary, p) => {
    newPending(p);
    return { t: summary.concat(['¿Lo hago?']), pid: p.id, btns: 'confirm' };
  };
  const moveInOrder = (order, id, mode, ref) => {
    const o = order.filter((x) => x !== id);
    if (mode === 'first') o.unshift(id);
    else if (mode === 'last') o.push(id);
    else {
      const at = o.indexOf(ref);
      if (at < 0) o.push(id);
      else o.splice(mode === 'before' ? at : at + 1, 0, id);
    }
    return o;
  };
  const currentOrderIds = () => NB.orderedInstances(T()).map((i) => i.debt.id);
  const dname = (id) => (NB.state.debts.find((d) => d.id === id) || { name: '?' }).name;

  const parseAction = (raw) => {
    const t = norm(raw);
    const s = NB.state;
    const amt = parseAmount(raw);
    const isQuestion = /\?/.test(raw) || /^(cuanto|cuantos|cuanta|que|como|donde|cuando|cual|por que|puedo|me alcanza)/.test(t);

    // restablecer prioridad
    if (/(restablece|restablecer|resetea|quita|elimina|vuelve|regresa|automatico).*(orden|prioridad)|orden (original|automatico|normal)/.test(t)) {
      if (!s.settings.priority) return { t: ['Ya estás usando el orden automático (tarjetas, herramientas de trabajo, préstamos, servicios; por fecha).'] };
      return ask(['Voy a **restablecer el orden automático** de prioridades (tarjetas, herramientas de trabajo, préstamos y servicios).'], { kind: 'prioreset' });
    }

    // prioridad: X antes que Y / X primero / X al final
    if (/(pon|poner|pasa|pasar|mueve|mover|prioriza|priorizar|quiero|cambia|cambiar|coloca|manda|despriorizar|ordena).*(antes|despues|primero|primer|ultimo|final|prioridad|sobre|importante)/.test(t) || /(prioriza|priorizar|despriorizar)\s/.test(t) || /(antes (que|de))|despues (que|de)/.test(t) && !isQuestion) {
      const ds = findDebts(raw);
      if (ds.length) {
        const order = currentOrderIds();
        const rel = t.match(/\b(antes (?:que|de)|despues (?:que|de)|sobre)\b/);
        let mode;
        let target = ds[0].d;
        let ref = null;
        if (rel && ds.length >= 2) {
          const before = /antes|sobre/.test(rel[1]);
          // la deuda que se menciona antes de la palabra relacional es la que se mueve
          const idx = t.indexOf(rel[1]);
          const left = ds.filter((x) => x.pos < idx);
          const right = ds.filter((x) => x.pos >= idx);
          target = (left[left.length - 1] || ds[0]).d;
          ref = (right[0] || ds[1]).d;
          mode = before ? 'before' : 'after';
        } else if (/(ultimo|final|despriorizar|al fondo)/.test(t)) mode = 'last';
        else mode = 'first';
        if (ref && ref.id === target.id) return null;
        const newOrder = moveInOrder(order, target.id, mode, ref && ref.id);
        const lines = ['Voy a poner **' + target.name + '** ' + (mode === 'first' ? 'como **primera prioridad**' : mode === 'last' ? 'al **final**' : (mode === 'before' ? 'antes de ' : 'después de ') + '**' + ref.name + '**') + '.', 'Nuevo orden: ' + newOrder.slice(0, 6).map((id, k) => k + 1 + '. ' + dname(id)).join(' · ')];
        newPending({ kind: 'prio', order: newOrder });
        return { t: lines.concat(['¿Por cuánto tiempo quieres este orden?']), pid: NB._pending.id, btns: 'scope' };
      }
    }

    // pagar un pago
    if (/\b(pague|pagamos|ya pague|liquide|ya liquide|abone|pagado)\b/.test(t) && !isQuestion) {
      const ds = findDebts(raw);
      if (ds.length) {
        const d = ds[0].d;
        const inst = NB.instances(T()).find((i) => i.debt.id === d.id);
        const amount = amt > 0 ? amt : inst ? inst.target : NB.targetOf(d);
        if (inst && NB.isPaid(d, inst.ym)) return { t: [d.name + ' ya está pagado este mes.'] };
        return ask(['Voy a marcar **' + d.name + '** como pagado por **' + money(amount) + '** (hoy).' + (d.type === 'tarjeta' && NB.num(d.balance) > 0 ? ' Su saldo bajará.' : '')], { kind: 'pay', debtId: d.id, ym: inst ? inst.ym : NB.ym(T()), amount, date: parseDate(raw) });
      }
    }

    // ingreso
    if (/(me pago|me pagaron|me pagan hoy|me deposit|cobre|me cobre|recibi|me llego|me transfirio|me entro|ingreso de|pago de)/.test(t) && !isQuestion) {
      const c = findClient(raw);
      const amount = amt > 0 ? amt : c ? NB.num(c.amount) : 0;
      if (amount > 0) {
        const res = NB.computeAllocation(amount, NB.currentPlanKey(T()), T());
        return ask(['Voy a registrar un ingreso de **' + money(amount) + '**' + (c ? ' de **' + c.name + '**' : '') + ' (' + NB.fmtShort(parseDate(raw)) + ').', 'Se repartirá así: ahorro ' + m0(res.savings) + ', pagos ' + m0(NB.sum(res.lines, (l) => l.amount)) + ', gastos ' + m0(res.expenseReserve) + ', libre ' + m0(res.free) + '.'], { kind: 'income', amount, clientId: c ? c.id : '', date: parseDate(raw), note: c ? '' : 'Desde el asesor' });
      }
    }

    // gasto
    if (/\b(gaste|gasto|compre|pague|pagamos|me cobraron|salio|invertí|inverti)\b/.test(t) && amt > 0 && !isQuestion) {
      const cat = findCat(raw) || (/gasolin|pemex/.test(t) ? s.categories.find((c) => c.id === 'gasolina') : null) || s.categories.find((c) => c.id === 'otros') || s.categories[0];
      const pm = raw.match(/\ben\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9][^,.\d$]*?)(?:\s+(?:por|de|con|ayer|hoy|anteayer)\b|$)/i);
      let place = pm ? pm[1].trim() : '';
      const nc = norm(place);
      if (place && cat && (norm(cat.name) === nc || (CATSYN[cat.id] || '').split(' ').includes(nc))) place = /pemex/.test(nc) ? 'Pemex' : '';
      place = place.replace(/^(la|el|los|las|un|una)\s+/i, '').slice(0, 40);
      const lim = NB.num(cat.weekly);
      const after = NB.weekSpent(cat.id, T()) + amt;
      return ask(['Voy a registrar un gasto de **' + money(amt) + '** en **' + cat.name + '**' + (place ? ' (' + place + ')' : '') + ', ' + NB.fmtShort(parseDate(raw)) + '.'].concat(lim > 0 && after > lim ? ['Ojo: con este gasto te pasarías de tu límite semanal de ' + cat.name + ' (' + m0(lim) + ').'] : []), { kind: 'expense', amount: amt, category: cat.id, place, date: parseDate(raw) });
    }

    // crear categoría
    const cm = t.match(/(?:crea|agrega|anade|nueva|crear|agregar)\s+(?:la\s+|una\s+)?categoria\s+(?:de\s+|llamada\s+)?([a-z0-9 ]+?)(?:\s+(?:con|de)\s+(?:limite|presupuesto).*)?$/);
    if (cm) {
      const rawName = (raw.match(/categor[ií]a\s+(?:de\s+|llamada\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]+?)(?:\s+(?:con|de)\s+(?:l[ií]mite|presupuesto).*)?$/i) || [])[1] || cm[1];
      const name = rawName.trim().replace(/^./, (c) => c.toUpperCase());
      const lm = t.match(/(?:limite|presupuesto)\D*(\d[\d,.]*)/);
      return ask(['Voy a crear la categoría **' + name + '**' + (lm ? ' con límite semanal de **' + m0(NB.num(lm[1].replace(/,/g, ''))) + '**' : '') + '.'], { kind: 'cat', name, weekly: lm ? NB.num(lm[1].replace(/,/g, '')) : 0 });
    }

    // límite semanal
    if (/(cambia|pon|sube|baja|ajusta|fija|quiero).*(limite|presupuesto)/.test(t) && amt > 0) {
      const cat = findCat(raw);
      if (cat) return ask(['Voy a poner el límite semanal de **' + cat.name + '** en **' + m0(amt) + '** (antes ' + (NB.num(cat.weekly) ? m0(cat.weekly) : 'sin límite') + ').'], { kind: 'budget', catId: cat.id, amount: amt });
    }

    // ahorro %
    if (/(cambia|pon|sube|baja|ajusta|fija|quiero).*(ahorro|ahorrar)/.test(t) && amt > 0 && amt <= 60 && !isQuestion) {
      const pk = NB.currentPlanKey(T());
      return ask(['Voy a cambiar el ahorro del plan **' + NB.PLANS[pk].name + '** de ' + NB.num(s.settings.savings[pk]) + '% a **' + amt + '%**.'], { kind: 'savings', pk, pct: amt });
    }

    // pausar / reanudar
    if (/^(pausa|pausar|cancela|cancelar|deja de pagar|ya no pago|reanuda|reanudar|reactiva|reactivar)/.test(t)) {
      const ds = findDebts(raw);
      if (ds.length) {
        const d = ds[0].d;
        const resume = /reanuda|reactiva/.test(t);
        return ask(['Voy a ' + (resume ? '**reanudar**' : '**pausar**') + ' **' + d.name + '**' + (resume ? '.' : ': la app dejará de apartar para él.')], { kind: 'pause', debtId: d.id, active: resume });
      }
    }

    // elegir plan
    if (/(elige|escoge|cambia|pon|selecciona|quiero)\s.*\bplan\b/.test(t) && /(rapido|equilibrado|liquidez)/.test(t)) {
      const key = /rapido/.test(t) ? 'rapido' : /liquidez/.test(t) ? 'liquidez' : 'equilibrado';
      return ask(['Voy a elegir el plan **' + NB.PLANS[key].name + '** para ' + NB.MONTHS[T().getMonth()] + '.'], { kind: 'plan', key });
    }
    return null;
  };

  const SCOPES = { week: 'esta semana', month: 'este mes', always: 'hasta que lo cambies' };
  const endOf = (scope) => {
    const t = T();
    if (scope === 'week') return NB.ymd(NB.addDays(NB.weekStart(t), 6));
    if (scope === 'month') return NB.ymd(new Date(t.getFullYear(), t.getMonth() + 1, 0));
    return null;
  };

  const exec = (p, scope) => {
    const s = NB.state;
    const t = T();
    switch (p.kind) {
      case 'expense': {
        s.expenses.push({ id: NB.uid(), amount: p.amount, category: p.category, place: p.place || '', note: 'Desde el asesor', date: p.date, pending: false });
        NB.save();
        const cat = NB.catById(p.category);
        const lim = NB.num(cat.weekly);
        const sp = NB.weekSpent(cat.id, t);
        return ['Listo, gasto registrado: **' + money(p.amount) + '** en ' + cat.name + '.'].concat(lim > 0 ? ['Llevas ' + m0(sp) + ' de ' + m0(lim) + ' esta semana en ' + cat.name + '.'] : []);
      }
      case 'income': {
        const inc = { id: NB.uid(), amount: p.amount, clientId: p.clientId, date: p.date, note: p.note };
        s.incomes.push(inc);
        if (p.clientId) {
          const c = s.clients.find((x) => x.id === p.clientId);
          if (c && NB.occurs(c, NB.parse(p.date))) s.confirmations[NB.clientKey(c, p.date)] = 'received';
        }
        const res = NB.computeAllocation(p.amount, NB.currentPlanKey(t), t);
        NB.applyAllocation(res, inc.id, p.date);
        NB.save();
        return ['Listo, ingreso registrado: **' + money(p.amount) + '**.'].concat(reparto2(res));
      }
      case 'pay': {
        const d = s.debts.find((x) => x.id === p.debtId);
        if (!d) return ['No encontré ese pago.'];
        s.payments.push({ id: NB.uid(), debtId: d.id, ym: p.ym, date: p.date, amount: p.amount, full: true });
        if ((d.type === 'tarjeta' || d.type === 'prestamo') && NB.num(d.balance) > 0) d.balance = Math.max(0, NB.round2(NB.num(d.balance) - p.amount));
        NB.save();
        return ['Listo, **' + d.name + '** quedó pagado (' + money(p.amount) + '). Desde ahora aparto para el siguiente mes.'];
      }
      case 'prio': {
        s.settings.priority = { order: p.order, until: endOf(scope), setAt: NB.ymd(t) };
        NB.save();
        return ['Hecho. Orden guardado ' + SCOPES[scope] + (scope !== 'always' ? ' (hasta el ' + NB.fmtShort(endOf(scope)) + ')' : '') + ':', p.order.slice(0, 6).map((id, k) => k + 1 + '. ' + dname(id)).join(' · '), 'Aplicará en el reparto de tus próximos ingresos y en mis recomendaciones.'];
      }
      case 'prioreset':
        s.settings.priority = null;
        NB.save();
        return ['Listo, volví al orden automático.'];
      case 'cat':
        s.categories.push({ id: 'c' + NB.uid(), name: p.name, color: '#94A3B8', weekly: p.weekly });
        NB.save();
        return ['Categoría **' + p.name + '** creada.'];
      case 'budget': {
        const c = s.categories.find((x) => x.id === p.catId);
        if (c) c.weekly = p.amount;
        NB.save();
        return ['Listo: límite semanal de **' + (c ? c.name : '') + '** en ' + m0(p.amount) + '.'];
      }
      case 'savings':
        s.settings.savings[p.pk] = p.pct;
        NB.save();
        return ['Hecho: ahorro del plan ' + NB.PLANS[p.pk].name + ' en **' + p.pct + '%**.'];
      case 'pause': {
        const d = s.debts.find((x) => x.id === p.debtId);
        if (d) d.active = p.active;
        NB.save();
        return [(d ? d.name : 'Pago') + (p.active ? ' reanudado.' : ' en pausa.')];
      }
      case 'plan':
        s.settings.plans[NB.ym(t)] = p.key;
        NB.save();
        return ['Plan **' + NB.PLANS[p.key].name + '** elegido para ' + NB.MONTHS[t.getMonth()] + '.'];
    }
    return ['Listo.'];
  };
  const reparto2 = (res) => {
    const o = [];
    if (res.savings > 0) o.push('• Ahorro: **' + m0(res.savings) + '**');
    res.lines.forEach((l) => l.amount > 0 && o.push('• ' + l.debt.name + ': **' + m0(l.amount) + '**'));
    if (res.expenseReserve > 0) o.push('• Gastos de la semana: **' + m0(res.expenseReserve) + '**');
    if (res.free > 0) o.push('• Libre: **' + m0(res.free) + '**');
    if (res.shortfall.length) o.push('No alcanzó para: ' + res.shortfall.map((x) => x.name).join(', ') + '.');
    return o;
  };

  const confirmPending = (scope) => {
    const p = NB._pending;
    if (!p) return { t: ['No tengo nada pendiente por confirmar.'] };
    if (p.kind === 'prio' && !scope) return { t: ['¿Por cuánto tiempo quieres ese orden?'], pid: p.id, btns: 'scope' };
    NB._pending = null;
    const t = exec(p, scope);
    NB.render();
    return { t, done: true };
  };
  const cancelPending = () => {
    NB._pending = null;
    return { t: ['Cancelado, no cambié nada.'] };
  };

  /* ====================== MEMORIA: comandos ====================== */
  const memoryCmd = (raw) => {
    const t = norm(raw);
    const m = mem();
    let r = raw.match(/^\s*(?:recuerda|acuerdate|anota|guarda|memoriza)(?:\s+que)?[:\s]+(.+)/i);
    if (r) {
      m.facts.push({ t: r[1].trim().slice(0, 200), d: NB.ymd(T()) });
      if (m.facts.length > 60) m.facts.shift();
      NB.save();
      return { t: ['Anotado: "' + r[1].trim() + '". Lo tendré en cuenta.'] };
    }
    r = raw.match(/^\s*(?:olvida|borra de tu memoria|elimina de tu memoria)\s+(?:que\s+)?(.+)/i);
    if (r && !/(datos|todo|gasto|ingreso)/.test(t)) {
      const key = toks(r[1]);
      const before = m.facts.length;
      m.facts = m.facts.filter((f) => !(key.length && key.every((k) => toks(f.t).some((x) => same(x, k)))));
      NB.save();
      return { t: [before > m.facts.length ? 'Listo, lo olvidé.' : 'No encontré eso en mi memoria.'] };
    }
    if (/(que recuerdas|que sabes de mi|que has aprendido|tu memoria|mis notas)/.test(t)) {
      const o = [];
      if (m.facts.length) o.push('Esto es lo que me pediste recordar:'), m.facts.slice(-12).forEach((f) => o.push('• ' + f.t));
      else o.push('Aún no me has pedido recordar nada. Prueba: "recuerda que Luis me paga los miércoles".');
      const fav = Object.keys(m.asks).sort((a, b) => m.asks[b] - m.asks[a]).slice(0, 3);
      if (fav.length) o.push('Tus consultas más frecuentes: ' + fav.map(intentName).join(', ') + '.');
      o.push(m.prefs.brief ? 'Estilo: respuestas cortas.' : 'Estilo: respuestas completas.');
      return { t: o };
    }
    if (/(respondeme|contestame|hablame|responde).*(corto|breve|resumido)|mas corto|menos texto/.test(t)) {
      m.prefs.brief = true;
      NB.save();
      return { t: ['Va, te responderé corto. Si quieres detalle, dime "más detalle".'] };
    }
    if (/(mas detalle|detallado|completo|explicame mas|respuestas largas)/.test(t) && /(respuesta|detall|completo|dame)/.test(t)) {
      m.prefs.brief = false;
      NB.save();
      const w = NB._ctx.detail;
      return { t: w && w.length ? ['Respuestas completas activadas. Detalle de lo último:'].concat(w) : ['Respuestas completas activadas.'] };
    }
    return null;
  };
  const INAMES = { aparta: 'cuánto apartar', alcanza: 'si te alcanza', primero: 'prioridades', gastar: 'cuánto gastar', ahorro: 'ahorro', plan: 'plan', tarjetas: 'tarjetas', resumen: 'cómo vas', estrategia: 'estrategia', analisis: 'análisis', reparto: 'reparto', stat: 'estadísticas', clientes: 'clientes', finmes: 'fin de mes', colchon: 'colchón', kb: 'dudas de la app/finanzas', accion: 'acciones' };
  const intentName = (k) => INAMES[k] || k;

  /* ====================== BASE DE CONOCIMIENTOS ====================== */
  let kbIndex = null;
  const buildKB = () => {
    kbIndex = NB.KB.map((e) => {
      const kws = [];
      const seen = new Set();
      e.k.split(/\s+/).forEach((w) => {
        const strong = w[0] === '!';
        const st = stem(norm(strong ? w.slice(1) : w));
        if (!st || seen.has(st)) return;
        seen.add(st);
        kws.push({ w: st, wt: strong ? 3 : 1 });
      });
      toks(e.t).forEach((st) => {
        if (!seen.has(st)) {
          seen.add(st);
          kws.push({ w: st, wt: 0.7 });
        }
      });
      return { e, kws, total: kws.reduce((a, b) => a + b.wt, 0) };
    });
  };
  const kbSearch = (text) => {
    if (!kbIndex) buildKB();
    const COMMON = new Set(['pagar', 'apart', 'debo', 'teng', 'cuant', 'hacer', 'pued', 'mejor', 'pag', 'deb', 'dinero', 'mes', 'semana', 'quier', 'dame', 'ver', 'dond', 'cos', 'ahorr']);
    const qt = toks(text);
    if (!qt.length) return [];
    const res = [];
    kbIndex.forEach((x) => {
      let got = 0;
      let strong = 0;
      x.kws.forEach((k) => {
        if (qt.some((q) => same(q, k.w))) {
          got += k.wt < 3 && COMMON.has(k.w) ? k.wt * 0.35 : k.wt + (k.wt >= 3 && k.w.length >= 6 ? 1 : 0);
          if (k.wt >= 3) strong++;
        }
      });
      if (got < 2.6 && !(strong >= 1 && got >= 2.4)) return;
      res.push({ e: x.e, score: (got + 1.5 * strong) / (1 + 0.04 * x.total), strong });
    });
    return res.sort((a, b) => b.score - a.score);
  };

  /* ====================== ENRUTADOR ====================== */
  const brief = (lines) => {
    if (!mem().prefs.brief) return lines;
    NB._ctx.detail = lines.slice(2);
    return lines.slice(0, 2);
  };
  const KBFIRST = /^(que es|que son|que significa|que quiere decir|como funciona|como se|como (agrego|registro|creo|activo|cambio|hago|uso|edito|pauso|borro|elimino|instalo|actualizo|exporto|importo|paso|recupero|corrijo|elijo|marco|deshago|completo)|donde (veo|esta|se)|explica|explicame|para que sirve|diferencia|define|cual es la diferencia|que hago si|puedo usar|necesito)/;

  const topicBubble = (key) => {
    const tp = NB.TOPICS[key];
    return { t: ['**' + tp.name + '** · toca una pregunta o escribe la tuya:'], chips: tp.qs.map((q) => [q, q]) };
  };

  const dataIntent = (raw, t, f) => {
    const ctx = NB._ctx;
    const set = (k, why) => {
      ctx.intent = k;
      ctx.why = why || null;
    };
    if (/(estrategia|plan de pago|salir de (mis )?deudas|pagar (todo|mis deudas)|como le hago para pagar|que hago para (pagar|cubrir|salir)|liquidar (mis )?deudas|ayudame a pagar)/.test(t)) return set('estrategia'), strategy(f);
    if (/(analiz|estadistic|en que gasto|gasto de mas|donde se me va|donde gasto|hallazgo|resumen semanal|propuesta|sugerenc|recomendaci|como mejoro|como voy con|que me recomiendas|consejo)/.test(t)) {
      set('analisis');
      const ins = NB.advisorInsights(T());
      if (!ins.length) return ['Revisé tus números y no veo alertas. ' + (NB.state.expenses.length < 6 ? 'Registra más gastos y cobros para darte hallazgos más precisos.' : 'Vas bien; sigue así.')];
      const ico = { bad: '🔴', warn: '🟠', info: '🔵', good: '🟢' };
      const o = ['Esto encontré en tus números:'];
      ins.slice(0, 6).forEach((i) => {
        o.push(ico[i.tone] + ' **' + i.title + '.** ' + i.text);
        if (i.tip) o.push('➜ Propuesta: ' + i.tip);
      });
      return o;
    }
    const amt = parseAmount(raw);
    if (/(repart|divid|distribu|cuanto (le )?(doy|pongo|dispongo|destino|asigno|aparto a)|exactamente cuanto|cuanto (a|para) cada)/.test(t)) {
      set('reparto');
      if (amt > 0) return reparto(amt);
      if (f.free > 1) return reparto(f.free, 'tu dinero libre hoy');
      const next = NB.expectedIncomes(T(), NB.addDays(T(), 14))[0];
      if (next) return reparto(next.amount, 'el cobro esperado de ' + (next.client ? next.client.name : 'tu ingreso estimado'));
      return ['No tienes dinero libre ni cobros esperados para repartir. Dime un monto: "reparte 1800".'];
    }
    if (/(meta|metas) de ahorro|propon(me|er|gas)? (una )?meta|semanas? (ligera|tranquila|holgada|libre)|cuando (puedo|podria|conviene) ahorrar mas|ahorro (grande|fuerte|alto)|inversion alta|alta inversion|cuando (me )?sobra mas/.test(t)) return set('metas'), A.metas(f);
    if (/(llevo|tengo|cuanto) .*ahorrad/.test(t)) return set('ahorro'), A.ahorro(f);
    if (!/puedo|me da para|podria/.test(t) && (/\b(cuanto|cuantos|total|llevo|he gastado)\b.*\b(gast|llevo)/.test(t) || /\bgasto\b.*(en|de)\b.*(comida|gasolina|servicios|entretenimiento|transporte|ocio|otros|este mes|esta semana|hoy)/.test(t) || /en que gaste/.test(t))) return set('stat'), statQuery(raw);
    if (/(cliente|quien (me )?(debe|paga|pagara)|me van a pagar|cobros? (pendiente|esperado|atrasado))/.test(t)) return set('clientes'), A.clientes(f);
    if (/(fin de mes|cierre de mes|cuanto tendre|proyeccion|como terminare|como cerrare)/.test(t)) return set('finmes'), A.finmes(f);
    if (/(colchon|meses de (gasto|ahorro)|cuanto aguanto|cuanto tiempo aguanto)/.test(t)) return set('colchon'), A.colchon(f);
    if (/(primero|priorid|urgente|orden de pago|cual pago|que pago|que debo pagar)/.test(t)) return set('primero'), A.primero(f);
    if (/(alcanz|completar|este mes|llego|me da para)/.test(t) && /(alcanz|llego|me da|completar)/.test(t)) return set('alcanza'), A.alcanza(f);
    if (/(ahorr|fondo|emergencia)/.test(t) && /(cuant|tengo|llevo|debo|deberia|ahorro)/.test(t)) return set('ahorro'), A.ahorro(f);
    if (/\bplan\b|rapido|equilibr|liquidez/.test(t) && /(conviene|recomiend|cual|elijo|me sugieres)/.test(t)) return set('plan'), A.plan(f);
    if (/(gast(ar|o)|puedo (gastar|comprar|salir)|antojo)/.test(t) && /(puedo|cuanto|me da)/.test(t)) return set('gastar'), A.gastar(f);
    if (/(tarjeta|interes|\bcat\b|minimo)/.test(t) && /(mis|mi|cuanto|debo|pagar|tengo)/.test(t)) return set('tarjetas'), A.tarjetas(f);
    if (/(apart|separ|guard|semana|necesito|debo)/.test(t) && /(cuanto|que|debo|apart|separ)/.test(t)) return set('aparta'), A.aparta(f);
    if (/(como voy|resumen|saldo|balance|cuanto tengo|que tengo|me queda|libre|disponible)/.test(t)) return set('resumen'), A.resumen(f);
    return null;
  };


  /* ====================== METAS EN SEMANAS LIGERAS ====================== */
  const goalFact = () => {
    const m = mem();
    const f = m.facts.slice().reverse().find((x) => x.k === 'meta' || /(meta|quiero comprar|ahorrar para|camara|lente|laptop|equipo|viaje)/.test(norm(x.t)));
    return f ? f.t.replace(/^[^:]*:\s*/, '').replace(/^(mi )?meta( financiera)?( principal)? (es|seria) /i, '') : '';
  };
  NB.advisorWeeks = (n) => {
    const today = T();
    const ws = NB.weekStart(today);
    const spend = NB.weeklyEstimate(today);
    const pct = NB.num(NB.state.settings.savings[NB.currentPlanKey ? NB.currentPlanKey(today) : 'equilibrado']) || 10;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = NB.addDays(ws, i * 7);
      const b = NB.addDays(a, 6);
      let inflow = NB.sum(NB.expectedIncomes(i === 0 ? today : a, b), (e) => e.amount);
      let dues = 0;
      for (let k = 0; k < 7; k++) {
        const d = NB.addDays(a, k);
        NB.state.debts.forEach((x) => {
          if (x.active === false) return;
          const day = Math.min(Math.max(1, NB.num(x.dueDay) || 1), NB.daysIn(d.getFullYear(), d.getMonth()));
          if (d.getDate() === day) dues += NB.targetOf(x);
        });
      }
      const net = inflow - dues - spend;
      out.push({ from: a, to: b, inflow, dues, spend, net: NB.round2(net - Math.max(0, inflow) * pct / 100) });
    }
    return out;
  };
  A.metas = (f) => {
    const wk = NB.advisorWeeks(10);
    if (!wk.some((w) => w.inflow > 0)) return ['Aún no tengo clientes ni cobros esperados para proyectar semanas. Agrega tus clientes en **Ajustes > Clientes** y te propongo metas.'];
    const sorted = wk.slice().sort((a, b) => b.net - a.net);
    const avg = NB.sum(wk, (w) => w.net) / wk.length;
    const light = sorted.filter((w) => w.net > Math.max(avg, 0) && w.net > 300).slice(0, 4).sort((a, b) => a.from - b.from);
    const gf = goalFact();
    const o = [];
    if (!light.length) {
      o.push('En las próximas 10 semanas no veo semanas claramente ligeras: tus pagos y gastos se reparten parejo. Mejor ahorra una cantidad **constante** (' + m0(Math.max(200, Math.round(f.weekTarget ? f.weekTarget * 0.1 : 300))) + ' por semana) y revisa cuando entren cobros grandes.');
      return o;
    }
    const total = NB.sum(light, (w) => w.net);
    const goal = Math.round((total * 0.6) / 100) * 100;
    o.push('Proyecté tus próximas 10 semanas (cobros esperados menos pagos y gasto normal). Estas son tus **semanas ligeras**:');
    light.forEach((w) => o.push('• ' + NB.fmtShort(w.from) + ' al ' + NB.fmtShort(w.to) + ': te sobrarían ~**' + m0(w.net) + '** (cobros ' + m0(w.inflow) + ', pagos ' + m0(w.dues) + ')'));
    o.push('**Propuesta de meta:** ' + (gf ? '"' + gf + '"' : 'una meta de ahorro grande (equipo, inversión o colchón)') + ' de hasta **' + m0(goal) + '**, aportando en esas semanas el 60% de lo que te sobre (~' + light.map((w) => m0(Math.round((w.net * 0.6) / 10) * 10)).join(', ') + ').');
    const fund = NB.savingsFund();
    const mo = (f.fixedMonthly || 0) || NB.sum(NB.state.debts.filter((d) => d.active !== false), (d) => NB.targetOf(d)) + NB.weeklyEstimate(T()) * 4.3;
    if (fund < mo * 3) o.push('Antes de una meta grande, ten en cuenta tu colchón: llevas ' + m0(fund) + ' de unos ' + m0(mo * 3) + ' (3 meses de gastos). Si te falta, destina la primera mitad ahí.');
    if (!gf) o.push('Dime "recuerda que mi meta es …" (por ejemplo "una cámara de $40,000") y la uso para afinar la propuesta.');
    o.push('Es una estimación con tus cobros esperados y gasto promedio; si un cliente se atrasa, ajusta.');
    return o;
  };

  /* ====================== PREGUNTAS SOBRE TI (memoria) ====================== */
  const PQ = [
    { id: 'meta', q: '¿Cuál es tu **meta financiera más importante** este año? (por ejemplo: comprar equipo, liquidar una tarjeta, juntar colchón)', label: 'Meta principal' },
    { id: 'equipo', q: '¿Qué **equipo o herramienta** quieres comprar pronto y más o menos cuánto cuesta?', label: 'Equipo que quiere comprar' },
    { id: 'ingreso', q: '¿Cuánto te gustaría **ganar al mes** de forma estable?', label: 'Ingreso mensual deseado' },
    { id: 'flojos', q: '¿Cuáles son tus **meses más flojos** de trabajo en el año?', label: 'Meses flojos' },
    { id: 'proyecto', q: '¿Cuánto cobras normalmente por un **proyecto de video** típico?', label: 'Cobro típico por proyecto' },
    { id: 'colchon', q: '¿Cuántos **meses de gastos** te gustaría tener de colchón?', label: 'Colchón deseado' },
    { id: 'deudas', q: '¿Tienes **deudas que aún no están en la app** (con familia, amigos, otras tarjetas)?', label: 'Otras deudas' },
    { id: 'extra', q: 'Cuando te entra dinero extra, ¿qué sueles hacer con él?', label: 'Qué hace con dinero extra' },
    { id: 'gastoimpulso', q: '¿En qué tipo de cosas sueles **gastar sin planear**?', label: 'Gasto sin planear' },
    { id: 'colab', q: '¿Pagas a **colaboradores** (editores, asistentes) en tus proyectos? ¿Más o menos cuánto al mes?', label: 'Pago a colaboradores' }
  ];
  const profileAsk = () => {
    const m = mem();
    if (!m.pq) m.pq = { done: {}, last: '', cur: null };
    return m.pq;
  };
  const maybeAsk = () => {
    const pq = profileAsk();
    if (NB._pending || pq.cur || pq.last === NB.ymd(T())) return null;
    const next = PQ.find((x) => !pq.done[x.id]);
    if (!next) return null;
    pq.cur = next.id;
    pq.last = NB.ymd(T());
    NB.save();
    return { t: ['Para conocerte mejor y darte consejos más a tu medida, una pregunta rápida:', next.q, 'Puedes responder en una línea o tocar "Prefiero no decir".'], chips: [['Prefiero no decir', '__skipq']] };
  };
  const answerProfile = (raw, t) => {
    const pq = profileAsk();
    if (!pq.cur) return null;
    const item = PQ.find((x) => x.id === pq.cur);
    if (!item) { pq.cur = null; return null; }
    if (raw === '__skipq' || /^(prefiero no|no quiero|paso|omitir|saltar|despues|luego|no se)\b/.test(t)) {
      pq.done[item.id] = 'skip';
      pq.cur = null;
      NB.save();
      return { t: ['Sin problema, la salto. Más adelante te preguntaré otras cosas, y si no quieres, solo toca "Prefiero no decir".'] };
    }
    const looksQuestion = /\?/.test(raw) || /^(cuanto|como|que|por que|donde|cuando|quien|cual|dame|pon|crea|cambia|gaste|pague|me pago|analiza|explica)\b/.test(t) || raw.length > 180;
    if (looksQuestion) { pq.cur = null; NB.save(); return null; }
    const m = mem();
    m.facts = m.facts.filter((f) => f.k !== item.id);
    m.facts.push({ t: item.label + ': ' + raw.slice(0, 160), d: NB.ymd(T()), k: item.id });
    if (m.facts.length > 60) m.facts.shift();
    pq.done[item.id] = 'ok';
    pq.cur = null;
    NB.save();
    const extra = { meta: 'Pregúntame "propón una meta de ahorro" y te sugiero cuándo aportar más.', equipo: 'Pregúntame "propón una meta de ahorro" y calculo en qué semanas te sobrará más para ahorrarlo.', ingreso: 'Lo uso para juzgar si tu ritmo actual te acerca a esa cifra.', flojos: 'Prepararé tu colchón pensando en esos meses.' }[item.id] || '';
    return { t: ['Anotado: **' + item.label + '** → "' + raw.slice(0, 120) + '".' + (extra ? ' ' + extra : ''), 'Puedes ver o borrar lo que sé de ti con "¿qué recuerdas?" y "olvida …".'] };
  };

  NB.advisorReply = (raw) => {
    const q = String(raw || '').trim();
    const t = norm(q);
    const m = mem();
    const ctx = NB._ctx;
    if (q.indexOf('__topic:') === 0) return topicBubble(q.slice(8));

    // confirmaciones escritas
    if (NB._pending) {
      if (/^(si|dale|ok|okay|va|claro|adelante|confirmo|confirmar|hazlo|correcto|asi es|de acuerdo|sale)\b/.test(t) && NB._pending.kind !== 'prio') return confirmPending();
      if (NB._pending.kind === 'prio') {
        if (/semana/.test(t)) return confirmPending('week');
        if (/\bmes\b/.test(t)) return confirmPending('month');
        if (/(siempre|hasta|permanente|indefinid|cambie)/.test(t)) return confirmPending('always');
      }
      if (/^(no|cancela|cancelar|mejor no|nel|olvidalo|para)\b/.test(t)) return cancelPending();
    }

    if (q === '__skipq' || (profileAsk().cur && !NB._pending)) { const pr = answerProfile(q, t); if (pr) return pr; }
    if (/(que no supiste|preguntas (que )?no (supiste|entendiste)|preguntas pendientes|lo que no sabes)/.test(t)) {
      const u = mem().unknown || [];
      return { t: u.length ? ['Estas son las preguntas que no supe responder (cópialas y mándaselas a Claude para que las agregue a mi base):'].concat(u.slice(-30).map((x) => '• ' + x)) : ['Todavía no tengo preguntas sin respuesta guardadas.'] };
    }
    const memR = memoryCmd(q);
    if (memR) return memR;

    const kbFirst = KBFIRST.test(t) || /(impuesto|\bsat\b|\bisr\b|\biva\b|factur|cfdi|resico|declaracion|deducib|contador|como (le )?cobro|cliente (que )?no (me )?paga|cobrar mas|subir (mi )?tarifa|cuanto cobrar)/.test(t);
    if (!kbFirst) {
      const act = parseAction(q);
      if (act) {
        ctx.intent = 'accion';
        return act;
      }
    }

    const f = NB.advisorFacts();
    // detalle de pago por nombre
    const ds = findDebts(q);
    let ans = null;
    if (kbFirst) {
      const r = kbSearch(q);
      if (r.length && r[0].score >= 1.6) {
        ctx.intent = 'kb';
        return kbAnswer(r);
      }
    }
    if (ds.length && /(cuanto|falta|debo|vence|cuando|saldo|detalle|como va|que onda|apartado)/.test(t) && !/(estrategia|repart|analiz|priorid|primero|gast|puedo|alcanz|semana|ahorr)/.test(t)) {
      ctx.debtId = ds[0].d.id; ctx.intent = 'debt';
      return { t: brief(debtDetail(ds[0].d)) };
    }
    if (!kbFirst) {
      const PERS = /(cuanto (aparto|debo apartar esta|gaste|llevo|puedo gastar|tengo)|me alcanza|que pago primero|mis (tarjetas|clientes|pagos|gastos|deudas)|esta semana|este mes|estrategia|analiza|reparte|repartir|clientes me)/;
      const rk = kbSearch(q);
      if (rk.length && rk[0].strong >= 1 && rk[0].score >= 3.4 && !PERS.test(t)) {
        ctx.intent = 'kb';
        return kbAnswer(rk);
      }
    }
    ans = dataIntent(q, t, f);
    if (ans) return { t: brief(ans), why: ctx.why };
    if (ds.length && /(cuanto|falta|debo|vence|cuando|saldo|detalle|como va|que onda|apartado)/.test(t)) {
      ctx.debtId = ds[0].d.id;
      ctx.intent = 'debt';
      return { t: brief(debtDetail(ds[0].d)) };
    }
    const r = kbSearch(q);
    if (r.length) {
      ctx.intent = 'kb';
      return kbAnswer(r);
    }
    // seguimientos cortos
    if (ds.length && toks(q).length <= 4) {
      ctx.debtId = ds[0].d.id;
      return { t: brief(debtDetail(ds[0].d)) };
    }
    if (/^(y |tambien |ademas )/.test(t) && ctx.intent) {
      const cat = findCat(q);
      if (cat && (ctx.intent === 'stat')) return { t: statQuery(q + ' ' + (cat.name || '')) };
    }
    if (/^(por que|porque|y por que|explicame|por que\?)$/.test(t) || /^por que/.test(t)) {
      return { t: ctx.why && ctx.why.length ? ctx.why : ['Lo calculo con tus pagos pendientes, lo que ya apartaste, tu dinero libre y los cobros que esperas. Pregúntame algo más concreto y te muestro el detalle.'] };
    }
    if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ayuda|help|que puedes hacer)/.test(t)) return { t: A.intro(), chips: Object.keys(NB.TOPICS).map((k) => [NB.TOPICS[k].name, '__topic:' + k]) };
    if (/(gracias|genial|perfecto|excelente|buen trabajo)/.test(t)) return { t: ['¡De nada! Aquí sigo cuando me necesites.'] };
    { const u = mem(); u.unknown = u.unknown || []; if (q.length > 3 && u.unknown.indexOf(q) < 0) { u.unknown.push(q); if (u.unknown.length > 60) u.unknown.shift(); NB.save(); } }
    return { t: ['No estoy seguro de haber entendido. Puedo ayudarte con tu dinero, estadísticas, finanzas, impuestos de freelance y el uso de la app. Prueba con una de estas, o toca **Temas**:'], chips: [['¿Cuánto aparto esta semana?', '¿Cuánto aparto esta semana?'], ['¿En qué gasto de más?', '¿En qué gasto de más?'], ['¿Cómo agrego una tarjeta?', '¿Cómo agrego una tarjeta de crédito?'], ['Temas', '__topic:dinero']] };
  };
  NB._kb = (q) => kbSearch(q).slice(0, 5).map((x) => [x.e.id, +x.score.toFixed(2)]);
  const kbAnswer = (r) => {
    const top = r[0];
    const o = { t: brief(top.e.a.slice()), why: null };
    NB._ctx.detail = top.e.a.slice(2);
    const alt = r.slice(1, 4).filter((x) => x.score >= top.score * 0.55).map((x) => [x.e.t, x.e.t]);
    if (alt.length) o.chips = alt;
    return o;
  };

  /* ====================== INTERFAZ ====================== */
  const fmt = (line) => NB.esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = (t) => (Array.isArray(t) ? t : [t]);
  const topChips = () => {
    const m = mem();
    const fav = Object.keys(m.asks)
      .filter((k) => k.length < 60)
      .sort((a, b) => m.asks[b] - m.asks[a])
      .slice(0, 2);
    const base = ['¿Cuánto aparto esta semana?', '¿Me alcanza este mes?', '¿Qué pago primero?', '¿En qué gasto de más?', 'Dame una estrategia para pagar todo'];
    const out = [];
    fav.concat(base).forEach((q) => {
      if (q.indexOf('__') !== 0 && out.indexOf(q) < 0 && out.length < 6) out.push(q);
    });
    return out;
  };
  const bubble = (m) => {
    if (m.me) return '<div class="bub me">' + NB.esc(m.t) + '</div>';
    let h = '<div class="bub ai">' + lines(m.t).map((l) => '<p>' + fmt(l) + '</p>').join('');
    if (m.chips) h += '<div class="bchips">' + m.chips.map((c) => '<button type="button" class="chip" data-act="ask" data-q="' + NB.esc(c[1]) + '">' + NB.esc(c[0]) + '</button>').join('') + '</div>';
    if (m.btns && NB._pending && m.pid === NB._pending.id) {
      if (m.btns === 'scope') h += '<div class="bbtns"><button type="button" class="btn sm primary" data-act="adv-scope" data-v="week">Esta semana</button><button type="button" class="btn sm primary" data-act="adv-scope" data-v="month">Este mes</button><button type="button" class="btn sm ghost" data-act="adv-scope" data-v="always">Hasta que lo cambie</button><button type="button" class="btn sm ghost" data-act="adv-no">Cancelar</button></div>';
      else h += '<div class="bbtns"><button type="button" class="btn sm primary" data-act="adv-yes">Sí, hazlo</button><button type="button" class="btn sm ghost" data-act="adv-no">No</button></div>';
    }
    return h + '</div>';
  };

  NB.openAdvisor = (first) => {
    const log = chatLog();
    if (log.length && !first) { const qa = maybeAsk(); if (qa) log.push(Object.assign({ me: false }, qa)); }
    if (!log.length) log.push({ me: false, t: A.intro(), chips: Object.keys(NB.TOPICS).map((k) => [NB.TOPICS[k].name, '__topic:' + k]) });
    NB.sheet(
      NB.sheetHead('Asesor', 'Con tus números, sin internet') +
        '<div class="chat" id="chat">' + log.slice(-30).map(bubble).join('') + '</div>' +
        '<div class="qchips">' + Object.keys(NB.TOPICS).map((k) => '<button type="button" class="chip tp" data-act="ask" data-q="__topic:' + k + '">' + NB.esc(NB.TOPICS[k].name) + '</button>').join('') + topChips().map((q) => '<button type="button" class="chip" data-act="ask" data-q="' + NB.esc(q) + '">' + NB.esc(q.replace(/[¿?]/g, '')) + '</button>').join('') + '<button type="button" class="chip" data-act="adv-clear">Limpiar chat</button></div>' +
        '<form class="askbar" data-form="ask" autocomplete="off"><input name="q" placeholder="Pregunta o pídeme algo" enterkeyhint="send" autocapitalize="sentences"><button class="btn primary" type="submit" aria-label="Enviar">' + NB.icon('chev', 18) + '</button></form>',
      { full: true }
    );
    const c = NB.$('#chat');
    if (c) c.scrollTop = c.scrollHeight;
    if (first) say(first);
  };
  const push = (msg) => {
    const log = chatLog();
    log.push(msg);
    if (log.length > 60) NB.state.chat = log.slice(-60);
    NB.save();
  };
  function say(q) {
    q = String(q || '').trim();
    if (!q) return;
    const m = mem();
    if (q.indexOf('__') !== 0) {
      push({ me: true, t: q });
    } else push({ me: true, t: q === '__skipq' ? 'Prefiero no decir' : NB.TOPICS[q.slice(8)] ? NB.TOPICS[q.slice(8)].name : q });
    let r;
    try {
      r = NB.advisorReply(q);
    } catch (e) {
      r = { t: ['Tuve un problema al procesar eso. Intenta de otra forma o dime qué quieres hacer.'] };
    }
    if (q.indexOf('__') !== 0 && NB._ctx.intent) m.asks[NB._ctx.intent] = (m.asks[NB._ctx.intent] || 0) + 1;
    push(Object.assign({ me: false }, r));
    NB._ctx.detail = NB._ctx.detail || null;
    NB.openAdvisor();
  }
  NB.act.advisor = () => NB.openAdvisor();
  NB.act.ask = (el) => say(el.dataset.q);
  NB.act['adv-yes'] = () => {
    push({ me: true, t: 'Sí' });
    push(Object.assign({ me: false }, confirmPending()));
    NB.openAdvisor();
  };
  NB.act['adv-no'] = () => {
    push({ me: true, t: 'No' });
    push(Object.assign({ me: false }, cancelPending()));
    NB.openAdvisor();
  };
  NB.act['adv-scope'] = (el) => {
    const v = el.dataset.v;
    push({ me: true, t: SCOPES[v].replace(/^./, (c) => c.toUpperCase()) });
    push(Object.assign({ me: false }, confirmPending(v)));
    NB.openAdvisor();
  };
  NB.act['adv-clear'] = () => {
    NB.state.chat = [];
    NB._pending = null;
    NB.save();
    NB.openAdvisor();
  };
  NB.act['adv-seen'] = () => {
    NB.state.settings.insightSeen = NB.ymd(NB.weekStart(T()));
    NB.save();
    NB.render();
  };
  NB.act['adv-insights'] = () => NB.openAdvisor('Analiza mis estadísticas');
  NB.forms.ask = (_, form) => say(new FormData(form).get('q'));

  /* ====================== TARJETAS DE INICIO ====================== */
  NB.advisorCard = () => {
    let h = '';
    const f = NB.advisorFacts();
    const seen = NB.state.settings.insightSeen === NB.ymd(NB.weekStart(T()));
    let ins = [];
    try {
      ins = seen ? [] : NB.advisorInsights(T()).slice(0, 3);
    } catch (e) {
      ins = [];
    }
    if (f.items.length) {
      const total = NB.round2(f.weekNeed + f.saveWeek);
      const first = f.items[0];
      h +=
        '<section class="card ask-card"><div class="grow"><span class="mut small">Esta semana aparta</span><b class="mid">' + m0(total) + '</b>' +
        '<span class="mut small">' + m0(f.weekNeed) + ' para pagos' + (f.saveWeek > 0 ? ' · ' + m0(f.saveWeek) + ' ahorro' : '') + ' · primero ' + NB.esc(first.debt.name) + '</span></div>' +
        '<button class="btn sm primary" data-act="advisor">' + NB.icon('spark', 16) + ' Preguntar</button></section>';
    }
    if (ins.length) {
      const ic = { bad: 'alert', warn: 'alert', info: 'info', good: 'check' };
      h +=
        '<section class="card insights"><div class="row between"><b>Resumen de la semana</b><button class="icon-btn sm" data-act="adv-seen" aria-label="Entendido">' + NB.icon('x', 16) + '</button></div>' +
        ins.map((i) => '<div class="ins ' + i.tone + '"><span class="ins-ic">' + NB.icon(ic[i.tone], 16) + '</span><div><b>' + NB.esc(i.title) + '</b><span class="mut small">' + NB.esc(i.text) + '</span></div></div>').join('') +
        '<div class="a-act"><button class="btn sm primary" data-act="adv-insights">Ver análisis y propuestas</button><button class="btn sm ghost" data-act="adv-seen">Entendido</button></div></section>';
    }
    return h;
  };
})();
