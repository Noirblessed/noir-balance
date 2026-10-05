/* Noir Balance · motor del plan financiero (apartados por fecha de pago) */
(function () {
  const NB = window.NB;

  NB.PLANS = {
    rapido: {
      key: 'rapido',
      name: 'Rápido',
      tag: 'Deudas primero',
      desc: 'Aparta más y más pronto para liquidar tus pagos cuanto antes. Te deja menos dinero libre.',
      boost: 1,
      exp: 0.8,
      extra: 0.7
    },
    equilibrado: {
      key: 'equilibrado',
      name: 'Equilibrado',
      tag: 'Pagos a tiempo y buena liquidez',
      desc: 'Reparte cada pago en partes iguales hasta su fecha. Llegas sin presión y conservas dinero libre.',
      boost: 1,
      exp: 1,
      extra: 0
    },
    liquidez: {
      key: 'liquidez',
      name: 'Liquidez',
      tag: 'Máximo dinero libre',
      desc: 'Aparta solo lo necesario para llegar a cada fecha de pago. Más tranquilo, con más margen para ti.',
      boost: 0.85,
      exp: 1,
      extra: 0
    }
  };

  /* ---------- Pagos y deudas ---------- */
  NB.targetOf = (d) => {
    if (d.type === 'tarjeta') return NB.num(d.noInterest) > 0 ? NB.num(d.noInterest) : NB.num(d.min);
    return NB.num(d.amount);
  };
  // 0 tarjetas, 1 herramientas de trabajo, 2 préstamos, 3 renta/servicios
  NB.groupOf = (d) => (d.type === 'tarjeta' ? 0 : d.type === 'suscripcion' ? (d.work === false ? 3 : 1) : d.type === 'prestamo' ? 2 : 3);
  NB.dueOf = (d, ym) => {
    const y = +ym.slice(0, 4);
    const m = +ym.slice(5, 7) - 1;
    return new Date(y, m, Math.min(Math.max(1, NB.num(d.dueDay) || 1), NB.daysIn(y, m)));
  };
  NB.paidSum = (id, ym) => NB.sum(NB.state.payments.filter((p) => p.debtId === id && p.ym === ym), (p) => NB.num(p.amount));
  NB.isPaid = (d, ym) => {
    const ps = NB.state.payments.filter((p) => p.debtId === d.id && p.ym === ym);
    if (ps.some((p) => p.full)) return true;
    const t = NB.targetOf(d);
    return t > 0 && NB.sum(ps, (p) => NB.num(p.amount)) >= t - 0.5;
  };
  NB.allocSum = (id, ym) => NB.round2(NB.sum(NB.state.allocs.filter((a) => a.debtId === id && a.ym === ym), (a) => NB.num(a.amount)));

  NB.instances = (today) => {
    const out = [];
    NB.state.debts.forEach((d) => {
      if (d.active === false) return;
      const target = NB.targetOf(d);
      if (!(target > 0)) return;
      let ym = NB.ym(today);
      if (NB.isPaid(d, ym)) ym = NB.addMonthsYM(ym, 1);
      const due = NB.dueOf(d, ym);
      const allocated = NB.allocSum(d.id, ym);
      out.push({
        debt: d,
        ym,
        due,
        target,
        allocated,
        remaining: NB.round2(Math.max(0, target - allocated)),
        group: NB.groupOf(d),
        days: NB.diffDays(today, due)
      });
    });
    return out;
  };
  const byGroupDue = (a, b) => a.group - b.group || a.due - b.due || a.debt.name.localeCompare(b.debt.name);
  const byDue = (a, b) => a.due - b.due || a.group - b.group;
  NB.instancesByDue = (today) => NB.instances(today).sort(byDue);

  /* ---------- Saldo ---------- */
  NB.balanceAt = (date) => {
    const s = NB.state;
    const end = NB.ymd(date);
    const st = s.settings.startDate || '0000-00-00';
    const f = (a) => NB.sum(a.filter((x) => x.date >= st && x.date <= end), (x) => NB.num(x.amount));
    return NB.round2(NB.num(s.settings.startBalance) + f(s.incomes) - f(s.expenses.filter((e) => !e.pending)) - f(s.payments));
  };
  NB.savingsFund = () => NB.round2(NB.sum(NB.state.allocs.filter((a) => a.debtId === 'ahorro'), (a) => NB.num(a.amount)));
  NB.apartados = () => {
    const s = NB.state;
    let tot = NB.savingsFund();
    const groups = {};
    s.allocs.forEach((a) => {
      if (a.debtId === 'ahorro') return;
      const k = a.debtId + '|' + a.ym;
      groups[k] = (groups[k] || 0) + NB.num(a.amount);
    });
    Object.keys(groups).forEach((k) => {
      const [id, ym] = k.split('|');
      const d = s.debts.find((x) => x.id === id);
      if (!d || d.active === false || NB.isPaid(d, ym)) return;
      tot += groups[k];
    });
    return NB.round2(tot);
  };

  /* ---------- Ingresos esperados (clientes) ---------- */
  NB.occurs = (c, date) => {
    if (c.active === false) return false;
    if (c.freq === 'monthly') return date.getDate() === Math.min(Math.max(1, NB.num(c.dom) || 1), NB.daysIn(date.getFullYear(), date.getMonth()));
    if (c.freq === 'biweekly') {
      const a = NB.parse(c.anchor || NB.ymd(date));
      const diff = NB.diffDays(a, date);
      return ((diff % 14) + 14) % 14 === 0;
    }
    return date.getDay() === (c.dow == null ? 3 : c.dow);
  };
  NB.expectedIncomes = (from, to) => {
    const out = [];
    const clients = NB.state.clients.filter((c) => c.active !== false);
    let guard = 0;
    for (let d = from; d <= to && guard < 400; d = NB.addDays(d, 1), guard++) {
      if (clients.length) {
        clients.forEach((c) => {
          if (NB.occurs(c, d)) out.push({ date: NB.ymd(d), client: c, amount: NB.num(c.amount) });
        });
      } else if (d.getDay() === 3) {
        const inc = NB.state.incomes;
        const avg = inc.length ? NB.sum(inc, (i) => NB.num(i.amount)) / inc.length : 0;
        out.push({ date: NB.ymd(d), client: null, amount: NB.round2(avg) });
      }
    }
    return out;
  };

  NB.weeklyEstimate = (today) => {
    const s = NB.state;
    const from = NB.ymd(NB.addDays(today, -28));
    const to = NB.ymd(today);
    const recent = s.expenses.filter((e) => !e.pending && e.date >= from && e.date <= to);
    const base = NB.num(s.settings.expense.gasolina) + NB.num(s.settings.expense.comida);
    if (recent.length >= 6) return NB.round2(Math.max(NB.sum(recent, (e) => NB.num(e.amount)) / 4, base * 0.5));
    return NB.round2(base);
  };

  /* ---------- Reparto de un ingreso ---------- */
  NB.computeAllocation = (amount, planKey, today) => {
    const s = NB.state;
    amount = NB.round2(NB.num(amount));
    const plan = NB.PLANS[planKey] || NB.PLANS.equilibrado;
    const pct = NB.num(s.settings.savings[plan.key]);
    let left = amount;
    const savings = Math.min(left, NB.round2((amount * pct) / 100));
    left = NB.round2(left - savings);

    const ups = NB.instances(today).filter((i) => i.remaining > 0.005).sort(byGroupDue);
    const futureDates = Array.from(new Set(NB.expectedIncomes(NB.addDays(today, 1), NB.addDays(today, 62)).map((e) => e.date))).sort();
    const lines = [];
    const shortfall = [];
    ups.forEach((i) => {
      const dueStr = NB.ymd(i.due);
      let n = 1 + futureDates.filter((d) => d <= dueStr).length;
      if (i.due < today) n = 1;
      const need = n <= 1 ? i.remaining : Math.min(i.remaining, Math.ceil((i.remaining / n) * plan.boost));
      const give = NB.round2(Math.min(need, left));
      left = NB.round2(left - give);
      lines.push({ debt: i.debt, ym: i.ym, due: i.due, group: i.group, remaining: i.remaining, need, amount: give, n, extra: 0 });
      if (give < need - 0.005) shortfall.push({ name: i.debt.name, missing: NB.round2(need - give) });
    });

    const expenseReserve = NB.round2(Math.min(left, NB.weeklyEstimate(today) * plan.exp));
    left = NB.round2(left - expenseReserve);

    let extraTotal = 0;
    if (plan.extra > 0 && left > 0 && lines.length) {
      let pool = NB.round2(left * plan.extra);
      lines.forEach((l) => {
        const room = NB.round2(l.remaining - l.amount);
        const add = Math.max(0, Math.min(room, pool));
        l.amount = NB.round2(l.amount + add);
        l.extra = NB.round2(add);
        pool = NB.round2(pool - add);
        extraTotal = NB.round2(extraTotal + add);
      });
      left = NB.round2(left - extraTotal);
    }
    return { total: amount, plan: plan.key, pct, savings, lines, expenseReserve, free: Math.max(0, left), shortfall };
  };

  NB.applyAllocation = (res, incomeId, dateStr) => {
    const s = NB.state;
    res.lines.forEach((l) => {
      if (l.amount > 0.004) s.allocs.push({ id: NB.uid(), date: dateStr, incomeId, debtId: l.debt.id, ym: l.ym, amount: l.amount });
    });
    if (res.savings > 0.004) s.allocs.push({ id: NB.uid(), date: dateStr, incomeId, debtId: 'ahorro', ym: null, amount: res.savings });
    NB.save();
  };
  NB.undoAllocation = (incomeId) => {
    NB.state.allocs = NB.state.allocs.filter((a) => a.incomeId !== incomeId);
    NB.save();
  };

  /* ---------- Plan sugerido del mes ---------- */
  NB.currentPlanKey = (today) => {
    const s = NB.state.settings;
    const ym = NB.ym(today || NB.today());
    if (s.plans[ym]) return s.plans[ym];
    const keys = Object.keys(s.plans).sort();
    return keys.length ? s.plans[keys[keys.length - 1]] : 'equilibrado';
  };
  NB.recommend = (today) => {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const limit = NB.addDays(today, 31);
    const ups = NB.instances(today).filter((i) => i.due <= end || i.due <= limit);
    const obligations = NB.round2(NB.sum(ups, (i) => i.remaining));
    const daysLeft = Math.max(1, NB.diffDays(today, end) + 1);
    const expected = NB.sum(NB.expectedIncomes(today, end), (e) => e.amount);
    const free = Math.max(0, NB.balanceAt(today) - NB.apartados());
    const supply = NB.round2(free + expected);
    const demand = NB.round2(obligations + (NB.weeklyEstimate(today) * daysLeft) / 7);
    const ratio = supply > 0 ? demand / supply : obligations > 0 ? 9 : 0;
    const plan = ratio >= 0.75 ? 'rapido' : ratio >= 0.4 ? 'equilibrado' : obligations > 0 ? 'liquidez' : 'equilibrado';
    return { plan, ratio, obligations, supply, demand };
  };

  /* ---------- Serie del balance del mes (real + proyección) ---------- */
  NB.monthSeries = (today) => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const n = NB.daysIn(y, m);
    const todayIdx = today.getDate() - 1;
    const vals = [];
    const exp = NB.expectedIncomes(NB.addDays(today, 1), new Date(y, m, n));
    const daily = NB.weeklyEstimate(today) / 7;
    const dues = NB.instances(today);
    for (let d = 1; d <= n; d++) {
      const date = new Date(y, m, d);
      if (d - 1 <= todayIdx) vals.push(NB.balanceAt(date));
      else {
        const ds = NB.ymd(date);
        let v = vals[vals.length - 1] - daily;
        exp.filter((e) => e.date === ds).forEach((e) => (v += e.amount));
        dues.filter((i) => NB.ymd(i.due) === ds).forEach((i) => (v -= i.target));
        vals.push(NB.round2(v));
      }
    }
    return { vals, todayIdx, days: n };
  };

  /* ---------- Gastos por semana de categoría ---------- */
  NB.weekSpent = (catId, today) => {
    const ws = NB.ymd(NB.weekStart(today));
    return NB.round2(
      NB.sum(
        NB.state.expenses.filter((e) => !e.pending && e.category === catId && e.date >= ws && e.date <= NB.ymd(today)),
        (e) => NB.num(e.amount)
      )
    );
  };

  /* ---------- Alertas y avisos dentro de la app ---------- */
  NB.clientKey = (c, date) => c.id + '|' + date;
  NB.alerts = (today) => {
    const s = NB.state;
    const out = [];
    const ts = NB.ymd(today);
    const tomorrow = NB.ymd(NB.addDays(today, 1));

    // Clientes
    s.clients.forEach((c) => {
      if (c.active === false) return;
      for (let i = -10; i <= 1; i++) {
        const d = NB.addDays(today, i);
        if (!NB.occurs(c, d)) continue;
        const ds = NB.ymd(d);
        if (ds < (s.settings.startDate || '0000-00-00')) continue;
        const conf = s.confirmations[NB.clientKey(c, ds)];
        if (conf === 'received' || conf === 'skipped') continue;
        const when = ds === ts ? 'Hoy' : i === 1 ? 'Mañana' : i === -1 ? 'Ayer' : NB.fmtShort(d);
        const amt = NB.money(c.amount) + ' esperados';
        if (i === 1) {
          out.push({ id: 'cm' + c.id + ds, pri: 20, tone: 'info', icon: 'user', title: c.name + ' paga mañana', sub: amt });
        } else if (conf === 'late') {
          out.push({
            id: 'cl' + c.id + ds,
            pri: 1,
            tone: 'warn',
            icon: 'user',
            title: c.name + ' · pago atrasado',
            sub: 'Esperado el ' + NB.fmtShort(d) + ' · ' + amt,
            actions: [
              { label: 'Ya llegó', act: 'client-yes', id: c.id, date: ds, primary: true },
              { label: 'Descartar', act: 'client-skip', id: c.id, date: ds }
            ]
          });
        } else {
          out.push({
            id: 'ca' + c.id + ds,
            pri: 0,
            tone: 'good',
            icon: 'user',
            title: '¿' + c.name + ' ya liquidó su pago?',
            sub: when + ' · ' + amt,
            actions: [
              { label: 'Sí', act: 'client-yes', id: c.id, date: ds, primary: true },
              { label: 'No', act: 'client-no', id: c.id, date: ds }
            ]
          });
        }
      }
    });

    // Pagos próximos
    const free = NB.balanceAt(today) - NB.apartados();
    NB.instancesByDue(today).forEach((i) => {
      if (i.days > 5) return;
      const when = i.days < 0 ? 'venció hace ' + -i.days + ' ' + NB.plural(-i.days, 'día', 'días') : i.days === 0 ? 'vence hoy' : i.days === 1 ? 'vence mañana' : 'vence en ' + i.days + ' días';
      if (i.remaining > 0.005) {
        const actions = [];
        if (free >= i.remaining) actions.push({ label: 'Apartar ' + NB.money0(i.remaining), act: 'topup', id: i.debt.id, primary: true });
        actions.push({ label: 'Ya pagué', act: 'paysheet', id: i.debt.id });
        out.push({
          id: 'pd' + i.debt.id + i.ym,
          pri: i.days <= 1 ? 2 : 5,
          tone: 'warn',
          icon: 'card',
          title: i.debt.name + ' ' + when,
          sub: 'Faltan ' + NB.money(i.remaining) + ' por apartar de ' + NB.money(i.target),
          actions
        });
      } else {
        out.push({
          id: 'pr' + i.debt.id + i.ym,
          pri: 6,
          tone: 'good',
          icon: 'card',
          title: i.debt.name + ' ' + when,
          sub: 'Ya está apartado. Cuando lo pagues, márcalo.',
          actions: [{ label: 'Marcar pagado', act: 'paysheet', id: i.debt.id, primary: true }]
        });
      }
    });

    // Cortes de tarjeta
    s.debts.forEach((d) => {
      if (d.type !== 'tarjeta' || d.active === false || !d.cutDay) return;
      const cut = Math.min(NB.num(d.cutDay), NB.daysIn(today.getFullYear(), today.getMonth()));
      if (today.getDate() === cut) out.push({ id: 'cut' + d.id + ts, pri: 8, tone: 'info', icon: 'card', title: 'Hoy es el corte de ' + d.name, sub: 'Se cierra tu estado de cuenta.' });
      else if (today.getDate() + 1 === cut) out.push({ id: 'cut' + d.id + ts, pri: 9, tone: 'info', icon: 'card', title: 'Mañana es el corte de ' + d.name, sub: 'Revisa tus gastos antes del corte.' });
    });

    // Presupuestos semanales
    s.categories.forEach((c) => {
      const lim = NB.num(c.weekly);
      if (lim <= 0) return;
      const sp = NB.weekSpent(c.id, today);
      if (sp >= lim) out.push({ id: 'bg' + c.id, pri: 4, tone: 'warn', icon: 'alert', title: 'Te pasaste en ' + c.name, sub: 'Llevas ' + NB.money(sp) + ' de ' + NB.money(lim) + ' esta semana.' });
      else if (sp >= lim * 0.8) out.push({ id: 'bg' + c.id, pri: 10, tone: 'info', icon: 'alert', title: c.name + ': ya vas al ' + Math.round((sp / lim) * 100) + '%', sub: 'Te quedan ' + NB.money(lim - sp) + ' esta semana.' });
    });

    // Tickets pendientes
    const pend = s.expenses.filter((e) => e.pending);
    if (pend.length)
      out.push({
        id: 'tk',
        pri: 7,
        tone: 'info',
        icon: 'camera',
        title: pend.length + ' ' + NB.plural(pend.length, 'ticket', 'tickets') + ' por completar',
        sub: 'Agrega monto y lugar cuando tengas un momento.',
        actions: [{ label: 'Completar', act: 'tickets', primary: true }]
      });

    // Plan del mes
    const ym = NB.ym(today);
    if (!s.settings.plans[ym] && (s.debts.length || s.clients.length))
      out.push({
        id: 'plan' + ym,
        pri: 3,
        tone: 'good',
        icon: 'spark',
        title: 'Elige tu plan de ' + NB.MONTHS[today.getMonth()],
        sub: 'Rápido, Equilibrado o Liquidez, según tus pagos del mes.',
        actions: [{ label: 'Ver planes', act: 'plans', primary: true }]
      });

    // Respaldo
    const entries = s.incomes.length + s.expenses.length;
    const lb = s.settings.lastBackup;
    if (entries >= 15 && (!lb || NB.diffDays(NB.parse(lb), today) > 30))
      out.push({
        id: 'bk',
        pri: 30,
        tone: 'info',
        icon: 'download',
        title: 'Haz un respaldo',
        sub: 'Si cambias de iPhone o se borran los datos de Safari, lo recuperas.',
        actions: [{ label: 'Respaldar', act: 'backup', primary: true }]
      });

    return out.sort((a, b) => a.pri - b.pri);
  };
})();
