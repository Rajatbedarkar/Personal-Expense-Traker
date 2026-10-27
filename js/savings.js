// SpendWise - Savings Goals Portfolio Controller
// Handles financial targets, milestone progress, and required monthly savings estimations

const Savings = (function() {

  // 1. Save Savings Goal (Add or Edit)
  async function handleSave(event) {
    event.preventDefault();
    const state = State.getState();
    const userId = state.currentUser?.uid;
    if (!userId) {
      UI.showToast('Please sign in to save goals.', 'error');
      return;
    }

    const id = document.getElementById('goal-id').value;
    const title = document.getElementById('goal-title-input').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target-amount').value);
    const savedAmount = parseFloat(document.getElementById('goal-saved-amount').value) || 0;
    const targetDate = document.getElementById('goal-deadline-input').value;
    const icon = document.getElementById('goal-category-icon').value || 'target';
    const notes = document.getElementById('goal-notes-input').value.trim();

    if (!title) {
      UI.showToast('Please provide a goal name.', 'warning');
      return;
    }
    if (isNaN(targetAmount) || targetAmount <= 0) {
      UI.showToast('Please enter a valid positive target amount.', 'warning');
      return;
    }
    if (!targetDate) {
      UI.showToast('Please select a target deadline date.', 'warning');
      return;
    }

    const goalData = {
      title,
      targetAmount: Number(targetAmount.toFixed(2)),
      savedAmount: Number(savedAmount.toFixed(2)),
      targetDate,
      icon,
      notes
    };

    try {
      if (id) {
        await FirebaseService.updateDocument(userId, 'savingsGoals', id, goalData);
        UI.showToast(`Savings goal "${title}" updated.`, 'success');
      } else {
        await FirebaseService.addDocument(userId, 'savingsGoals', goalData);
        UI.showToast(`Savings goal "${title}" created!`, 'success');
      }

      const freshGoals = await FirebaseService.getCollection(userId, 'savingsGoals');
      State.setSavingsGoals(freshGoals);

      UI.closeModal('modal-savings-goal');
      render();
      UI.renderDashboard();
    } catch (err) {
      console.error('[Savings] Save failed:', err);
      UI.showToast('Failed to save goal: ' + err.message, 'error');
    }
  }

  // 2. Open Add Funds Modal
  function openAddFundsModal(id) {
    const goal = State.getState().savingsGoals.find(g => g.id === id);
    if (!goal) return;

    document.getElementById('funds-goal-id').value = goal.id;
    document.getElementById('funds-goal-title').textContent = goal.title;
    document.getElementById('funds-deposit-amount').value = '';

    UI.openModal('modal-add-funds');
  }

  // 3. Deposit / Add Funds to Goal
  async function handleDeposit(event) {
    event.preventDefault();
    const userId = State.getState().currentUser?.uid;
    const goalId = document.getElementById('funds-goal-id').value;
    const depositAmt = parseFloat(document.getElementById('funds-deposit-amount').value);

    if (isNaN(depositAmt) || depositAmt <= 0) {
      UI.showToast('Please enter a valid deposit amount.', 'warning');
      return;
    }

    const goal = State.getState().savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    const newSaved = Number(((Number(goal.savedAmount) || 0) + depositAmt).toFixed(2));

    try {
      await FirebaseService.updateDocument(userId, 'savingsGoals', goalId, { savedAmount: newSaved });
      
      const freshGoals = await FirebaseService.getCollection(userId, 'savingsGoals');
      State.setSavingsGoals(freshGoals);

      UI.closeModal('modal-add-funds');
      UI.showToast(`Deposited ${Calculations.formatCurrency(depositAmt, State.getState().settings.currency)} to "${goal.title}".`, 'success');
      render();
      UI.renderDashboard();

      // Check if goal was achieved
      if (newSaved >= goal.targetAmount) {
        Notifications.createMilestoneAlert(goal.title);
      }
    } catch (err) {
      UI.showToast('Failed to deposit funds: ' + err.message, 'error');
    }
  }

  // 4. Edit Goal
  function editGoal(id) {
    const goal = State.getState().savingsGoals.find(g => g.id === id);
    if (!goal) return;

    document.getElementById('goal-id').value = goal.id;
    document.getElementById('modal-goal-title').textContent = 'Edit Savings Goal';
    document.getElementById('goal-title-input').value = goal.title;
    document.getElementById('goal-target-amount').value = goal.targetAmount;
    document.getElementById('goal-saved-amount').value = goal.savedAmount;
    document.getElementById('goal-deadline-input').value = goal.targetDate;
    document.getElementById('goal-category-icon').value = goal.icon || 'shield-alert';
    document.getElementById('goal-notes-input').value = goal.notes || '';

    UI.openModal('modal-savings-goal');
  }

  // 5. Delete Goal with Confirmation
  function promptDelete(id) {
    const goal = State.getState().savingsGoals.find(g => g.id === id);
    if (!goal) return;

    UI.confirmAction(
      'Delete Savings Goal',
      `Are you sure you want to delete "${goal.title}"?`,
      async () => {
        try {
          const userId = State.getState().currentUser?.uid;
          await FirebaseService.deleteDocument(userId, 'savingsGoals', id);
          
          const fresh = await FirebaseService.getCollection(userId, 'savingsGoals');
          State.setSavingsGoals(fresh);

          UI.showToast('Savings goal deleted.', 'info');
          render();
          UI.renderDashboard();
        } catch (err) {
          UI.showToast('Failed to delete goal: ' + err.message, 'error');
        }
      }
    );
  }

  // 6. Render Savings View
  function render() {
    const state = State.getState();
    const goals = state.savingsGoals;
    const currency = state.settings.currency;
    const dateFormat = state.settings.dateFormat;

    // Overall Portfolio Metrics
    const totalTarget = goals.reduce((s, g) => s + (Number(g.targetAmount) || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + (Number(g.savedAmount) || 0), 0);
    const totalRemaining = Math.max(0, totalTarget - totalSaved);
    const overallPercent = totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(1) : '0';

    document.getElementById('savings-total-target').textContent = Calculations.formatCurrency(totalTarget, currency);
    document.getElementById('savings-total-saved').textContent = Calculations.formatCurrency(totalSaved, currency);
    document.getElementById('savings-total-remaining').textContent = Calculations.formatCurrency(totalRemaining, currency);
    document.getElementById('savings-overall-percent').textContent = `${overallPercent}%`;

    const grid = document.getElementById('savings-goals-grid');
    const empty = document.getElementById('savings-empty-state');
    if (!grid) return;

    if (!goals.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = goals.map(g => {
      const p = Calculations.calculateGoalProgress(g);
      const isAchieved = p.isAchieved;

      return `
        <div class="goal-card">
          <div class="goal-header">
            <div class="goal-info">
              <div class="goal-icon" style="background: ${isAchieved ? 'var(--color-income-bg)' : 'var(--color-purple-bg)'}; color: ${isAchieved ? 'var(--color-income)' : 'var(--color-purple)'};">
                <i data-lucide="${g.icon || 'target'}"></i>
              </div>
              <div>
                <h4 class="goal-name">${UI.escapeHtml(g.title)}</h4>
                <span class="badge ${isAchieved ? 'badge-income' : 'badge-accent'}">
                  ${isAchieved ? '🎉 Goal Achieved!' : `${p.percent}% Completed`}
                </span>
              </div>
            </div>
            <div class="td-actions">
              <button class="btn-table-action" onclick="Savings.editGoal('${g.id}')" title="Edit Goal">
                <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-table-action delete" onclick="Savings.promptDelete('${g.id}')" title="Delete Goal">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${p.percent}%; background: ${isAchieved ? 'var(--color-income)' : 'var(--color-purple)'};"></div>
          </div>

          <div class="goal-numbers">
            <div>
              <span class="label" style="font-size: 0.72rem; color: var(--text-muted); display: block;">SAVED</span>
              <span class="saved">${Calculations.formatCurrency(p.saved, currency)}</span>
            </div>
            <div style="text-align: right;">
              <span class="label" style="font-size: 0.72rem; color: var(--text-muted); display: block;">TARGET</span>
              <span class="target">${Calculations.formatCurrency(p.target, currency)}</span>
            </div>
          </div>

          <div class="goal-monthly-calc">
            <span>Required Monthly:</span>
            <strong>${isAchieved ? 'Completed' : `${Calculations.formatCurrency(p.monthlyRequired, currency)}/mo`}</strong>
          </div>

          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Deadline: ${Calculations.formatDate(g.targetDate, dateFormat)}</span>
            <span>${p.daysLeft > 0 ? `${p.daysLeft} days left` : (isAchieved ? 'Achieved' : 'Due')}</span>
          </div>

          ${g.notes ? `<p style="font-size: 0.75rem; color: var(--text-secondary); background: var(--bg-input); padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);">${UI.escapeHtml(g.notes)}</p>` : ''}

          <div class="goal-card-actions">
            <button class="btn btn-secondary btn-sm btn-block" onclick="Savings.openAddFundsModal('${g.id}')">
              <i data-lucide="plus-circle"></i> Add Funds
            </button>
          </div>
        </div>
      `;
    }).join('');

    UI.refreshIcons();
  }

  return {
    handleSave,
    openAddFundsModal,
    handleDeposit,
    editGoal,
    promptDelete,
    render
  };
})();
