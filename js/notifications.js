// SpendWise - In-App Notification & Alert Manager
// Generates intelligent financial warnings (80% & 100% budget alerts, goal completion, MoM spending spikes)

const Notifications = (function() {
  let notifications = [];

  // 1. Evaluate All Financial Triggers
  function evaluateTriggers() {
    const state = State.getState();
    const currentMonth = state.selectedMonth || new Date().toISOString().substring(0, 7);
    const currency = state.settings.currency;
    const generatedAlerts = [];

    // Trigger A: Overall & Category Budget Alerts (80% and 100%)
    const budgetStatus = Calculations.evaluateBudgets(state.budgets, state.transactions, currentMonth);

    // Overall Budget Alert
    if (budgetStatus.overall) {
      const o = budgetStatus.overall;
      if (o.isExceeded) {
        generatedAlerts.push({
          id: `alert_overall_exceeded_${currentMonth}`,
          type: 'danger',
          icon: 'alert-octagon',
          title: 'Overall Budget Exceeded!',
          message: `Total spending (${Calculations.formatCurrency(o.spent, currency)}) has exceeded your monthly budget cap of ${Calculations.formatCurrency(o.limit, currency)} (${o.percent}% used).`,
          timestamp: new Date().toISOString()
        });
      } else if (o.isWarning) {
        generatedAlerts.push({
          id: `alert_overall_warning_${currentMonth}`,
          type: 'warning',
          icon: 'alert-triangle',
          title: 'Overall Budget Warning (80%)',
          message: `You have consumed ${o.percent}% of your total monthly budget (${Calculations.formatCurrency(o.spent, currency)} / ${Calculations.formatCurrency(o.limit, currency)}).`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Category Budget Alerts
    budgetStatus.categories.forEach(b => {
      if (b.isExceeded) {
        generatedAlerts.push({
          id: `alert_cat_${b.category}_exceeded_${currentMonth}`,
          type: 'danger',
          icon: 'alert-octagon',
          title: `${b.category} Budget Exceeded!`,
          message: `Spending on ${b.category} (${Calculations.formatCurrency(b.spent, currency)}) is over the allocated limit of ${Calculations.formatCurrency(b.limit, currency)}.`,
          timestamp: new Date().toISOString()
        });
      } else if (b.isWarning) {
        generatedAlerts.push({
          id: `alert_cat_${b.category}_warning_${currentMonth}`,
          type: 'warning',
          icon: 'alert-triangle',
          title: `${b.category} Budget Alert (80%)`,
          message: `${b.category} expenses have reached ${b.percent}% of the ${Calculations.formatCurrency(b.limit, currency)} limit.`,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Trigger B: Savings Goals Achieved
    state.savingsGoals.forEach(g => {
      if (Number(g.savedAmount) >= Number(g.targetAmount) && Number(g.targetAmount) > 0) {
        generatedAlerts.push({
          id: `alert_goal_achieved_${g.id}`,
          type: 'success',
          icon: 'trophy',
          title: 'Goal Achieved!',
          message: `Congratulations! You have reached your savings goal target for "${g.title}" (${Calculations.formatCurrency(g.savedAmount, currency)}).`,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Trigger C: Month-over-Month High Spending Spike (> 20% increase)
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const mom = Calculations.calculateMoMComparison(state.transactions, currentMonth, prevMonth);

    if (mom.previous.expense > 0 && mom.expenseChangePct >= 20) {
      generatedAlerts.push({
        id: `alert_mom_spike_${currentMonth}`,
        type: 'warning',
        icon: 'trending-up',
        title: 'High Spending Spike Detected',
        message: `Current month expenses have surged by +${mom.expenseChangePct}% compared to last month (${Calculations.formatCurrency(mom.current.expense, currency)} vs ${Calculations.formatCurrency(mom.previous.expense, currency)}).`,
        timestamp: new Date().toISOString()
      });
    }

    // Merge without duplicates
    const readMap = JSON.parse(localStorage.getItem('spendwise_read_notifications') || '{}');
    notifications = generatedAlerts.map(a => ({
      ...a,
      isRead: Boolean(readMap[a.id])
    }));

    State.setNotifications(notifications);
    renderNotificationBadge();
    renderNotificationDropdown();
    renderDashboardAlerts();
  }

  // 2. Render Badge on Bell Icon
  function renderNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const budgetNavAlert = document.getElementById('budget-nav-alert');
    if (!badge) return;

    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Also toggle the budget nav alert dot if there are budget warnings
    const hasBudgetAlert = notifications.some(n => n.type === 'danger' || n.type === 'warning');
    if (budgetNavAlert) {
      if (hasBudgetAlert) budgetNavAlert.classList.remove('hidden');
      else budgetNavAlert.classList.add('hidden');
    }
  }

  // 3. Render Dropdown Drawer
  function renderNotificationDropdown() {
    const listContainer = document.getElementById('notification-list-container');
    if (!listContainer) return;

    if (!notifications.length) {
      listContainer.innerHTML = `
        <div class="empty-notifications">
          <i data-lucide="bell-off"></i>
          <p>No active alerts. All budgets on track!</p>
        </div>
      `;
      UI.refreshIcons();
      return;
    }

    listContainer.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.type} ${n.isRead ? '' : 'unread'}">
        <i data-lucide="${n.icon}"></i>
        <div style="flex: 1;">
          <strong style="display: block; font-size: 0.82rem;">${UI.escapeHtml(n.title)}</strong>
          <span style="color: var(--text-secondary); font-size: 0.75rem; line-height: 1.3; display: block;">${UI.escapeHtml(n.message)}</span>
        </div>
      </div>
    `).join('');

    UI.refreshIcons();
  }

  // 4. Render Active Alerts on Dashboard Banner
  function renderDashboardAlerts() {
    const container = document.getElementById('dash-alerts-container');
    if (!container) return;

    const activeWarnings = notifications.filter(n => n.type === 'danger' || n.type === 'warning');
    if (!activeWarnings.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = activeWarnings.map(n => `
      <div class="alert-item ${n.type}">
        <i data-lucide="${n.icon}"></i>
        <div>
          <strong>${UI.escapeHtml(n.title)}:</strong>
          <span>${UI.escapeHtml(n.message)}</span>
        </div>
      </div>
    `).join('');

    UI.refreshIcons();
  }

  // 5. Mark All Notifications as Read
  function markAllAsRead() {
    const readMap = {};
    notifications.forEach(n => {
      n.isRead = true;
      readMap[n.id] = true;
    });
    localStorage.setItem('spendwise_read_notifications', JSON.stringify(readMap));
    renderNotificationBadge();
    renderNotificationDropdown();
    UI.showToast('All notifications marked as read.', 'info');
  }

  // 6. Explicit Celebration for Savings Goals
  function createMilestoneAlert(goalTitle) {
    UI.showToast(`🎉 Congratulations! You achieved your savings goal: "${goalTitle}"!`, 'success', 5000);
    evaluateTriggers();
  }

  return {
    evaluateTriggers,
    markAllAsRead,
    renderDashboardAlerts,
    createMilestoneAlert
  };
})();
