/* dashboard.js — funções de renderização (DOM) reutilizadas pelas telas */
window.App = window.App || {};

App.Dashboard = (function () {
  const U = App.Utils;
  const T = App.Transactions;

  // Saldo contínuo: soma de tudo, sem qualquer filtro aplicado.
  function renderCurrentBalance() {
    const { income, expense, balance } = T.computeCurrentBalance();

    const balanceEl = document.getElementById('card-balance');
    balanceEl.textContent = U.formatCurrency(balance);
    balanceEl.classList.toggle('text-expense', balance < 0);
    balanceEl.classList.toggle('text-income', balance >= 0);

    document.getElementById('card-total-income').textContent = U.formatCurrency(income);
    document.getElementById('card-total-expense').textContent = U.formatCurrency(expense);

    return { income, expense, balance };
  }

  // Indicadores do recorte selecionado. Não é um saldo: é o resultado do período.
  function renderPeriodSummary(range) {
    const { income, expense, result, percentSpent, count } = T.computeSummary(range);

    document.getElementById('card-income').textContent = U.formatCurrency(income);
    document.getElementById('card-expense').textContent = U.formatCurrency(expense);
    document.getElementById('card-percent').textContent =
      `${Math.min(percentSpent, 999).toFixed(1)}%`;

    const resultEl = document.getElementById('card-result');
    resultEl.textContent = U.formatCurrency(result);
    resultEl.classList.toggle('text-expense', result < 0);
    resultEl.classList.toggle('text-income', result >= 0);

    document.getElementById('period-count').textContent =
      count === 1 ? '1 movimentação' : `${count} movimentações`;

    return { income, expense, result, percentSpent };
  }

  function setPeriodLabels(label) {
    document.querySelectorAll('[data-period-label]').forEach(el => {
      el.textContent = label;
    });
    const main = document.getElementById('period-label');
    if (main) main.textContent = label;
  }

  // O orçamento é sempre do mês corrente, independente do filtro de período.
  function renderBudgetCard() {
    const settings = App.Storage.getSettings();
    const wrapper = document.getElementById('budget-card');
    const budget = Number(settings.monthlyBudget) || 0;

    if (budget <= 0) {
      wrapper.classList.add('hidden');
      return;
    }
    wrapper.classList.remove('hidden');

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const monthRange = {
      start: `${y}-${U.pad(m)}-01`,
      end: U.endOfMonthISO(y, m)
    };

    const { expense } = T.computeSummary(monthRange);
    const remaining = U.roundMoney(budget - expense);
    const pct = Math.min(U.roundMoney((expense / budget) * 100), 999);
    const over = expense > budget;

    document.getElementById('budget-spent').textContent = U.formatCurrency(expense);
    document.getElementById('budget-total').textContent = U.formatCurrency(budget);
    document.getElementById('budget-remaining').textContent = U.formatCurrency(remaining);
    document.getElementById('budget-percent-label').textContent = `${pct.toFixed(1)}%`;

    const bar = document.getElementById('budget-bar-fill');
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.classList.toggle('bg-expense', over);
    bar.classList.toggle('bg-accent', !over);

    document.getElementById('budget-warning').classList.toggle('hidden', !over);
  }

  function transactionIcon(t) {
    return T.findCategory(t.type, t.category).icon;
  }

  function transactionItemHTML(t) {
    const isIncome = t.type === 'income';
    const sign = isIncome ? '+' : '−';
    const colorClass = isIncome ? 'text-income' : 'text-expense';
    const category = T.findCategory(t.type, t.category);

    return `
      <li class="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3 active:scale-[0.98] transition" data-id="${t.id}">
        <div class="w-11 h-11 shrink-0 rounded-full bg-surface2 flex items-center justify-center text-lg">
          ${transactionIcon(t)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-text truncate">${U.escapeHtml(t.description)}</p>
          <p class="text-xs text-textMuted">${category.label} · ${U.formatDateBR(t.date)}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-semibold ${colorClass}">${sign} ${U.formatCurrency(t.amount)}</p>
        </div>
        <button class="edit-txn-btn text-textMuted hover:text-accent p-1" data-id="${t.id}" aria-label="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="delete-txn-btn text-textMuted hover:text-expense p-1" data-id="${t.id}" aria-label="Excluir">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
        </button>
      </li>`;
  }

  function renderList(containerId, list, emptyMessage) {
    const container = document.getElementById(containerId);
    if (!list.length) {
      container.innerHTML = `
        <li class="text-center text-textMuted text-sm py-10">
          <p class="text-3xl mb-2">🗂️</p>
          ${emptyMessage}
        </li>`;
      return;
    }
    container.innerHTML = list.map(transactionItemHTML).join('');
  }

  return {
    setPeriodLabels,
    renderCurrentBalance,
    renderPeriodSummary,
    renderBudgetCard,
    renderList
  };
})();
