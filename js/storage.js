/* storage.js — única camada que toca o localStorage diretamente */
window.App = window.App || {};

App.Storage = (function () {
  const KEY_TRANSACTIONS = 'pf_transactions';
  const KEY_SETTINGS = 'pf_settings';
  const KEY_CATEGORIES = 'pf_categories';

  const DEFAULT_SETTINGS = {
    currency: 'AUD',
    monthlyBudget: 0
  };

  // Em alguns contextos (ex: abrir o arquivo via content:// em gerenciadores
  // de arquivos do Android, ou modo privado restrito), o navegador bloqueia o
  // localStorage e lançar erro aqui derrubaria o app inteiro. Nesses casos
  // caímos para um armazenamento em memória: o app continua 100% funcional
  // durante a sessão, apenas não persiste ao fechar.
  const memoryFallback = {};
  let usingFallback = false;

  const backend = (function () {
    try {
      const probe = '__pf_test__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (e) {
      usingFallback = true;
      return {
        getItem: (k) => (k in memoryFallback ? memoryFallback[k] : null),
        setItem: (k, v) => { memoryFallback[k] = String(v); },
        removeItem: (k) => { delete memoryFallback[k]; }
      };
    }
  })();

  function isPersistent() {
    return !usingFallback;
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      const data = JSON.parse(raw);
      return data == null ? fallback : data;
    } catch (e) {
      console.error('Falha ao ler dados salvos:', e);
      return fallback;
    }
  }

  function getTransactions() {
    return safeParse(backend.getItem(KEY_TRANSACTIONS), []);
  }

  function saveTransactions(list) {
    backend.setItem(KEY_TRANSACTIONS, JSON.stringify(list));
  }

  function getSettings() {
    const stored = safeParse(backend.getItem(KEY_SETTINGS), {});
    return Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  function saveSettings(settings) {
    const merged = Object.assign({}, getSettings(), settings);
    backend.setItem(KEY_SETTINGS, JSON.stringify(merged));
    return merged;
  }

  // Categorias criadas pelo usuário, separadas das categorias padrão.
  function getCustomCategories() {
    const stored = safeParse(backend.getItem(KEY_CATEGORIES), {});
    return {
      income: Array.isArray(stored.income) ? stored.income : [],
      expense: Array.isArray(stored.expense) ? stored.expense : []
    };
  }

  function saveCustomCategories(categories) {
    backend.setItem(KEY_CATEGORIES, JSON.stringify({
      income: categories.income || [],
      expense: categories.expense || []
    }));
  }

  function clearAll() {
    backend.removeItem(KEY_TRANSACTIONS);
    backend.removeItem(KEY_SETTINGS);
    backend.removeItem(KEY_CATEGORIES);
  }

  function exportJSON() {
    const payload = {
      transactions: getTransactions(),
      settings: getSettings(),
      categories: getCustomCategories(),
      exportedAt: new Date().toISOString(),
      version: 2
    };
    return JSON.stringify(payload, null, 2);
  }

  function exportCSV() {
    const rows = [['id', 'type', 'amount', 'description', 'category', 'date', 'createdAt']];
    getTransactions().forEach(t => {
      rows.push([t.id, t.type, t.amount, t.description, t.category, t.date, t.createdAt]);
    });
    return rows
      .map(row => row.map(csvEscape).join(','))
      .join('\r\n');
  }

  function csvEscape(value) {
    const str = value == null ? '' : String(value);
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function isValidTransaction(t) {
    return t && typeof t === 'object' &&
      typeof t.id === 'string' &&
      (t.type === 'income' || t.type === 'expense') &&
      typeof t.amount === 'number' &&
      typeof t.description === 'string' &&
      typeof t.category === 'string' &&
      typeof t.date === 'string';
  }

  // Valida a estrutura antes de aceitar um arquivo importado.
  function importJSON(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { success: false, error: 'Arquivo inválido: não é um JSON legível.' };
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
      return { success: false, error: 'Arquivo inválido: estrutura de dados não reconhecida.' };
    }

    const validTransactions = parsed.transactions.filter(isValidTransaction);
    if (validTransactions.length !== parsed.transactions.length) {
      return { success: false, error: 'Arquivo inválido: algumas transações estão malformadas.' };
    }

    saveTransactions(validTransactions);
    if (parsed.settings && typeof parsed.settings === 'object') {
      saveSettings(parsed.settings);
    }
    // Backups antigos (version 1) não têm categorias; nesse caso mantém as atuais.
    if (parsed.categories && typeof parsed.categories === 'object') {
      const valid = (list) => Array.isArray(list)
        ? list.filter(c => c && typeof c.id === 'string' &&
            typeof c.label === 'string' && typeof c.icon === 'string')
        : [];
      saveCustomCategories({
        income: valid(parsed.categories.income),
        expense: valid(parsed.categories.expense)
      });
    }

    return { success: true, count: validTransactions.length };
  }

  return {
    getTransactions,
    saveTransactions,
    getSettings,
    saveSettings,
    clearAll,
    exportJSON,
    exportCSV,
    importJSON,
    getCustomCategories,
    saveCustomCategories,
    isPersistent,
    DEFAULT_SETTINGS
  };
})();
