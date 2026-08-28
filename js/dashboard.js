/* dashboard.js — funções de renderização (DOM) reutilizadas pelas telas */
window.App = window.App || {};

App.Dashboard = (function () {
  const U = App.Utils;
  const T = App.Transactions;

  function setMonthLabels(monthKey) {
    document.querySelectorAll('[data-month-label]').forEach(el => {
      el.textContent = U.monthLabel(monthKey);
    });
  }

  function renderSummaryCards(monthKey) {
    const { income, expense, balance, percentSpent } = T.computeSummary(monthKey);

    document.getElementById('card-income').textContent = U.formatCurrency(income);
    document.getElementById('card-expense').textContent = U.formatCurrency(expense);
    document.getElementById('card-balance').textContent = U.formatCurrency(balance);
    document.getElementById('card-percent').textContent = `${Math.min(percentSpent, 999).toFixed(1)}%`;

    const balanceCard = document.getElementById('card-balance');
    balanceCard.classList.toggle('text-expense', balance < 0);
    balanceCard.classList.toggle('text-income', balance >= 0);

    return { income, expense, balance, percentSpent };
  }

  function renderBudgetCard(monthKey) {
    const settings = App.Storage.getSettings();
    const wrapper = document.getElementById('budget-card');
    const budget = Number(settings.monthlyBudget) || 0;

    if (budget <= 0) {
      wrapper.classList.add('hidden');
      return;
    }
    wrapper.classList.remove('hidden');

    const { expense } = T.computeSummary(monthKey);
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

    const warning = document.getElementById('budget-warning');
    warning.classList.toggle('hidden', !over);
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
    setMonthLabels,
    renderSummaryCards,
    renderBudgetCard,
    renderList
  };
})();
