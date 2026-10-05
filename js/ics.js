/* Noir Balance · recordatorios para el Calendario del iPhone (.ics) */
(function () {
  const NB = window.NB;

  const fold = (line) => {
    const out = [];
    let s = line;
    while (s.length > 74) {
      out.push(s.slice(0, 74));
      s = ' ' + s.slice(74);
    }
    out.push(s);
    return out.join('\r\n');
  };
  const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const dt = (d, hhmm) => d.getFullYear() + NB.pad(d.getMonth() + 1) + NB.pad(d.getDate()) + 'T' + hhmm + '00';
  const stamp = () => {
    const n = new Date();
    return n.getUTCFullYear() + NB.pad(n.getUTCMonth() + 1) + NB.pad(n.getUTCDate()) + 'T' + NB.pad(n.getUTCHours()) + NB.pad(n.getUTCMinutes()) + NB.pad(n.getUTCSeconds()) + 'Z';
  };
  const firstFrom = (from, pred) => {
    for (let i = 0; i < 400; i++) {
      const d = NB.addDays(from, i);
      if (pred(d)) return d;
    }
    return from;
  };

  NB.buildICS = () => {
    const s = NB.state;
    const today = NB.today();
    const now = stamp();
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Noir Balance//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Noir Balance'];
    let count = 0;

    const ev = (uid, date, hhmm, title, desc, rrule, alarms) => {
      count++;
      const endH = NB.pad(Math.min(23, +hhmm.slice(0, 2))) + NB.pad(Math.min(59, +hhmm.slice(2) + 15));
      L.push('BEGIN:VEVENT', 'UID:' + uid + '@noirbalance', 'DTSTAMP:' + now, 'DTSTART:' + dt(date, hhmm), 'DTEND:' + dt(date, endH));
      L.push(fold('SUMMARY:' + esc(title)));
      if (desc) L.push(fold('DESCRIPTION:' + esc(desc)));
      if (rrule) L.push('RRULE:' + rrule);
      (alarms || ['PT0M']).forEach((a) => {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + esc(title)), 'TRIGGER:-' + a, 'END:VALARM');
      });
      L.push('END:VEVENT');
    };

    // Plan del mes: día 1 a las 7:00 am
    const first = firstFrom(today, (d) => d.getDate() === 1);
    ev('plan-mes', first, '0700', 'Noir Balance · Elige tu plan del mes', 'Abre Noir Balance y elige Rápido, Equilibrado o Liquidez para este mes.', 'FREQ=MONTHLY;BYMONTHDAY=1', ['PT0M']);

    // Pagos y cortes
    s.debts.forEach((d) => {
      if (d.active === false) return;
      const t = NB.targetOf(d);
      const day = Math.max(1, NB.num(d.dueDay) || 1);
      const rr = day >= 29 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY;BYMONTHDAY=' + day;
      const start = firstFrom(today, (x) => (day >= 29 ? x.getDate() === NB.daysIn(x.getFullYear(), x.getMonth()) : x.getDate() === day));
      ev('pago-' + d.id, start, '0700', 'Pagar ' + d.name + (t > 0 ? ' (' + NB.money(t) + ')' : ''), 'Hoy vence ' + d.name + '. Abre Noir Balance para marcarlo como pagado.', rr, ['P1D', 'PT0M']);
      if (d.type === 'tarjeta' && d.cutDay) {
        const cd = Math.max(1, NB.num(d.cutDay));
        const crr = cd >= 29 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY;BYMONTHDAY=' + cd;
        const cs = firstFrom(today, (x) => (cd >= 29 ? x.getDate() === NB.daysIn(x.getFullYear(), x.getMonth()) : x.getDate() === cd));
        ev('corte-' + d.id, cs, '0700', 'Corte de ' + d.name, 'Hoy cierra el estado de cuenta de ' + d.name + '.', crr, ['PT0M']);
      }
    });

    // Clientes: "mañana paga" 7:00 pm del día anterior y "hoy paga" 7:00 am
    s.clients.forEach((c) => {
      if (c.active === false) return;
      const amt = NB.num(c.amount) > 0 ? ' (' + NB.money(c.amount) + ')' : '';
      let hoyRR;
      let manRR;
      let hoy;
      if (c.freq === 'monthly') {
        const dom = Math.min(31, Math.max(1, NB.num(c.dom) || 1));
        hoyRR = dom >= 29 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : 'FREQ=MONTHLY;BYMONTHDAY=' + dom;
        manRR = dom === 1 ? 'FREQ=MONTHLY;BYMONTHDAY=-1' : dom >= 29 ? 'FREQ=MONTHLY;BYMONTHDAY=-2' : 'FREQ=MONTHLY;BYMONTHDAY=' + (dom - 1);
        hoy = firstFrom(today, (x) => NB.occurs(c, x));
      } else if (c.freq === 'biweekly') {
        hoyRR = 'FREQ=WEEKLY;INTERVAL=2';
        manRR = 'FREQ=WEEKLY;INTERVAL=2';
        hoy = firstFrom(today, (x) => NB.occurs(c, x));
      } else {
        hoyRR = 'FREQ=WEEKLY';
        manRR = 'FREQ=WEEKLY';
        hoy = firstFrom(today, (x) => NB.occurs(c, x));
      }
      const man = NB.addDays(hoy, -1);
      ev('cli-hoy-' + c.id, hoy, '0700', 'Hoy paga ' + c.name + amt, 'Buenos días. Abre Noir Balance y confirma si ya liquidó su pago.', hoyRR, ['PT0M']);
      ev('cli-man-' + c.id, man, '1900', 'Mañana paga ' + c.name + amt, 'Mañana toca cobro de ' + c.name + '.', manRR, ['PT0M']);
    });

    L.push('END:VCALENDAR');
    return { text: L.join('\r\n') + '\r\n', count };
  };

  /* Guardar o compartir un archivo (iPhone: hoja de compartir) */
  NB.shareFile = async (name, mime, content) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    try {
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 4000);
    return 'download';
  };
})();
