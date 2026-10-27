// SpendWise - Main Application Bootstrapper & Lifecycle Orchestrator

const App = (function() {

  // 1. App Initialization Entry Point
  async function init() {
    console.log(`[SpendWise] Initializing ${CONFIG.APP_NAME} v${CONFIG.VERSION}...`);

    // Initialize Theme (Dark/Light)
    UI.initTheme();

    // Initialize Firebase / Storage Service
    FirebaseService.init();

    // Update Connection Status Pill
    updateConnectionIndicator();

    // Register Auth State Listener
    FirebaseService.onAuthStateChanged(handleAuthStateChange);

    // Reactive State Subscriptions
    State.subscribe('transactionsUpdated', () => {
      Notifications.evaluateTriggers();
      UI.renderDashboard();
    });

    State.subscribe('budgetsUpdated', () => {
      Notifications.evaluateTriggers();
      UI.renderDashboard();
    });

    // Hashchange listener for URL routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      UI.navigateTo(hash);
    });

    // Initial icon replacement
    UI.refreshIcons();
  }

  // 2. Auth State Change Handler
  async function handleAuthStateChange(user) {
    const authView = document.getElementById('auth-view');
    const appShell = document.getElementById('app-shell');

    if (user) {
      console.log(`[SpendWise] User authenticated: ${user.email} (${user.uid})`);
      State.setUser(user);

      // Update Sidebar Profile
      const usernameEl = document.getElementById('sidebar-username');
      const emailEl = document.getElementById('sidebar-email');
      const avatarEl = document.getElementById('sidebar-avatar');

      const name = user.displayName || user.email.split('@')[0];
      if (usernameEl) usernameEl.textContent = name;
      if (emailEl) emailEl.textContent = user.email;
      if (avatarEl) {
        avatarEl.textContent = name.substring(0, 2).toUpperCase();
      }

      // Show Application, Hide Auth Screen
      authView.classList.add('hidden');
      appShell.classList.remove('hidden');

      // Load User Data from Firestore / Local Engine
      await loadUserData(user.uid);

      // Determine initial route
      const initialView = window.location.hash.replace('#', '') || 'dashboard';
      UI.navigateTo(initialView);
    } else {
      console.log('[SpendWise] No active user session.');
      State.setUser(null);
      authView.classList.remove('hidden');
      appShell.classList.add('hidden');
    }

    UI.refreshIcons();
  }

  // 3. Load User Collections
  async function loadUserData(userId) {
    try {
      // 1. Categories
      const categories = await FirebaseService.getCollection(userId, 'categories');
      if (categories && categories.length) {
        State.setCategories(categories);
      } else {
        State.setCategories(CONFIG.DEFAULT_CATEGORIES);
      }

      // 2. Transactions
      const transactions = await FirebaseService.getCollection(userId, 'transactions');
      State.setTransactions(transactions);

      // 3. Budgets
      const budgets = await FirebaseService.getCollection(userId, 'budgets');
      State.setBudgets(budgets);

      // 4. Savings Goals
      const savingsGoals = await FirebaseService.getCollection(userId, 'savingsGoals');
      State.setSavingsGoals(savingsGoals);

      // 5. Settings
      const settingsDocs = await FirebaseService.getCollection(userId, 'settings');
      if (settingsDocs && settingsDocs.length) {
        State.setSettings(settingsDocs[0]);
      }

      // Populate filter categories dropdown
      Transactions.populateFilterCategoryDropdown();

      // Trigger notification evaluations
      Notifications.evaluateTriggers();
    } catch (err) {
      console.error('[SpendWise] Error loading user collections:', err);
      UI.showToast('Failed to load user financial records: ' + err.message, 'error');
    }
  }

  // 4. Update Connection Status Indicator Pill
  function updateConnectionIndicator() {
    const textEl = document.getElementById('connection-status-text');
    const pill = document.getElementById('connection-pill');
    if (!textEl) return;

    if (FirebaseService.isLive()) {
      textEl.textContent = 'Live Cloud Firestore';
      pill.title = 'Connected to Google Firebase Cloud Firestore and Authentication';
    } else {
      textEl.textContent = 'Local Sandbox Engine';
      pill.title = 'Running in Zero-Setup Offline Mode with full persistence';
    }
  }

  // 5. Auth Handlers
  async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-login-submit');
    const alertBox = document.getElementById('auth-alert');
    const alertMsg = document.getElementById('auth-alert-msg');

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing In...';
    alertBox.classList.add('hidden');

    try {
      await FirebaseService.login(email, password);
      UI.showToast('Welcome back to SpendWise!', 'success');
    } catch (err) {
      alertMsg.textContent = err.message || 'Login failed. Please check your credentials.';
      alertBox.classList.remove('hidden');
      UI.refreshIcons();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="log-in"></i> Sign In to Account';
      UI.refreshIcons();
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const submitBtn = document.getElementById('btn-register-submit');
    const alertBox = document.getElementById('auth-alert');
    const alertMsg = document.getElementById('auth-alert-msg');

    if (password.length < 6) {
      alertMsg.textContent = 'Password must be at least 6 characters.';
      alertBox.classList.remove('hidden');
      UI.refreshIcons();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating Account...';
    alertBox.classList.add('hidden');

    try {
      await FirebaseService.register(email, password, name);
      UI.showToast(`Account created successfully! Welcome, ${name}.`, 'success');
    } catch (err) {
      alertMsg.textContent = err.message || 'Registration failed. Please try again.';
      alertBox.classList.remove('hidden');
      UI.refreshIcons();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="user-check"></i> Create Account';
      UI.refreshIcons();
    }
  }

  async function loginAsDemoUser() {
    try {
      await FirebaseService.loginDemoUser();
      UI.showToast('Launched College Project Demo Mode with sample dataset!', 'success');
    } catch (err) {
      UI.showToast('Failed to start demo mode: ' + err.message, 'error');
    }
  }

  async function handleLogout() {
    UI.confirmAction(
      'Sign Out',
      'Are you sure you want to log out of your SpendWise session?',
      async () => {
        try {
          await FirebaseService.logout();
          UI.showToast('Logged out successfully.', 'info');
        } catch (err) {
          UI.showToast('Logout error: ' + err.message, 'error');
        }
      }
    );
  }

  return {
    init,
    handleLogin,
    handleRegister,
    loginAsDemoUser,
    handleLogout
  };
})();

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
