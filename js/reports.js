// SpendWise - Monthly Financial Reports & Multi-Format Export Engine
// Supports RFC-4180 CSV Export and Professional Vector PDF Generation via jsPDF & autoTable

const Reports = (function() {

  // 1. Handle Period Type Selector Change
  function handlePeriodTypeChange() {
    const type = document.getElementById('report-period-type').value;
    const monthCol = document.getElementById('report-month-picker-col');
    const customCol = document.getElementById('report-custom-picker-col');

    if (type === 'custom') {
      monthCol.classList.add('hidden');
      customCol.classList.remove('hidden');

      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().substring(0, 10);
      document.getElementById('report-start-date').value = firstOfMonth;
      document.getElementById('report-end-date').value = now.toISOString().substring(0, 10);
    } else {
      monthCol.classList.remove('hidden');
      customCol.classList.add('hidden');
    }

    updateReportPreview();
  }

  // 2. Filter Transactions for Report
  function getFilteredReportTransactions() {
    const state = State.getState();
    const type = document.getElementById('report-period-type')?.value || 'month';
    const monthPicker = document.getElementById('report-month-input')?.value || state.selectedMonth;

    if (type === 'month') {
      return state.transactions.filter(t => t.date && t.date.startsWith(monthPicker));
    } else if (type === 'quarter') {
      const [year, month] = monthPicker.split('-').map(Number);
      const qMonth1 = String(month).padStart(2, '0');
      const qMonth2 = String(Math.max(1, month - 1)).padStart(2, '0');
      const qMonth3 = String(Math.max(1, month - 2)).padStart(2, '0');
      const qPrefixes = [`${year}-${qMonth1}`, `${year}-${qMonth2}`, `${year}-${qMonth3}`];
      return state.transactions.filter(t => t.date && qPrefixes.some(p => t.date.startsWith(p)));
    } else if (type === 'year') {
      const year = monthPicker.split('-')[0];
      return state.transactions.filter(t => t.date && t.date.startsWith(year));
    } else if (type === 'custom') {
      const start = document.getElementById('report-start-date')?.value;
      const end = document.getElementById('report-end-date')?.value;
      return state.transactions.filter(t => {
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
      });
    }

    return state.transactions;
  }

  // 3. Update Report Preview
  function updateReportPreview() {
    const state = State.getState();
    const currency = state.settings.currency;
    const dateFormat = state.settings.dateFormat;
    const monthPicker = document.getElementById('report-month-input');

    if (monthPicker && !monthPicker.value) {
      monthPicker.value = state.selectedMonth;
    }

    const filtered = getFilteredReportTransactions();
    const totals = Calculations.calculateTotals(filtered);

    // Header metadata
    const user = state.currentUser;
    const userEl = document.getElementById('report-user-info');
    if (userEl) {
      userEl.textContent = `Account Holder: ${user ? (user.displayName || user.email) : 'Student'} (${user?.email || 'demo@college-project.edu'})`;
    }

    const genEl = document.getElementById('report-generated-timestamp');
    if (genEl) {
      genEl.textContent = `Generated on: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }

    const periodEl = document.getElementById('report-period-badge');
    const type = document.getElementById('report-period-type')?.value || 'month';
    if (periodEl) {
      if (type === 'month') {
        const [y, m] = (monthPicker?.value || state.selectedMonth).split('-');
        const d = new Date(y, m - 1, 1);
        periodEl.textContent = `Period: ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
      } else if (type === 'year') {
        periodEl.textContent = `Period: Full Year ${(monthPicker?.value || state.selectedMonth).split('-')[0]}`;
      } else if (type === 'custom') {
        periodEl.textContent = `Period: ${document.getElementById('report-start-date')?.value || ''} to ${document.getElementById('report-end-date')?.value || ''}`;
      } else {
        periodEl.textContent = `Period: Quarterly Audit`;
      }
    }

    // 4 Summary Metrics
    document.getElementById('rep-total-income').textContent = Calculations.formatCurrency(totals.income, currency);
    document.getElementById('rep-total-expense').textContent = Calculations.formatCurrency(totals.expense, currency);
    
    const netEl = document.getElementById('rep-net-cashflow');
    netEl.textContent = Calculations.formatCurrency(totals.netCashFlow, currency);
    netEl.style.color = totals.netCashFlow >= 0 ? 'var(--color-income)' : 'var(--color-expense)';

    document.getElementById('rep-savings-rate').textContent = `${totals.savingsRate}%`;

    // Month-over-Month Comparison
    renderMoMSection();

    // Category Breakdown Table
    renderCategoryTable(filtered);

    // Itemized Transactions Table
    renderTransactionsTable(filtered);

    UI.refreshIcons();
  }

  // 4. Render MoM Comparison Cards
  function renderMoMSection() {
    const state = State.getState();
    const currentMonth = document.getElementById('report-month-input')?.value || state.selectedMonth;
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const mom = Calculations.calculateMoMComparison(state.transactions, currentMonth, prevMonth);
    const currency = state.settings.currency;

    // Income MoM
    const incDiffEl = document.getElementById('mom-income-diff');
    const incSign = mom.incomeChangePct >= 0 ? '+' : '';
    incDiffEl.innerHTML = `
      <span class="mom-pct ${mom.incomeChangePct >= 0 ? 'text-emerald' : 'text-rose'}">${incSign}${mom.incomeChangePct}%</span>
      <span class="mom-prev">Prev: ${Calculations.formatCurrency(mom.previous.income, currency)}</span>
    `;

    // Expense MoM
    const expDiffEl = document.getElementById('mom-expense-diff');
    const expSign = mom.expenseChangePct >= 0 ? '+' : '';
    expDiffEl.innerHTML = `
      <span class="mom-pct ${mom.expenseChangePct > 0 ? 'text-rose' : 'text-emerald'}">${expSign}${mom.expenseChangePct}%</span>
      <span class="mom-prev">Prev: ${Calculations.formatCurrency(mom.previous.expense, currency)}</span>
    `;

    // Net Cash Flow MoM
    const netDiffEl = document.getElementById('mom-net-diff');
    const netSign = mom.netChangePct >= 0 ? '+' : '';
    netDiffEl.innerHTML = `
      <span class="mom-pct ${mom.netChangePct >= 0 ? 'text-emerald' : 'text-rose'}">${netSign}${mom.netChangePct}%</span>
      <span class="mom-prev">Prev: ${Calculations.formatCurrency(mom.previous.netCashFlow, currency)}</span>
    `;
  }

  // 5. Render Category Table
  function renderCategoryTable(filteredTx) {
    const tbody = document.getElementById('report-category-tbody');
    if (!tbody) return;

    const { breakdown, totalExpense } = Calculations.calculateCategoryBreakdown(filteredTx);
    const currency = State.getState().settings.currency;

    if (!breakdown.length) {
      tbody.innerHTML = `
        <tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No expense categories recorded for this period.</td></tr>
      `;
      return;
    }

    tbody.innerHTML = breakdown.map(item => `
      <tr>
        <td><strong>${UI.escapeHtml(item.category)}</strong></td>
        <td>${item.count}</td>
        <td style="font-family: var(--font-mono); font-weight: 700;">${Calculations.formatCurrency(item.total, currency)}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div class="progress-bar-container" style="flex: 1; height: 6px; margin-bottom: 0;">
              <div class="progress-bar-fill" style="width: ${item.percentage}%;"></div>
            </div>
            <span style="font-size: 0.78rem; font-family: var(--font-mono);">${item.percentage}%</span>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // 6. Render Itemized Transactions Table
  function renderTransactionsTable(filteredTx) {
    const tbody = document.getElementById('report-tx-tbody');
    const countEl = document.getElementById('rep-tx-count');
    if (!tbody) return;

    if (countEl) countEl.textContent = filteredTx.length;

    if (!filteredTx.length) {
      tbody.innerHTML = `
        <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No transactions recorded for the selected period.</td></tr>
      `;
      return;
    }

    // Sort newest first
    const sorted = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));
    const currency = State.getState().settings.currency;
    const dateFormat = State.getState().settings.dateFormat;

    tbody.innerHTML = sorted.map(tx => {
      const isIncome = tx.type === 'income';
      return `
        <tr>
          <td>${Calculations.formatDate(tx.date, dateFormat)}</td>
          <td><strong>${UI.escapeHtml(tx.title)}</strong></td>
          <td>${UI.escapeHtml(tx.category)}</td>
          <td>${tx.paymentMethod || 'UPI'}</td>
          <td><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${isIncome ? 'Income' : 'Expense'}</span></td>
          <td style="font-family: var(--font-mono); font-weight: 700; color: ${isIncome ? 'var(--color-income)' : 'var(--color-expense)'};">
            ${isIncome ? '+' : '-'}${Calculations.formatCurrency(tx.amount, currency)}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 7. CSV Export Engine (RFC-4180 with UTF-8 BOM)
  function exportCSV() {
    const transactions = getFilteredReportTransactions();
    if (!transactions.length) {
      UI.showToast('No transactions found in this period to export.', 'warning');
      return;
    }

    const state = State.getState();
    const currency = state.settings.currency;
    const period = document.getElementById('report-month-input')?.value || state.selectedMonth;

    // RFC-4180 header
    const headers = ['Date', 'Title', 'Type', 'Category', 'Payment Method', `Amount (${currency})`, 'Description'];
    
    const rows = transactions.map(t => [
      `"${t.date || ''}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.type || ''}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${t.paymentMethod || ''}"`,
      `"${Number(t.amount).toFixed(2)}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `SpendWise_Financial_Report_${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    UI.showToast('CSV report exported successfully!', 'success');
  }

  // 8. PDF Export Engine via jsPDF & autoTable
  function generatePDF() {
    if (typeof window.jspdf === 'undefined') {
      UI.showToast('PDF generator library loading. Please try again in a moment.', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const state = State.getState();
    const currency = state.settings.currency;
    const filteredTx = getFilteredReportTransactions();
    const totals = Calculations.calculateTotals(filteredTx);
    const period = document.getElementById('report-month-input')?.value || state.selectedMonth;
    const user = state.currentUser;

    // Primary Colors
    const primaryColor = [99, 102, 241];
    const textColor = [30, 41, 59];
    const mutedColor = [100, 116, 139];

    // Page 1: Header & Executive Summary
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 595, 60, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('SpendWise - Financial Statement Report', 40, 38);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${period} | Capstone Project`, 420, 38);

    // Meta details
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.text(`Account Holder: ${user ? (user.displayName || user.email) : 'Student'} (${user?.email || 'student@college.edu'})`, 40, 85);
    doc.text(`Report Generation Date: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, 40, 100);
    doc.text(`Currency: ${currency} (${CONFIG.CURRENCIES[currency]?.name || 'INR'})`, 40, 115);

    // Summary Metrics Table
    doc.autoTable({
      startY: 130,
      head: [['Financial Metric', 'Value']],
      body: [
        ['Total Recorded Income', Calculations.formatCurrency(totals.income, currency)],
        ['Total Recorded Expenses', Calculations.formatCurrency(totals.expense, currency)],
        ['Net Cash Flow / Savings', Calculations.formatCurrency(totals.netCashFlow, currency)],
        ['Effective Savings Rate', `${totals.savingsRate}%`],
        ['Total Transactions Audited', `${totals.totalCount} records (${totals.incomeCount} credits, ${totals.expenseCount} debits)`]
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5 }
    });

    // Category Spending Breakdown Table
    const { breakdown } = Calculations.calculateCategoryBreakdown(filteredTx);
    const categoryRows = breakdown.map(b => [
      b.category,
      b.count,
      Calculations.formatCurrency(b.total, currency),
      `${b.percentage}%`
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Category-wise Expenditure Breakdown', 40, doc.lastAutoTable.finalY + 25);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 32,
      head: [['Category', 'Count', 'Total Spent', '% of Outflow']],
      body: categoryRows.length ? categoryRows : [['No expense categories recorded', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8.5, cellPadding: 4 }
    });

    // Itemized Ledger Table
    const sortedTx = [...filteredTx].sort((a, b) => new Date(b.date) - new Date(a.date));
    const txRows = sortedTx.map(t => [
      t.date,
      t.title,
      t.category,
      t.paymentMethod || 'UPI',
      t.type === 'income' ? 'Income' : 'Expense',
      `${t.type === 'income' ? '+' : '-'}${Calculations.formatCurrency(t.amount, currency)}`
    ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Itemized Transaction History (${sortedTx.length} records)`, 40, doc.lastAutoTable.finalY + 25);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 32,
      head: [['Date', 'Title', 'Category', 'Payment Method', 'Type', 'Amount']],
      body: txRows.length ? txRows : [['-', 'No transactions recorded', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 8, cellPadding: 3.5 }
    });

    // Footer with Page Numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      doc.text(`SpendWise Personal Finance Engine • Page ${i} of ${pageCount}`, 40, 820);
      doc.text('CSE B.Tech College Project Evaluation Report', 380, 820);
    }

    doc.save(`SpendWise_Financial_Report_${period}.pdf`);
    UI.showToast('Formatted PDF report downloaded!', 'success');
  }

  return {
    handlePeriodTypeChange,
    updateReportPreview,
    exportCSV,
    generatePDF
  };
})();
