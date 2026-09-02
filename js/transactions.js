/* transactions.js — regras de negócio sobre as transações financeiras */
window.App = window.App || {};

App.Transactions = (function () {
  const U = App.Utils;

  const DEFAULT_EXPENSE_CATEGORIES = [
    { id: 'moradia', label: 'Moradia', icon: '🏠' },
    { id: 'mercado', label: 'Mercado', icon: '🛒' },
    { id: 'alimentacao', label: 'Alimentação', icon: '🍔' },
    { id: 'transporte', label: 'Transporte', icon: '🚗' },
    { id: 'contas', label: 'Contas', icon: '💡' },
    { id: 'educacao', label: 'Educação', icon: '📚' },
    { id: 'poupanca', label: 'Poupança', icon: '🐷' },
    { id: 'lazer', label: 'Lazer', icon: '🎮' },
    { id: 'compras', label: 'Compras', icon: '🛍️' },
    { id: 'besteiras', label: 'Besteiras', icon: '🍭' },
    { id: 'outros', label: 'Outros', icon: '💰' }
  ];

  const DEFAULT_INCOME_CATEGORIES = [
    { id: 'salario', label: 'Salário', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '💻' },
    { id: 'investimentos', label: 'Investimentos', icon: '📈' },
    { id: 'extra', label: 'Extra', icon: '✨' },
    { id: 'outros', label: 'Outros', icon: '💰' }
  ];

  // Sugestões de ícone oferecidas ao criar uma categoria nova.
  const ICON_CHOICES = [
    '🏷️', '🍽️', '☕', '🍺', '🎁', '✈️', '🏥', '💊', '🐶', '👶',
    '💇', '🏋️', '⛽', '🚌', '📱', '💻', '🎵', '🎬', '📖', '🧾',
    '🔧', '🧹', '🌱', '⚽', '💸', '🏦', '💳', '🎯'
  ];

  function customFor(type) {
    const custom = App.Storage.getCustomCategories();
    return (type === 'income' ? custom.income : custom.expense) || [];
  }

  function defaultsFor(type) {
    return type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  }

  // A lista visível é sempre padrão + personalizadas, nessa ordem.
  function categoriesFor(type) {
    return defaultsFor(type).concat(customFor(type));
  }

  function isCustom(type, categoryId) {
    return customFor(type).some(c => c.id === categoryId);
  }

  function slugify(label) {
    return label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'categoria';
  }

  function addCategory(type, label, icon) {
    const clean = (label || '').trim();
    if (!clean) return { success: false, error: 'Dê um nome para a categoria.' };
    if (clean.length > 20) return { success: false, error: 'Nome muito longo (máx. 20).' };

    const existing = categoriesFor(type);
    if (existing.some(c => c.label.toLowerCase() === clean.toLowerCase())) {
      return { success: false, error: 'Já existe uma categoria com esse nome.' };
    }

    // Garante um id único mesmo se o slug colidir com outro existente.
    let id = slugify(clean);
    let suffix = 2;
    while (existing.some(c => c.id === id)) {
      id = `${slugify(clean)}_${suffix++}`;
    }

    const category = { id, label: clean, icon: icon || '🏷️' };
    const custom = App.Storage.getCustomCategories();
    const key = type === 'income' ? 'income' : 'expense';
    custom[key] = (custom[key] || []).concat([category]);
    App.Storage.saveCustomCategories(custom);

    return { success: true, category };
  }

  function removeCategory(type, categoryId) {
    const custom = App.Storage.getCustomCategories();
    const key = type === 'income' ? 'income' : 'expense';
    custom[key] = (custom[key] || []).filter(c => c.id !== categoryId);
    App.Storage.saveCustomCategories(custom);
  }

  // Quantas transações usam uma categoria (avisa antes de excluir).
  function countUsage(type, categoryId) {
    return getAll().filter(t => t.type === type && t.category === categoryId).length;
  }

  function findCategory(type, categoryId) {
    return categoriesFor(type).find(c => c.id === categoryId) ||
      { id: categoryId, label: categoryId || 'Outros', icon: '🏷️' };
  }

  function getAll() {
    return App.Storage.getTransactions();
  }

  function getById(id) {
    return getAll().find(t => t.id === id) || null;
  }

  function validate(data) {
    const errors = {};
    const amount = Number(data.amount);

    if (!data.type || (data.type !== 'income' && data.type !== 'expense')) {
      errors.type = 'Selecione receita ou despesa.';
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      errors.amount = 'Informe um valor maior que zero.';
    }
    if (!data.description || !data.description.trim()) {
      errors.description = 'Informe uma descrição.';
    }
    if (!data.category) {
      errors.category = 'Selecione uma categoria.';
    }
    if (!data.date) {
      errors.date = 'Selecione uma data.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function add(data) {
    const list = getAll();
    const transaction = {
      id: U.generateId(),
      type: data.type,
      amount: U.roundMoney(Number(data.amount)),
      description: data.description.trim(),
      category: data.category,
      date: data.date,
      createdAt: new Date().toISOString()
    };
    list.push(transaction);
    App.Storage.saveTransactions(list);
    return transaction;
  }

  function update(id, data) {
    const list = getAll();
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) return null;

    list[idx] = Object.assign({}, list[idx], {
      type: data.type,
      amount: U.roundMoney(Number(data.amount)),
      description: data.description.trim(),
      category: data.category,
      date: data.date
    });
    App.Storage.saveTransactions(list);
    return list[idx];
  }

  function remove(id) {
    const list = getAll().filter(t => t.id !== id);
    App.Storage.saveTransactions(list);
  }

  // ---- Livro contínuo ----
  // Não existe fechamento mensal nem saldo por mês. O saldo atual considera
  // TODAS as movimentações registradas. Períodos são apenas filtros de
  // visualização e nunca alteram o saldo real.

  function inRange(t, range) {
    if (!range) return true;
    if (range.start && t.date < range.start) return false;
    if (range.end && t.date > range.end) return false;
    return true;
  }

  function getByRange(range) {
    return getAll().filter(t => inRange(t, range));
  }

  // Saldo acumulado de toda a vida do livro. Independe de qualquer filtro.
  function computeCurrentBalance() {
    const list = getAll();
    const income = U.sumMoney(list.filter(t => t.type === 'income').map(t => t.amount));
    const expense = U.sumMoney(list.filter(t => t.type === 'expense').map(t => t.amount));
    return {
      income,
      expense,
      balance: U.roundMoney(income - expense),
      count: list.length
    };
  }

  // Indicadores do período selecionado (receitas, despesas e resultado).
  // "result" é o resultado do recorte, não um saldo próprio.
  function computeSummary(range) {
    const list = getByRange(range);
    const income = U.sumMoney(list.filter(t => t.type === 'income').map(t => t.amount));
    const expense = U.sumMoney(list.filter(t => t.type === 'expense').map(t => t.amount));
    const result = U.roundMoney(income - expense);
    const percentSpent = income > 0
      ? U.roundMoney((expense / income) * 100)
      : (expense > 0 ? 100 : 0);

    return { income, expense, result, percentSpent, count: list.length };
  }

  function getFiltered(range, filters) {
    filters = filters || {};
    let list = getByRange(range);

    if (filters.type) {
      list = list.filter(t => t.type === filters.type);
    }
    if (filters.category) {
      list = list.filter(t => t.category === filters.category);
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(t => t.description.toLowerCase().includes(q));
    }

    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  }

  function computeCategoryBreakdown(range) {
    const list = getByRange(range).filter(t => t.type === 'expense');
    const totals = {};
    list.forEach(t => {
      totals[t.category] = U.roundMoney((totals[t.category] || 0) + t.amount);
    });
    return Object.keys(totals)
      .map(catId => ({
        category: findCategory('expense', catId),
        total: totals[catId]
      }))
      .sort((a, b) => b.total - a.total);
  }

  // Evolução dos gastos dentro do período, dia a dia.
  // Quando o período é aberto, usa a primeira e a última data existentes.
  function computeEvolution(range) {
    const list = getByRange(range).filter(t => t.type === 'expense');
    if (!list.length) return { labels: [], values: [] };

    const dates = list.map(t => t.date).sort();
    const start = (range && range.start) || dates[0];
    const end = (range && range.end) || dates[dates.length - 1];

    const span = U.daysBetween(start, end);
    // Períodos muito longos viram agrupamento por mês para o gráfico continuar legível.
    if (span > 92) return evolutionByMonth(list);

    const perDay = {};
    list.forEach(t => {
      perDay[t.date] = U.roundMoney((perDay[t.date] || 0) + t.amount);
    });

    const labels = [];
    const values = [];
    for (let i = 0; i < span; i++) {
      const day = U.addDaysISO(start, i);
      labels.push(day.slice(8, 10) + '/' + day.slice(5, 7));
      values.push(perDay[day] || 0);
    }
    return { labels, values };
  }

  function evolutionByMonth(list) {
    const perMonth = {};
    list.forEach(t => {
      const key = t.date.slice(0, 7);
      perMonth[key] = U.roundMoney((perMonth[key] || 0) + t.amount);
    });
    const keys = Object.keys(perMonth).sort();
    return {
      labels: keys.map(k => k.slice(5, 7) + '/' + k.slice(0, 4)),
      values: keys.map(k => perMonth[k])
    };
  }

  return {
    DEFAULT_EXPENSE_CATEGORIES,
    DEFAULT_INCOME_CATEGORIES,
    ICON_CHOICES,
    categoriesFor,
    customFor,
    isCustom,
    addCategory,
    removeCategory,
    countUsage,
    findCategory,
    getAll,
    getById,
    validate,
    add,
    update,
    remove,
    getByRange,
    getFiltered,
    computeCurrentBalance,
    computeSummary,
    computeCategoryBreakdown,
    computeEvolution
  };
})();
