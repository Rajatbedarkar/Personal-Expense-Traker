// SpendWise - Global Configuration and Constants

const CONFIG = {
  APP_NAME: 'SpendWise',
  VERSION: '1.0.0',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_DATE_FORMAT: 'DD/MM/YYYY',
  DEFAULT_THEME: 'dark',
  PAGINATION_LIMIT: 10,

  // Firebase Web App Configuration
  // Can be populated directly or configured via the UI Settings / localStorage
  FIREBASE: {
    apiKey: localStorage.getItem('spendwise_fb_api_key') || '',
    authDomain: localStorage.getItem('spendwise_fb_auth_domain') || '',
    projectId: localStorage.getItem('spendwise_fb_project_id') || '',
    storageBucket: localStorage.getItem('spendwise_fb_storage_bucket') || '',
    messagingSenderId: localStorage.getItem('spendwise_fb_messaging_sender_id') || '',
    appId: localStorage.getItem('spendwise_fb_app_id') || ''
  },

  // Supported Currencies
  CURRENCIES: {
    INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
    EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
    GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
    JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' }
  },

  // Standard Default Categories (14 Categories)
  DEFAULT_CATEGORIES: [
    { id: 'cat_food', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#f59e0b', isDefault: true },
    { id: 'cat_transport', name: 'Transportation', type: 'expense', icon: 'car', color: '#3b82f6', isDefault: true },
    { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#ec4899', isDefault: true },
    { id: 'cat_education', name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#8b5cf6', isDefault: true },
    { id: 'cat_bills', name: 'Bills & Utilities', type: 'expense', icon: 'zap', color: '#eab308', isDefault: true },
    { id: 'cat_healthcare', name: 'Healthcare', type: 'expense', icon: 'heart-pulse', color: '#ef4444', isDefault: true },
    { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'film', color: '#14b8a6', isDefault: true },
    { id: 'cat_travel', name: 'Travel', type: 'expense', icon: 'plane', color: '#06b6d4', isDefault: true },
    { id: 'cat_rent', name: 'Rent & Housing', type: 'expense', icon: 'home', color: '#6366f1', isDefault: true },
    { id: 'cat_personal', name: 'Personal Care', type: 'expense', icon: 'sparkles', color: '#d946ef', isDefault: true },
    { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'wallet', color: '#10b981', isDefault: true },
    { id: 'cat_freelance', name: 'Freelance Income', type: 'income', icon: 'laptop', color: '#059669', isDefault: true },
    { id: 'cat_other_income', name: 'Other Income', type: 'income', icon: 'circle-dollar-sign', color: '#10b981', isDefault: true },
    { id: 'cat_other_expense', name: 'Other Expense', type: 'expense', icon: 'more-horizontal', color: '#64748b', isDefault: true }
  ]
};

// Check if Firebase Client credentials are validly supplied
function isFirebaseConfigured() {
  return Boolean(
    CONFIG.FIREBASE.apiKey &&
    CONFIG.FIREBASE.projectId &&
    !CONFIG.FIREBASE.apiKey.includes('your-') &&
    CONFIG.FIREBASE.apiKey.length > 10
  );
}
