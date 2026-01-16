import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  payment: string;
}

export interface RecurringTransaction {
  id: number;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  payment: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDueDate: string;
}

let db: SQLite.SQLiteDatabase | null = null;

export const initializeDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('finance_tracker.db');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        payment TEXT DEFAULT 'Bank'
      );
      
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        payment TEXT DEFAULT 'Bank',
        frequency TEXT NOT NULL,
        nextDueDate TEXT NOT NULL
      );
    `);
    
    // Migrate from AsyncStorage if needed
    await migrateFromAsyncStorage();
    
    return db;
  } catch (error) {
    console.error('Database init error:', error);
    // Reset migration flag on error so it retries
    try {
      await AsyncStorage.removeItem('migrated_to_sqlite');
    } catch (e) {
      // ignore
    }
    throw error;
  }
};

const migrateFromAsyncStorage = async () => {
  try {
    const migrated = await AsyncStorage.getItem('migrated_to_sqlite');
    if (migrated) return; // Already migrated

    const transactionsStr = await AsyncStorage.getItem('transactions');
    const recurringStr = await AsyncStorage.getItem('recurring_transactions');

    if (transactionsStr) {
      const transactions = JSON.parse(transactionsStr) as Transaction[];
      for (const tx of transactions) {
        // Ensure payment has a value
        const txWithPayment = { ...tx, payment: tx.payment || 'Bank' };
        await addTransaction(txWithPayment);
      }
    }

    if (recurringStr) {
      const recurring = JSON.parse(recurringStr) as RecurringTransaction[];
      for (const rt of recurring) {
        // Ensure payment has a value
        const rtWithPayment = { ...rt, payment: rt.payment || 'Bank' };
        await addRecurringTransaction(rtWithPayment);
      }
    }

    await AsyncStorage.setItem('migrated_to_sqlite', 'true');
    console.log('Migration complete');
  } catch (error) {
    console.error('Migration error:', error);
  }
};

export const getDatabase = () => {
  if (!db) throw new Error('Database not initialized');
  return db;
};

// Transactions
export const getTransactions = async (): Promise<Transaction[]> => {
  const database = getDatabase();
  const result = await database.getAllAsync('SELECT * FROM transactions ORDER BY date DESC');
  return result as Transaction[];
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
  const database = getDatabase();
  const result = await database.runAsync(
    'INSERT INTO transactions (date, description, amount, type, category, payment) VALUES (?, ?, ?, ?, ?, ?)',
    [transaction.date, transaction.description, transaction.amount, transaction.type, transaction.category, transaction.payment]
  );
  return result.lastInsertRowId;
};

export const updateTransaction = async (id: number, transaction: Omit<Transaction, 'id'>) => {
  const database = getDatabase();
  await database.runAsync(
    'UPDATE transactions SET date=?, description=?, amount=?, type=?, category=?, payment=? WHERE id=?',
    [transaction.date, transaction.description, transaction.amount, transaction.type, transaction.category, transaction.payment, id]
  );
};

export const deleteTransaction = async (id: number) => {
  const database = getDatabase();
  await database.runAsync('DELETE FROM transactions WHERE id=?', [id]);
};

// Recurring Transactions
export const getRecurringTransactions = async (): Promise<RecurringTransaction[]> => {
  const database = getDatabase();
  const result = await database.getAllAsync('SELECT * FROM recurring_transactions');
  return result as RecurringTransaction[];
};

export const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, 'id'>) => {
  const database = getDatabase();
  const result = await database.runAsync(
    'INSERT INTO recurring_transactions (description, amount, type, category, payment, frequency, nextDueDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [transaction.description, transaction.amount, transaction.type, transaction.category, transaction.payment, transaction.frequency, transaction.nextDueDate]
  );
  return result.lastInsertRowId;
};

export const updateRecurringTransaction = async (id: number, transaction: Omit<RecurringTransaction, 'id'>) => {
  const database = getDatabase();
  await database.runAsync(
    'UPDATE recurring_transactions SET description=?, amount=?, type=?, category=?, payment=?, frequency=?, nextDueDate=? WHERE id=?',
    [transaction.description, transaction.amount, transaction.type, transaction.category, transaction.payment, transaction.frequency, transaction.nextDueDate, id]
  );
};

export const deleteRecurringTransaction = async (id: number) => {
  const database = getDatabase();
  await database.runAsync('DELETE FROM recurring_transactions WHERE id=?', [id]);
};

// Bulk operations
export const getAllData = async () => {
  return {
    transactions: await getTransactions(),
    recurringTransactions: await getRecurringTransactions(),
  };
};

export const clearAllData = async () => {
  const database = getDatabase();
  try {
    await database.runAsync('DELETE FROM transactions');
    await database.runAsync('DELETE FROM recurring_transactions');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

export const getDatabasePath = async () => {
  // Database is stored in app's document directory with name 'finance_tracker.db'
  // Typically located at: <app-documents>/SQLite/finance_tracker.db
  return 'finance_tracker.db';
};
