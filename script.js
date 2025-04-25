 // Data Model
 class ExpenseSplitApp {
    constructor() {
        this.groups = [];
        this.loadData();
        this.activeGroupId = null;
    }

    loadData() {
        const savedData = localStorage.getItem('expenseSplitData');
        if (savedData) {
            this.groups = JSON.parse(savedData);
        }
    }

    saveData() {
        localStorage.setItem('expenseSplitData', JSON.stringify(this.groups));
    }

    createGroup(name, members) {
        const newGroup = {
            id: Date.now().toString(),
            name: name,
            members: members,
            expenses: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.groups.push(newGroup);
        this.saveData();
        return newGroup;
    }

    getGroup(groupId) {
        return this.groups.find(group => group.id === groupId);
    }

    getAllGroups() {
        return this.groups;
    }

    addExpense(groupId, expense) {
        const group = this.getGroup(groupId);
        if (group) {
            expense.id = Date.now().toString();
            expense.createdAt = new Date().toISOString();
            group.expenses.push(expense);
            group.updatedAt = new Date().toISOString();
            this.saveData();
            return expense;
        }
        return null;
    }

    calculateBalances(groupId) {
        const group = this.getGroup(groupId);
        if (!group) return [];

        const balances = {};
        
        // Initialize balances for all members
        group.members.forEach(member => {
            balances[member] = 0;
        });

        // Calculate net balance for each member based on expenses
        group.expenses.forEach(expense => {
            const payer = expense.paidBy;
            const amount = expense.amount;
            
            balances[payer] += amount; // Payer paid this amount
            
            // Subtract the shares from each member
            Object.entries(expense.splits).forEach(([member, share]) => {
                balances[member] -= share;
            });
        });

        return Object.entries(balances).map(([member, balance]) => ({
            member,
            balance: parseFloat(balance.toFixed(2))
        }));
    }

    generateSettlements(groupId) {
        const balances = this.calculateBalances(groupId);
        const settlements = [];
        
        // Separate positive (creditors) and negative (debtors) balances
        const creditors = balances.filter(b => b.balance > 0)
            .sort((a, b) => b.balance - a.balance);
        const debtors = balances.filter(b => b.balance < 0)
            .sort((a, b) => a.balance - b.balance);
        
        // Generate settlement transactions
        while (debtors.length > 0 && creditors.length > 0) {
            const debtor = debtors[0];
            const creditor = creditors[0];
            
            // Calculate transaction amount (minimum of the absolute values)
            const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
            
            if (amount > 0.01) { // Only add significant transactions
                settlements.push({
                    from: debtor.member,
                    to: creditor.member,
                    amount: parseFloat(amount.toFixed(2))
                });
            }
            
            // Update balances
            debtor.balance += amount;
            creditor.balance -= amount;
            
            // Remove settled parties
            if (Math.abs(debtor.balance) < 0.01) debtors.shift();
            if (Math.abs(creditor.balance) < 0.01) creditors.shift();
        }
        
        return settlements;
    }

    getTotalExpenses(groupId) {
        const group = this.getGroup(groupId);
        if (!group) return 0;
        
        return group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    }

    getGroupCount() {
        return this.groups.length;
    }
}

// DOM Manipulation and UI Controller
class UIController {
    constructor(app) {
        this.app = app;
        this.initTheme();
        this.initEventListeners();
        this.renderGroups();
        this.updateGroupsCount();
        this.checkEmptyState();

        // Set today's date as default for expense form
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date-input').value = today;
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.getElementById('theme-toggle').innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    initEventListeners() {
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Group management
        document.getElementById('add-group-btn').addEventListener('click', () => this.openAddGroupModal());
        document.getElementById('welcome-add-group-btn').addEventListener('click', () => this.openAddGroupModal());
        document.getElementById('close-add-group-modal').addEventListener('click', () => this.closeAddGroupModal());
        document.getElementById('cancel-add-group').addEventListener('click', () => this.closeAddGroupModal());
        document.getElementById('add-member-btn').addEventListener('click', () => this.addMemberToForm());
        document.getElementById('member-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addMemberToForm();
            }
        });
        document.getElementById('save-group-btn').addEventListener('click', () => this.saveGroup());

        // Expense management
        document.getElementById('add-expense-btn').addEventListener('click', () => this.openAddExpenseModal());
        document.getElementById('close-add-expense-modal').addEventListener('click', () => this.closeAddExpenseModal());
        document.getElementById('cancel-add-expense').addEventListener('click', () => this.closeAddExpenseModal());
        document.getElementById('save-expense-btn').addEventListener('click', () => this.saveExpense());

        // Split method radio buttons
        const splitRadios = document.querySelectorAll('input[name="split-method"]');
        splitRadios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleSplitMethod());
        });

        // Report management
        document.getElementById('generate-report-btn').addEventListener('click', () => this.openReportModal());
        document.getElementById('close-report-modal').addEventListener('click', () => this.closeReportModal());
        document.getElementById('close-report-btn').addEventListener('click', () => this.closeReportModal());
    }

    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');
        
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            body.classList.add('dark-theme');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
    }

    openAddGroupModal() {
        const modal = document.getElementById('add-group-modal');
        modal.classList.add('active');
        document.getElementById('group-name-input').focus();
        
        // Clear the form
        document.getElementById('group-name-input').value = '';
        document.getElementById('member-input').value = '';
        document.getElementById('members-list').innerHTML = '';
    }

    closeAddGroupModal() {
        const modal = document.getElementById('add-group-modal');
        modal.classList.remove('active');
    }

    addMemberToForm() {
        const memberInput = document.getElementById('member-input');
        const memberName = memberInput.value.trim();
        
        if (memberName) {
            const membersList = document.getElementById('members-list');
            
            // Check if member already exists
            const existingMembers = membersList.querySelectorAll('.form-member-name');
            for (let i = 0; i < existingMembers.length; i++) {
                if (existingMembers[i].textContent === memberName) {
                    this.showToast('Member already added', 'error');
                    return;
                }
            }
            
            // Create new member element
            const memberElement = document.createElement('div');
            memberElement.className = 'form-member';
            memberElement.innerHTML = `
                <span class="form-member-name">${memberName}</span>
                <i class="fas fa-times" onclick="this.parentElement.remove()"></i>
            `;
            membersList.appendChild(memberElement);
            
            // Clear input
            memberInput.value = '';
            memberInput.focus();
        }
    }

    saveGroup() {
        const groupNameInput = document.getElementById('group-name-input');
        const groupName = groupNameInput.value.trim();
        
        if (!groupName) {
            this.showToast('Please enter a group name', 'error');
            return;
        }
        
        const memberElements = document.querySelectorAll('.form-member-name');
        const members = Array.from(memberElements).map(el => el.textContent);
        
        if (members.length < 2) {
            this.showToast('Please add at least two members', 'error');
            return;
        }
        
        // Create the group
        const newGroup = this.app.createGroup(groupName, members);
        
        // Close modal
        this.closeAddGroupModal();
        
        // Update UI
        this.renderGroups();
        this.updateGroupsCount();
        this.checkEmptyState();
        this.selectGroup(newGroup.id);
        
        // Show success message
        this.showToast('Group created successfully');
    }

    renderGroups() {
        const groupsList = document.getElementById('groups-list');
        groupsList.innerHTML = '';
        
        const groups = this.app.getAllGroups();
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'group-item';
            groupElement.dataset.id = group.id;
            
            if (this.app.activeGroupId === group.id) {
                groupElement.classList.add('active');
            }
            
            const updatedDate = new Date(group.updatedAt);
            const formattedDate = updatedDate.toLocaleDateString();
            
            groupElement.innerHTML = `
                <div class="group-item-header">
                    <div class="group-name">${group.name}</div>
                    <div class="group-members">
                        <i class="fas fa-users"></i>
                        ${group.members.length}
                    </div>
                </div>
                <div class="group-meta">
                    <div class="group-date">Updated: ${formattedDate}</div>
                </div>
            `;
            
            groupElement.addEventListener('click', () => {
                this.selectGroup(group.id);
            });
            
            groupsList.appendChild(groupElement);
        });
    }

    selectGroup(groupId) {
        // Update active group
        this.app.activeGroupId = groupId;
        
        // Update UI
        document.querySelectorAll('.group-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.id === groupId) {
                item.classList.add('active');
            }
        });
        
        // Show group details
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('group-details').style.display = 'flex';
        
        // Render group details
        this.renderGroupDetails(groupId);
    }

    renderGroupDetails(groupId) {
        const group = this.app.getGroup(groupId);
        if (!group) return;
        
        // Update group name
        document.getElementById('group-name').textContent = group.name;
        
        // Update members count
        document.getElementById('members-count').textContent = group.members.length;
        
        // Update total expenses
        const totalExpenses = this.app.getTotalExpenses(groupId);
        document.getElementById('total-expenses').textContent = `$${totalExpenses.toFixed(2)}`;
        
        // Update last updated date
        const updatedDate = new Date(group.updatedAt);
        document.getElementById('last-updated').textContent = updatedDate.toLocaleDateString();
        
        // Render expenses
        this.renderExpenses(groupId);
        
        // Render balances
        this.renderBalances(groupId);
    }

    renderExpenses(groupId) {
        const group = this.app.getGroup(groupId);
        const expenseList = document.getElementById('expense-list');
        const emptyExpenses = document.getElementById('empty-expenses');
        
        expenseList.innerHTML = '';
        
        if (group.expenses.length === 0) {
            emptyExpenses.style.display = 'flex';
            return;
        }
        
        emptyExpenses.style.display = 'none';
        
        // Sort expenses by date (newest first)
        const sortedExpenses = [...group.expenses].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        sortedExpenses.forEach(expense => {
            const expenseElement = document.createElement('div');
            expenseElement.className = 'expense-item';
            
            const expenseDate = new Date(expense.date);
            
            expenseElement.innerHTML = `
                <div class="expense-details">
                    <div class="expense-title">${expense.description}</div>
                    <div class="expense-meta">
                        <span><i class="fas fa-user"></i> ${expense.paidBy}</span>
                        <span><i class="fas fa-calendar"></i> ${expenseDate.toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="expense-amount">$${expense.amount.toFixed(2)}</div>
            `;
            
            expenseList.appendChild(expenseElement);
        });
    }

    renderBalances(groupId) {
        const balances = this.app.calculateBalances(groupId);
        const balanceList = document.getElementById('balance-list');
        
        balanceList.innerHTML = '';
        
        balances.forEach(balance => {
            const balanceElement = document.createElement('div');
            balanceElement.className = 'balance-item';
            
            const balanceClass = balance.balance > 0 ? 'positive' : 
                                balance.balance < 0 ? 'negative' : '';
            
            balanceElement.innerHTML = `
                <div class="balance-person">${balance.member}</div>
                <div class="balance-amount ${balanceClass}">
                    ${balance.balance > 0 ? '+' : ''}$${balance.balance.toFixed(2)}
                </div>
            `;
            
            balanceList.appendChild(balanceElement);
        });
    }

    openAddExpenseModal() {
        if (!this.app.activeGroupId) return;
        
        const modal = document.getElementById('add-expense-modal');
        modal.classList.add('active');
        
        // Clear form
        document.getElementById('expense-name-input').value = '';
        document.getElementById('expense-amount-input').value = '';
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expense-date-input').value = today;
        
        // Reset split method
        document.querySelector('input[name="split-method"][value="equal"]').checked = true;
        document.getElementById('custom-split-container').style.display = 'none';
        
        // Populate member dropdown
        const group = this.app.getGroup(this.app.activeGroupId);
        const payerSelect = document.getElementById('expense-payer-input');
        payerSelect.innerHTML = '';
        
        group.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member;
            option.textContent = member;
            payerSelect.appendChild(option);
        });
        
        // Prepare custom split container
        this.prepareCustomSplitInputs();
        
        // Focus on first input
        document.getElementById('expense-name-input').focus();
    }

    closeAddExpenseModal() {
        const modal = document.getElementById('add-expense-modal');
        modal.classList.remove('active');
    }

    toggleSplitMethod() {
        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        const customSplitContainer = document.getElementById('custom-split-container');
        
        if (splitMethod === 'custom') {
            customSplitContainer.style.display = 'grid';
            this.prepareCustomSplitInputs();
        } else {
            customSplitContainer.style.display = 'none';
        }
    }

    prepareCustomSplitInputs() {
        if (!this.app.activeGroupId) return;
        
        const group = this.app.getGroup(this.app.activeGroupId);
        const customSplitContainer = document.getElementById('custom-split-container');
        
        customSplitContainer.innerHTML = '';
        
        group.members.forEach(member => {
            const inputContainer = document.createElement('div');
            inputContainer.className = 'custom-split-item';
            
            inputContainer.innerHTML = `
                <div class="split-person">${member}</div>
                <input type="number" class="form-control" data-member="${member}" 
                       min="0" step="0.01" placeholder="0.00">
            `;
            
            customSplitContainer.appendChild(inputContainer);
        });
    }

    saveExpense() {
        if (!this.app.activeGroupId) return;
        
        const description = document.getElementById('expense-name-input').value.trim();
        const amountStr = document.getElementById('expense-amount-input').value.trim();
        const paidBy = document.getElementById('expense-payer-input').value;
        const date = document.getElementById('expense-date-input').value;
        const splitMethod = document.querySelector('input[name="split-method"]:checked').value;
        
        if (!description) {
            this.showToast('Please enter an expense description', 'error');
            return;
        }
        
        if (!amountStr) {
            this.showToast('Please enter an amount', 'error');
            return;
        }
        
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }
        
        if (!date) {
            this.showToast('Please select a date', 'error');
            return;
        }
        
        // Calculate splits based on method
        const group = this.app.getGroup(this.app.activeGroupId);
        let splits = {};
        
        if (splitMethod === 'equal') {
            // Equal split
            const perPersonAmount = amount / group.members.length;
            group.members.forEach(member => {
                splits[member] = parseFloat(perPersonAmount.toFixed(2));
            });
        } else {
            // Custom split
            const customInputs = document.querySelectorAll('#custom-split-container input');
            let totalSplit = 0;
            
            customInputs.forEach(input => {
                const member = input.dataset.member;
                const value = parseFloat(input.value || 0);
                
                if (!isNaN(value) && value > 0) {
                    splits[member] = value;
                    totalSplit += value;
                } else {
                    splits[member] = 0;
                }
            });
            
            if (Math.abs(totalSplit - amount) > 0.01) {
                this.showToast(`Split amount (${totalSplit.toFixed(2)}) doesn't match expense amount (${amount.toFixed(2)})`, 'error');
                return;
            }
        }
        
        // Create expense object
        const expense = {
            description,
            amount,
            paidBy,
            date,
            splits
        };
        
        // Add expense to group
        this.app.addExpense(this.app.activeGroupId, expense);
        
        // Close modal
        this.closeAddExpenseModal();
        
        // Update UI
        this.renderGroupDetails(this.app.activeGroupId);
        this.renderGroups(); // To update the "Updated" date
        
        // Show success message
        this.showToast('Expense added successfully');
    }

    openReportModal() {
        if (!this.app.activeGroupId) return;
        
        const modal = document.getElementById('report-modal');
        modal.classList.add('active');
        
        // Generate settlements
        const settlements = this.app.generateSettlements(this.app.activeGroupId);
        const settlementsList = document.getElementById('report-settlements');
        
        settlementsList.innerHTML = '';
        
        if (settlements.length === 0) {
            settlementsList.innerHTML = '<div class="empty-state">All settled up!</div>';
            return;
        }
        
        settlements.forEach(settlement => {
            const settlementElement = document.createElement('div');
            settlementElement.className = 'settlement-item';
            
            settlementElement.innerHTML = `
                <div class="settlement-text">${settlement.from} pays ${settlement.to}</div>
                <div class="settlement-amount">$${settlement.amount.toFixed(2)}</div>
            `;
            
            settlementsList.appendChild(settlementElement);
        });
    }

    closeReportModal() {
        const modal = document.getElementById('report-modal');
        modal.classList.remove('active');
    }

    updateGroupsCount() {
        const count = this.app.getGroupCount();
        document.getElementById('groups-count').textContent = count;
    }

    checkEmptyState() {
        const welcomeScreen = document.getElementById('welcome-screen');
        const groupDetails = document.getElementById('group-details');
        
        if (this.app.getGroupCount() === 0) {
            welcomeScreen.style.display = 'flex';
            groupDetails.style.display = 'none';
        } else if (!this.app.activeGroupId) {
            // Select first group if none is active
            const firstGroup = this.app.getAllGroups()[0];
            if (firstGroup) {
                this.selectGroup(firstGroup.id);
            }
        }
    }

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'info' ? 'fa-info-circle' : 'fa-check-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ExpenseSplitApp();
    const ui = new UIController(app);
});