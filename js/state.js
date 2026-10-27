// SpendWise - Reactive Central State Store

const State = (function() {
  const state = {
    currentUser: null,
    transactions: [],
    budgets: [],
    savingsGoals: [],
    categories: [...CONFIG.DEFAULT_CATEGORIES],
    settings: {
      currency: CONFIG.DEFAULT_CURRENCY,
      dateFormat: CONFIG.DEFAULT_DATE_FORMAT,
      theme: CONFIG.DEFAULT_THEME
    },
    notifications: [],
    activeView: 'dashboard',
    selectedMonth: new Date().toISOString().substring(0, 7) // '2026-10'
  };

  const listeners = {};

  function getState() {
    return state;
  }

  function subscribe(event, callback) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push(callback);
    return () => {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    };
  }

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[State Error] in listener for '${event}':`, err);
        }
      });
    }
    // Also emit catch-all stateChanged
    if (event !== 'stateChanged' && listeners['stateChanged']) {
      listeners['stateChanged'].forEach(cb => {
        try {
          cb(state);
        } catch (e) {}
      });
    }
  }

  // State Mutators
  function setUser(user) {
    state.currentUser = user;
    emit('userChanged', user);
  }

  function setTransactions(list) {
    state.transactions = Array.isArray(list) ? list : [];
    emit('transactionsUpdated', state.transactions);
  }

  function addTransaction(tx) {
    state.transactions.unshift(tx);
    emit('transactionsUpdated', state.transactions);
  }

  function updateTransaction(tx) {
    const idx = state.transactions.findIndex(t => t.id === tx.id);
    if (idx !== -1) {
      state.transactions[idx] = { ...state.transactions[idx], ...tx };
      emit('transactionsUpdated', state.transactions);
    }
  }

  function removeTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    emit('transactionsUpdated', state.transactions);
  }

  function setBudgets(list) {
    state.budgets = Array.isArray(list) ? list : [];
    emit('budgetsUpdated', state.budgets);
  }

  function setSavingsGoals(list) {
    state.savingsGoals = Array.isArray(list) ? list : [];
    emit('savingsGoalsUpdated', state.savingsGoals);
  }

  function setCategories(list) {
    state.categories = Array.isArray(list) ? list : [...CONFIG.DEFAULT_CATEGORIES];
    emit('categoriesUpdated', state.categories);
  }

  function setSettings(obj) {
    state.settings = { ...state.settings, ...obj };
    emit('settingsUpdated', state.settings);
  }

  function setNotifications(list) {
    state.notifications = list;
    emit('notificationsUpdated', state.notifications);
  }

  function setSelectedMonth(monthStr) {
    state.selectedMonth = monthStr;
    emit('selectedMonthChanged', monthStr);
  }

  return {
    getState,
    subscribe,
    emit,
    setUser,
    setTransactions,
    addTransaction,
    updateTransaction,
    removeTransaction,
    setBudgets,
    setSavingsGoals,
    setCategories,
    setSettings,
    setNotifications,
    setSelectedMonth
  };
})();
