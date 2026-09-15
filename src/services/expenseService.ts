// src/services/expenseService.ts
import { Expense } from '../types';
import { indexedDbService } from './indexedDbService';

class ExpenseService {
  async getExpenses(): Promise<Expense[]> {
    return indexedDbService.getAll<Expense>('expenses');
  }

  async addExpense(expense: Expense): Promise<Expense> {
    return indexedDbService.put<Expense>('expenses', expense);
  }
}

export const expenseService = new ExpenseService();
