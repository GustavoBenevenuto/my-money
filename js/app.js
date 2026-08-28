/* app.js — orquestra estado, eventos e integra os demais módulos */
window.App = window.App || {};

App.App = (function () {
  const U = App.Utils;
  const S = App.Storage;
  const T = App.Transactions;
  const D = App.Dashboard;
  const C = App.Charts;

  const state = {
    currentMonthKey: U.currentMonthKey(),
    currentView: 'dashboard',
    editingId: null,
    currentType: 'expense'
  };

  let confirmCallback = null;

  /* ---------- Inicialização ---------- */

  function init() {
    populateFilterCategories();
    U.attachCurrencyMask(document.getElementById('form-amount'));
    U.attachCurrencyMask(document.getElementById('setting-budget'));
    loadSettingsIntoForm();
    bindNav();
    bindMonthNav();
    bindFab();
    bindModal();
    bindFilters();
    bindSettings();
    bindConfirmDialog();
    bindNewCategoryPanel();
    bindCategorySettings();

    switchView('dashboard');
    refresh();
  }

  /* ---------- Navegação entre telas ---------- */

  function bindNav() {
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.goto));
    });
  }

  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById('view-' + view).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.goto === view);
    });

    renderActiveView();
  }

  function bindMonthNav() {
    document.getElementById('month-prev').addEventListener('click', () => changeMonth(-1));
    document.getElementById('month-next').addEventListener('click', () => changeMonth(1));
  }

  function changeMonth(delta) {
    state.currentMonthKey = U.shiftMonthKey(state.currentMonthKey, delta);
    refresh();
  }

  /* ---------- Renderização ---------- */

  function updateCurrencyPrefixes() {
    const symbol = U.currencySymbol();
    document.querySelectorAll('[data-currency-prefix]').forEach(el => {
      el.textContent = symbol;
    });
  }

  function refresh() {
    updateCurrencyPrefixes();
    D.setMonthLabels(state.currentMonthKey);
    D.renderSummaryCards(state.currentMonthKey);
    D.renderBudgetCard(state.currentMonthKey);
    renderActiveView();
  }

  function renderActiveView() {
    // Gráficos só são desenhados quando o container está visível,
    // senão o Chart.js mede a área como 0x0 e o gráfico quebra.
    if (state.currentView === 'dashboard') renderDashboardView();
    if (state.currentView === 'transactions') renderTransactionsList();
    if (state.currentView === 'reports') renderReports();
    if (state.currentView === 'settings') renderCategorySettings();
  }

  function renderDashboardView() {
    const summary = T.computeSummary(state.currentMonthKey);
    C.renderIncomeExpenseChart('chart-income-expense-mini', summary.income, summary.expense);
    renderRecentList();
  }

  function renderRecentList() {
    const list = T.getFiltered(state.currentMonthKey, {}).slice(0, 5);
    D.renderList('dashboard-recent-list', list, 'Nenhuma transação neste mês ainda.');
    bindListItemActions('dashboard-recent-list');
  }

  function renderTransactionsList() {
    const filters = {
      type: document.getElementById('filter-type').value,
      category: document.getElementById('filter-category').value,
      search: document.getElementById('filter-search').value
    };
    const list = T.getFiltered(state.currentMonthKey, filters);
    D.renderList('transactions-full-list', list, 'Nenhuma transação encontrada com esses filtros.');
    bindListItemActions('transactions-full-list');
  }

  function renderReports() {
    const breakdown = T.computeCategoryBreakdown(state.currentMonthKey);
    C.renderCategoryChart('chart-category', breakdown);

    const summary = T.computeSummary(state.currentMonthKey);
    C.renderIncomeExpenseChart('chart-income-expense', summary.income, summary.expense);

    const daily = T.computeDailyEvolution(state.currentMonthKey);
    C.renderDailyEvolutionChart('chart-daily', daily);
  }

  function bindListItemActions(containerId) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.edit-txn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });
    container.querySelectorAll('.delete-txn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(btn.dataset.id);
      });
    });
  }

  /* ---------- Filtros da tela de transações ---------- */

  function populateFilterCategories() {
    const select = document.getElementById('filter-category');
    const previous = select.value;

    const seen = new Map();
    T.categoriesFor('expense').concat(T.categoriesFor('income')).forEach(c => {
      if (!seen.has(c.id)) seen.set(c.id, c);
    });

    select.innerHTML = '<option value="">Todas categorias</option>';
    seen.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.icon} ${c.label}`;
      select.appendChild(opt);
    });

    // Mantém o filtro atual se a categoria ainda existir.
    if (previous && seen.has(previous)) select.value = previous;
  }

  function bindFilters() {
    document.getElementById('filter-type').addEventListener('change', renderTransactionsList);
    document.getElementById('filter-category').addEventListener('change', renderTransactionsList);
    document.getElementById('filter-search').addEventListener('input', U.debounce(renderTransactionsList, 200));
  }

  /* ---------- FAB e Modal de transação ---------- */

  /* ---------- Criação de categoria ---------- */

  let pendingIcon = null;

  function openNewCategoryPanel() {
    const panel = document.getElementById('new-category-panel');
    panel.classList.remove('hidden');
    document.getElementById('new-category-name').value = '';
    document.getElementById('new-category-error').classList.add('hidden');

    const grid = document.getElementById('new-category-icons');
    grid.innerHTML = T.ICON_CHOICES
      .map(icon => `<button type="button" class="icon-option" data-icon="${icon}">${icon}</button>`)
      .join('');
    grid.querySelectorAll('.icon-option').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingIcon = btn.dataset.icon;
        grid.querySelectorAll('.icon-option').forEach(b => {
          b.classList.toggle('selected', b === btn);
        });
      });
    });

    pendingIcon = T.ICON_CHOICES[0];
    grid.querySelector('.icon-option').classList.add('selected');
    document.getElementById('new-category-name').focus();
  }

  function closeNewCategoryPanel() {
    document.getElementById('new-category-panel').classList.add('hidden');
  }

  function bindNewCategoryPanel() {
    document.getElementById('new-category-cancel')
      .addEventListener('click', closeNewCategoryPanel);

    document.getElementById('new-category-save').addEventListener('click', () => {
      const name = document.getElementById('new-category-name').value;
      const result = T.addCategory(state.currentType, name, pendingIcon);
      const errorEl = document.getElementById('new-category-error');

      if (!result.success) {
        errorEl.textContent = result.error;
        errorEl.classList.remove('hidden');
        return;
      }

      closeNewCategoryPanel();
      // Recria a trilha já com a categoria nova selecionada.
      populateCategorySelect(state.currentType, result.category.id);
      populateFilterCategories();
      showToast(`Categoria "${result.category.label}" criada.`);
    });
  }

  /* ---------- Categorias nas Configurações ---------- */

  let settingsCategoryTab = 'expense';

  function bindCategorySettings() {
    document.querySelectorAll('[data-cat-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        settingsCategoryTab = btn.dataset.catTab;
        renderCategorySettings();
      });
    });
  }

  function renderCategorySettings() {
    document.querySelectorAll('[data-cat-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.catTab === settingsCategoryTab);
    });

    const type = settingsCategoryTab;
    const list = T.categoriesFor(type);
    const container = document.getElementById('settings-category-list');

    container.innerHTML = list.map(c => {
      const custom = T.isCustom(type, c.id);
      return `
        <li class="flex items-center gap-3 bg-surface2 rounded-xl px-3 py-2">
          <span class="text-base">${c.icon}</span>
          <span class="flex-1 text-sm truncate">${U.escapeHtml(c.label)}</span>
          ${custom
            ? `<button type="button" class="remove-cat-btn text-textMuted hover:text-expense p-1" data-id="${U.escapeHtml(c.id)}" aria-label="Remover">
                 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
               </button>`
            : `<span class="text-[10px] text-textMuted">padrão</span>`}
        </li>`;
    }).join('');

    container.querySelectorAll('.remove-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmRemoveCategory(type, btn.dataset.id));
    });
  }

  function confirmRemoveCategory(type, categoryId) {
    const cat = T.findCategory(type, categoryId);
    const used = T.countUsage(type, categoryId);
    const message = used > 0
      ? `Remover "${cat.label}"? ${used} transação(ões) usam essa categoria e continuarão salvas, mas ficarão sem ícone próprio.`
      : `Remover a categoria "${cat.label}"?`;

    showConfirm(message, () => {
      T.removeCategory(type, categoryId);
      renderCategorySettings();
      populateFilterCategories();
      refresh();
      showToast('Categoria removida.');
    });
  }

  function bindFab() {
    document.getElementById('fab-add').addEventListener('click', openAddModal);
  }

  function bindModal() {
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => selectType(btn.dataset.type));
    });
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
    document.getElementById('transaction-form').addEventListener('submit', handleSubmit);
  }

  function openAddModal() {
    state.editingId = null;
    document.getElementById('modal-title').textContent = 'Nova transação';
    document.getElementById('form-id').value = '';
    document.getElementById('form-amount').value = '';
    document.getElementById('form-description').value = '';
    document.getElementById('form-date').value = U.todayISO();
    clearFieldErrors();
    closeNewCategoryPanel();
    selectType('expense');
    openModal();
  }

  function openEditModal(id) {
    const t = T.getById(id);
    if (!t) return;
    state.editingId = id;
    document.getElementById('modal-title').textContent = 'Editar transação';
    document.getElementById('form-id').value = t.id;
    document.getElementById('form-amount').value = U.formatGrouped(t.amount);
    document.getElementById('form-description').value = t.description;
    document.getElementById('form-date').value = t.date;
    clearFieldErrors();
    closeNewCategoryPanel();
    selectType(t.type, t.category);
    openModal();
  }

  function selectType(type, selectedCategoryId) {
    state.currentType = type;
    document.getElementById('form-type').value = type;
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    populateCategorySelect(type, selectedCategoryId);
  }

  function populateCategorySelect(type, selectedCategoryId) {
    const track = document.getElementById('form-category-chips');
    const list = T.categoriesFor(type);

    // Se a categoria anterior não existe neste tipo, seleciona a primeira.
    let selected = selectedCategoryId;
    if (!selected || !list.some(c => c.id === selected)) {
      selected = list.length ? list[0].id : '';
    }

    track.innerHTML = list.map(c => `
      <button type="button" class="cat-chip" data-cat="${U.escapeHtml(c.id)}">
        <span class="cat-emoji">${c.icon}</span>
        <span class="cat-name">${U.escapeHtml(c.label)}</span>
      </button>`).join('') + `
      <button type="button" class="cat-chip add-chip" id="chip-add-category">
        <span class="cat-emoji">＋</span>
        <span class="cat-name">Nova</span>
      </button>`;

    track.querySelectorAll('.cat-chip[data-cat]').forEach(chip => {
      chip.addEventListener('click', () => selectCategory(chip.dataset.cat));
    });
    document.getElementById('chip-add-category')
      .addEventListener('click', openNewCategoryPanel);

    selectCategory(selected, { scroll: false });
  }

  function selectCategory(categoryId, options) {
    options = options || {};
    document.getElementById('form-category').value = categoryId || '';

    const track = document.getElementById('form-category-chips');
    let selectedChip = null;
    track.querySelectorAll('.cat-chip[data-cat]').forEach(chip => {
      const on = chip.dataset.cat === categoryId;
      chip.classList.toggle('selected', on);
      if (on) selectedChip = chip;
    });

    const label = document.getElementById('form-category-current');
    const cat = T.findCategory(state.currentType, categoryId);
    label.textContent = categoryId ? `${cat.icon} ${cat.label}` : '';

    // Traz a categoria escolhida para a área visível da trilha.
    if (selectedChip && options.scroll !== false) {
      selectedChip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    } else if (selectedChip) {
      track.scrollLeft = Math.max(0, selectedChip.offsetLeft - track.offsetWidth / 2 + selectedChip.offsetWidth / 2);
    }
  }

  function openModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('open');
    setTimeout(() => overlay.classList.add('hidden'), 250);
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
  }

  function showFieldErrors(errors) {
    clearFieldErrors();
    Object.keys(errors).forEach(field => {
      const el = document.querySelector(`.field-error[data-for="${field}"]`);
      if (el) {
        el.textContent = errors[field];
        el.classList.remove('hidden');
      }
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = {
      type: document.getElementById('form-type').value,
      amount: U.unmaskCurrency(document.getElementById('form-amount').value),
      description: document.getElementById('form-description').value,
      category: document.getElementById('form-category').value,
      date: document.getElementById('form-date').value
    };

    const { valid, errors } = T.validate(data);
    if (!valid) {
      showFieldErrors(errors);
      return;
    }

    if (state.editingId) {
      T.update(state.editingId, data);
      showToast('Transação atualizada.');
    } else {
      T.add(data);
      showToast(data.type === 'income' ? 'Receita adicionada.' : 'Despesa adicionada.');
    }

    closeModal();
    state.currentMonthKey = U.getMonthKey(data.date);
    refresh();
  }

  function confirmDelete(id) {
    const t = T.getById(id);
    if (!t) return;
    showConfirm(`Excluir "${t.description}"? Essa ação não pode ser desfeita.`, () => {
      T.remove(id);
      refresh();
      showToast('Transação excluída.');
    });
  }

  /* ---------- Diálogo de confirmação genérico ---------- */

  function bindConfirmDialog() {
    document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirm);
    document.getElementById('confirm-ok-btn').addEventListener('click', () => {
      if (typeof confirmCallback === 'function') confirmCallback();
      closeConfirm();
    });
  }

  function showConfirm(message, onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirm-dialog').classList.remove('hidden');
    document.getElementById('confirm-dialog').classList.add('open');
  }

  function closeConfirm() {
    document.getElementById('confirm-dialog').classList.remove('open');
    document.getElementById('confirm-dialog').classList.add('hidden');
    confirmCallback = null;
  }

  /* ---------- Configurações ---------- */

  function loadSettingsIntoForm() {
    const settings = S.getSettings();
    document.getElementById('setting-currency').value = settings.currency;
    document.getElementById('setting-budget').value =
      settings.monthlyBudget ? U.formatGrouped(settings.monthlyBudget) : '';
  }

  function bindSettings() {
    document.getElementById('save-settings-btn').addEventListener('click', () => {
      const currency = document.getElementById('setting-currency').value;
      const monthlyBudget = Math.max(0, U.unmaskCurrency(document.getElementById('setting-budget').value));

      S.saveSettings({ currency, monthlyBudget });
      refresh();
      showToast('Configurações salvas.');
    });

    document.getElementById('export-json-btn').addEventListener('click', () => {
      downloadFile('meu-dinheiro-backup.json', S.exportJSON(), 'application/json');
    });

    document.getElementById('export-csv-btn').addEventListener('click', () => {
      downloadFile('meu-dinheiro-transacoes.csv', S.exportCSV(), 'text/csv');
    });

    document.getElementById('import-json-input').addEventListener('change', handleImport);

    document.getElementById('clear-data-btn').addEventListener('click', () => {
      showConfirm('Tem certeza? Todos os seus dados financeiros serão apagados.', () => {
        S.clearAll();
        state.currentMonthKey = U.currentMonthKey();
        loadSettingsIntoForm();
        populateFilterCategories();
        renderCategorySettings();
        refresh();
        showToast('Todos os dados foram apagados.');
      });
    });
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = S.importJSON(reader.result);
      if (result.success) {
        loadSettingsIntoForm();
        populateFilterCategories();
        renderCategorySettings();
        refresh();
        showToast(`${result.count} transações importadas.`);
      } else {
        showToast(result.error);
      }
      e.target.value = '';
    };
    reader.onerror = () => showToast('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---------- Toast ---------- */

  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.App.init);
