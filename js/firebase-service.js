// SpendWise - Dual-Engine Firebase Service
// Automatically routes requests to Live Firebase Authentication & Firestore
// OR high-performance Local Sandbox Engine if credentials are not configured yet.

const FirebaseService = (function() {
  let isLiveFirebase = false;
  let authInstance = null;
  let firestoreInstance = null;
  let authStateCallback = null;

  // Initialize service
  function init() {
    if (isFirebaseConfigured() && typeof firebase !== 'undefined') {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(CONFIG.FIREBASE);
        }
        authInstance = firebase.auth();
        firestoreInstance = firebase.firestore();
        isLiveFirebase = true;
        console.log('[FirebaseService] Live Firebase Auth & Cloud Firestore initialized.');
      } catch (err) {
        console.warn('[FirebaseService] Failed to initialize live Firebase, falling back to Local Engine:', err.message);
        isLiveFirebase = false;
      }
    } else {
      console.log('[FirebaseService] Using Local Sandbox Storage Engine (Full Persistence Mode).');
      isLiveFirebase = false;
    }
  }

  // -------------------------------------------------------------------------
  // AUTHENTICATION METHODS
  // -------------------------------------------------------------------------

  async function register(email, password, displayName) {
    if (isLiveFirebase && authInstance) {
      const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: displayName || email.split('@')[0] });
      
      // Initialize user settings document in Firestore
      const user = userCredential.user;
      await firestoreInstance.collection('users').doc(user.uid).set({
        email: user.email,
        displayName: displayName || user.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.email.split('@')[0]
      };
    } else {
      // Local Sandbox Mode
      const users = JSON.parse(localStorage.getItem('spendwise_local_users') || '[]');
      const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        throw new Error('An account with this email address already exists.');
      }

      const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newUser = {
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        passwordHash: btoa(password), // simple local encoding
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem('spendwise_local_users', JSON.stringify(users));
      localStorage.setItem('spendwise_active_session', JSON.stringify({
        uid: newUser.uid,
        email: newUser.email,
        displayName: newUser.displayName
      }));

      // Initialize default categories for new local user
      initDefaultUserData(uid);

      if (authStateCallback) authStateCallback(newUser);
      return newUser;
    }
  }

  async function login(email, password) {
    if (isLiveFirebase && authInstance) {
      const cred = await authInstance.signInWithEmailAndPassword(email, password);
      return {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email.split('@')[0]
      };
    } else {
      // Local Sandbox Mode
      const users = JSON.parse(localStorage.getItem('spendwise_local_users') || '[]');
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        throw new Error('No user found with this email. Please check your credentials or register.');
      }
      if (user.passwordHash !== btoa(password)) {
        throw new Error('Incorrect password. Please try again.');
      }

      const session = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      };
      localStorage.setItem('spendwise_active_session', JSON.stringify(session));
      if (authStateCallback) authStateCallback(session);
      return session;
    }
  }

  async function loginDemoUser() {
    const demoUser = {
      uid: 'college_demo_uid_2026',
      email: 'student@college-project.edu',
      displayName: 'Rajat Sharma (Student)'
    };

    localStorage.setItem('spendwise_active_session', JSON.stringify(demoUser));

    // Ensure realistic college demo dataset is seeded
    initDefaultUserData(demoUser.uid, true);

    if (authStateCallback) authStateCallback(demoUser);
    return demoUser;
  }

  async function logout() {
    if (isLiveFirebase && authInstance) {
      await authInstance.signOut();
    } else {
      localStorage.removeItem('spendwise_active_session');
      if (authStateCallback) authStateCallback(null);
    }
  }

  function onAuthStateChanged(callback) {
    authStateCallback = callback;
    if (isLiveFirebase && authInstance) {
      authInstance.onAuthStateChanged(user => {
        if (user) {
          callback({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0]
          });
        } else {
          callback(null);
        }
      });
    } else {
      // Check stored session
      const savedSession = localStorage.getItem('spendwise_active_session');
      if (savedSession) {
        try {
          callback(JSON.parse(savedSession));
        } catch (e) {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  }

  // -------------------------------------------------------------------------
  // FIRESTORE CRUD OPERATIONS (Strict User Isolation)
  // -------------------------------------------------------------------------

  // Generic Get Collection
  async function getCollection(userId, collectionName) {
    if (!userId) throw new Error('User ID is required for data isolation.');

    if (isLiveFirebase && firestoreInstance) {
      const snapshot = await firestoreInstance
        .collection('users')
        .doc(userId)
        .collection(collectionName)
        .get();

      const items = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      return items;
    } else {
      const storageKey = `spendwise_${userId}_${collectionName}`;
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    }
  }

  // Generic Add Document
  async function addDocument(userId, collectionName, data) {
    if (!userId) throw new Error('User ID is required for data isolation.');

    if (isLiveFirebase && firestoreInstance) {
      const docRef = await firestoreInstance
        .collection('users')
        .doc(userId)
        .collection(collectionName)
        .add({
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      return { id: docRef.id, ...data };
    } else {
      const storageKey = `spendwise_${userId}_${collectionName}`;
      const items = await getCollection(userId, collectionName);
      const newId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const doc = {
        id: newId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      items.push(doc);
      localStorage.setItem(storageKey, JSON.stringify(items));
      return doc;
    }
  }

  // Generic Update Document
  async function updateDocument(userId, collectionName, docId, data) {
    if (!userId || !docId) throw new Error('User ID and Document ID required.');

    if (isLiveFirebase && firestoreInstance) {
      await firestoreInstance
        .collection('users')
        .doc(userId)
        .collection(collectionName)
        .doc(docId)
        .update({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      return { id: docId, ...data };
    } else {
      const storageKey = `spendwise_${userId}_${collectionName}`;
      const items = await getCollection(userId, collectionName);
      const index = items.findIndex(item => item.id === docId);
      if (index === -1) throw new Error(`Document ${docId} not found.`);

      items[index] = {
        ...items[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(items));
      return items[index];
    }
  }

  // Generic Delete Document
  async function deleteDocument(userId, collectionName, docId) {
    if (!userId || !docId) throw new Error('User ID and Document ID required.');

    if (isLiveFirebase && firestoreInstance) {
      await firestoreInstance
        .collection('users')
        .doc(userId)
        .collection(collectionName)
        .doc(docId)
        .delete();
      return true;
    } else {
      const storageKey = `spendwise_${userId}_${collectionName}`;
      let items = await getCollection(userId, collectionName);
      items = items.filter(item => item.id !== docId);
      localStorage.setItem(storageKey, JSON.stringify(items));
      return true;
    }
  }

  // -------------------------------------------------------------------------
  // INITIAL SEEDING FOR REALISTIC COLLEGE DEMO DATA
  // -------------------------------------------------------------------------

  function initDefaultUserData(userId, forceDemoData = false) {
    const txKey = `spendwise_${userId}_transactions`;
    const budgetKey = `spendwise_${userId}_budgets`;
    const goalKey = `spendwise_${userId}_savingsGoals`;
    const catKey = `spendwise_${userId}_categories`;
    const setKey = `spendwise_${userId}_settings`;

    // Initialize categories if empty
    if (!localStorage.getItem(catKey)) {
      localStorage.setItem(catKey, JSON.stringify(CONFIG.DEFAULT_CATEGORIES));
    }

    // Initialize user settings if empty
    if (!localStorage.getItem(setKey)) {
      localStorage.setItem(setKey, JSON.stringify([{
        id: 'user_settings',
        currency: CONFIG.DEFAULT_CURRENCY,
        dateFormat: CONFIG.DEFAULT_DATE_FORMAT,
        theme: CONFIG.DEFAULT_THEME
      }]));
    }

    // Seed realistic college sample transactions and budgets if empty or forced
    if (forceDemoData || !localStorage.getItem(txKey)) {
      const sampleTransactions = [
        // Current Month (October 2026) Income
        { id: 'tx_1', title: 'Monthly Software Engineering Internship Stipend', amount: 35000, type: 'income', category: 'Salary', date: '2026-10-01', paymentMethod: 'Net Banking', description: 'Monthly stipend credit from tech firm' },
        { id: 'tx_2', title: 'Freelance Web Dev React/Node Project', amount: 15000, type: 'income', category: 'Freelance Income', date: '2026-10-08', paymentMethod: 'UPI', description: 'Landing page development milestone payment' },
        
        // Current Month (October 2026) Expenses
        { id: 'tx_3', title: 'College Hostel / PG Monthly Rent', amount: 9500, type: 'expense', category: 'Rent & Housing', date: '2026-10-02', paymentMethod: 'Net Banking', description: 'Shared accommodation rent with utilities' },
        { id: 'tx_4', title: 'Campus Canteen & Swiggy Dinners', amount: 4850, type: 'expense', category: 'Food & Dining', date: '2026-10-05', paymentMethod: 'UPI', description: 'Weekly lunch and evening meals' },
        { id: 'tx_5', title: 'Supermarket Grocery & Fruits', amount: 2200, type: 'expense', category: 'Food & Dining', date: '2026-10-12', paymentMethod: 'UPI', description: 'Breakfast provisions and dry snacks' },
        { id: 'tx_6', title: 'Semester Lab Manuals & Technical Books', amount: 1800, type: 'expense', category: 'Education', date: '2026-10-06', paymentMethod: 'Credit Card', description: 'Data structures & Cloud computing textbooks' },
        { id: 'tx_7', title: 'Monthly Metro & Bus Smartcard Recharge', amount: 1200, type: 'expense', category: 'Transportation', date: '2026-10-03', paymentMethod: 'UPI', description: 'Metro pass for daily college commute' },
        { id: 'tx_8', title: 'Broadband Fiber & Mobile Recharge', amount: 1199, type: 'expense', category: 'Bills & Utilities', date: '2026-10-10', paymentMethod: 'UPI', description: 'High speed internet for project development' },
        { id: 'tx_9', title: 'Weekend Movie & Bowling Outing', amount: 1450, type: 'expense', category: 'Entertainment', date: '2026-10-15', paymentMethod: 'Debit Card', description: 'Weekend entertainment with engineering batchmates' },
        { id: 'tx_10', title: 'Campus Gym Membership', amount: 1000, type: 'expense', category: 'Healthcare', date: '2026-10-04', paymentMethod: 'UPI', description: 'Monthly fitness center fee' },
        { id: 'tx_11', title: 'College TechFest T-Shirt & Jacket', amount: 2400, type: 'expense', category: 'Shopping', date: '2026-10-18', paymentMethod: 'Credit Card', description: 'Annual tech fest merchandise' },
        { id: 'tx_12', title: 'Uber to Hackathon Venue', amount: 650, type: 'expense', category: 'Transportation', date: '2026-10-22', paymentMethod: 'UPI', description: 'Cab ride for overnight hackathon' },

        // Previous Month (September 2026) for MoM Comparison
        { id: 'tx_13', title: 'September Internship Stipend', amount: 35000, type: 'income', category: 'Salary', date: '2026-09-01', paymentMethod: 'Net Banking', description: 'Previous month stipend' },
        { id: 'tx_14', title: 'PG Rent September', amount: 9500, type: 'expense', category: 'Rent & Housing', date: '2026-09-02', paymentMethod: 'Net Banking', description: 'September rent' },
        { id: 'tx_15', title: 'September Food & Dining', amount: 6200, type: 'expense', category: 'Food & Dining', date: '2026-09-14', paymentMethod: 'UPI', description: 'September meals' },
        { id: 'tx_16', title: 'September Transport', amount: 1100, type: 'expense', category: 'Transportation', date: '2026-09-05', paymentMethod: 'UPI', description: 'Commute' },
        { id: 'tx_17', title: 'Laptop Service & RAM Upgrade', amount: 4500, type: 'expense', category: 'Shopping', date: '2026-09-20', paymentMethod: 'Debit Card', description: 'RAM upgrade to 16GB' }
      ];

      const sampleBudgets = [
        { id: 'bg_overall', category: 'Overall', limit: 30000, period: '2026-10' },
        { id: 'bg_food', category: 'Food & Dining', limit: 8000, period: '2026-10' },
        { id: 'bg_transport', category: 'Transportation', limit: 2500, period: '2026-10' },
        { id: 'bg_shopping', category: 'Shopping', limit: 3000, period: '2026-10' },
        { id: 'bg_entertainment', category: 'Entertainment', limit: 2000, period: '2026-10' }
      ];

      const sampleSavingsGoals = [
        { id: 'sg_1', title: 'Emergency Contingency Reserve', targetAmount: 50000, savedAmount: 32000, targetDate: '2026-12-31', icon: 'shield-alert', notes: 'Safety net covering 3 months of college living expenses' },
        { id: 'sg_2', title: 'MacBook Pro for AI/ML Research', targetAmount: 120000, savedAmount: 45000, targetDate: '2027-04-30', icon: 'laptop', notes: 'High-performance laptop for machine learning thesis' },
        { id: 'sg_3', title: 'Goa Grad Trip with Batchmates', targetAmount: 25000, savedAmount: 12500, targetDate: '2027-02-28', icon: 'plane', notes: 'End-of-degree graduation trip fund' }
      ];

      localStorage.setItem(txKey, JSON.stringify(sampleTransactions));
      localStorage.setItem(budgetKey, JSON.stringify(sampleBudgets));
      localStorage.setItem(goalKey, JSON.stringify(sampleSavingsGoals));
    }
  }

  return {
    init,
    isLive: () => isLiveFirebase,
    register,
    login,
    loginDemoUser,
    logout,
    onAuthStateChanged,
    getCollection,
    addDocument,
    updateDocument,
    deleteDocument,
    initDefaultUserData
  };
})();
