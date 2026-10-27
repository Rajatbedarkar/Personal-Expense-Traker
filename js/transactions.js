// SpendWise - Transaction Management Controller
// Handles CRUD, filtering, search, sorting, pagination, and deletion confirmation

const Transactions = (function() {
  let currentPage = 1;
  const itemsPerPage = CONFIG.PAGINATION_LIMIT || 10;
  let currentFilteredList = [];

  // 1. Save Transaction (Add or Edit)
  async function handleSave(event) {
    event.preventDefault();
    const state = State.getState();
    const userId = state.currentUser?.uid;
    if (!userId) {
      UI.showToast('Please sign in to save transactions.', 'error');
      return;
    }

    const id = document.getElementById('tx-id').value;
    const type = document.getElementById('tx-type').value || 'expense';
    const title = document.getElementById('tx-title-input').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount-input').value);
    const date = document.getElementById('tx-date-input').value;
    const category = document.getElementById('tx-category-select').value;
    const paymentMethod = document.getElementById('tx-payment-method').value;
    const description = document.getElementById('tx-description-input').value.trim();

    // Validation
    if (!title) {
      UI.showToast('Transaction title is required.', 'warning');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      UI.showToast('Please enter a valid positive amount.', 'warning');
      return;
    }
    if (!date) {
      UI.showToast('Transaction date is required.', 'warning');
      return;
    }

    const txData = {
      title,
      amount: Number(amount.toFixed(2)),
      type,
      category,
      date,
      paymentMethod,
      description
    };

    try {
      if (id) {
        // Edit existing
        const updated = await FirebaseService.updateDocument(userId, 'transactions', id, txData);
        State.updateTransaction(updated);
        UI.showToast('Transaction updated successfully.', 'success');
      } else {
        // Add new
        const created = await FirebaseService.addDocument(userId, 'transactions', txData);
        State.addTransaction(created);
        UI.showToast('Transaction recorded successfully.', 'success');
      }

      UI.closeModal('modal-transaction');
      applyFilters();
      UI.renderDashboard();
      Charts.renderDashboardCharts();
    } catch (err) {
      console.error('[Transactions] Save failed:', err);
      UI.showToast('Failed to save transaction: ' + err.message, 'error');
    }
  }

  // 2. Open Edit Transaction Modal
  function editTransaction(id) {
    const tx = State.getState().transactions.find(t => t.id === id);
    if (!tx) return;

    document.getElementById('tx-id').value = tx.id;
    document.getElementById('modal-tx-title').textContent = 'Edit Transaction';
    document.getElementById('tx-title-input').value = tx.title;
    document.getElementById('tx-amount-input').value = tx.amount;
    document.getElementById('tx-date-input').value = tx.date;
    document.getElementById('tx-payment-method').value = tx.paymentMethod || 'UPI';
    document.getElementById('tx-description-input').value = tx.description || '';

    populateCategorySelect(tx.type);
    document.getElementById('tx-category-select').value = tx.category;
    setType(tx.type);

    UI.openModal('modal-transaction');
  }

  // 3. Confirm & Delete Transaction
  function promptDelete(id) {
    const tx = State.getState().transactions.find(t => t.id === id);
    if (!tx) return;

    const currency = State.getState().settings.currency;
    const msg = `Are you sure you want to delete "${tx.title}" (${Calculations.formatCurrency(tx.amount, currency)})? This cannot be undone.`;

    UI.confirmAction('Delete Transaction', msg, async () => {
      try {
        const userId = State.getState().currentUser?.uid;
        await FirebaseService.deleteDocument(userId, 'transactions', id);
        State.removeTransaction(id);
        UI.showToast('Transaction permanently deleted.', 'info');
        applyFilters();
        UI.renderDashboard();
        Charts.renderDashboardCharts();
      } catch (err) {
        UI.showToast('Failed to delete transaction: ' + err.message, 'error');
      }
    });
  }

  // 4. Set Transaction Type in Modal (Expense / Income)
  function setType(type) {
    const hiddenType = document.getElementById('tx-type');
    const expBtn = document.getElementById('toggle-expense-btn');
    const incBtn = document.getElementById('toggle-income-btn');
    if (!hiddenType) return;

    hiddenType.value = type;

    if (type === 'income') {
      incBtn.classList.add('active');
      expBtn.classList.remove('active');
    } else {
      expBtn.classList.add('active');
      incBtn.classList.remove('active');
    }

    populateCategorySelect(type);
  }

  // 5. Populate Category Select in Modal & Filter Bar
  function populateCategorySelect(filterType = null) {
    const select = document.getElementById('tx-category-select');
    if (!select) return;

    const categories = State.getState().categories;
    const filtered = filterType ? categories.filter(c => c.type === filterType) : categories;

    select.innerHTML = filtered.map(cat => `
      <option value="${UI.escapeHtml(cat.name)}">${UI.escapeHtml(cat.name)}</option>
    `).join('');
  }

  function populateFilterCategoryDropdown() {
    const filterCat = document.getElementById('tx-filter-category');
    if (!filterCat) return;

    const categories = State.getState().categories;
    filterCat.innerHTML = `
      <option value="all">All Categories</option>
      ${categories.map(c => `<option value="${UI.escapeHtml(c.name)}">${UI.escapeHtml(c.name)}</option>`).join('')}
    `;
  }

  // 6. Filter Period Selector Change
  function handlePeriodChange() {
    const period = document.getElementById('tx-filter-period').value;
    const customContainer = document.getElementById('tx-custom-date-container');

    if (period === 'custom') {
      customContainer.classList.remove('hidden');
      // Set initial defaults for custom range (first of month to today)
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
      document.getElementById('tx-date-start').value = firstOfMonth;
      document.getElementById('tx-date-end').value = now.toISOString().substring(0, 10);
    } else {
      customContainer.classList.add('hidden');
    }
    applyFilters();
  }

  // 7. Apply Filters, Search, and Sorting
  function applyFilters() {
    const all = State.getState().transactions;
    const search = document.getElementById('tx-search-input')?.value.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('tx-filter-type')?.value || 'all';
    const catFilter = document.getElementById('tx-filter-category')?.value || 'all';
    const period = document.getElementById('tx-filter-period')?.value || 'this-month';
    const sortBy = document.getElementById('tx-sort-by')?.value || 'date-desc';

    const now = new Date();
    const currentMonthStr = now.toISOString().substring(0, 7);
    
    // Previous month string
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    let result = all.filter(tx => {
      // 1. Search Query
      if (search) {
        const inTitle = tx.title?.toLowerCase().includes(search);
        const inDesc = tx.description?.toLowerCase().includes(search);
        const inPay = tx.paymentMethod?.toLowerCase().includes(search);
        const inCat = tx.category?.toLowerCase().includes(search);
        if (!inTitle && !inDesc && !inPay && !inCat) return false;
      }

      // 2. Type Filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

      // 3. Category Filter
      if (catFilter !== 'all' && tx.category !== catFilter) return false;

      // 4. Date Period Filter
      if (period === 'this-month') {
        if (!tx.date || !tx.date.startsWith(currentMonthStr)) return false;
      } else if (period === 'last-month') {
        if (!tx.date || !tx.date.startsWith(prevMonthStr)) return false;
      } else if (period === 'last-30') {
        const txDate = new Date(tx.date);
        const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 30) return false;
      } else if (period === 'this-year') {
        const yearStr = String(now.getFullYear());
        if (!tx.date || !tx.date.startsWith(yearStr)) return false;
      } else if (period === 'custom') {
        const start = document.getElementById('tx-date-start')?.value;
        const end = document.getElementById('tx-date-end')?.value;
        if (start && tx.date < start) return false;
        if (end && tx.date > end) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'amount-asc') return Number(a.amount) - Number(b.amount);
      return 0;
    });

    currentFilteredList = result;
    currentPage = 1; // Reset to page 1 on filter change
    renderTable();
    renderFilterRibbonSummary();
  }

  function resetFilters() {
    document.getElementById('tx-search-input').value = '';
    document.getElementById('tx-filter-type').value = 'all';
    document.getElementById('tx-filter-category').value = 'all';
    document.getElementById('tx-filter-period').value = 'this-month';
    document.getElementById('tx-custom-date-container').classList.add('hidden');
    document.getElementById('tx-sort-by').value = 'date-desc';
    applyFilters();
  }

  // 8. Render Filter Ribbon Summary
  function renderFilterRibbonSummary() {
    const countEl = document.getElementById('tx-filter-count');
    const incomeEl = document.getElementById('tx-filter-income');
    const expenseEl = document.getElementById('tx-filter-expense');
    const netEl = document.getElementById('tx-filter-net');
    const currency = State.getState().settings.currency;

    const totals = Calculations.calculateTotals(currentFilteredList);

    if (countEl) countEl.textContent = currentFilteredList.length;
    if (incomeEl) incomeEl.textContent = Calculations.formatCurrency(totals.income, currency);
    if (expenseEl) expenseEl.textContent = Calculations.formatCurrency(totals.expense, currency);
    if (netEl) {
      netEl.textContent = Calculations.formatCurrency(totals.netCashFlow, currency);
      netEl.style.color = totals.netCashFlow >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
    }
  }

  // 9. Render Table Rows with Pagination
  function renderTable() {
    const tbody = document.getElementById('tx-table-body');
    const emptyState = document.getElementById('tx-empty-state');
    const table = document.getElementById('transactions-table');
    const paginationBar = document.getElementById('tx-pagination-bar');
    if (!tbody) return;

    if (!currentFilteredList.length) {
      tbody.innerHTML = '';
      table.classList.add('hidden');
      emptyState.classList.remove('hidden');
      paginationBar.classList.add('hidden');
      return;
    }

    table.classList.remove('hidden');
    emptyState.classList.add('hidden');
    paginationBar.classList.remove('hidden');

    // Slice for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageItems = currentFilteredList.slice(startIndex, startIndex + itemsPerPage);

    const currency = State.getState().settings.currency;
    const dateFormat = State.getState().settings.dateFormat;

    tbody.innerHTML = pageItems.map(tx => {
      const isIncome = tx.type === 'income';
      const catObj = State.getState().categories.find(c => c.name === tx.category) || {};
      const dotColor = catObj.color || (isIncome ? '#10b981' : '#f43f5e');

      return `
        <tr>
          <td>
            <div class="td-category">
              <span class="cat-indicator-dot" style="background: ${dotColor};"></span>
              <span>${UI.escapeHtml(tx.category)}</span>
            </div>
          </td>
          <td>
            <strong>${UI.escapeHtml(tx.title)}</strong>
            ${tx.description ? `<br><small style="color: var(--text-muted);">${UI.escapeHtml(tx.description)}</small>` : ''}
          </td>
          <td>${Calculations.formatDate(tx.date, dateFormat)}</td>
          <td><span class="tx-payment-tag">${tx.paymentMethod || 'UPI'}</span></td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: ${isIncome ? 'var(--color-income)' : 'var(--color-expense)'};">
            ${isIncome ? '+' : '-'}${Calculations.formatCurrency(tx.amount, currency)}
          </td>
          <td class="td-actions">
            <button class="btn-table-action" onclick="Transactions.editTransaction('${tx.id}')" title="Edit Record">
              <i data-lucide="pencil" style="width: 15px; height: 15px;"></i>
            </button>
            <button class="btn-table-action delete" onclick="Transactions.promptDelete('${tx.id}')" title="Delete Record">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    renderPaginationControls();
    UI.refreshIcons();
  }

  // 10. Pagination Controls
  function renderPaginationControls() {
    const totalItems = currentFilteredList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    document.getElementById('tx-pagination-info').textContent =
      `Showing ${totalItems > 0 ? start : 0} to ${end} of ${totalItems} entries`;

    const prevBtn = document.getElementById('tx-prev-page');
    const nextBtn = document.getElementById('tx-next-page');
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalItems === 0;

    const pageNumbersContainer = document.getElementById('tx-page-numbers');
    pageNumbersContainer.innerHTML = '';

    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 6 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        continue;
      }
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-num-btn ${p === currentPage ? 'active' : ''}`;
      pageBtn.textContent = p;
      pageBtn.onclick = () => {
        currentPage = p;
        renderTable();
      };
      pageNumbersContainer.appendChild(pageBtn);
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  }

  function nextPage() {
    const totalPages = Math.ceil(currentFilteredList.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  }

  return {
    handleSave,
    editTransaction,
    promptDelete,
    setType,
    populateCategorySelect,
    populateFilterCategoryDropdown,
    handlePeriodChange,
    applyFilters,
    resetFilters,
    prevPage,
    nextPage
  };
})();
