/* utils.js — funções auxiliares puras, sem estado próprio */
window.App = window.App || {};

App.Utils = (function () {
  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Símbolo exibido antes do valor. O padrão australiano (ex: "A$ 1,250.50")
  // é usado como formatação numérica base para todas as moedas, garantindo
  // consistência independente do navegador/locale do usuário.
  const CURRENCY_SYMBOLS = {
    AUD: 'A$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    BRL: 'R$'
  };

  function generateId() {
    return 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  // Evita erros de arredondamento tratando valores em centavos internamente.
  function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function toCents(value) {
    return Math.round((Number(value) || 0) * 100);
  }

  function sumMoney(values) {
    const centsSum = values.reduce((acc, v) => acc + toCents(v), 0);
    return centsSum / 100;
  }

  function currencySymbol(currencyCode) {
    const code = currencyCode || (App.Storage ? App.Storage.getSettings().currency : 'AUD');
    return CURRENCY_SYMBOLS[code] || code;
  }

  function formatCurrency(value, currencyCode) {
    const code = currencyCode || (App.Storage ? App.Storage.getSettings().currency : 'AUD');
    const symbol = CURRENCY_SYMBOLS[code] || (code + ' ');
    const amount = roundMoney(value);
    const sign = amount < 0 ? '-' : '';
    let numberPart;
    try {
      numberPart = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(amount));
    } catch (e) {
      numberPart = Math.abs(amount).toFixed(2);
    }
    return `${sign}${symbol} ${numberPart}`;
  }

  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  function formatDateBR(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getMonthKey(isoDate) {
    return isoDate.slice(0, 7); // "YYYY-MM"
  }

  function currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function monthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }

  function shiftMonthKey(monthKey, delta) {
    let [y, m] = monthKey.split('-').map(Number);
    m += delta;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
    return `${y}-${pad(m)}`;
  }

  function daysInMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  // ---- Máscara de valores monetários ----
  // O usuário digita apenas dígitos e o campo vai se formatando da direita
  // para a esquerda (os dois últimos dígitos são sempre os centavos).
  // Ex: digitar 4 5 0 0 0 0 -> "4,500.00"

  function maskCurrency(rawValue) {
    const digits = String(rawValue == null ? '' : rawValue).replace(/\D/g, '');
    if (!digits) return '';
    // Limita a 11 dígitos (até 999,999,999.99) para evitar overflow visual.
    const limited = digits.slice(0, 11);
    const cents = parseInt(limited, 10);
    return formatGrouped(cents / 100);
  }

  function formatGrouped(value) {
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      return value.toFixed(2);
    }
  }

  // Converte o texto mascarado ("4,500.00") de volta para número (4500).
  function unmaskCurrency(maskedValue) {
    const digits = String(maskedValue == null ? '' : maskedValue).replace(/\D/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10) / 100;
  }

  // Liga a máscara a um input: formata enquanto digita e mantém o cursor
  // no fim, que é o comportamento natural para entrada de valores.
  function attachCurrencyMask(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      const masked = maskCurrency(input.value);
      input.value = masked;
      // Mantém o cursor no final após a reformatação.
      requestAnimationFrame(() => {
        const end = input.value.length;
        try { input.setSelectionRange(end, end); } catch (e) { /* alguns tipos não suportam */ }
      });
    });
  }

  // ---- Períodos (apenas filtros de visualização) ----
  // Um período é { start, end } em "YYYY-MM-DD". null = sem limite.
  // Nada aqui altera movimentações: serve só para recortar a visualização.

  function endOfMonthISO(year, month) {
    const last = new Date(year, month, 0).getDate();
    return `${year}-${pad(month)}-${pad(last)}`;
  }

  function buildRange(preset, custom) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const today = todayISO();

    switch (preset) {
      case 'today':
        return { start: today, end: today };
      case 'this_month':
        return { start: `${y}-${pad(m)}-01`, end: endOfMonthISO(y, m) };
      case 'last_month': {
        const ly = m === 1 ? y - 1 : y;
        const lm = m === 1 ? 12 : m - 1;
        return { start: `${ly}-${pad(lm)}-01`, end: endOfMonthISO(ly, lm) };
      }
      case 'this_year':
        return { start: `${y}-01-01`, end: `${y}-12-31` };
      case 'last_year':
        return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
      case 'custom':
        return {
          start: (custom && custom.start) || null,
          end: (custom && custom.end) || null
        };
      case 'all':
      default:
        return { start: null, end: null };
    }
  }

  function rangeLabel(preset, range) {
    const names = {
      all: 'Todas as movimentações',
      today: 'Hoje',
      this_month: 'Este mês',
      last_month: 'Mês anterior',
      this_year: 'Este ano',
      last_year: 'Ano anterior'
    };
    if (preset !== 'custom') return names[preset] || names.all;

    if (range.start && range.end) return `${formatDateBR(range.start)} — ${formatDateBR(range.end)}`;
    if (range.start) return `A partir de ${formatDateBR(range.start)}`;
    if (range.end) return `Até ${formatDateBR(range.end)}`;
    return 'Período personalizado';
  }

  // Quantos dias tem o período (usado no gráfico de evolução).
  function daysBetween(startISO, endISO) {
    const a = new Date(startISO + 'T00:00:00');
    const b = new Date(endISO + 'T00:00:00');
    return Math.round((b - a) / 86400000) + 1;
  }

  function addDaysISO(isoDate, days) {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  return {
    MONTH_NAMES,
    generateId,
    roundMoney,
    toCents,
    sumMoney,
    formatCurrency,
    formatDateBR,
    todayISO,
    pad,
    getMonthKey,
    currentMonthKey,
    monthLabel,
    shiftMonthKey,
    daysInMonth,
    buildRange,
    rangeLabel,
    daysBetween,
    addDaysISO,
    endOfMonthISO,
    maskCurrency,
    currencySymbol,
    unmaskCurrency,
    formatGrouped,
    attachCurrencyMask,
    escapeHtml,
    debounce
  };
})();
