// SpendWise - Settings, Preferences, Category Management, & Data Portability Controller

const Settings = (function() {

  // 1. Save User Profile
  async function handleSaveProfile(event) {
    event.preventDefault();
    const nameInput = document.getElementById('settings-display-name');
    const newName = nameInput.value.trim();
    if (!newName) {
      UI.showToast('Please enter a display name.', 'warning');
      return;
    }

    const state = State.getState();
    const user = state.currentUser;
    if (!user) return;

    user.displayName = newName;
    State.setUser(user);

    // Save in session
    localStorage.setItem('spendwise_active_session', JSON.stringify(user));
    
    // Update sidebar UI
    document.getElementById('sidebar-username').textContent = newName;
    document.getElementById('sidebar-avatar').textContent = newName.substring(0, 2).toUpperCase();

    UI.showToast('Profile updated successfully!', 'success');
    UI.renderDashboard();
  }

  // 2. Change Currency Preference
  function handleCurrencyChange(code) {
    State.setSettings({ currency: code });
    saveSettingsToStorage();
    
    // Update currency symbol display in modals
    const sym = (CONFIG.CURRENCIES[code] || CONFIG.CURRENCIES.INR).symbol;
    document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = sym);

    UI.showToast(`Default currency changed to ${code} (${sym})`, 'info');
    UI.renderDashboard();
    Charts.renderDashboardCharts();
  }

  // 3. Change Date Format Preference
  function handleDateFormatChange(fmt) {
    State.setSettings({ dateFormat: fmt });
    saveSettingsToStorage();
    UI.showToast(`Date format changed to ${fmt}`, 'info');
    UI.renderDashboard();
    Transactions.applyFilters();
  }

  function saveSettingsToStorage() {
    const state = State.getState();
    const userId = state.currentUser?.uid;
    if (userId) {
      localStorage.setItem(`spendwise_${userId}_settings`, JSON.stringify([state.settings]));
    }
  }

  // 4. Save Custom Category
  async function handleSaveCategory(event) {
    event.preventDefault();
    const name = document.getElementById('cat-name-input').value.trim();
    const type = document.getElementById('cat-type-select').value;
    const color = document.getElementById('cat-color-input').value;
    const icon = document.getElementById('cat-icon-select').value;

    if (!name) {
      UI.showToast('Category name is required.', 'warning');
      return;
    }

    const state = State.getState();
    const exists = state.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      UI.showToast('A category with this name already exists.', 'warning');
      return;
    }

    const newCat = {
      id: 'cat_custom_' + Date.now(),
      name,
      type,
      color,
      icon,
      isDefault: false
    };

    const updatedCategories = [...state.categories, newCat];
    State.setCategories(updatedCategories);

    // Persist to storage
    const userId = state.currentUser?.uid;
    if (userId) {
      localStorage.setItem(`spendwise_${userId}_categories`, JSON.stringify(updatedCategories));
    }

    UI.closeModal('modal-category');
    UI.showToast(`Custom category "${name}" added!`, 'success');
    
    renderCategoryManager();
    Transactions.populateFilterCategoryDropdown();
  }

  // 5. Delete Custom Category
  function deleteCategory(catId) {
    const state = State.getState();
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;

    if (cat.isDefault) {
      UI.showToast('Default system categories cannot be deleted.', 'warning');
      return;
    }

    UI.confirmAction(
      'Delete Category',
      `Delete category "${cat.name}"? Transactions using this category will retain their label.`,
      () => {
        const updated = state.categories.filter(c => c.id !== catId);
        State.setCategories(updated);

        const userId = state.currentUser?.uid;
        if (userId) {
          localStorage.setItem(`spendwise_${userId}_categories`, JSON.stringify(updated));
        }

        UI.showToast(`Category "${cat.name}" deleted.`, 'info');
        renderCategoryManager();
        Transactions.populateFilterCategoryDropdown();
      }
    );
  }

  // 6. Render Category Manager List
  function renderCategoryManager() {
    const list = document.getElementById('settings-category-list');
    if (!list) return;

    const categories = State.getState().categories;

    list.innerHTML = categories.map(cat => `
      <div class="cat-pill">
        <div class="cat-pill-left">
          <span class="cat-pill-dot" style="background: ${cat.color};"></span>
          <span>${UI.escapeHtml(cat.name)}</span>
          <small style="font-size: 0.68rem; color: var(--text-muted);">(${cat.type})</small>
        </div>
        ${!cat.isDefault ? `
          <button class="btn-icon delete" style="padding: 2px;" onclick="Settings.deleteCategory('${cat.id}')" title="Delete Category">
            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: var(--color-expense);"></i>
          </button>
        ` : `
          <span style="font-size: 0.65rem; color: var(--text-muted); padding: 0.1rem 0.35rem; background: var(--bg-card); border-radius: 4px;">Default</span>
        `}
      </div>
    `).join('');

    UI.refreshIcons();
  }

  // 7. Save Firebase Configuration
  function handleSaveFirebaseConfig(event) {
    event.preventDefault();
    const apiKey = document.getElementById('cfg-api-key').value.trim();
    const authDomain = document.getElementById('cfg-auth-domain').value.trim();
    const projectId = document.getElementById('cfg-project-id').value.trim();
    const storageBucket = document.getElementById('cfg-storage-bucket').value.trim();
    const messagingSenderId = document.getElementById('cfg-messaging-sender-id').value.trim();
    const appId = document.getElementById('cfg-app-id').value.trim();

    localStorage.setItem('spendwise_fb_api_key', apiKey);
    localStorage.setItem('spendwise_fb_auth_domain', authDomain);
    localStorage.setItem('spendwise_fb_project_id', projectId);
    localStorage.setItem('spendwise_fb_storage_bucket', storageBucket);
    localStorage.setItem('spendwise_fb_messaging_sender_id', messagingSenderId);
    localStorage.setItem('spendwise_fb_app_id', appId);

    CONFIG.FIREBASE.apiKey = apiKey;
    CONFIG.FIREBASE.authDomain = authDomain;
    CONFIG.FIREBASE.projectId = projectId;
    CONFIG.FIREBASE.storageBucket = storageBucket;
    CONFIG.FIREBASE.messagingSenderId = messagingSenderId;
    CONFIG.FIREBASE.appId = appId;

    UI.closeModal('modal-firebase-config');
    UI.showToast('Firebase configuration saved. Reloading app...', 'success');

    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  // 8. Export All Data as JSON
  function exportDataJSON() {
    const state = State.getState();
    const exportBundle = {
      app: 'SpendWise',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: state.currentUser,
      settings: state.settings,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      savingsGoals: state.savingsGoals
    };

    const jsonStr = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `SpendWise_Backup_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    UI.showToast('Complete JSON database backup downloaded!', 'success');
  }

  // 9. Import Data from JSON
  function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.app || data.app !== 'SpendWise') {
          throw new Error('Unrecognized JSON backup file format.');
        }

        const userId = State.getState().currentUser?.uid;
        if (!userId) return;

        if (Array.isArray(data.transactions)) {
          State.setTransactions(data.transactions);
          localStorage.setItem(`spendwise_${userId}_transactions`, JSON.stringify(data.transactions));
        }
        if (Array.isArray(data.budgets)) {
          State.setBudgets(data.budgets);
          localStorage.setItem(`spendwise_${userId}_budgets`, JSON.stringify(data.budgets));
        }
        if (Array.isArray(data.savingsGoals)) {
          State.setSavingsGoals(data.savingsGoals);
          localStorage.setItem(`spendwise_${userId}_savingsGoals`, JSON.stringify(data.savingsGoals));
        }
        if (Array.isArray(data.categories)) {
          State.setCategories(data.categories);
          localStorage.setItem(`spendwise_${userId}_categories`, JSON.stringify(data.categories));
        }

        UI.showToast('Data restored successfully from backup!', 'success');
        UI.renderDashboard();
        Charts.renderDashboardCharts();
      } catch (err) {
        UI.showToast('Import failed: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  }

  // 10. Load Sample College Dataset
  function loadSampleData() {
    UI.confirmAction(
      'Preload Sample Data',
      'This will populate realistic college student income, expenses, budgets, and savings goals for evaluation. Continue?',
      () => {
        const userId = State.getState().currentUser?.uid;
        if (!userId) return;

        FirebaseService.initDefaultUserData(userId, true);
        
        // Reload into state
        const txs = JSON.parse(localStorage.getItem(`spendwise_${userId}_transactions`) || '[]');
        const bgs = JSON.parse(localStorage.getItem(`spendwise_${userId}_budgets`) || '[]');
        const sgs = JSON.parse(localStorage.getItem(`spendwise_${userId}_savingsGoals`) || '[]');

        State.setTransactions(txs);
        State.setBudgets(bgs);
        State.setSavingsGoals(sgs);

        UI.showToast('Realistic college project sample dataset loaded!', 'success');
        UI.renderDashboard();
        Charts.renderDashboardCharts();
        Transactions.applyFilters();
      }
    );
  }

  // 11. Clear All User Data
  function confirmClearAllData() {
    UI.confirmAction(
      'Reset All Data',
      'DANGER: This will permanently delete all your transactions, budgets, and savings goals. Are you sure?',
      () => {
        const userId = State.getState().currentUser?.uid;
        if (!userId) return;

        localStorage.removeItem(`spendwise_${userId}_transactions`);
        localStorage.removeItem(`spendwise_${userId}_budgets`);
        localStorage.removeItem(`spendwise_${userId}_savingsGoals`);
        
        State.setTransactions([]);
        State.setBudgets([]);
        State.setSavingsGoals([]);

        UI.showToast('All financial records have been reset.', 'info');
        UI.renderDashboard();
        Charts.renderDashboardCharts();
        Transactions.applyFilters();
      }
    );
  }

  // 12. Render Settings View
  function render() {
    const state = State.getState();
    const user = state.currentUser;

    if (user) {
      document.getElementById('settings-display-name').value = user.displayName || '';
      document.getElementById('settings-user-email').value = user.email || '';
    }

    document.getElementById('settings-currency').value = state.settings.currency || 'INR';
    document.getElementById('settings-date-format').value = state.settings.dateFormat || 'DD/MM/YYYY';

    // Update Firebase engine badge
    const fbBadge = document.getElementById('firebase-active-badge');
    if (fbBadge) {
      if (FirebaseService.isLive()) {
        fbBadge.textContent = 'Active Engine: Live Google Firebase Firestore & Auth';
        fbBadge.style.background = 'var(--color-income-bg)';
        fbBadge.style.color = 'var(--color-income)';
      } else {
        fbBadge.textContent = 'Active Engine: High-Speed Local Sandbox Engine';
        fbBadge.style.background = 'var(--color-primary-light)';
        fbBadge.style.color = 'var(--color-primary)';
      }
    }

    renderCategoryManager();
  }

  return {
    handleSaveProfile,
    handleCurrencyChange,
    handleDateFormatChange,
    handleSaveCategory,
    deleteCategory,
    handleSaveFirebaseConfig,
    exportDataJSON,
    importDataJSON,
    loadSampleData,
    confirmClearAllData,
    render
  };
})();
