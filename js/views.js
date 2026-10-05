/* Noir Balance · pantallas principales */
(function () {
  const NB = window.NB;
  const esc = NB.esc;
  const money = NB.money;

  NB.tab = 'home';
  NB.payTab = 'tarjeta';
  NB.calMode = 'cal';
  NB.calMonth = null;
  NB.calSel = null;
  NB.flt = { cat: 'all', q: '', from: '', to: '' };

  NB.debtIcon = (d) => {
    if (d.logo) return '<img src="' + d.logo + '" alt="">';
    if (d.icon) return esc(d.icon);
    if (d.type === 'tarjeta') return NB.icon('card', 20);
    if (d.type === 'prestamo') return NB.icon('bank', 20);
    if (d.type === 'servicio') return NB.icon('bolt', 20);
    return esc((d.name || '?').slice(0, 1).toUpperCase());
  };
  NB.TYPE_NAMES = { tarjeta: 'Tarjeta de crédito', prestamo: 'Préstamo', suscripcion: 'Suscripción', servicio: 'Renta o servicio' };

  NB.alertCard = (a) =>
    '<div class="alert ' + a.tone + '"><div class="a-ic">' + NB.icon(a.icon, 20) + '</div><div class="a-body"><b>' + esc(a.title) + '</b><span class="mut small">' + esc(a.sub) + '</span>' +
    (a.actions
      ? '<div class="a-act">' +
        a.actions.map((x) => '<button class="btn sm ' + (x.primary ? 'primary' : 'ghost') + '" data-act="' + x.act + '" data-id="' + esc(x.id || '') + '" data-date="' + esc(x.date || '') + '">' + esc(x.label) + '</button>').join('') +
        '</div>'
      : '') +
    '</div></div>';

  const dueText = (days) => (days < 0 ? 'venció hace ' + -days + ' ' + NB.plural(-days, 'día', 'días') : days === 0 ? 'vence hoy' : days === 1 ? 'vence mañana' : 'vence en ' + days + ' días');

  /* =============== INICIO =============== */
  NB.views.home = () => {
    const s = NB.state;
    const t = NB.today();
    const bal = NB.balanceAt(t);
    const apart = NB.apartados();
    const free = NB.round2(bal - apart);
    const ym = NB.ym(t);
    const inMonth = (a) => a.filter((x) => x.date.slice(0, 7) === ym);
    const incM = NB.sum(inMonth(s.incomes), (x) => NB.num(x.amount));
    const expM = NB.sum(inMonth(s.expenses.filter((e) => !e.pending)), (x) => NB.num(x.amount));
    const monthName = NB.MONTHS[t.getMonth()];
    const ser = NB.monthSeries(t);
    const labels = ser.vals.map((_, i) => i + 1 + ' ' + NB.MON3[t.getMonth()]);

    // 1. Balance
    const w1 =
      '<div class="wcard hero"><span class="mut small">Balance de ' + monthName + '</span><div class="big">' + money(bal) + '</div>' +
      '<div class="mini3"><div><span class="mut">Libre</span><b class="' + (free < 0 ? 'neg' : '') + '">' + NB.money0(free) + '</b></div><div><span class="mut">Apartado</span><b>' + NB.money0(apart) + '</b></div><div><span class="mut">Ingresos</span><b class="pos">+' + NB.money0(incM) + '</b></div></div>' +
      NB.charts.line('bal', { vals: ser.vals, todayIdx: ser.todayIdx, labels, todayLabel: 'Hoy · ' + t.getDate() + ' ' + NB.MON3[t.getMonth()], aria: 'Balance del mes. Desliza para ver cada día.' }) +
      '<div class="ticks"><span>1</span><span>10</span><span>20</span><span>' + ser.days + '</span></div></div>';

    // 2. Avance de apartados
    const ins = NB.instancesByDue(t);
    const totT = NB.sum(ins, (i) => i.target);
    const totA = NB.sum(ins, (i) => Math.min(i.allocated, i.target));
    const w2 =
      '<div class="wcard"><div class="w-head"><b>Avance de apartados</b><span class="mut small">Este ciclo</span></div>' +
      (ins.length
        ? '<div class="ring-row">' + NB.charts.ring(totT ? totA / totT : 0, 76) + '<div class="grow"><div class="mut small">Apartado</div><div class="mid">' + NB.money0(totA) + ' <span class="mut">de ' + NB.money0(totT) + '</span></div></div></div>' +
          ins.slice(0, 4).map((i, k) => '<div class="mrow"><span>' + esc(i.debt.name) + '</span><span class="mut small">' + NB.money0(Math.min(i.allocated, i.target)) + ' / ' + NB.money0(i.target) + '</span></div>' + NB.charts.progress(i.target ? i.allocated / i.target : 0, 0.3 + k * 0.12)).join('')
        : '<div class="empty">Agrega tus tarjetas, préstamos y suscripciones en la pestaña Pagos para ver aquí cuánto llevas apartado.</div>') +
      '</div>';

    // 3. Gastos por categoría
    const byCat = {};
    inMonth(s.expenses.filter((e) => !e.pending)).forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + NB.num(e.amount)));
    const cats = Object.keys(byCat)
      .map((k) => ({ label: NB.catById(k).name, value: byCat[k], color: NB.catById(k).color }))
      .sort((a, b) => b.value - a.value);
    const w3 =
      '<div class="wcard"><div class="w-head"><b>Gastos por categoría</b><span class="mut small">' + NB.cap(monthName) + '</span></div>' +
      (cats.length
        ? '<div class="donut-row">' + NB.charts.donut(cats, 'Gastado') + '<div class="legend">' +
          cats.slice(0, 5).map((c) => '<div><i style="background:' + c.color + '"></i><span>' + esc(c.label) + '</span><b>' + NB.money0(c.value) + '</b></div>').join('') + '</div></div>'
        : '<div class="empty">Cuando captures tus gastos verás aquí en qué se te va el dinero.</div>') +
      '</div>';

    // 4. Ingresos vs gastos por semana
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const ws = NB.addDays(NB.weekStart(t), -7 * i);
      const a = NB.ymd(ws);
      const b = NB.ymd(NB.addDays(ws, 6));
      weeks.push({
        label: NB.fmtShort(ws),
        inc: NB.sum(s.incomes.filter((x) => x.date >= a && x.date <= b), (x) => NB.num(x.amount)),
        exp: NB.sum(s.expenses.filter((x) => !x.pending && x.date >= a && x.date <= b), (x) => NB.num(x.amount))
      });
    }
    const hasW = weeks.some((w) => w.inc || w.exp);
    const w4 =
      '<div class="wcard"><div class="w-head"><b>Ingresos vs gastos</b><span class="mut small">Por semana</span></div>' +
      (hasW ? NB.charts.bars(weeks) + '<div class="legend row"><div><i style="background:var(--green)"></i><span>Ingresos</span></div><div><i style="background:var(--vio)"></i><span>Gastos</span></div></div>' : '<div class="empty">Aún no hay movimientos en las últimas semanas.</div>') +
      '</div>';

    // 5. Fondo de ahorro
    const fund = NB.savingsFund();
    const sv = s.allocs.filter((a) => a.debtId === 'ahorro');
    let w5body = '<div class="empty">Cada ingreso aparta un porcentaje a tu fondo. Registra uno y empieza a crecer.</div>';
    if (sv.length) {
      const months = [];
      for (let i = 5; i >= 0; i--) months.push(NB.addMonthsYM(ym, -i));
      let acc = NB.sum(sv.filter((a) => a.date.slice(0, 7) < months[0]), (a) => NB.num(a.amount));
      const vals = months.map((m) => {
        acc += NB.sum(sv.filter((a) => a.date.slice(0, 7) === m), (a) => NB.num(a.amount));
        return NB.round2(acc);
      });
      w5body = NB.charts.line('sav', { vals, todayIdx: vals.length - 1, labels: months.map((m) => NB.cap(NB.MONTHS[+m.slice(5, 7) - 1])), todayLabel: 'Ahora', proj: false, aria: 'Crecimiento del fondo de ahorro' }) + '<div class="ticks"><span>' + NB.MON3[+months[0].slice(5, 7) - 1] + '</span><span>' + NB.MON3[+months[5].slice(5, 7) - 1] + '</span></div>';
    }
    const w5 =
      '<div class="wcard"><div class="w-head"><b>Fondo de ahorro</b><span class="mut small">Emergencias</span></div><div class="big sm">' + money(fund) + '</div>' + w5body +
      (fund > 0 ? '<button class="btn sm ghost" data-act="usefund">Usar del fondo</button>' : '') + '</div>';

    // 6. Gasto por lugar
    const from60 = NB.ymd(NB.addDays(t, -60));
    const byPlace = {};
    s.expenses.filter((e) => !e.pending && e.place && e.date >= from60).forEach((e) => {
      const k = e.place.trim().toLowerCase();
      byPlace[k] = byPlace[k] || { label: e.place.trim(), value: 0, n: 0 };
      byPlace[k].value += NB.num(e.amount);
      byPlace[k].n++;
    });
    const places = Object.values(byPlace).sort((a, b) => b.value - a.value).slice(0, 5);
    const maxP = places.length ? places[0].value : 1;
    const w6 =
      '<div class="wcard"><div class="w-head"><b>Gasto por lugar</b><span class="mut small">Últimos 60 días</span></div>' +
      (places.length
        ? places.map((p, k) => '<div class="mrow"><span>' + esc(p.label) + ' <span class="mut small">· ' + p.n + ' ' + NB.plural(p.n, 'vez', 'veces') + '</span></span><b class="small">' + NB.money0(p.value) + '</b></div><div class="track"><div class="fill" style="width:' + (p.value / maxP) * 100 + '%;animation-delay:' + (0.3 + k * 0.1) + 's,0s"></div></div>').join('')
        : '<div class="empty">Anota el lugar en cada gasto (restaurante, gasolinera) y aquí verás dónde gastas más.</div>') +
      '</div>';

    const ws = [w1, w2, w3, w4, w5, w6];

    // Pendiente / avisos
    const alerts = NB.alerts(t);
    const alertsHtml = alerts.length ? '<section><h2 class="sec">Pendiente</h2>' + alerts.slice(0, 6).map(NB.alertCard).join('') + '</section>' : '';

    // Primeros pasos
    const start =
      !s.debts.length && !s.clients.length
        ? '<section class="card start"><b>Empieza por aquí</b><p class="mut small">Agrega tus clientes y tus pagos para que Noir Balance arme tu plan.</p><div class="a-act"><button class="btn primary sm" data-act="clients">Agregar clientes</button><button class="btn ghost sm" data-act="goto" data-v="pay">Agregar pagos</button></div></section>'
        : '';

    // Próximos pagos
    const next = ins
      .slice(0, 6)
      .map(
        (i, k) =>
          '<button class="card pay-row" data-act="paysheet" data-id="' + i.debt.id + '"><div class="logo">' + NB.debtIcon(i.debt) + '</div><div class="grow"><div class="row between"><b>' + esc(i.debt.name) + '</b><span class="small">' + NB.money0(i.allocated) + ' <span class="mut">/ ' + NB.money0(i.target) + '</span></span></div>' +
          NB.charts.progress(i.target ? i.allocated / i.target : 0, 0.4 + k * 0.1) +
          '<span class="mut small">' + NB.fmtShort(i.due) + ' · ' + dueText(i.days) + '</span></div></button>'
      )
      .join('');

    // Esta semana (presupuestos)
    const budg = s.categories.filter((c) => NB.num(c.weekly) > 0);
    const week = budg.length
      ? '<section><h2 class="sec">Esta semana</h2><div class="card">' +
        budg.map((c, k) => {
          const sp = NB.weekSpent(c.id, t);
          const lim = NB.num(c.weekly);
          return '<div class="mrow"><span><i class="dot" style="background:' + c.color + '"></i>' + esc(c.name) + '</span><span class="small ' + (sp >= lim ? 'neg' : '') + '">' + NB.money0(sp) + ' <span class="mut">/ ' + NB.money0(lim) + '</span></span></div>' + NB.charts.progress(Math.min(1, sp / lim), 0.3 + k * 0.1);
        }).join('') + '</div></section>'
      : '';

    // Plan
    const pk = NB.currentPlanKey(t);
    const chosen = !!s.settings.plans[ym];
    const plan =
      '<section class="card plan-card"><div class="grow"><span class="mut small">Plan de ' + monthName + '</span><b>' + NB.PLANS[pk].name + '</b><span class="mut small">' + (chosen ? NB.PLANS[pk].tag + ' · ahorro ' + NB.num(s.settings.savings[pk]) + '%' : 'Aún sin elegir este mes') + '</span></div><button class="btn sm ' + (chosen ? 'ghost' : 'primary') + '" data-act="plans">' + (chosen ? 'Cambiar' : 'Elegir') + '</button></section>';

    return (
      '<header class="top"><div><span class="mut small">' + NB.greeting() + '</span><h1>' + esc(s.settings.name || 'Hola') + '</h1></div>' + NB.logo(34) + '</header>' +
      '<div class="car" id="car">' + ws.map((w) => w).join('') + '</div>' +
      '<div class="dots" id="dots">' + ws.map((_, i) => '<i class="' + (i === 0 ? 'on' : '') + '"></i>').join('') + '</div>' +
      start + (NB.advisorCard ? NB.advisorCard() : '') + alertsHtml + plan + (next ? '<section><h2 class="sec">Apartados por fecha</h2>' + next + '</section>' : '') + week
    );
  };

  /* =============== CALENDARIO / HISTORIAL =============== */
  NB.dayEvents = (ym) => {
    const s = NB.state;
    const map = {};
    const add = (d, k, v) => {
      (map[d] = map[d] || { inc: [], exp: [], pay: [], due: [], cli: [] })[k].push(v);
    };
    s.incomes.filter((x) => x.date.slice(0, 7) === ym).forEach((x) => add(x.date, 'inc', x));
    s.expenses.filter((x) => x.date.slice(0, 7) === ym).forEach((x) => add(x.date, 'exp', x));
    s.payments.filter((x) => x.date.slice(0, 7) === ym).forEach((x) => add(x.date, 'pay', x));
    s.debts.forEach((d) => {
      if (d.active === false) return;
      const t = NB.targetOf(d);
      if (t > 0) add(NB.ymd(NB.dueOf(d, ym)), 'due', { debt: d, amount: t });
    });
    const y = +ym.slice(0, 4);
    const m = +ym.slice(5, 7) - 1;
    const today = NB.ymd(NB.today());
    for (let d = 1; d <= NB.daysIn(y, m); d++) {
      const date = new Date(y, m, d);
      const ds = NB.ymd(date);
      s.clients.forEach((c) => {
        if (NB.occurs(c, date) && ds >= today && !s.confirmations[NB.clientKey(c, ds)]) add(ds, 'cli', c);
      });
    }
    return map;
  };

  const rowsFor = (key, e) => {
    if (key === 'inc') {
      const c = NB.state.clients.find((x) => x.id === e.clientId);
      return { ic: 'download', cls: 'pos', title: c ? c.name : e.note || 'Ingreso', sub: c && e.note ? e.note : 'Ingreso', amt: '+' + money(e.amount), act: 'edit-income', id: e.id };
    }
    if (key === 'exp') {
      const c = NB.catById(e.category);
      return { ic: e.pending ? 'camera' : 'upload', cls: '', color: c.color, title: e.pending ? 'Ticket por completar' : e.place || c.name, sub: e.pending ? 'Falta monto y lugar' : c.name + (e.note ? ' · ' + e.note : ''), amt: e.pending ? '—' : '-' + money(e.amount), act: 'edit-expense', id: e.id };
    }
    if (key === 'pay') {
      const d = NB.state.debts.find((x) => x.id === e.debtId);
      return { ic: 'check', cls: '', title: 'Pago · ' + (d ? d.name : 'Pago'), sub: 'Pagado', amt: '-' + money(e.amount), act: 'edit-payment', id: e.id };
    }
    if (key === 'due') return { ic: 'bell', cls: 'warn', title: e.debt.name, sub: 'Fecha de pago', amt: money(e.amount), act: 'paysheet', id: e.debt.id };
    return { ic: 'user', cls: 'pos', title: e.name, sub: 'Pago esperado', amt: money(e.amount), act: 'clients', id: e.id };
  };
  const rowHtml = (r) =>
    '<button class="lrow" data-act="' + r.act + '" data-id="' + esc(r.id) + '"><span class="l-ic ' + r.cls + '"' + (r.color ? ' style="color:' + r.color + '"' : '') + '>' + NB.icon(r.ic, 18) + '</span><span class="grow"><b>' + esc(r.title) + '</b><span class="mut small">' + esc(r.sub) + '</span></span><span class="amt ' + r.cls + '">' + esc(r.amt) + '</span></button>';

  NB.views.cal = () => {
    const t = NB.today();
    if (!NB.calMonth) NB.calMonth = NB.ym(t);
    if (!NB.calSel) NB.calSel = NB.ymd(t);
    const head = '<header class="top"><div><span class="mut small">Movimientos</span><h1>Calendario</h1></div>' + NB.seg('calmode', [['cal', 'Calendario'], ['list', 'Lista']], NB.calMode) + '</header>';
    return NB.calMode === 'cal' ? head + calendar(t) : head + listView();
  };

  function calendar(t) {
    const ym = NB.calMonth;
    const y = +ym.slice(0, 4);
    const m = +ym.slice(5, 7) - 1;
    const map = NB.dayEvents(ym);
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const n = NB.daysIn(y, m);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="day empty"></span>';
    for (let d = 1; d <= n; d++) {
      const ds = ym + '-' + NB.pad(d);
      const ev = map[ds];
      const dots = ev
        ? (ev.inc.length ? '<i style="background:var(--green)"></i>' : '') + (ev.exp.length ? '<i style="background:var(--vio)"></i>' : '') + (ev.pay.length || ev.due.length ? '<i style="background:var(--warn)"></i>' : '') + (ev.cli.length ? '<i class="ring-dot"></i>' : '')
        : '';
      cells += '<button class="day' + (ds === NB.calSel ? ' sel' : '') + (ds === NB.ymd(t) ? ' today' : '') + '" data-act="calsel" data-date="' + ds + '"><span>' + d + '</span><em>' + dots + '</em></button>';
    }
    const ev = map[NB.calSel] || { inc: [], exp: [], pay: [], due: [], cli: [] };
    const rows = []
      .concat(ev.inc.map((e) => rowsFor('inc', e)), ev.exp.map((e) => rowsFor('exp', e)), ev.pay.map((e) => rowsFor('pay', e)), ev.due.map((e) => rowsFor('due', e)), ev.cli.map((e) => rowsFor('cli', e)))
      .map(rowHtml)
      .join('');
    const incT = NB.sum(ev.inc, (e) => NB.num(e.amount));
    const expT = NB.sum(ev.exp.filter((e) => !e.pending), (e) => NB.num(e.amount));
    return (
      '<div class="card cal"><div class="cal-head"><button class="icon-btn" data-act="calprev" aria-label="Mes anterior">' + NB.icon('back') + '</button><b>' + NB.cap(NB.MONTHS[m]) + ' ' + y + '</b><button class="icon-btn" data-act="calnext" aria-label="Mes siguiente">' + NB.icon('chev') + '</button></div>' +
      '<div class="dow">' + ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => '<span>' + x + '</span>').join('') + '</div><div class="days">' + cells + '</div>' +
      '<div class="legend row small"><div><i style="background:var(--green)"></i><span>Ingreso</span></div><div><i style="background:var(--vio)"></i><span>Gasto</span></div><div><i style="background:var(--warn)"></i><span>Pago</span></div><div><i class="ring-dot"></i><span>Esperado</span></div></div></div>' +
      '<section><div class="row between"><h2 class="sec">' + NB.fmtLong(NB.calSel) + '</h2><button class="btn sm primary" data-act="add" data-date="' + NB.calSel + '">' + NB.icon('plus', 16) + ' Agregar</button></div>' +
      (rows ? '<div class="card list">' + rows + '</div><div class="row between mut small pad"><span>Ingresos ' + money(incT) + '</span><span>Gastos ' + money(expT) + '</span></div>' : '<div class="card empty">Sin movimientos este día.</div>') + '</section>'
    );
  }

  function listView() {
    const s = NB.state;
    const f = NB.flt;
    let items = [];
    s.incomes.forEach((e) => items.push({ k: 'inc', e, date: e.date, cat: 'ingresos' }));
    s.expenses.forEach((e) => items.push({ k: 'exp', e, date: e.date, cat: e.category }));
    s.payments.forEach((e) => items.push({ k: 'pay', e, date: e.date, cat: 'pagos' }));
    if (f.cat !== 'all') items = items.filter((x) => x.cat === f.cat);
    if (f.from) items = items.filter((x) => x.date >= f.from);
    if (f.to) items = items.filter((x) => x.date <= f.to);
    const q = f.q.trim().toLowerCase();
    if (q) {
      items = items.filter((x) => {
        const r = rowsFor(x.k, x.e);
        return (r.title + ' ' + r.sub + ' ' + (x.e.place || '') + ' ' + (x.e.note || '')).toLowerCase().includes(q);
      });
    }
    items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const chips = [['all', 'Todo'], ['ingresos', 'Ingresos'], ['pagos', 'Pagos']].concat(s.categories.map((c) => [c.id, c.name]));
    const totalOut = NB.sum(items.filter((x) => x.k === 'exp' && !x.e.pending), (x) => NB.num(x.e.amount)) + NB.sum(items.filter((x) => x.k === 'pay'), (x) => NB.num(x.e.amount));
    const totalIn = NB.sum(items.filter((x) => x.k === 'inc'), (x) => NB.num(x.e.amount));
    let body = '';
    let last = '';
    items.slice(0, 300).forEach((x) => {
      if (x.date !== last) {
        last = x.date;
        body += '<div class="day-h">' + NB.fmtLong(x.date) + '</div>';
      }
      body += rowHtml(rowsFor(x.k, x.e));
    });
    return (
      '<div class="filters"><input class="search" type="search" placeholder="Buscar lugar, nota o cliente" value="' + esc(f.q) + '" data-input="q"><div class="chips">' +
      chips.map((c) => '<button class="chip' + (f.cat === c[0] ? ' on' : '') + '" data-act="fcat" data-v="' + esc(c[0]) + '">' + esc(c[1]) + '</button>').join('') +
      '</div><div class="dates"><label><span class="mut small">Desde</span><input type="date" value="' + esc(f.from) + '" data-input="from"></label><label><span class="mut small">Hasta</span><input type="date" value="' + esc(f.to) + '" data-input="to"></label></div></div>' +
      '<div class="row between mut small pad"><span>' + items.length + ' ' + NB.plural(items.length, 'movimiento', 'movimientos') + '</span><span>Entró ' + money(totalIn) + ' · Salió ' + money(totalOut) + '</span></div>' +
      (body ? '<div class="card list">' + body + '</div>' : '<div class="card empty">No hay movimientos con estos filtros.</div>')
    );
  }

  /* =============== PAGOS =============== */
  NB.views.pay = () => {
    const t = NB.today();
    const type = NB.payTab;
    const list = NB.state.debts.filter((d) => d.type === type);
    const insAll = NB.instances(t);
    const tabs = [['tarjeta', 'Tarjetas'], ['prestamo', 'Préstamos'], ['suscripcion', 'Suscripciones'], ['servicio', 'Servicios']];
    const monthly = NB.sum(list.filter((d) => d.active !== false), (d) => NB.targetOf(d));
    const cards = list
      .sort((a, b) => NB.num(a.dueDay) - NB.num(b.dueDay))
      .map((d, k) => {
        const ym = NB.ym(t);
        const paidNow = NB.isPaid(d, ym);
        const inst = insAll.find((i) => i.debt.id === d.id);
        const target = NB.targetOf(d);
        let meta = '';
        if (d.type === 'tarjeta') meta = (d.bank ? esc(d.bank) + ' · ' : '') + 'corte ' + (d.cutDay || '—') + ' · pago ' + (d.dueDay || '—');
        else if (d.type === 'prestamo') meta = (d.bank ? esc(d.bank) + ' · ' : '') + 'día ' + (d.dueDay || '—') + (d.rate ? ' · ' + d.rate + '% anual' : '');
        else meta = (d.note ? esc(d.note) + ' · ' : '') + 'día ' + (d.dueDay || '—') + (d.work === false || d.type !== 'suscripcion' ? '' : ' · herramienta de trabajo');
        let extra = '';
        if (d.type === 'tarjeta') {
          const bits = [];
          if (NB.num(d.balance) > 0) bits.push('Saldo ' + NB.money0(d.balance));
          if (NB.num(d.limit) > 0) bits.push('Límite ' + NB.money0(d.limit));
          if (NB.num(d.rate) > 0) bits.push('Tasa ' + d.rate + '%');
          if (NB.num(d.cat) > 0) bits.push('CAT ' + d.cat + '%');
          if (NB.num(d.min) > 0) bits.push('Mínimo ' + NB.money0(d.min));
          if (NB.num(d.fee) > 0) bits.push('Anualidad ' + NB.money0(d.fee));
          extra = bits.length ? '<div class="chips ro">' + bits.map((b) => '<span class="chip">' + esc(b) + '</span>').join('') + '</div>' : '';
          if (NB.num(d.rate) > 0 && NB.num(d.balance) > 0 && NB.num(d.min) > 0) {
            const int = Math.max(0, (NB.num(d.balance) - NB.num(d.min)) * (NB.num(d.rate) / 100 / 12) * 1.16);
            extra += '<p class="note small">Si pagas solo el mínimo, pagarías aprox. <b>' + money(int) + '</b> de intereses este mes (con IVA). Pagando el total: $0. Es un estimado.</p>';
          }
        }
        return (
          '<div class="card debt' + (d.active === false ? ' off' : '') + '"><div class="row"><div class="logo">' + NB.debtIcon(d) + '</div><div class="grow"><b>' + esc(d.name) + '</b><div class="mut small">' + meta + '</div></div><div class="right"><b>' + money(target) + '</b><div class="mut small">' + (d.active === false ? 'En pausa' : inst ? NB.fmtShort(inst.due) : '') + '</div></div></div>' +
          (d.active === false
            ? ''
            : (paidNow ? '<div class="paid small">' + NB.icon('check', 14) + ' Pagado en ' + NB.MONTHS[t.getMonth()] + '. Ahora aparta para el siguiente.</div>' : '') +
              (inst ? NB.charts.progress(inst.target ? inst.allocated / inst.target : 0, 0.2 + k * 0.08) + '<div class="row between mut small"><span>Apartado ' + money(inst.allocated) + '</span><span>' + (inst.remaining > 0 ? 'Faltan ' + money(inst.remaining) : 'Completo') + '</span></div>' : '')) +
          extra +
          '<div class="a-act"><button class="btn sm primary" data-act="paysheet" data-id="' + d.id + '">Marcar pagado</button><button class="btn sm ghost" data-act="debt-edit" data-id="' + d.id + '">' + NB.icon('edit', 14) + ' Editar</button></div></div>'
        );
      })
      .join('');
    const names = { tarjeta: 'tarjeta', prestamo: 'préstamo', suscripcion: 'suscripción', servicio: 'renta o servicio' };
    return (
      '<header class="top"><div><span class="mut small">Cada mes</span><h1>Pagos</h1></div><button class="btn sm primary" data-act="debt-new">' + NB.icon('plus', 16) + ' Agregar</button></header>' +
      NB.seg('paytab', tabs, type) +
      '<div class="sum card"><span class="mut small">Total mensual en ' + tabs.find((x) => x[0] === type)[1].toLowerCase() + '</span><b class="mid">' + money(monthly) + '</b></div>' +
      (cards || '<div class="card empty">Aún no tienes ' + (type === 'servicio' ? 'rentas o servicios' : type === 'prestamo' ? 'préstamos' : type === 'tarjeta' ? 'tarjetas' : 'suscripciones') + '. Toca Agregar para crear tu primer ' + names[type] + '.</div>')
    );
  };

  /* =============== AJUSTES =============== */
  NB.views.set = () => {
    const s = NB.state.settings;
    const row = (ic, title, sub, act) => '<button class="srow" data-act="' + act + '"><span class="s-ic">' + NB.icon(ic, 18) + '</span><span class="grow"><b>' + title + '</b><span class="mut small">' + sub + '</span></span>' + NB.icon('chev', 18) + '</button>';
    const act = NB.state.clients.filter((c) => c.active !== false).length;
    return (
      '<header class="top"><div><span class="mut small">Noir Balance</span><h1>Ajustes</h1></div>' + NB.logo(34) + '</header>' +
      '<section><h2 class="sec">Apariencia</h2><div class="card">' + NB.seg('theme', [['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']], s.theme) + '<p class="mut small pad">Automático sigue el modo de tu iPhone.</p></div></section>' +
      '<section><h2 class="sec">Tu dinero</h2><div class="card list">' +
      row('user', 'Clientes', act + ' ' + NB.plural(act, 'activo', 'activos') + ' · días de pago y montos', 'clients') +
      row('spark', 'Plan del mes', NB.PLANS[NB.currentPlanKey(NB.today())].name + ' · cambia el ahorro de cada plan', 'plans') +
      row('spark', 'Asesor', 'Pregunta cuánto apartar, ahorrar o gastar', 'advisor') +
      row('list', 'Categorías y presupuesto', 'Crea categorías y límites por semana', 'cats') +
      row('dollar', 'Gastos de la semana', 'Gasolina ' + NB.money0(s.expense.gasolina) + ' · comida ' + NB.money0(s.expense.comida), 'weekly') +
      row('card', 'Saldo disponible', 'Corrige el dinero que tienes hoy', 'balance') +
      '</div></section>' +
      '<section><h2 class="sec">Avisos</h2><div class="card list">' + row('bell', 'Recordatorios en el iPhone', 'Plan del día 1 a las 7:00 am, pagos y clientes', 'reminders') + '</div></section>' +
      '<section><h2 class="sec">Datos y seguridad</h2><div class="card list">' +
      row('download', 'Respaldo', s.lastBackup ? 'Último: ' + NB.fmtShort(s.lastBackup) : 'Exporta o importa tus datos', 'backup') +
      row('lock', 'Cambiar PIN', 'Protege la app con 6 dígitos', 'changepin') +
      row('user', 'Tu nombre', esc(s.name || ''), 'rename') +
      row('trash', 'Borrar todos los datos', 'No se puede deshacer', 'wipe') +
      '</div></section>' +
      '<p class="credit">Noir Balance · Creado por José García</p>'
    );
  };

  NB.render = () => {
    const root = NB.$('#screen');
    if (!root) return;
    const keep = root.scrollTop;
    root.innerHTML = (NB.views[NB.tab] || NB.views.home)();
    root.scrollTop = keep;
    NB.$$('#nav [data-act="goto"]').forEach((b) => b.classList.toggle('on', b.dataset.v === NB.tab));
    if (NB.tab === 'home') NB.bindCarousel();
  };
  NB.bindCarousel = () => {
    const car = NB.$('#car');
    const dots = NB.$$('#dots i');
    if (!car || !dots.length) return;
    if (NB._carIdx) car.scrollLeft = NB._carIdx * (car.firstElementChild ? car.firstElementChild.offsetWidth + 12 : 0);
  };
})();
