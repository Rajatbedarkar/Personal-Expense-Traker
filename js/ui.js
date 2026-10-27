// SpendWise - UI Controller, Navigation, Modals, Toasts, & Theme Manager

const UI = (function() {
  const viewTitles = {
    dashboard: { title: 'Financial Dashboard', subtitle: 'Real-time overview of income, expenses, and budget health' },
    transactions: { title: 'Transactions Ledger', subtitle: 'Search, filter, edit, and organize all financial records' },
    budgets: { title: 'Monthly Budgets', subtitle: 'Set and monitor spending limits to prevent budget overruns' },
    analytics: { title: 'Interactive Analytics', subtitle: 'Visual charts and spending behavior trends powered by Chart.js' },
    savings: { title: 'Savings Goals Portfolio', subtitle: 'Plan and track capital reserves toward financial milestones' },
    reports: { title: 'Financial Reports & Exports', subtitle: 'Month-over-month audit reports with CSV and PDF generation' },
    settings: { title: 'System Settings', subtitle: 'Manage preferences, categories, themes, and database credentials' }
  };

  // 1. Navigation Between Views
  function navigateTo(viewId) {
    if (!viewTitles[viewId]) return;

    // Update active nav link
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
      if (link.getAttribute('data-view') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update view panes
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const targetPane = document.getElementById(`view-${viewId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }

    // Update Header
    const heading = document.getElementById('page-heading');
    const subheading = document.getElementById('page-subheading');
    if (heading) heading.textContent = viewTitles[viewId].title;
    if (subheading) subheading.textContent = viewTitles[viewId].subtitle;

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');

    // Trigger view-specific re-renders
    if (viewId === 'dashboard') {
      renderDashboard();
      Charts.renderDashboardCharts();
    } else if (viewId === 'transactions') {
      Transactions.applyFilters();
    } else if (viewId === 'budgets') {
      Budgets.render();
    } else if (viewId === 'analytics') {
      Charts.renderAnalyticsCharts();
    } else if (viewId === 'savings') {
      Savings.render();
    } else if (viewId === 'reports') {
      Reports.updateReportPreview();
    } else if (viewId === 'settings') {
      Settings.render();
    }

    refreshIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 2. Mobile Sidebar Toggle
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('open');
    }
  }

  // 3. Auth Tabs Switch
  function switchAuthTab(tab) {
    const loginBtn = document.getElementById('tab-login-btn');
    const regBtn = document.getElementById('tab-register-btn');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const alertBox = document.getElementById('auth-alert');

    if (alertBox) alertBox.classList.add('hidden');

    if (tab === 'login') {
      loginBtn.classList.add('active');
      regBtn.classList.remove('active');
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
    } else {
      regBtn.classList.add('active');
      loginBtn.classList.remove('active');
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
    refreshIcons();
  }

  // 4. Password Visibility Toggle
  function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(`eye-${inputId}`);
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
    }
    refreshIcons();
  }

  // 5. Modal Operations
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      refreshIcons();
      // Auto-focus first input
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function openAddTransactionModal(defaultType = 'expense') {
    // Reset form
    const form = document.getElementById('form-transaction');
    if (form) form.reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('modal-tx-title').textContent = defaultType === 'income' ? 'Add Income Record' : 'Add Expense Record';
    
    // Set default date to today
    document.getElementById('tx-date-input').value = new Date().toISOString().substring(0, 10);
    
    // Populate categories
    Transactions.populateCategorySelect(defaultType);
    Transactions.setType(defaultType);

    openModal('modal-transaction');
  }

  function openAddBudgetModal() {
    const form = document.getElementById('form-budget');
    if (form) form.reset();
    document.getElementById('budget-id').value = '';
    document.getElementById('modal-budget-title').textContent = 'Set Monthly Budget';
    
    // Set default period to current month
    const currentMonth = State.getState().selectedMonth || new Date().toISOString().substring(0, 7);
    document.getElementById('budget-period-input').value = currentMonth;
    
    Budgets.populateCategorySelect();
    openModal('modal-budget');
  }

  function openAddSavingsGoalModal() {
    const form = document.getElementById('form-savings-goal');
    if (form) form.reset();
    document.getElementById('goal-id').value = '';
    document.getElementById('modal-goal-title').textContent = 'Create New Savings Goal';

    // Set default deadline 6 months ahead
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    document.getElementById('goal-deadline-input').value = d.toISOString().substring(0, 10);

    openModal('modal-savings-goal');
  }

  function openAddCategoryModal() {
    const form = document.getElementById('form-category');
    if (form) form.reset();
    openModal('modal-category');
  }

  function openFirebaseConfigModal() {
    document.getElementById('cfg-api-key').value = CONFIG.FIREBASE.apiKey || '';
    document.getElementById('cfg-auth-domain').value = CONFIG.FIREBASE.authDomain || '';
    document.getElementById('cfg-project-id').value = CONFIG.FIREBASE.projectId || '';
    document.getElementById('cfg-storage-bucket').value = CONFIG.FIREBASE.storageBucket || '';
    document.getElementById('cfg-messaging-sender-id').value = CONFIG.FIREBASE.messagingSenderId || '';
    document.getElementById('cfg-app-id').value = CONFIG.FIREBASE.appId || '';
    openModal('modal-firebase-config');
  }

  // 6. Confirmation Dialog
  let confirmCallback = null;
  function confirmAction(title, message, onConfirm) {
    document.getElementById('modal-confirm-title').textContent = title || 'Confirm Action';
    document.getElementById('modal-confirm-message').textContent = message || 'Are you sure you want to proceed?';
    confirmCallback = onConfirm;

    const actionBtn = document.getElementById('modal-confirm-action-btn');
    actionBtn.onclick = function() {
      if (confirmCallback) confirmCallback();
      closeModal('modal-confirm');
    };

    openModal('modal-confirm');
  }

  // 7. Toast Notifications
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-octagon';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span class="toast-msg">${message}</span>
      <button class="btn-icon" style="padding: 2px;" onclick="this.parentElement.remove()">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
      </button>
    `;

    container.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // 8. Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('spendwise_theme') || CONFIG.DEFAULT_THEME;
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spendwise_theme', theme);
    
    const label = document.getElementById('theme-btn-label');
    if (label) {
      label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }

    // Refresh charts with updated theme palette
    setTimeout(() => {
      Charts.refreshTheme();
      refreshIcons();
    }, 50);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // 9. Notification Drawer Toggle
  function toggleNotificationDrawer() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
      refreshIcons();
    }
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    const bellWrapper = document.querySelector('.notification-bell-wrapper');
    const dropdown = document.getElementById('notification-dropdown');
    if (bellWrapper && dropdown && !bellWrapper.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // 10. Lucide Icons Refresher
  function refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // 11. Render Dashboard
  function renderDashboard() {
    const state = State.getState();
    const transactions = state.transactions;
    const currentMonth = state.selectedMonth;
    const currency = state.settings.currency;

    // Greeting
    const nameEl = document.getElementById('dash-greeting-name');
    if (nameEl && state.currentUser) {
      nameEl.textContent = state.currentUser.displayName || 'Student';
    }

    // Current Month Banner
    const monthEl = document.getElementById('dash-current-month-label');
    if (monthEl) {
      const [y, m] = currentMonth.split('-');
      const dateObj = new Date(y, m - 1, 1);
      monthEl.textContent = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // Days remaining in current month
    const daysLeft = Calculations.getDaysRemainingInMonth(currentMonth);
    const daysEl = document.getElementById('dash-days-remaining');
    if (daysEl) {
      daysEl.textContent = `${daysLeft} days left`;
    }

    // 4 Summary Metric Cards
    const totals = Calculations.calculateTotals(transactions, t => t.date && t.date.startsWith(currentMonth));
    
    document.getElementById('dash-total-income').textContent = Calculations.formatCurrency(totals.income, currency);
    document.getElementById('dash-income-count').textContent = `${totals.incomeCount} credits recorded`;

    document.getElementById('dash-total-expense').textContent = Calculations.formatCurrency(totals.expense, currency);
    document.getElementById('dash-expense-count').textContent = `${totals.expenseCount} debits recorded`;

    const netBalEl = document.getElementById('dash-net-balance');
    netBalEl.textContent = Calculations.formatCurrency(totals.netCashFlow, currency);
    netBalEl.style.color = totals.netCashFlow >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
    
    document.getElementById('dash-balance-rate').textContent = `Savings Rate: ${totals.savingsRate}%`;

    // Total Savings Reserved across all goals
    const totalSavings = state.savingsGoals.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0);
    document.getElementById('dash-total-savings').textContent = Calculations.formatCurrency(totalSavings, currency);
    document.getElementById('dash-savings-goals-count').textContent = `${state.savingsGoals.length} active goals`;

    // Monthly Budget Glance Card
    const budgetStatus = Calculations.evaluateBudgets(state.budgets, transactions, currentMonth);
    const budgetCard = document.getElementById('dash-budget-card');
    const spentEl = document.getElementById('dash-budget-spent');
    const limitEl = document.getElementById('dash-budget-limit');
    const statusPill = document.getElementById('dash-budget-status-pill');
    const barFill = document.getElementById('dash-budget-progress-bar');
    const remEl = document.getElementById('dash-budget-remaining-text');

    if (budgetStatus.overall) {
      const o = budgetStatus.overall;
      spentEl.textContent = Calculations.formatCurrency(o.spent, currency);
      limitEl.textContent = Calculations.formatCurrency(o.limit, currency);
      remEl.textContent = `Remaining: ${Calculations.formatCurrency(o.remaining, currency)}`;

      const width = Math.min(100, o.percent);
      barFill.style.width = `${width}%`;
      barFill.className = 'progress-bar-fill';

      if (o.isExceeded) {
        barFill.classList.add('danger');
        statusPill.className = 'badge badge-danger';
        statusPill.textContent = `Exceeded (${o.percent}%)`;
      } else if (o.isWarning) {
        barFill.classList.add('warning');
        statusPill.className = 'badge badge-warning';
        statusPill.textContent = `Warning (${o.percent}%)`;
      } else {
        statusPill.className = 'badge badge-income';
        statusPill.textContent = `On Track (${o.percent}%)`;
      }
    } else {
      spentEl.textContent = Calculations.formatCurrency(budgetStatus.grandTotalExpense, currency);
      limitEl.textContent = 'None';
      remEl.textContent = 'No overall monthly budget set for this month.';
      barFill.style.width = '0%';
      statusPill.className = 'badge';
      statusPill.textContent = 'No Cap Set';
    }

    // Recent Transactions Widget (Latest 5)
    renderRecentTransactions(transactions);

    // Active Dashboard Alerts
    Notifications.renderDashboardAlerts();

    // Badges in Sidebar
    const txBadge = document.getElementById('tx-count-badge');
    if (txBadge) txBadge.textContent = transactions.length;

    refreshIcons();
  }

  function renderRecentTransactions(transactions) {
    const container = document.getElementById('dash-recent-tx-list');
    const totalCountEl = document.getElementById('dash-total-tx-count');
    if (!container) return;

    if (totalCountEl) totalCountEl.textContent = transactions.length;

    if (!transactions.length) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No transactions recorded yet. Click "+ Add Expense" to begin.
        </div>
      `;
      return;
    }

    // Sort newest first, take 5
    const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const currency = State.getState().settings.currency;
    const dateFormat = State.getState().settings.dateFormat;

    container.innerHTML = recent.map(tx => {
      const isIncome = tx.type === 'income';
      const catObj = State.getState().categories.find(c => c.name === tx.category) || {};
      const icon = catObj.icon || (isIncome ? 'arrow-down-left' : 'shopping-bag');
      const color = catObj.color || (isIncome ? '#10b981' : '#f43f5e');

      return `
        <div class="tx-item">
          <div class="tx-item-left">
            <div class="tx-cat-icon" style="background: ${color};">
              <i data-lucide="${icon}"></i>
            </div>
            <div class="tx-meta">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              <span class="tx-sub">
                <span>${Calculations.formatDate(tx.date, dateFormat)}</span>
                <span>•</span>
                <span class="tx-payment-tag">${tx.paymentMethod || 'UPI'}</span>
                <span>•</span>
                <span>${escapeHtml(tx.category)}</span>
              </span>
            </div>
          </div>
          <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? '+' : '-'}${Calculations.formatCurrency(tx.amount, currency)}
          </div>
        </div>
      `;
    }).join('');
  }

  // HTML escaping utility for safe rendering
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    navigateTo,
    toggleSidebar,
    switchAuthTab,
    togglePasswordVisibility,
    openModal,
    closeModal,
    openAddTransactionModal,
    openAddBudgetModal,
    openAddSavingsGoalModal,
    openAddCategoryModal,
    openFirebaseConfigModal,
    confirmAction,
    showToast,
    initTheme,
    setTheme,
    toggleTheme,
    toggleNotificationDrawer,
    refreshIcons,
    renderDashboard,
    escapeHtml
  };
})();
