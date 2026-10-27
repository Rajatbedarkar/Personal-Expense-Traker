// SpendWise - Chart.js 4 Interactive Visualizations & Analytics Engine

const Charts = (function() {
  let chartDashCategory = null;
  let chartDashCashflow = null;
  let chartAnaCategory = null;
  let chartAnaIncomeExpense = null;
  let chartAnaSpendingTrend = null;
  let chartAnaBudgetCompare = null;
  let chartAnaSavingsTrend = null;

  // Helpers to get current theme colors
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
      tooltipBorder: isDark ? '#334155' : '#e2e8f0'
    };
  }

  // -------------------------------------------------------------------------
  // 1. DASHBOARD CHARTS
  // -------------------------------------------------------------------------

  function renderDashboardCharts() {
    renderDashCategoryChart();
    renderDashCashflowChart();
  }

  // A. Expenses by Category Doughnut
  function renderDashCategoryChart() {
    const canvas = document.getElementById('chart-dash-category');
    if (!canvas) return;

    const state = State.getState();
    const currentMonth = state.selectedMonth;
    const { breakdown } = Calculations.calculateCategoryBreakdown(state.transactions, currentMonth);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = breakdown.length ? breakdown.map(b => b.category) : ['No Expenses'];
    const dataValues = breakdown.length ? breakdown.map(b => b.total) : [1];
    
    // Category Colors
    const backgroundColors = breakdown.length ? breakdown.map(b => {
      const cat = state.categories.find(c => c.name === b.category);
      return cat ? cat.color : '#94a3b8';
    }) : ['#334155'];

    if (chartDashCategory) {
      chartDashCategory.destroy();
    }

    chartDashCategory = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: dataValues,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: theme.tooltipBg
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              padding: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                if (!breakdown.length) return 'No expense records yet';
                const val = ctx.raw || 0;
                return ` ${ctx.label}: ${Calculations.formatCurrency(val, currency)}`;
              }
            }
          }
        },
        cutout: '72%'
      }
    });
  }

  // B. Monthly Cashflow Bar Chart (Last 6 Months)
  function renderDashCashflowChart() {
    const canvas = document.getElementById('chart-dash-cashflow');
    if (!canvas) return;

    const state = State.getState();
    const months = getLastNMonths(6);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = [];
    const incomeData = [];
    const expenseData = [];

    months.forEach(mStr => {
      const [y, m] = mStr.split('-');
      const d = new Date(y, m - 1, 1);
      labels.push(d.toLocaleDateString('en-US', { month: 'short' }));

      const totals = Calculations.calculateTotals(state.transactions, t => t.date && t.date.startsWith(mStr));
      incomeData.push(totals.income);
      expenseData.push(totals.expense);
    });

    if (chartDashCashflow) {
      chartDashCashflow.destroy();
    }

    chartDashCashflow = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Expense',
            data: expenseData,
            backgroundColor: '#f43f5e',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: theme.gridColor },
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Calculations.formatCurrency(val, currency).replace('.00', '')
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: theme.textColor, usePointStyle: true, font: { family: 'Plus Jakarta Sans' } }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${Calculations.formatCurrency(ctx.raw, currency)}`
            }
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 2. DETAILED ANALYTICS CHARTS (5 Distinct Views)
  // -------------------------------------------------------------------------

  function renderAnalyticsCharts() {
    renderAnalyticsMetrics();
    renderAnaCategoryDoughnut();
    renderAnaIncomeExpenseBar();
    renderAnaSpendingTrendLine();
    renderAnaBudgetComparisonBar();
    renderAnaSavingsTrendArea();
  }

  function updateAnalyticsPeriod() {
    renderAnalyticsCharts();
  }

  // High-level analytics metrics
  function renderAnalyticsMetrics() {
    const state = State.getState();
    const period = document.getElementById('analytics-period')?.value || 'last-6-months';
    const filteredTx = filterTransactionsByAnalyticsPeriod(state.transactions, period);
    const currency = state.settings.currency;

    const expenses = filteredTx.filter(t => t.type === 'expense');
    const totals = Calculations.calculateTotals(filteredTx);

    // 1. Avg Daily Spending
    const dayCount = Math.max(1, getPeriodDayCount(period));
    const avgDaily = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0) / dayCount;
    document.getElementById('ana-avg-daily').textContent = Calculations.formatCurrency(avgDaily, currency);

    // 2. Top Spending Category
    const { breakdown } = Calculations.calculateCategoryBreakdown(filteredTx);
    if (breakdown.length) {
      document.getElementById('ana-top-cat').textContent = breakdown[0].category;
      document.getElementById('ana-top-cat-amount').textContent = `${Calculations.formatCurrency(breakdown[0].total, currency)} (${breakdown[0].percentage}%)`;
    } else {
      document.getElementById('ana-top-cat').textContent = 'None';
      document.getElementById('ana-top-cat-amount').textContent = '₹0.00 spent';
    }

    // 3. Highest Single Expense
    if (expenses.length) {
      const maxTx = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      document.getElementById('ana-max-expense').textContent = Calculations.formatCurrency(maxTx.amount, currency);
      document.getElementById('ana-max-expense-title').textContent = `${maxTx.title} (${maxTx.category})`;
    } else {
      document.getElementById('ana-max-expense').textContent = '₹0.00';
      document.getElementById('ana-max-expense-title').textContent = 'None';
    }

    // 4. Effective Savings Rate
    document.getElementById('ana-savings-rate').textContent = `${totals.savingsRate}%`;
  }

  // 1. Doughnut: Expenses by Category
  function renderAnaCategoryDoughnut() {
    const canvas = document.getElementById('chart-ana-category');
    if (!canvas) return;

    const state = State.getState();
    const period = document.getElementById('analytics-period')?.value || 'last-6-months';
    const filteredTx = filterTransactionsByAnalyticsPeriod(state.transactions, period);
    const { breakdown } = Calculations.calculateCategoryBreakdown(filteredTx);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = breakdown.length ? breakdown.map(b => b.category) : ['No Data'];
    const dataValues = breakdown.length ? breakdown.map(b => b.total) : [1];
    const bgColors = breakdown.length ? breakdown.map(b => {
      const cat = state.categories.find(c => c.name === b.category);
      return cat ? cat.color : '#94a3b8';
    }) : ['#334155'];

    if (chartAnaCategory) chartAnaCategory.destroy();

    chartAnaCategory = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 2, borderColor: theme.tooltipBg }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: theme.textColor, usePointStyle: true, font: { size: 11 } } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${Calculations.formatCurrency(ctx.raw, currency)}`
            }
          }
        }
      }
    });
  }

  // 2. Bar: Monthly Income vs Expenses
  function renderAnaIncomeExpenseBar() {
    const canvas = document.getElementById('chart-ana-income-expense');
    if (!canvas) return;

    const state = State.getState();
    const months = getLastNMonths(6);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = [];
    const incomes = [];
    const expenses = [];

    months.forEach(mStr => {
      const [y, m] = mStr.split('-');
      labels.push(new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
      const totals = Calculations.calculateTotals(state.transactions, t => t.date && t.date.startsWith(mStr));
      incomes.push(totals.income);
      expenses.push(totals.expense);
    });

    if (chartAnaIncomeExpense) chartAnaIncomeExpense.destroy();

    chartAnaIncomeExpense = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Total Income', data: incomes, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Total Expense', data: expenses, backgroundColor: '#f43f5e', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: theme.textColor }, grid: { display: false } },
          y: {
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Calculations.formatCurrency(val, currency).replace('.00', '')
            },
            grid: { color: theme.gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: theme.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Calculations.formatCurrency(ctx.raw, currency)}` }
          }
        }
      }
    });
  }

  // 3. Line Chart: Spending Trends Over Time
  function renderAnaSpendingTrendLine() {
    const canvas = document.getElementById('chart-ana-spending-trend');
    if (!canvas) return;

    const state = State.getState();
    const period = document.getElementById('analytics-period')?.value || 'last-6-months';
    const filteredTx = filterTransactionsByAnalyticsPeriod(state.transactions, period)
      .filter(t => t.type === 'expense');

    // Group daily expenses
    const dailyMap = {};
    filteredTx.forEach(tx => {
      dailyMap[tx.date] = (dailyMap[tx.date] || 0) + (Number(tx.amount) || 0);
    });

    const sortedDates = Object.keys(dailyMap).sort();
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = sortedDates.length ? sortedDates.map(d => Calculations.formatDate(d, 'DD/MM')) : ['No Activity'];
    const dataValues = sortedDates.length ? sortedDates.map(d => dailyMap[d]) : [0];

    if (chartAnaSpendingTrend) chartAnaSpendingTrend.destroy();

    chartAnaSpendingTrend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Spending Trend',
          data: dataValues,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: theme.textColor }, grid: { display: false } },
          y: {
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Calculations.formatCurrency(val, currency).replace('.00', '')
            },
            grid: { color: theme.gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: theme.textColor } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: { label: ctx => ` Spent: ${Calculations.formatCurrency(ctx.raw, currency)}` }
          }
        }
      }
    });
  }

  // 4. Horizontal Bar Chart: Budget vs Actual Spending by Category
  function renderAnaBudgetComparisonBar() {
    const canvas = document.getElementById('chart-ana-budget-compare');
    if (!canvas) return;

    const state = State.getState();
    const currentMonth = state.selectedMonth;
    const budgetStatus = Calculations.evaluateBudgets(state.budgets, state.transactions, currentMonth);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = [];
    const budgetLimits = [];
    const actualSpents = [];

    budgetStatus.categories.forEach(item => {
      labels.push(item.category);
      budgetLimits.push(item.limit);
      actualSpents.push(item.spent);
    });

    if (!labels.length) {
      labels.push('No Budgets Set');
      budgetLimits.push(0);
      actualSpents.push(0);
    }

    if (chartAnaBudgetCompare) chartAnaBudgetCompare.destroy();

    chartAnaBudgetCompare = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Budget Limit', data: budgetLimits, backgroundColor: 'rgba(99, 102, 241, 0.4)', borderRadius: 4 },
          { label: 'Actual Spent', data: actualSpents, backgroundColor: '#f43f5e', borderRadius: 4 }
        ]
      },
      options: {
        indexAxis: 'y', // Horizontal Bar
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              color: theme.textColor,
              callback: val => Calculations.formatCurrency(val, currency).replace('.00', '')
            },
            grid: { color: theme.gridColor }
          },
          y: { ticks: { color: theme.textColor }, grid: { display: false } }
        },
        plugins: {
          legend: { labels: { color: theme.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Calculations.formatCurrency(ctx.raw, currency)}` }
          }
        }
      }
    });
  }

  // 5. Savings Chart: Monthly Savings Trends & Trajectory
  function renderAnaSavingsTrendArea() {
    const canvas = document.getElementById('chart-ana-savings-trend');
    if (!canvas) return;

    const state = State.getState();
    const months = getLastNMonths(6);
    const theme = getThemeColors();
    const currency = state.settings.currency;

    const labels = [];
    const monthlyNetSavings = [];
    let cumulative = 0;
    const cumulativeSavings = [];

    months.forEach(mStr => {
      const [y, m] = mStr.split('-');
      labels.push(new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }));

      const totals = Calculations.calculateTotals(state.transactions, t => t.date && t.date.startsWith(mStr));
      const net = Math.max(0, totals.netCashFlow);
      monthlyNetSavings.push(net);
      cumulative += net;
      cumulativeSavings.push(cumulative);
    });

    if (chartAnaSavingsTrend) chartAnaSavingsTrend.destroy();

    chartAnaSavingsTrend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly Net Savings (Inflow - Outflow)',
            data: monthlyNetSavings,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 4
          },
          {
            label: 'Cumulative Accumulated Savings',
            data: cumulativeSavings,
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            fill: false,
            tension: 0.25,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: theme.textColor }, grid: { display: false } },
          y: {
            ticks: {
              color: theme.textColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: val => Calculations.formatCurrency(val, currency).replace('.00', '')
            },
            grid: { color: theme.gridColor }
          }
        },
        plugins: {
          legend: { labels: { color: theme.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Calculations.formatCurrency(ctx.raw, currency)}` }
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // HELPER UTILITIES
  // -------------------------------------------------------------------------

  function getLastNMonths(n = 6) {
    const list = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      list.push(`${y}-${m}`);
    }
    return list;
  }

  function filterTransactionsByAnalyticsPeriod(transactions, period) {
    const now = new Date();
    if (period === 'this-month') {
      const curStr = now.toISOString().substring(0, 7);
      return transactions.filter(t => t.date && t.date.startsWith(curStr));
    }
    if (period === 'last-3-months') {
      const months = getLastNMonths(3);
      return transactions.filter(t => t.date && months.some(m => t.date.startsWith(m)));
    }
    if (period === 'last-6-months') {
      const months = getLastNMonths(6);
      return transactions.filter(t => t.date && months.some(m => t.date.startsWith(m)));
    }
    if (period === 'this-year') {
      const yearStr = String(now.getFullYear());
      return transactions.filter(t => t.date && t.date.startsWith(yearStr));
    }
    return transactions;
  }

  function getPeriodDayCount(period) {
    if (period === 'this-month') return new Date().getDate();
    if (period === 'last-3-months') return 90;
    if (period === 'last-6-months') return 180;
    if (period === 'this-year') return 300;
    return 180;
  }

  function refreshTheme() {
    renderDashboardCharts();
    const activeView = State.getState().activeView;
    if (activeView === 'analytics') {
      renderAnalyticsCharts();
    }
  }

  return {
    renderDashboardCharts,
    renderAnalyticsCharts,
    updateAnalyticsPeriod,
    refreshTheme
  };
})();
