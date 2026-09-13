import { Expense } from '../types';

const EXPENSES_KEY = 'small_shop_expenses_v1';

class ExpenseService {
  getExpenses(): Expense[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(EXPENSES_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data) as Expense[];
    } catch {
      return [];
    }
  }

  addExpense(expense: Omit<Expense, 'id'>): Expense {
    const expenses = this.getExpenses();
    const newExpense: Expense = {
      ...expense,
      id: `expense-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newExpense, ...expenses];
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(updated));
    return newExpense;
  }
}

export const expenseService = new ExpenseService();
