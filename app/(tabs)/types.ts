export type TransactionType = 'expense' | 'income';
export type Frequency = 'daily' | 'weekly' | 'monthly';
export type TabType = 'transactions' | 'recurring' | 'insights';

export interface Transaction {
    id: number;
    date: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    payment: string;
}

export interface RecurringTransaction {
    id: number;
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    payment: string;
    frequency: Frequency;
    nextDueDate: string;
}

export interface FormData {
    date: string;
    description: string;
    amount: string;
    type: TransactionType;
    category: string;
    payment: string;
    isRecurring: boolean;
    frequency: Frequency;
    nextDueDate: string;
}

export interface MonthlyInsight {
    previousMonth: string;
    currentTotalExpenses: number;
    previousTotalExpenses: number;
    expenseChange: number;
    expensePercentChange: number;
    currentTotalIncome: number;
    previousTotalIncome: number;
    incomeChange: number;
    incomePercentChange: number;
    categoryChanges: Array<{ category: string; current: number; previous: number; change: number; percentChange: number }>;
}
