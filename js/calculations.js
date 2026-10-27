// SpendWise - Pure Mathematical Financial Calculations & Formatters

const Calculations = (function() {

  // 1. Calculate Financial Totals for a Given Period
  function calculateTotals(transactions, filterFn = null) {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    const list = filterFn ? transactions.filter(filterFn) : transactions;

    list.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        income += amount;
        incomeCount++;
      } else if (tx.type === 'expense') {
        expense += amount;
        expenseCount++;
      }
    });

    const netCashFlow = income - expense;
    const savingsRate = income > 0 ? Math.max(0, (netCashFlow / income) * 100) : 0;

    return {
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
      savingsRate: Number(savingsRate.toFixed(1)),
      incomeCount,
      expenseCount,
      totalCount: list.length
    };
  }

  // 2. Filter Transactions by Year-Month string (e.g. '2026-10')
  function filterByMonth(transactions, yearMonthStr) {
    if (!yearMonthStr) return transactions;
    return transactions.filter(tx => {
      if (!tx.date) return false;
      return tx.date.startsWith(yearMonthStr);
    });
  }

  // 3. Spending Breakdown by Category
  function calculateCategoryBreakdown(transactions, yearMonthStr = null) {
    const list = yearMonthStr ? filterByMonth(transactions, yearMonthStr) : transactions;
    const expenseList = list.filter(t => t.type === 'expense');
    
    let totalExpense = 0;
    const map = {};

    expenseList.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      totalExpense += amt;
      const cat = tx.category || 'Other';
      if (!map[cat]) {
        map[cat] = { category: cat, total: 0, count: 0 };
      }
      map[cat].total += amt;
      map[cat].count++;
    });

    // Compute percentages and sort descending by spending
    const result = Object.values(map).map(item => {
      const pct = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
      return {
        ...item,
        total: Number(item.total.toFixed(2)),
        percentage: Number(pct.toFixed(1))
      };
    });

    result.sort((a, b) => b.total - a.total);
    return {
      breakdown: result,
      totalExpense: Number(totalExpense.toFixed(2))
    };
  }

  // 4. Budget Status & Alert Evaluation
  function evaluateBudgets(budgets, transactions, yearMonthStr) {
    const monthTx = filterByMonth(transactions, yearMonthStr).filter(t => t.type === 'expense');
    const categoryTotals = {};
    let grandTotalExpense = 0;

    monthTx.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      grandTotalExpense += amt;
      const cat = tx.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    // Find overall budget if set
    const overallBudget = budgets.find(b => b.category === 'Overall' && (b.period === yearMonthStr || !b.period));
    let overallResult = null;

    if (overallBudget) {
      const limit = Number(overallBudget.limit) || 0;
      const percent = limit > 0 ? (grandTotalExpense / limit) * 100 : 0;
      overallResult = {
        id: overallBudget.id,
        limit,
        spent: Number(grandTotalExpense.toFixed(2)),
        remaining: Math.max(0, limit - grandTotalExpense),
        percent: Number(percent.toFixed(1)),
        isWarning: percent >= 80 && percent < 100,
        isExceeded: percent >= 100
      };
    }

    // Category budgets
    const categoryResults = budgets
      .filter(b => b.category !== 'Overall' && (b.period === yearMonthStr || !b.period))
      .map(b => {
        const spent = categoryTotals[b.category] || 0;
        const limit = Number(b.limit) || 0;
        const percent = limit > 0 ? (spent / limit) * 100 : 0;
        return {
          id: b.id,
          category: b.category,
          limit,
          spent: Number(spent.toFixed(2)),
          remaining: Math.max(0, limit - spent),
          percent: Number(percent.toFixed(1)),
          isWarning: percent >= 80 && percent < 100,
          isExceeded: percent >= 100
        };
      });

    return {
      overall: overallResult,
      categories: categoryResults,
      grandTotalExpense: Number(grandTotalExpense.toFixed(2))
    };
  }

  // 5. Month-over-Month (MoM) Financial Comparison
  function calculateMoMComparison(transactions, currentMonthStr, prevMonthStr) {
    const currentTotals = calculateTotals(transactions, t => t.date && t.date.startsWith(currentMonthStr));
    const prevTotals = calculateTotals(transactions, t => t.date && t.date.startsWith(prevMonthStr));

    function getPctChange(curr, prev) {
      if (prev === 0) {
        return curr > 0 ? 100 : 0;
      }
      return ((curr - prev) / prev) * 100;
    }

    const incomeChangePct = getPctChange(currentTotals.income, prevTotals.income);
    const expenseChangePct = getPctChange(currentTotals.expense, prevTotals.expense);
    const netChangePct = getPctChange(currentTotals.netCashFlow, prevTotals.netCashFlow);

    return {
      current: currentTotals,
      previous: prevTotals,
      incomeDiff: Number((currentTotals.income - prevTotals.income).toFixed(2)),
      expenseDiff: Number((currentTotals.expense - prevTotals.expense).toFixed(2)),
      netDiff: Number((currentTotals.netCashFlow - prevTotals.netCashFlow).toFixed(2)),
      incomeChangePct: Number(incomeChangePct.toFixed(1)),
      expenseChangePct: Number(expenseChangePct.toFixed(1)),
      netChangePct: Number(netChangePct.toFixed(1))
    };
  }

  // 6. Savings Goal Monthly Required Savings Calculation
  function calculateGoalProgress(goal) {
    const target = Number(goal.targetAmount) || 0;
    const saved = Number(goal.savedAmount) || 0;
    const remaining = Math.max(0, target - saved);
    const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;

    let monthsLeft = 1;
    let daysLeft = 0;
    let isAchieved = saved >= target;

    if (goal.targetDate) {
      const now = new Date();
      const targetDate = new Date(goal.targetDate);
      const diffTime = targetDate - now;
      daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const yearDiff = targetDate.getFullYear() - now.getFullYear();
      const monthDiff = targetDate.getMonth() - now.getMonth();
      monthsLeft = Math.max(1, yearDiff * 12 + monthDiff);
    }

    const monthlyRequired = remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;

    return {
      target,
      saved,
      remaining,
      percent: Number(percent.toFixed(1)),
      daysLeft,
      monthsLeft,
      monthlyRequired,
      isAchieved
    };
  }

  // 7. Days Remaining in Selected Month
  function getDaysRemainingInMonth(yearMonthStr) {
    const now = new Date();
    const [year, month] = yearMonthStr.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    if (now.getFullYear() === year && (now.getMonth() + 1) === month) {
      const currentDay = now.getDate();
      return Math.max(0, lastDayOfMonth - currentDay);
    } else if (new Date(year, month - 1, 1) < now) {
      return 0; // Past month
    } else {
      return lastDayOfMonth; // Future month
    }
  }

  // 8. Currency Formatter (INR default with Indian numbering system)
  function formatCurrency(amount, currencyCode = 'INR') {
    const num = Number(amount) || 0;
    const symbol = (CONFIG.CURRENCIES[currencyCode] || CONFIG.CURRENCIES.INR).symbol;

    if (currencyCode === 'INR') {
      // Indian numbering system: 1,00,000.00
      try {
        const formatted = new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
        return `${symbol}${formatted}`;
      } catch (e) {
        return `${symbol}${num.toFixed(2)}`;
      }
    } else {
      try {
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(num);
        return `${symbol}${formatted}`;
      } catch (e) {
        return `${symbol}${num.toFixed(2)}`;
      }
    }
  }

  // 9. Date Formatter
  function formatDate(dateStr, format = 'DD/MM/YYYY') {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
        if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
        if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }

  return {
    calculateTotals,
    filterByMonth,
    calculateCategoryBreakdown,
    evaluateBudgets,
    calculateMoMComparison,
    calculateGoalProgress,
    getDaysRemainingInMonth,
    formatCurrency,
    formatDate
  };
})();
