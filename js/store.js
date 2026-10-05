/* Noir Balance · almacenamiento local (todo se queda en tu iPhone) */
(function () {
  const NB = window.NB;
  const KEY = 'nb.v1';

  NB.DEFAULT_CATS = [
    { id: 'gasolina', name: 'Gasolina', color: '#F5A524', weekly: 600 },
    { id: 'comida', name: 'Comida', color: '#4ADE80', weekly: 500 },
    { id: 'servicios', name: 'Servicios', color: '#60A5FA', weekly: 0 },
    { id: 'entretenimiento', name: 'Entretenimiento', color: '#C084FC', weekly: 0 },
    { id: 'transporte', name: 'Transporte', color: '#22D3EE', weekly: 0 },
    { id: 'ocio', name: 'Ocio', color: '#F472B6', weekly: 0 },
    { id: 'otros', name: 'Otros', color: '#94A3B8', weekly: 0 }
  ];

  NB.defaults = () => ({
    v: 1,
    settings: {
      name: 'José',
      theme: 'auto',
      pinHash: null,
      pinSalt: null,
      onboarded: false,
      startBalance: 0,
      startDate: NB.ymd(NB.today()),
      plans: {},
      planPrompted: null,
      savings: { rapido: 5, equilibrado: 10, liquidez: 15 },
      expense: { gasolina: 450, comida: 500 },
      lastBackup: null
    },
    clients: [],
    incomes: [],
    expenses: [],
    debts: [],
    payments: [],
    allocs: [],
    confirmations: {},
    categories: JSON.parse(JSON.stringify(NB.DEFAULT_CATS))
  });

  function migrate(s) {
    const d = NB.defaults();
    const out = Object.assign({}, d, s);
    out.settings = Object.assign({}, d.settings, s.settings || {});
    out.settings.savings = Object.assign({}, d.settings.savings, (s.settings || {}).savings || {});
    out.settings.expense = Object.assign({}, d.settings.expense, (s.settings || {}).expense || {});
    ['clients', 'incomes', 'expenses', 'debts', 'payments', 'allocs', 'categories'].forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = d[k];
    });
    if (!out.confirmations || typeof out.confirmations !== 'object') out.confirmations = {};
    return out;
  }

  NB.migrate = migrate;
  NB.state = null;
  NB.load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      NB.state = raw ? migrate(JSON.parse(raw)) : NB.defaults();
    } catch (e) {
      NB.state = NB.defaults();
    }
  };
  NB.save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(NB.state));
    } catch (e) {
      if (NB.toast) NB.toast('No se pudo guardar. Libera espacio y haz un respaldo.');
    }
  };
  NB.wipe = async () => {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    try {
      await NB.photos.clear();
    } catch (e) {}
    NB.state = NB.defaults();
  };

  /* Fotos de tickets: IndexedDB */
  const idb = () =>
    new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('sin indexedDB'));
      const r = indexedDB.open('nb-photos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const tx = async (mode, fn) => {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction('p', mode);
      const store = t.objectStore('p');
      let out;
      try {
        out = fn(store);
      } catch (e) {
        rej(e);
        return;
      }
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  };
  NB.photos = {
    put: (id, data) => tx('readwrite', (s) => s.put(data, id)),
    get: async (id) => {
      const db = await idb();
      return new Promise((res) => {
        const r = db.transaction('p').objectStore('p').get(id);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => res(null);
      });
    },
    del: (id) => tx('readwrite', (s) => s.delete(id)),
    clear: () => tx('readwrite', (s) => s.clear()),
    all: async () => {
      const db = await idb();
      return new Promise((res) => {
        const out = {};
        const r = db.transaction('p').objectStore('p').openCursor();
        r.onsuccess = () => {
          const c = r.result;
          if (c) {
            out[c.key] = c.value;
            c.continue();
          } else res(out);
        };
        r.onerror = () => res(out);
      });
    }
  };
})();
