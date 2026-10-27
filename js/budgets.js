// SpendWise - Budget Management Controller
// Handles overall monthly budget, category-specific caps, and real-time alert thresholds

const Budgets = (function() {

  // 1. Save Budget (Add or Edit)
  async function handleSave(event) {
    event.preventDefault();
    const state = State.getState();
    const userId = state.currentUser?.uid;
    if (!userId) {
      UI.showToast('Please sign in to save budgets.', 'error');
      return;
    }

    const id = document.getElementById('budget-id').value;
    const category = document.getElementById('budget-category-select').value;
    const limit = parseFloat(document.getElementById('budget-limit-input').value);
    const period = document.getElementById('budget-period-input').value; // e.g. "2026-10"

    if (isNaN(limit) || limit <= 0) {
      UI.showToast('Please enter a valid positive budget limit.', 'warning');
      return;
    }
    if (!period) {
      UI.showToast('Target month is required.', 'warning');
      return;
    }

    const budgetData = {
      category,
      limit: Number(limit.toFixed(2)),
      period
    };

    try {
      if (id) {
        // Edit existing
        await FirebaseService.updateDocument(userId, 'budgets', id, budgetData);
        UI.showToast(`Budget for ${category} updated.`, 'success');
      } else {
        // Check for existing duplicate budget for this category and period
        const existing = state.budgets.find(b => b.category === category && b.period === period);
        if (existing) {
          await FirebaseService.updateDocument(userId, 'budgets', existing.id, budgetData);
          UI.showToast(`Updated existing budget for ${category}.`, 'success');
        } else {
          await FirebaseService.addDocument(userId, 'budgets', budgetData);
          UI.showToast(`New budget set for ${category}.`, 'success');
        }
      }

      // Reload fresh budgets list
      const freshBudgets = await FirebaseService.getCollection(userId, 'budgets');
      State.setBudgets(freshBudgets);

      UI.closeModal('modal-budget');
      render();
      UI.renderDashboard();
    } catch (err) {
      console.error('[Budgets] Save failed:', err);
      UI.showToast('Failed to save budget: ' + err.message, 'error');
    }
  }

  // 2. Open Edit Overall Budget Modal
  function openEditOverallBudgetModal() {
    const state = State.getState();
    const period = state.selectedMonth;
    const overall = state.budgets.find(b => b.category === 'Overall' && b.period === period);

    document.getElementById('budget-id').value = overall ? overall.id : '';
    document.getElementById('modal-budget-title').textContent = 'Set Overall Monthly Spending Cap';
    
    populateCategorySelect();
    document.getElementById('budget-category-select').value = 'Overall';
    document.getElementById('budget-limit-input').value = overall ? overall.limit : '';
    document.getElementById('budget-period-input').value = period;

    UI.openModal('modal-budget');
  }

  // 3. Edit Individual Budget
  function editBudget(id) {
    const budget = State.getState().budgets.find(b => b.id === id);
    if (!budget) return;

    document.getElementById('budget-id').value = budget.id;
    document.getElementById('modal-budget-title').textContent = `Edit Budget: ${budget.category}`;
    
    populateCategorySelect();
    document.getElementById('budget-category-select').value = budget.category;
    document.getElementById('budget-limit-input').value = budget.limit;
    document.getElementById('budget-period-input').value = budget.period || State.getState().selectedMonth;

    UI.openModal('modal-budget');
  }

  // 4. Delete Budget with Confirmation
  function promptDelete(id) {
    const budget = State.getState().budgets.find(b => b.id === id);
    if (!budget) return;

    UI.confirmAction(
      'Remove Budget',
      `Are you sure you want to delete the monthly budget for "${budget.category}"?`,
      async () => {
        try {
          const userId = State.getState().currentUser?.uid;
          await FirebaseService.deleteDocument(userId, 'budgets', id);
          
          const fresh = await FirebaseService.getCollection(userId, 'budgets');
          State.setBudgets(fresh);

          UI.showToast('Budget removed successfully.', 'info');
          render();
          UI.renderDashboard();
        } catch (err) {
          UI.showToast('Failed to remove budget: ' + err.message, 'error');
        }
      }
    );
  }

  // 5. Month Selector Change
  function handleMonthChange() {
    const picker = document.getElementById('budget-month-selector');
    if (picker && picker.value) {
      State.setSelectedMonth(picker.value);
      render();
      UI.renderDashboard();
    }
  }

  // 6. Populate Category Select
  function populateCategorySelect() {
    const select = document.getElementById('budget-category-select');
    if (!select) return;

    const expenseCategories = State.getState().categories.filter(c => c.type === 'expense');
    select.innerHTML = `
      <option value="Overall">Overall Total Monthly Budget</option>
      ${expenseCategories.map(c => `<option value="${UI.escapeHtml(c.name)}">${UI.escapeHtml(c.name)}</option>`).join('')}
    `;
  }

  // 7. Render Budgets View
  function render() {
    const state = State.getState();
    const period = state.selectedMonth || new Date().toISOString().substring(0, 7);
    const currency = state.settings.currency;

    // Sync Month Picker
    const picker = document.getElementById('budget-month-selector');
    if (picker) picker.value = period;

    // Days left in selected month
    const daysLeft = Calculations.getDaysRemainingInMonth(period);
    const daysLeftBadge = document.getElementById('budget-days-left');
    if (daysLeftBadge) {
      daysLeftBadge.textContent = `${daysLeft} days remaining in month`;
    }

    // Evaluate budgets against actual transactions
    const budgetStatus = Calculations.evaluateBudgets(state.budgets, state.transactions, period);

    // Render Overall Card
    const overallCard = document.getElementById('overall-budget-card');
    const limitEl = document.getElementById('overall-budget-limit');
    const spentEl = document.getElementById('overall-budget-spent');
    const remEl = document.getElementById('overall-budget-remaining');
    const pctEl = document.getElementById('overall-budget-percent');
    const bar = document.getElementById('overall-budget-bar');

    if (budgetStatus.overall) {
      const o = budgetStatus.overall;
      limitEl.textContent = Calculations.formatCurrency(o.limit, currency);
      spentEl.textContent = Calculations.formatCurrency(o.spent, currency);
      remEl.textContent = Calculations.formatCurrency(o.remaining, currency);
      pctEl.textContent = `${o.percent}%`;

      const barWidth = Math.min(100, o.percent);
      bar.style.width = `${barWidth}%`;
      bar.className = 'progress-bar-fill';

      if (o.isExceeded) {
        bar.classList.add('danger');
        pctEl.className = 'val text-rose';
      } else if (o.isWarning) {
        bar.classList.add('warning');
        pctEl.className = 'val text-warning';
      } else {
        pctEl.className = 'val text-emerald';
      }
    } else {
      limitEl.textContent = 'None set';
      spentEl.textContent = Calculations.formatCurrency(budgetStatus.grandTotalExpense, currency);
      remEl.textContent = '-';
      pctEl.textContent = 'No Cap';
      bar.style.width = '0%';
      pctEl.className = 'val';
    }

    // Render Category Budgets Grid
    renderCategoryGrid(budgetStatus.categories);
    UI.refreshIcons();
  }

  function renderCategoryGrid(categories) {
    const grid = document.getElementById('category-budgets-grid');
    const empty = document.getElementById('budgets-empty-state');
    if (!grid) return;

    if (!categories.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    const currency = State.getState().settings.currency;

    grid.innerHTML = categories.map(item => {
      const catObj = State.getState().categories.find(c => c.name === item.category) || {};
      const icon = catObj.icon || 'pie-chart';
      const color = catObj.color || '#6366f1';

      let barClass = 'progress-bar-fill';
      let badgeHtml = '<span class="badge badge-income">On Track</span>';

      if (item.isExceeded) {
        barClass += ' danger';
        badgeHtml = `<span class="badge badge-danger"><i data-lucide="alert-octagon"></i> Exceeded (${item.percent}%)</span>`;
      } else if (item.isWarning) {
        barClass += ' warning';
        badgeHtml = `<span class="badge badge-warning"><i data-lucide="alert-triangle"></i> 80% Warning (${item.percent}%)</span>`;
      } else {
        badgeHtml = `<span class="badge badge-income">${item.percent}% Used</span>`;
      }

      return `
        <div class="category-budget-card">
          <div class="cat-budget-header">
            <div class="cat-budget-info">
              <div class="cat-budget-icon" style="background: ${color};">
                <i data-lucide="${icon}"></i>
              </div>
              <div>
                <h4 class="cat-budget-name">${UI.escapeHtml(item.category)}</h4>
                ${badgeHtml}
              </div>
            </div>
            <div class="td-actions">
              <button class="btn-table-action" onclick="Budgets.editBudget('${item.id}')" title="Edit Budget">
                <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-table-action delete" onclick="Budgets.promptDelete('${item.id}')" title="Remove Budget">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="${barClass}" style="width: ${Math.min(100, item.percent)}%;"></div>
          </div>

          <div class="cat-budget-values">
            <div>
              <span class="label" style="font-size: 0.72rem; color: var(--text-muted); display: block;">SPENT</span>
              <span class="spent">${Calculations.formatCurrency(item.spent, currency)}</span>
            </div>
            <div style="text-align: right;">
              <span class="label" style="font-size: 0.72rem; color: var(--text-muted); display: block;">LIMIT</span>
              <span class="limit">${Calculations.formatCurrency(item.limit, currency)}</span>
            </div>
          </div>

          <div class="cat-budget-footer">
            <span style="color: var(--text-muted);">Remaining: <strong>${Calculations.formatCurrency(item.remaining, currency)}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  return {
    handleSave,
    openEditOverallBudgetModal,
    editBudget,
    promptDelete,
    handleMonthChange,
    populateCategorySelect,
    render
  };
})();
