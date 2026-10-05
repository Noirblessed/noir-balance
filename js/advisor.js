/* Noir Balance · Asesor: responde "¿cuánto aparto?" con tus propios datos (sin internet, gratis) */
(function () {
  const NB = window.NB;
  const money = (n) => NB.money(n);
  const m0 = (n) => NB.money0(n);

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  NB.advisorFacts = (t) => {
    t = t || NB.today();
    const s = NB.state;
    const bal = NB.balanceAt(t);
    const apart = NB.apartados();
    const free = NB.round2(bal - apart);
    const ins = NB.instancesByDue(t).filter((i) => i.remaining > 0);
    const items = ins.map((i) => {
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

  const A = {
    intro: () => [
      'Hola. Soy tu asesor dentro de Noir Balance. Respondo con tus propios números (pagos, clientes y gastos), sin internet.',
      'Pregúntame, por ejemplo: **¿cuánto aparto esta semana?**, **¿me alcanza este mes?** o **¿qué pago primero?**'
    ],
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
      if (cover < f.weekNeed) o.push('Ojo: entre tu dinero libre (' + m0(f.free) + ') y lo que esperas cobrar esta semana (' + m0(f.expectedWeek) + ') faltan **' + m0(f.weekNeed - cover) + '**. Cobra pendientes o recorta gastos y empieza por **' + f.items[0].debt.name + '**.');
      else o.push('Te alcanza: entre tu dinero libre y lo que esperas cobrar tienes ' + m0(cover) + '.');
      o.push('Recuerda que la app solo organiza; tú separas el dinero en tu banco o efectivo.');
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
      f.items.slice().sort((a, b) => a.group - b.group || a.due - b.due).forEach((i) => {
        if (pool >= i.remaining) pool -= i.remaining;
        else {
          uncovered.push(i.debt.name + ' (faltan ' + m0(i.remaining - pool) + ')');
          pool = 0;
        }
      });
      if (uncovered.length) o.push('Primero cubre tarjetas y herramientas de trabajo. Quedarían sin completar: ' + uncovered.join(', ') + '.');
      o.push('Qué puedes hacer: cobrar a clientes pendientes, pagar solo el mínimo en alguna tarjeta o pausar una suscripción que no uses.');
      return o;
    },
    primero: (f) => {
      if (!f.items.length) return ['No tienes pagos pendientes. Todo al día.'];
      const order = f.items.slice().sort((a, b) => a.group - b.group || a.due - b.due);
      const why = ['Tarjeta de crédito: genera intereses', 'Herramienta de trabajo: sin ella no produces', 'Préstamo', 'Renta o servicio'];
      const o = ['Este es tu orden de prioridad:'];
      order.slice(0, 5).forEach((i, k) => o.push(k + 1 + '. **' + i.debt.name + '** · ' + m0(i.remaining) + ' · ' + due(i) + ' (' + why[i.group] + ')'));
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
      o.push('Puedes cambiar el porcentaje en Ajustes > Plan del mes.');
      return o;
    },
    plan: (f) => {
      const p = NB.PLANS[f.rec.plan];
      return ['Por tus números te conviene **' + p.name + '** (' + p.tag + ').', 'Pagos pendientes: ' + m0(f.rec.obligations) + '. Dinero libre más cobros esperados: ' + m0(f.rec.supply) + '.', 'Elígelo desde la tarjeta "Plan" en Inicio.'];
    },
    tarjetas: (f) => {
      const cards = NB.state.debts.filter((d) => d.type === 'tarjeta' && d.active !== false);
      if (!cards.length) return ['No tienes tarjetas registradas. Agrégalas en Pagos > Tarjetas.'];
      const o = ['Con tus tarjetas:'];
      cards.forEach((d) => {
        const ni = NB.num(d.noInterest);
        const mn = NB.num(d.min);
        let t = '• **' + d.name + '**: ';
        if (ni > 0) t += 'paga **' + m0(ni) + '** para no generar intereses';
        else t += 'registra tu "pago para no generar intereses" para decirte más';
        if (mn > 0) t += ' (el mínimo es ' + m0(mn) + ')';
        if (NB.num(d.rate) > 0 && NB.num(d.balance) > mn && mn > 0) t += '. Pagando solo el mínimo, pagarías alrededor de ' + m0((NB.num(d.balance) - mn) * (NB.num(d.rate) / 1200) * 1.16) + ' de intereses este mes';
        o.push(t + '.');
      });
      return o;
    }
  };

  NB.advisorAnswer = (q) => {
    const f = NB.advisorFacts();
    const t = norm(q);
    let k;
    if (/tarjeta|interes|\bcat\b|minimo/.test(t)) k = 'tarjetas';
    else if (/ahorr|fondo|emergencia/.test(t)) k = 'ahorro';
    else if (/primero|priorid|urgente|orden|cual pago|que pago/.test(t)) k = 'primero';
    else if (/alcanz|completar|este mes|mes completo|llego/.test(t)) k = 'alcanza';
    else if (/plan|rapido|equilibr|liquidez/.test(t)) k = 'plan';
    else if (/gast|puedo|comprar|antojo|salir/.test(t)) k = 'gastar';
    else if (/apart|separ|guard|semana|cuanto|necesito|debo/.test(t)) k = 'aparta';
    else if (/como voy|resumen|saldo|balance|tengo/.test(t)) k = 'resumen';
    else if (/^(hola|buenas|ayuda|hey)/.test(t)) k = 'intro';
    if (!k) return ['No entendí esa pregunta, pero puedo ayudarte con estas:', '**cuánto aparto**, **si me alcanza**, **qué pago primero**, **cuánto puedo gastar**, **cuánto ahorro**, **qué plan elegir** o **mis tarjetas**.'];
    return A[k](f);
  };

  const fmt = (line) => NB.esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const QUICK = [
    ['¿Cuánto aparto esta semana?', 'Cuánto aparto'],
    ['¿Me alcanza este mes?', 'Me alcanza'],
    ['¿Qué pago primero?', 'Qué pago primero'],
    ['¿Cuánto puedo gastar?', 'Cuánto gastar'],
    ['¿Cuánto ahorro?', 'Cuánto ahorro'],
    ['¿Qué plan me conviene?', 'Qué plan'],
    ['Mis tarjetas', 'Mis tarjetas'],
    ['¿Cómo voy?', 'Cómo voy']
  ];
  NB._chat = NB._chat || [];

  const bubbles = () =>
    NB._chat
      .map((m) => (m.me ? '<div class="bub me">' + NB.esc(m.t) + '</div>' : '<div class="bub ai">' + m.t.map((l) => '<p>' + fmt(l) + '</p>').join('') + '</div>'))
      .join('');

  NB.openAdvisor = () => {
    if (!NB._chat.length) NB._chat.push({ me: false, t: A.intro() });
    NB.sheet(
      NB.sheetHead('Asesor', 'Con tus números, sin internet') +
        '<div class="chat" id="chat">' + bubbles() + '</div>' +
        '<div class="qchips">' + QUICK.map((q) => '<button type="button" class="chip" data-act="ask" data-q="' + NB.esc(q[0]) + '">' + NB.esc(q[1]) + '</button>').join('') + '</div>' +
        '<form class="askbar" data-form="ask" autocomplete="off"><input name="q" placeholder="Escribe tu pregunta" enterkeyhint="send"><button class="btn primary" type="submit" aria-label="Enviar">' + NB.icon('chev', 18) + '</button></form>',
      { full: true }
    );
    const c = NB.$('#chat');
    if (c) c.scrollTop = c.scrollHeight;
  };
  const say = (q) => {
    q = String(q || '').trim();
    if (!q) return;
    NB._chat.push({ me: true, t: q });
    NB._chat.push({ me: false, t: NB.advisorAnswer(q) });
    if (NB._chat.length > 40) NB._chat = NB._chat.slice(-40);
    NB.openAdvisor();
  };
  NB.act.advisor = () => NB.openAdvisor();
  NB.act.ask = (el) => say(el.dataset.q);
  NB.forms.ask = (_, form) => say(new FormData(form).get('q'));

  /* Tarjeta de Inicio: cuánto apartar esta semana */
  NB.advisorCard = () => {
    const f = NB.advisorFacts();
    if (!f.items.length) return '';
    const total = NB.round2(f.weekNeed + f.saveWeek);
    const first = f.items[0];
    return (
      '<section class="card ask-card"><div class="grow"><span class="mut small">Esta semana aparta</span><b class="mid">' + m0(total) + '</b>' +
      '<span class="mut small">' + m0(f.weekNeed) + ' para pagos' + (f.saveWeek > 0 ? ' · ' + m0(f.saveWeek) + ' ahorro' : '') + ' · primero ' + NB.esc(first.debt.name) + '</span></div>' +
      '<button class="btn sm primary" data-act="advisor">' + NB.icon('spark', 16) + ' Preguntar</button></section>'
    );
  };
})();
