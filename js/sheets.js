/* Noir Balance · formularios, hojas y acciones */
(function () {
  const NB = window.NB;
  const esc = NB.esc;
  const money = NB.money;
  const F = NB.f;
  const A = NB.act;
  const T = () => NB.today();
  const done = (msg) => {
    NB.save();
    NB.closeSheet();
    NB.render();
    if (msg) NB.toast(msg);
  };
  const fdata = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => (o[k] = v));
    return o;
  };

  /* ---------- Cierres y navegación ---------- */
  A.close = () => NB.closeSheet();
  A['dlg-no'] = () => NB.closeDialog();
  A['dlg-yes'] = () => {
    const fn = NB._confirmFn;
    NB.closeDialog();
    if (fn) fn();
  };
  A.goto = (el) => {
    NB.tab = el.dataset.v;
    NB.closeSheet();
    NB.render();
    NB.$('#screen').scrollTop = 0;
  };
  A.calsel = (el) => {
    NB.calSel = el.dataset.date;
    NB.render();
  };
  A.calprev = () => {
    NB.calMonth = NB.addMonthsYM(NB.calMonth, -1);
    NB.calSel = NB.calMonth + '-01';
    NB.render();
  };
  A.calnext = () => {
    NB.calMonth = NB.addMonthsYM(NB.calMonth, 1);
    NB.calSel = NB.calMonth + '-01';
    NB.render();
  };
  A.calmode = (el) => {
    NB.calMode = el.dataset.v;
    NB.render();
  };
  A.fcat = (el) => {
    NB.flt.cat = el.dataset.v;
    NB.render();
  };
  A.paytab = (el) => {
    NB.payTab = el.dataset.v;
    NB.render();
  };
  A.theme = (el) => {
    NB.state.settings.theme = el.dataset.v;
    NB.save();
    NB.applyTheme();
    NB.render();
  };

  /* ---------- Menú + ---------- */
  A.add = (el) => {
    NB._addDate = (el && el.dataset && el.dataset.date) || NB.ymd(T());
    NB.sheet(
      NB.sheetHead('Agregar') +
        '<div class="menu">' +
        '<button class="mbtn" data-act="add-expense"><span class="m-ic">' + NB.icon('upload', 22) + '</span><b>Gasto</b><span class="mut small">Gasolina, comida, servicios…</span></button>' +
        '<button class="mbtn" data-act="add-income"><span class="m-ic">' + NB.icon('download', 22) + '</span><b>Ingreso</b><span class="mut small">Pago de un cliente u otro</span></button>' +
        '<button class="mbtn" data-act="add-photo"><span class="m-ic">' + NB.icon('camera', 22) + '</span><b>Foto de ticket</b><span class="mut small">Captura rápido, completa después</span></button>' +
        '<button class="mbtn" data-act="add-payment"><span class="m-ic">' + NB.icon('check', 22) + '</span><b>Pagar una deuda</b><span class="mut small">Tarjeta, préstamo o suscripción</span></button>' +
        '</div>'
    );
  };
  A['add-expense'] = () => NB.openExpense();
  A['add-photo'] = () => NB.openExpense(null, { photoFirst: true });
  A['add-income'] = () => NB.openIncome();
  A['add-payment'] = () => {
    const ds = NB.state.debts.filter((d) => d.active !== false);
    if (!ds.length) {
      NB.closeSheet();
      NB.toast('Primero agrega un pago en la pestaña Pagos.');
      return;
    }
    NB.sheet(
      NB.sheetHead('¿Qué pagaste?') +
        '<div class="card list">' +
        ds.map((d) => '<button class="lrow" data-act="paysheet" data-id="' + d.id + '"><span class="logo sm">' + NB.debtIcon(d) + '</span><span class="grow"><b>' + esc(d.name) + '</b><span class="mut small">' + NB.TYPE_NAMES[d.type] + '</span></span><span class="amt">' + money(NB.targetOf(d)) + '</span></button>').join('') +
        '</div>'
    );
  };

  /* ---------- Gastos ---------- */
  NB.openExpense = (id, o) => {
    o = o || {};
    const e = id ? NB.state.expenses.find((x) => x.id === id) : null;
    NB._editing = e ? e.id : null;
    NB._photo = null;
    NB._photoId = e && e.photoId ? e.photoId : null;
    const cat = e ? e.category : 'comida';
    const places = Array.from(new Set(NB.state.expenses.map((x) => x.place).filter(Boolean)));
    NB.sheet(
      NB.sheetHead(e ? (e.pending ? 'Completar ticket' : 'Editar gasto') : 'Nuevo gasto') +
        '<form data-form="expense" autocomplete="off">' +
        F.money('Monto', 'amount', e && !e.pending ? e.amount : '', 'class="big-in" ' + (o.photoFirst ? '' : 'autofocus')) +
        '<div class="fld"><span>Categoría</span><div class="chips pick">' +
        NB.state.categories.map((c) => '<label class="chip pickc"><input type="radio" name="category" value="' + esc(c.id) + '"' + (c.id === cat ? ' checked' : '') + '><span style="--c:' + c.color + '"><i style="background:' + c.color + '"></i>' + esc(c.name) + '</span></label>').join('') +
        '</div></div>' +
        F.text('Lugar (restaurante, gasolinera…)', 'place', e ? e.place : '', 'list="places" autocapitalize="words"') +
        '<datalist id="places">' + places.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist>' +
        F.date('Fecha', 'date', e ? e.date : NB._addDate || NB.ymd(T())) +
        F.text('Nota', 'note', e ? e.note : '') +
        '<div class="fld"><span>Foto del ticket</span><div class="photo-box" id="photoBox"><span class="mut small">Sin foto</span></div>' +
        '<div class="row gap"><button type="button" class="btn sm ghost" data-act="photo-cam">' + NB.icon('camera', 16) + ' Tomar foto</button><button type="button" class="btn sm ghost" data-act="photo-gal">Galería</button><button type="button" class="btn sm ghost hide" id="ocrBtn" data-act="ocr">' + NB.icon('spark', 16) + ' Leer ticket</button></div>' +
        '<input type="file" accept="image/*" capture="environment" id="photoCam" hidden><input type="file" accept="image/*" id="photoGal" hidden><span class="mut small" id="ocrNote"></span></div>' +
        '<div class="btns"><button class="btn primary wide" type="submit">Guardar gasto</button>' +
        '<button type="button" class="btn ghost wide hide" id="pendBtn" data-act="save-pending">Guardar ticket y completar después</button>' +
        (e ? '<button type="button" class="btn danger-t wide" data-act="del-expense" data-id="' + e.id + '">' + NB.icon('trash', 16) + ' Eliminar</button>' : '') +
        '</div></form>',
      { full: true }
    );
    if (e && e.photoId) {
      NB.photos.get(e.photoId).then((d) => {
        if (d) NB.showPhoto(d, false);
      });
    }
    if (o.photoFirst) setTimeout(() => NB.$('#photoCam') && NB.$('#photoCam').click(), 250);
  };
  NB.showPhoto = (data, isNew) => {
    const box = NB.$('#photoBox');
    if (!box) return;
    box.innerHTML = '<img src="' + data + '" alt="Ticket">';
    NB.$('#ocrBtn') && NB.$('#ocrBtn').classList.remove('hide');
    NB.$('#pendBtn') && NB.$('#pendBtn').classList.remove('hide');
    if (isNew) NB._photo = data;
    NB._photoShown = data;
  };
  A['photo-cam'] = () => NB.$('#photoCam').click();
  A['photo-gal'] = () => NB.$('#photoGal').click();
  NB.onPhotoFile = async (file) => {
    if (!file) return;
    try {
      const data = await NB.readPhoto(file, 1280);
      NB.showPhoto(data, true);
    } catch (err) {
      NB.toast('No pude abrir esa foto.');
    }
  };
  A.ocr = async () => {
    const data = NB._photoShown;
    if (!data) return;
    const note = NB.$('#ocrNote');
    note.textContent = 'Leyendo el ticket… (la primera vez necesita internet)';
    try {
      const r = await NB.ocr(data);
      const form = NB.$('form[data-form="expense"]');
      if (!form) return;
      if (r.amount && !NB.num(form.amount.value)) form.amount.value = r.amount.toFixed(2);
      if (r.place && !form.place.value) form.place.value = r.place;
      if (r.cat) {
        const rad = form.querySelector('input[name="category"][value="' + r.cat + '"]');
        if (rad) rad.checked = true;
      }
      note.textContent = r.amount ? 'Te propuse el monto y el lugar. Revísalos antes de guardar.' : 'No encontré el total. Captúralo a mano.';
    } catch (err) {
      note.textContent = 'No pude leer el ticket (necesita internet la primera vez). Captúralo a mano.';
    }
  };
  async function saveExpense(pending) {
    const form = NB.$('form[data-form="expense"]');
    const d = fdata(form);
    const amount = NB.round2(NB.num(d.amount));
    if (!pending && !(amount > 0)) {
      NB.toast('Escribe el monto del gasto.');
      return;
    }
    const s = NB.state;
    let e = NB._editing ? s.expenses.find((x) => x.id === NB._editing) : null;
    if (!e) {
      e = { id: NB.uid() };
      s.expenses.push(e);
    }
    e.amount = pending ? amount : amount;
    e.category = d.category || 'otros';
    e.place = (d.place || '').trim();
    e.note = (d.note || '').trim();
    e.date = d.date || NB.ymd(T());
    e.pending = !!pending && !(amount > 0);
    if (NB._photo) {
      const pid = e.photoId || NB.uid();
      try {
        await NB.photos.put(pid, NB._photo);
        e.photoId = pid;
      } catch (err) {
        NB.toast('No pude guardar la foto en este dispositivo.');
      }
    }
    const cat = NB.catById(e.category);
    NB._addDate = null;
    done(e.pending ? 'Ticket guardado. Complétalo cuando puedas.' : 'Gasto guardado');
    const lim = NB.num(cat.weekly);
    if (!e.pending && lim > 0 && NB.weekSpent(cat.id, T()) > lim) setTimeout(() => NB.toast('Te pasaste del presupuesto semanal de ' + cat.name + '.'), 1800);
  }
  NB.forms.expense = () => saveExpense(false);
  A['save-pending'] = () => saveExpense(true);
  A['edit-expense'] = (el) => NB.openExpense(el.dataset.id);
  A['del-expense'] = (el) => {
    NB.confirm('¿Eliminar este gasto?', 'Eliminar', async () => {
      const s = NB.state;
      const e = s.expenses.find((x) => x.id === el.dataset.id);
      if (e && e.photoId) {
        try {
          await NB.photos.del(e.photoId);
        } catch (err) {}
      }
      s.expenses = s.expenses.filter((x) => x.id !== el.dataset.id);
      done('Gasto eliminado');
    });
  };
  A.tickets = () => {
    const list = NB.state.expenses.filter((e) => e.pending);
    NB.sheet(
      NB.sheetHead('Tickets por completar') +
        (list.length ? '<div class="card list">' + list.map((e) => '<button class="lrow" data-act="edit-expense" data-id="' + e.id + '"><span class="l-ic">' + NB.icon('camera', 18) + '</span><span class="grow"><b>Ticket del ' + NB.fmtShort(e.date) + '</b><span class="mut small">Falta monto y lugar</span></span>' + NB.icon('chev', 16) + '</button>').join('') + '</div>' : '<div class="card empty">No hay tickets pendientes.</div>')
    );
  };

  /* ---------- Ingresos y reparto ---------- */
  NB.openIncome = (id, pre) => {
    pre = pre || {};
    const s = NB.state;
    const e = id ? s.incomes.find((x) => x.id === id) : null;
    NB._editing = e ? e.id : null;
    const opts = [['', 'Otro ingreso']].concat(s.clients.map((c) => [c.id, c.name]));
    const clientId = e ? e.clientId || '' : pre.clientId || '';
    const amount = e ? e.amount : pre.amount || '';
    NB.sheet(
      NB.sheetHead(e ? 'Editar ingreso' : pre.title || 'Nuevo ingreso', pre.sub || '') +
        '<form data-form="income" autocomplete="off">' +
        F.money('Monto recibido', 'amount', amount, 'class="big-in"') +
        F.select('Cliente', 'clientId', opts, clientId) +
        F.date('Fecha', 'date', e ? e.date : pre.date || NB._addDate || NB.ymd(T())) +
        F.text('Nota', 'note', e ? e.note : '') +
        '<div class="btns"><button class="btn primary wide" type="submit">' + (e ? 'Guardar cambios' : 'Registrar ingreso') + '</button>' +
        (e ? '<button type="button" class="btn danger-t wide" data-act="del-income" data-id="' + e.id + '">' + NB.icon('trash', 16) + ' Eliminar</button>' : '') +
        '</div></form>',
      { full: true }
    );
  };
  NB.forms.income = (fd, form) => {
    const d = fdata(form);
    const amount = NB.round2(NB.num(d.amount));
    if (!(amount > 0)) return NB.toast('Escribe cuánto recibiste.');
    const s = NB.state;
    const date = d.date || NB.ymd(T());
    if (NB._editing) {
      const e = s.incomes.find((x) => x.id === NB._editing);
      Object.assign(e, { amount, clientId: d.clientId || '', date, note: (d.note || '').trim() });
      return done('Ingreso actualizado');
    }
    const inc = { id: NB.uid(), amount, clientId: d.clientId || '', date, note: (d.note || '').trim() };
    s.incomes.push(inc);
    if (inc.clientId) {
      const c = s.clients.find((x) => x.id === inc.clientId);
      if (c && NB.occurs(c, NB.parse(date))) s.confirmations[NB.clientKey(c, date)] = 'received';
    }
    const pk = NB.currentPlanKey(T());
    const res = NB.computeAllocation(amount, pk, T());
    NB.applyAllocation(res, inc.id, date);
    NB.save();
    NB.closeSheet();
    NB.render();
    NB.showReparto(res, inc.id);
  };
  A['edit-income'] = (el) => NB.openIncome(el.dataset.id);
  A['del-income'] = (el) => {
    NB.confirm('¿Eliminar este ingreso? También se quitan los apartados que generó.', 'Eliminar', () => {
      const s = NB.state;
      s.incomes = s.incomes.filter((x) => x.id !== el.dataset.id);
      NB.undoAllocation(el.dataset.id);
      done('Ingreso eliminado');
    });
  };

  NB.showReparto = (res, incomeId) => {
    const plan = NB.PLANS[res.plan];
    const line = (ic, t, sub, amt, cls) =>
      '<div class="lrow static"><span class="l-ic ' + (cls || '') + '">' + NB.icon(ic, 18) + '</span><span class="grow"><b>' + esc(t) + '</b><span class="mut small">' + esc(sub) + '</span></span><span class="amt">' + money(amt) + '</span></div>';
    let rows = '';
    if (res.savings > 0) rows += line('dollar', 'Ahorro y fondo de emergencia', res.pct + '% de este ingreso', res.savings, 'pos');
    res.lines.forEach((l) => {
      if (l.amount > 0)
        rows += line(l.debt.type === 'tarjeta' ? 'card' : 'bell', 'Apartar para ' + l.debt.name, 'Vence ' + NB.fmtShort(l.due) + ' · lleva ' + money(NB.allocSum(l.debt.id, l.ym)) + ' de ' + money(NB.targetOf(l.debt)), l.amount, 'warn');
    });
    if (res.expenseReserve > 0) rows += line('upload', 'Gastos de la semana', 'Gasolina, comida y más. Se queda en tu saldo.', res.expenseReserve);
    if (res.free > 0) rows += line('spark', 'Libre para ti', 'Lo que sobra después del plan.', res.free, 'pos');
    const short = res.shortfall.length
      ? '<div class="alert warn"><div class="a-ic">' + NB.icon('alert', 20) + '</div><div class="a-body"><b>No alcanzó para todo</b><span class="mut small">' + res.shortfall.map((x) => esc(x.name) + ': faltan ' + money(x.missing)).join(' · ') + '</span></div></div>'
      : '';
    NB.sheet(
      NB.sheetHead('Reparto de ' + money(res.total), 'Plan ' + plan.name) +
        '<p class="mut small pad">Esto solo organiza tu dinero; no mueve dinero real. Aparta cada parte en tu banco o efectivo.</p>' +
        '<div class="card list">' + (rows || '<div class="empty">No hay pagos pendientes. Agrega tus pagos en la pestaña Pagos.</div>') + '</div>' + short +
        '<div class="btns"><button class="btn primary wide" data-act="close">Listo</button><button class="btn ghost wide" data-act="undo-alloc" data-id="' + incomeId + '">' + NB.icon('undo', 16) + ' Deshacer reparto</button></div>'
    );
  };
  A['undo-alloc'] = (el) => {
    NB.undoAllocation(el.dataset.id);
    done('Reparto deshecho. El ingreso se conserva.');
  };

  /* ---------- Clientes (avisos Sí / No) ---------- */
  A['client-yes'] = (el) => {
    const c = NB.state.clients.find((x) => x.id === el.dataset.id);
    if (!c) return;
    NB.openIncome(null, { clientId: c.id, amount: NB.num(c.amount) || '', date: el.dataset.date, title: c.name + ' pagó', sub: 'Confirma el monto: puede variar' });
  };
  A['client-no'] = (el) => {
    NB.state.confirmations[el.dataset.id + '|' + el.dataset.date] = 'late';
    NB.save();
    NB.render();
    NB.toast('Queda como atrasado. Te lo voy recordando.');
  };
  A['client-skip'] = (el) => {
    NB.state.confirmations[el.dataset.id + '|' + el.dataset.date] = 'skipped';
    NB.save();
    NB.render();
  };

  A.topup = (el) => {
    const i = NB.instances(T()).find((x) => x.debt.id === el.dataset.id);
    if (!i || i.remaining <= 0) return;
    NB.state.allocs.push({ id: NB.uid(), date: NB.ymd(T()), incomeId: null, debtId: i.debt.id, ym: i.ym, amount: i.remaining });
    NB.save();
    NB.render();
    NB.toast('Apartaste ' + money(i.remaining) + ' para ' + i.debt.name + '.');
  };

  /* ---------- Marcar pago ---------- */
  A.paysheet = (el) => {
    const d = NB.state.debts.find((x) => x.id === el.dataset.id);
    if (!d) return;
    const i = NB.instances(T()).find((x) => x.debt.id === d.id);
    const target = NB.targetOf(d);
    NB._editing = null;
    NB._payDebt = d.id;
    NB._payYM = i ? i.ym : NB.ym(T());
    NB.sheet(
      NB.sheetHead('Marcar pagado', d.name, null) +
        '<form data-form="payment" autocomplete="off">' +
        (i ? '<p class="mut small pad">Pago de ' + NB.MONTHS[+i.ym.slice(5, 7) - 1] + ' · vence ' + NB.fmtShort(i.due) + ' · apartado ' + money(i.allocated) + '</p>' : '') +
        F.money('Monto que pagaste', 'amount', target, 'class="big-in"') +
        F.date('Fecha', 'date', NB.ymd(T())) +
        F.check('Es el pago completo del mes', 'full', true) +
        '<div class="btns"><button class="btn primary wide" type="submit">Marcar pagado</button></div></form>',
      { full: true }
    );
  };
  NB.forms.payment = (fd, form) => {
    const d = fdata(form);
    const amount = NB.round2(NB.num(d.amount));
    if (!(amount > 0)) return NB.toast('Escribe el monto pagado.');
    const s = NB.state;
    if (NB._editing) {
      const p = s.payments.find((x) => x.id === NB._editing);
      Object.assign(p, { amount, date: d.date || p.date });
      return done('Pago actualizado');
    }
    const debt = s.debts.find((x) => x.id === NB._payDebt);
    if (!debt) return;
    s.payments.push({ id: NB.uid(), debtId: debt.id, ym: NB._payYM, date: d.date || NB.ymd(T()), amount, full: !!d.full });
    if ((debt.type === 'tarjeta' || debt.type === 'prestamo') && NB.num(debt.balance) > 0) debt.balance = Math.max(0, NB.round2(NB.num(debt.balance) - amount));
    done('Pago registrado: ' + debt.name);
  };
  A['edit-payment'] = (el) => {
    const p = NB.state.payments.find((x) => x.id === el.dataset.id);
    if (!p) return;
    const d = NB.state.debts.find((x) => x.id === p.debtId);
    NB._editing = p.id;
    NB.sheet(
      NB.sheetHead('Editar pago', d ? d.name : '') +
        '<form data-form="payment" autocomplete="off">' + F.money('Monto', 'amount', p.amount, 'class="big-in"') + F.date('Fecha', 'date', p.date) +
        '<div class="btns"><button class="btn primary wide" type="submit">Guardar cambios</button><button type="button" class="btn danger-t wide" data-act="del-payment" data-id="' + p.id + '">' + NB.icon('trash', 16) + ' Eliminar pago</button></div></form>',
      { full: true }
    );
  };
  A['del-payment'] = (el) => {
    NB.confirm('¿Eliminar este pago? El pago del mes volverá a aparecer como pendiente.', 'Eliminar', () => {
      NB.state.payments = NB.state.payments.filter((x) => x.id !== el.dataset.id);
      done('Pago eliminado');
    });
  };

  /* ---------- Deudas, tarjetas, suscripciones ---------- */
  A['debt-new'] = () => NB.openDebt(NB.payTab);
  A['debt-edit'] = (el) => NB.openDebt(null, el.dataset.id);
  NB.openDebt = (type, id) => {
    const s = NB.state;
    const d = id ? s.debts.find((x) => x.id === id) : null;
    type = d ? d.type : type;
    NB._editing = d ? d.id : null;
    NB._debtType = type;
    NB._logo = null;
    let f = F.text('Nombre', 'name', d ? d.name : '', 'required autocapitalize="words"');
    if (type === 'tarjeta')
      f += F.text('Banco', 'bank', d ? d.bank : '', 'autocapitalize="words"') +
        '<div class="two">' + F.num('Fecha de corte (día)', 'cutDay', d ? d.cutDay : '', 'maxlength="2"') + F.num('Fecha límite de pago (día)', 'dueDay', d ? d.dueDay : '', 'maxlength="2"') + '</div>' +
        '<div class="two">' + F.money('Pago para no generar intereses', 'noInterest', d ? d.noInterest : '') + F.money('Pago mínimo', 'min', d ? d.min : '') + '</div>' +
        '<div class="two">' + F.money('Saldo actual', 'balance', d ? d.balance : '') + F.money('Límite de crédito', 'limit', d ? d.limit : '') + '</div>' +
        '<div class="two">' + F.num('Tasa de interés anual %', 'rate', d ? d.rate : '') + F.num('CAT %', 'cat', d ? d.cat : '') + '</div>' +
        F.money('Anualidad o comisiones (opcional)', 'fee', d ? d.fee : '');
    else if (type === 'prestamo')
      f += F.text('Banco o prestamista', 'bank', d ? d.bank : '') +
        '<div class="two">' + F.money('Pago mensual', 'amount', d ? d.amount : '') + F.num('Día de pago', 'dueDay', d ? d.dueDay : '', 'maxlength="2"') + '</div>' +
        F.money('Saldo pendiente (opcional)', 'balance', d ? d.balance : '') +
        '<div class="two">' + F.num('Tasa anual %', 'rate', d ? d.rate : '') + F.num('CAT %', 'cat', d ? d.cat : '') + '</div>';
    else if (type === 'suscripcion')
      f += F.text('Plan o nota (ej. plan intermedio)', 'note', d ? d.note : '') +
        '<div class="two">' + F.money('Monto exacto', 'amount', d ? d.amount : '') + F.num('Día de cobro', 'dueDay', d ? d.dueDay : '', 'maxlength="2"') + '</div>' +
        '<div class="fld"><span>Ícono</span><div class="row gap"><input class="icon-in" name="icon" maxlength="2" placeholder="Inicial o emoji" value="' + esc(d && d.icon ? d.icon : '') + '"><button type="button" class="btn sm ghost" data-act="logo-pick">Subir logo</button><span class="logo sm" id="logoPrev">' + (d ? NB.debtIcon(d) : '') + '</span></div><input type="file" accept="image/*" id="logoIn" hidden></div>' +
        F.check('Herramienta de trabajo (se aparta primero)', 'work', d ? d.work !== false : true);
    else
      f += F.text('Detalle (ej. luz, internet, renta)', 'note', d ? d.note : '') + '<div class="two">' + F.money('Monto', 'amount', d ? d.amount : '') + F.num('Día de pago', 'dueDay', d ? d.dueDay : '', 'maxlength="2"') + '</div>';
    NB.sheet(
      NB.sheetHead(d ? 'Editar ' + NB.TYPE_NAMES[type].toLowerCase() : 'Nueva ' + NB.TYPE_NAMES[type].toLowerCase()) +
        '<form data-form="debt" autocomplete="off">' + f +
        '<div class="btns"><button class="btn primary wide" type="submit">Guardar</button>' +
        (d ? '<button type="button" class="btn ghost wide" data-act="debt-toggle" data-id="' + d.id + '">' + (d.active === false ? 'Reanudar' : 'Pausar (ya no lo pago)') + '</button><button type="button" class="btn danger-t wide" data-act="debt-del" data-id="' + d.id + '">' + NB.icon('trash', 16) + ' Eliminar</button>' : '') +
        '</div></form>',
      { full: true }
    );
  };
  A['logo-pick'] = () => NB.$('#logoIn').click();
  NB.onLogoFile = async (file) => {
    if (!file) return;
    try {
      NB._logo = await NB.readPhoto(file, 96);
      NB.$('#logoPrev').innerHTML = '<img src="' + NB._logo + '" alt="">';
    } catch (e) {
      NB.toast('No pude abrir esa imagen.');
    }
  };
  NB.forms.debt = (fd, form) => {
    const d = fdata(form);
    const type = NB._debtType;
    const name = (d.name || '').trim();
    if (!name) return NB.toast('Escribe un nombre.');
    const day = Math.round(NB.num(d.dueDay));
    if (!(day >= 1 && day <= 31)) return NB.toast('El día de pago va de 1 a 31.');
    const o = { type, name, dueDay: day, active: true };
    if (type === 'tarjeta') {
      Object.assign(o, { bank: (d.bank || '').trim(), cutDay: Math.round(NB.num(d.cutDay)) || '', noInterest: NB.num(d.noInterest), min: NB.num(d.min), balance: NB.num(d.balance), limit: NB.num(d.limit), rate: NB.num(d.rate) || '', cat: NB.num(d.cat) || '', fee: NB.num(d.fee) });
      if (!(NB.targetOf(o) > 0)) return NB.toast('Escribe el pago para no generar intereses o el mínimo.');
    } else {
      o.amount = NB.num(d.amount);
      if (!(o.amount > 0)) return NB.toast('Escribe el monto.');
      o.note = (d.note || '').trim();
      if (type === 'prestamo') Object.assign(o, { bank: (d.bank || '').trim(), balance: NB.num(d.balance), rate: NB.num(d.rate) || '', cat: NB.num(d.cat) || '' });
      if (type === 'suscripcion') Object.assign(o, { icon: (d.icon || '').trim(), work: !!d.work });
    }
    const s = NB.state;
    if (NB._editing) {
      const e = s.debts.find((x) => x.id === NB._editing);
      const keepLogo = e.logo;
      Object.assign(e, o, { active: e.active !== false });
      e.logo = NB._logo || keepLogo;
    } else {
      o.id = NB.uid();
      if (NB._logo) o.logo = NB._logo;
      s.debts.push(o);
    }
    NB.payTab = type;
    done('Guardado');
  };
  A['debt-toggle'] = (el) => {
    const d = NB.state.debts.find((x) => x.id === el.dataset.id);
    d.active = d.active === false;
    done(d.active ? 'Reanudado' : 'En pausa');
  };
  A['debt-del'] = (el) => {
    NB.confirm('¿Eliminar este pago? Se borran también sus apartados y pagos registrados.', 'Eliminar', () => {
      const s = NB.state;
      const id = el.dataset.id;
      s.debts = s.debts.filter((x) => x.id !== id);
      s.payments = s.payments.filter((x) => x.debtId !== id);
      s.allocs = s.allocs.filter((x) => x.debtId !== id);
      done('Eliminado');
    });
  };

  /* ---------- Clientes ---------- */
  const freqText = (c) => (c.freq === 'monthly' ? 'Cada mes, día ' + (c.dom || 1) : c.freq === 'biweekly' ? 'Cada 2 semanas desde el ' + (c.anchor ? NB.fmtShort(c.anchor) : '—') : 'Cada ' + NB.DOWL[c.dow == null ? 3 : c.dow]);
  A.clients = () => {
    const cl = NB.state.clients;
    NB.sheet(
      NB.sheetHead('Clientes', 'Día de pago y monto de cada uno') +
        (cl.length
          ? cl.map((c) => '<div class="card client' + (c.active === false ? ' off' : '') + '"><div class="row"><span class="logo">' + esc(c.name.slice(0, 1).toUpperCase()) + '</span><div class="grow"><b>' + esc(c.name) + '</b><div class="mut small">' + freqText(c) + '</div></div><b>' + money(c.amount) + '</b></div><div class="a-act"><button class="btn sm ghost" data-act="client-edit" data-id="' + c.id + '">' + NB.icon('edit', 14) + ' Editar</button><button class="btn sm ghost" data-act="client-toggle" data-id="' + c.id + '">' + (c.active === false ? 'Reanudar' : 'Pausar') + '</button></div></div>').join('')
          : '<div class="card empty">Aún no tienes clientes. Agrega el primero.</div>') +
        '<div class="btns"><button class="btn primary wide" data-act="client-new">' + NB.icon('plus', 16) + ' Agregar cliente</button></div>',
      { full: true }
    );
  };
  A['client-new'] = () => NB.openClient();
  A['client-edit'] = (el) => NB.openClient(el.dataset.id);
  A['client-toggle'] = (el) => {
    const c = NB.state.clients.find((x) => x.id === el.dataset.id);
    c.active = c.active === false;
    NB.save();
    NB.render();
    A.clients();
  };
  NB.openClient = (id) => {
    const c = id ? NB.state.clients.find((x) => x.id === id) : null;
    NB._editing = c ? c.id : null;
    const freq = c ? c.freq : 'weekly';
    NB.sheet(
      NB.sheetHead(c ? 'Editar cliente' : 'Nuevo cliente', '', 'clients') +
        '<form data-form="client" data-freq="' + freq + '" autocomplete="off">' +
        F.text('Nombre del cliente', 'name', c ? c.name : '', 'required autocapitalize="words"') +
        F.money('Monto que paga (aprox.)', 'amount', c ? c.amount : '') +
        F.select('Cada cuánto paga', 'freq', [['weekly', 'Cada semana'], ['biweekly', 'Cada 2 semanas'], ['monthly', 'Cada mes']], freq) +
        '<div class="f-weekly">' + F.select('Día de la semana', 'dow', NB.DOWL.map((n, i) => [i, NB.cap(n)]), c && c.dow != null ? c.dow : 3) + '</div>' +
        '<div class="f-biweekly">' + F.date('Primer pago (una fecha de pago)', 'anchor', c && c.anchor ? c.anchor : NB.ymd(T())) + '</div>' +
        '<div class="f-monthly">' + F.num('Día del mes', 'dom', c ? c.dom : '', 'maxlength="2"') + '</div>' +
        '<p class="mut small pad">El monto puede variar: al confirmar cada pago lo ajustas.</p>' +
        '<div class="btns"><button class="btn primary wide" type="submit">Guardar</button>' +
        (c ? '<button type="button" class="btn danger-t wide" data-act="client-del" data-id="' + c.id + '">' + NB.icon('trash', 16) + ' Eliminar cliente</button>' : '') +
        '</div></form>',
      { full: true }
    );
  };
  NB.forms.client = (fd, form) => {
    const d = fdata(form);
    const name = (d.name || '').trim();
    if (!name) return NB.toast('Escribe el nombre del cliente.');
    const o = { name, amount: NB.num(d.amount), freq: d.freq, dow: +d.dow, anchor: d.anchor || NB.ymd(T()), dom: Math.round(NB.num(d.dom)) || 1 };
    if (o.freq === 'monthly' && !(o.dom >= 1 && o.dom <= 31)) return NB.toast('El día del mes va de 1 a 31.');
    const s = NB.state;
    if (NB._editing) Object.assign(s.clients.find((x) => x.id === NB._editing), o);
    else s.clients.push(Object.assign({ id: NB.uid(), active: true }, o));
    NB.save();
    NB.render();
    NB.toast('Cliente guardado');
    A.clients();
  };
  A['client-del'] = (el) => {
    NB.confirm('¿Eliminar este cliente? Los ingresos ya registrados se conservan.', 'Eliminar', () => {
      NB.state.clients = NB.state.clients.filter((x) => x.id !== el.dataset.id);
      NB.save();
      NB.render();
      A.clients();
    });
  };

  /* ---------- Plan ---------- */
  A.plans = () => {
    const t = T();
    const s = NB.state;
    const rec = NB.recommend(t);
    const cur = s.settings.plans[NB.ym(t)] || null;
    const incs = s.incomes.slice(-6);
    let sample = incs.length ? NB.sum(incs, (i) => NB.num(i.amount)) / incs.length : 0;
    if (!sample) {
      const e = NB.expectedIncomes(t, NB.addDays(t, 14))[0];
      sample = e ? e.amount : 0;
    }
    sample = Math.round(sample);
    const cards = Object.keys(NB.PLANS)
      .map((k) => {
        const p = NB.PLANS[k];
        let sim = '';
        if (sample > 0) {
          const r = NB.computeAllocation(sample, k, t);
          const debts = NB.sum(r.lines, (l) => l.amount);
          sim = '<div class="sim"><div><span class="mut small">Ahorro</span><b>' + NB.money0(r.savings) + '</b></div><div><span class="mut small">A pagos</span><b>' + NB.money0(debts) + '</b></div><div><span class="mut small">Gastos</span><b>' + NB.money0(r.expenseReserve) + '</b></div><div><span class="mut small">Libre</span><b>' + NB.money0(r.free) + '</b></div></div>';
        }
        return (
          '<div class="card plan' + (cur === k ? ' chosen' : '') + '"><div class="row between"><div><b class="mid">' + p.name + '</b><div class="mut small">' + p.tag + '</div></div>' + (rec.plan === k ? '<span class="badge">Recomendado</span>' : cur === k ? '<span class="badge on">Elegido</span>' : '') + '</div>' +
          '<p class="small">' + p.desc + '</p>' + sim +
          '<div class="row between"><label class="pct"><span class="mut small">Ahorro %</span><input inputmode="numeric" name="pct_' + k + '" value="' + NB.num(s.settings.savings[k]) + '"></label><button class="btn sm ' + (cur === k ? 'ghost' : 'primary') + '" data-act="plan-pick" data-v="' + k + '">' + (cur === k ? 'Guardar' : 'Elegir ' + p.name) + '</button></div></div>'
        );
      })
      .join('');
    NB.sheet(
      NB.sheetHead('Plan de ' + NB.MONTHS[t.getMonth()], 'Cómo se reparte cada ingreso') +
        '<p class="mut small pad">' + (rec.obligations > 0 ? 'Este mes tienes ' + NB.money0(rec.obligations) + ' en pagos por cubrir y esperas ' + NB.money0(rec.supply) + ' entre saldo libre e ingresos.' : 'Aún no tienes pagos pendientes registrados.') + (sample ? ' La simulación usa un ingreso de ' + NB.money0(sample) + '.' : '') + '</p>' + cards,
      { full: true }
    );
  };
  A['plan-pick'] = (el) => {
    const s = NB.state;
    NB.$$('.sheet [name^="pct_"]').forEach((i) => {
      const k = i.name.slice(4);
      s.settings.savings[k] = Math.max(0, Math.min(60, NB.num(i.value)));
    });
    const k = el.dataset.v;
    s.settings.plans[NB.ym(T())] = k;
    s.settings.planPrompted = NB.ym(T());
    done('Plan ' + NB.PLANS[k].name + ' elegido para ' + NB.MONTHS[T().getMonth()]);
  };

  /* ---------- Categorías, semana y saldo ---------- */
  A.cats = () => {
    const cats = NB.state.categories;
    const swatches = ['#F5A524', '#4ADE80', '#60A5FA', '#C084FC', '#22D3EE', '#F472B6', '#94A3B8', '#E8474A', '#A3E635', '#FB923C'];
    NB.sheet(
      NB.sheetHead('Categorías', 'Límite semanal opcional por categoría') +
        '<form data-form="cats">' +
        cats.map((c) => '<div class="card catrow"><i class="dot lg" style="background:' + c.color + '"></i><b class="grow">' + esc(c.name) + '</b><label class="pct"><span class="mut small">Límite/sem</span><input inputmode="decimal" name="w_' + esc(c.id) + '" value="' + (NB.num(c.weekly) || '') + '" placeholder="Sin límite"></label>' + (['otros'].includes(c.id) ? '' : '<button type="button" class="icon-btn" data-act="cat-del" data-id="' + esc(c.id) + '" aria-label="Eliminar">' + NB.icon('trash', 18) + '</button>') + '</div>').join('') +
        '<div class="btns"><button class="btn primary wide" type="submit">Guardar límites</button></div></form>' +
        '<h2 class="sec">Nueva categoría</h2><form data-form="catnew">' + F.text('Nombre', 'name', '', 'required') +
        '<div class="fld"><span>Color</span><div class="chips pick">' + swatches.map((c, i) => '<label class="sw"><input type="radio" name="color" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><span style="background:' + c + '"></span></label>').join('') + '</div></div>' +
        F.money('Límite semanal (opcional)', 'weekly', '') + '<div class="btns"><button class="btn ghost wide" type="submit">Agregar categoría</button></div></form>',
      { full: true }
    );
  };
  NB.forms.cats = (fd, form) => {
    const d = fdata(form);
    NB.state.categories.forEach((c) => (c.weekly = NB.num(d['w_' + c.id])));
    NB.save();
    NB.toast('Límites guardados');
    NB.render();
  };
  NB.forms.catnew = (fd, form) => {
    const d = fdata(form);
    const name = (d.name || '').trim();
    if (!name) return;
    NB.state.categories.push({ id: 'c' + NB.uid(), name, color: d.color || '#94A3B8', weekly: NB.num(d.weekly) });
    NB.save();
    NB.render();
    A.cats();
    NB.toast('Categoría creada');
  };
  A['cat-del'] = (el) => {
    NB.confirm('¿Eliminar esta categoría? Sus gastos pasan a Otros.', 'Eliminar', () => {
      const s = NB.state;
      s.expenses.forEach((e) => {
        if (e.category === el.dataset.id) e.category = 'otros';
      });
      s.categories = s.categories.filter((c) => c.id !== el.dataset.id);
      NB.save();
      NB.render();
      A.cats();
    });
  };
  A.weekly = () => {
    const e = NB.state.settings.expense;
    NB.sheet(
      NB.sheetHead('Gastos de la semana', 'Con esto el plan reserva tu dinero del día a día') +
        '<form data-form="weekly">' + F.money('Gasolina por semana', 'gasolina', e.gasolina) + F.money('Comida por semana', 'comida', e.comida) +
        '<p class="mut small pad">Después de registrar varios gastos, la app usa tu promedio real de las últimas 4 semanas.</p><div class="btns"><button class="btn primary wide" type="submit">Guardar</button></div></form>'
    );
  };
  NB.forms.weekly = (fd, form) => {
    const d = fdata(form);
    NB.state.settings.expense = { gasolina: NB.num(d.gasolina), comida: NB.num(d.comida) };
    done('Guardado');
  };
  A.balance = () => {
    const bal = NB.balanceAt(T());
    NB.sheet(
      NB.sheetHead('Saldo disponible', 'El dinero líquido que tienes hoy') +
        '<form data-form="balance">' + F.money('Dinero que tienes hoy', 'amount', bal, 'class="big-in"') +
        '<p class="mut small pad">Es solo tu referencia: no se conecta a ningún banco.</p><div class="btns"><button class="btn primary wide" type="submit">Guardar</button></div></form>'
    );
  };
  NB.forms.balance = (fd, form) => {
    const d = fdata(form);
    const want = NB.round2(NB.num(d.amount));
    const delta = NB.round2(want - NB.balanceAt(T()));
    NB.state.settings.startBalance = NB.round2(NB.num(NB.state.settings.startBalance) + delta);
    done('Saldo actualizado');
  };
  A.rename = () => {
    NB.sheet(NB.sheetHead('Tu nombre') + '<form data-form="rename">' + F.text('Nombre', 'name', NB.state.settings.name, 'autocapitalize="words"') + '<div class="btns"><button class="btn primary wide" type="submit">Guardar</button></div></form>');
  };
  NB.forms.rename = (fd, form) => {
    NB.state.settings.name = (fdata(form).name || '').trim() || 'José';
    done('Guardado');
  };
  A.usefund = () => {
    const fund = NB.savingsFund();
    NB.sheet(
      NB.sheetHead('Usar del fondo', 'Disponible ' + money(fund)) +
        '<form data-form="usefund">' + F.money('Monto a usar', 'amount', '', 'class="big-in"') + '<div class="btns"><button class="btn primary wide" type="submit">Retirar del fondo</button></div></form>'
    );
  };
  NB.forms.usefund = (fd, form) => {
    const a = NB.round2(NB.num(fdata(form).amount));
    if (!(a > 0)) return NB.toast('Escribe un monto.');
    if (a > NB.savingsFund() + 0.005) return NB.toast('No hay tanto en el fondo.');
    NB.state.allocs.push({ id: NB.uid(), date: NB.ymd(T()), incomeId: null, debtId: 'ahorro', ym: null, amount: -a });
    done('Retiraste ' + money(a) + ' del fondo');
  };

  /* ---------- Recordatorios y respaldo ---------- */
  A.reminders = () => {
    const n = NB.buildICS().count;
    NB.sheet(
      NB.sheetHead('Recordatorios en el iPhone', 'Te llegan solos, sin abrir la app') +
        '<div class="card"><p class="small">Se crean recordatorios en tu Calendario:</p><ul class="bul small"><li>Día 1 de cada mes, 7:00 am: elegir tu plan del mes.</li><li>Cada pago, con aviso un día antes y el mismo día, y el corte de tus tarjetas.</li><li>Cada cliente: "mañana paga" a las 7:00 pm y "hoy paga" a las 7:00 am.</li></ul>' +
        '<p class="mut small">Son ' + n + ' eventos. Al abrir el archivo toca "Añadir todos". Si cambias montos o fechas, vuelve a generarlo.</p></div>' +
        '<div class="btns"><button class="btn primary wide" data-act="make-ics">' + NB.icon('bell', 16) + ' Generar recordatorios</button></div>'
    );
  };
  A['make-ics'] = async () => {
    const r = NB.buildICS();
    const out = await NB.shareFile('noir-balance-recordatorios.ics', 'text/calendar', r.text);
    if (out === 'download') NB.toast('Abre el archivo descargado y toca "Añadir todos".');
  };
  A.backup = () => {
    const lb = NB.state.settings.lastBackup;
    NB.sheet(
      NB.sheetHead('Respaldo', lb ? 'Último: ' + NB.fmtShort(lb) : 'Aún sin respaldo') +
        '<div class="card"><p class="small">Exporta un archivo con todo lo que has capturado, incluidas las fotos de tickets. Guárdalo en Archivos o iCloud, o mándatelo por WhatsApp.</p><p class="mut small">Para recuperarlo en otro iPhone (o si se borran los datos de Safari), importa ese archivo.</p></div>' +
        '<div class="btns"><button class="btn primary wide" data-act="export">' + NB.icon('upload', 16) + ' Exportar respaldo</button><button class="btn ghost wide" data-act="import">' + NB.icon('download', 16) + ' Importar respaldo</button><input type="file" accept=".json,application/json" id="importIn" hidden></div>'
    );
  };
  A.export = async () => {
    let photos = {};
    try {
      photos = await NB.photos.all();
    } catch (e) {}
    const data = { app: 'noir-balance', version: 1, exportedAt: new Date().toISOString(), state: NB.state, photos };
    const out = await NB.shareFile('noir-balance-respaldo-' + NB.ymd(T()) + '.json', 'application/json', JSON.stringify(data));
    if (out !== 'cancel') {
      NB.state.settings.lastBackup = NB.ymd(T());
      NB.save();
      NB.toast(out === 'download' ? 'Respaldo descargado' : 'Respaldo listo');
      NB.render();
    }
  };
  A.import = () => NB.$('#importIn').click();
  NB.onImportFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || data.app !== 'noir-balance' || !data.state) throw new Error('bad');
      NB.confirm('Esto reemplaza todos los datos actuales de este iPhone con los del respaldo. ¿Continuar?', 'Importar', async () => {
        const keep = { pinHash: NB.state.settings.pinHash, pinSalt: NB.state.settings.pinSalt };
        NB.state = NB.migrate(data.state);
        Object.assign(NB.state.settings, keep, { onboarded: true });
        try {
          await NB.photos.clear();
          const ph = data.photos || {};
          for (const k of Object.keys(ph)) await NB.photos.put(k, ph[k]);
        } catch (e) {}
        NB.closeSheet();
        NB.save();
        NB.applyTheme();
        NB.render();
        NB.toast('Respaldo importado');
      }, false);
    } catch (e) {
      NB.toast('Ese archivo no es un respaldo de Noir Balance.');
    }
  };
  A.wipe = () => {
    NB.confirm('Se borrarán todos tus datos de este iPhone: clientes, pagos, gastos y fotos. Esto no se puede deshacer.', 'Borrar todo', async () => {
      await NB.wipe();
      location.reload();
    });
  };
})();
