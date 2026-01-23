import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert,
  Platform, SafeAreaView, KeyboardAvoidingView,
  FlatList, Switch, Share,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as db from '../db';
import { styles } from './styles';
import { Transaction, RecurringTransaction, FormData, MonthlyInsight, TabType, Frequency, TransactionType } from './types';
import Icon from '../../components/Icon';
import { TransactionItem, RecurringItem } from '../../components/TransactionItem';

const FinanceTracker: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    description: '', amount: '', type: 'expense', category: 'Groceries',
    payment: 'Bank', isRecurring: false, frequency: 'monthly',
    nextDueDate: new Date().toISOString().split('T')[0]
  });

  const categories: Record<TransactionType, string[]> = {
    expense: ['Groceries', 'Restaurant & Dining', 'Fast Food & Snacks', 'Clothing & Accessories',
      'Electronics', 'Household Items', 'Personal Care & Beauty', 'Healthcare & Medical',
      'Public Transport', 'Gas & Fuel', 'Rent & Mortgage', 'Utilities (Electric, Water, Gas)',
      'Internet & Phone Bills', 'Subscriptions (Netflix, Spotify, etc)', 'Insurance',
      'Education & Courses', 'Entertainment & Movies', 'Travel & Vacation', 'Gifts & Donations',
      'Pet Care', 'Radio Tax', 'Other Expenses'],
    income: ['Salary', 'Freelance Work', 'Part-time Job', 'Business Income', 'Investment Returns',
      'Dividends', 'Rental Income', 'Gift Received', 'Bonus', 'Commission', 'Other Income']
  };

  const initialData: Transaction[] = [
    { id: 1, date: "2025-12-03", description: "Groceries", amount: -4.99, type: "expense", category: "Groceries", payment: "Bank" },
    { id: 2, date: "2025-12-03", description: "Netto", amount: -4.92, type: "expense", category: "Groceries", payment: "" },
    { id: 3, date: "2025-12-05", description: "DM", amount: -3.95, type: "expense", category: "Personal Care & Beauty", payment: "" },
    { id: 4, date: "2025-12-05", description: "LIDL", amount: -14.64, type: "expense", category: "Groceries", payment: "Bank" },
    { id: 5, date: "2025-12-08", description: "Aldi", amount: -23.21, type: "expense", category: "Groceries", payment: "" },
    { id: 6, date: "2025-12-10", description: "Frankfurt Expedition", amount: -10.35, type: "expense", category: "Public Transport", payment: "" },
    { id: 7, date: "2025-12-22", description: "Air Fryer", amount: -23.26, type: "expense", category: "Household Items", payment: "Bank" }
  ];

  useEffect(() => { loadData(); }, []);
  useEffect(() => { checkAndAddRecurringTransactions(); }, [selectedMonth, recurringTransactions]);

  const loadData = async () => {
    try {
      await db.initializeDatabase();
      const { transactions: txs, recurringTransactions: recs } = await db.getAllData();
      if (txs.length === 0) {
        // Initialize with sample data if empty
        for (const tx of initialData) {
          await db.addTransaction(tx);
        }
        const newTxs = await db.getAllData();
        setTransactions(newTxs.transactions);
      } else {
        setTransactions(txs);
      }
      setRecurringTransactions(recs);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const checkAndAddRecurringTransactions = async () => {
    if (recurringTransactions.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    let updated = false;
    const newTransactions = [...transactions];
    const updatedRecurring = recurringTransactions.map(rt => {
      if (rt.nextDueDate <= today) {
        const newId = Math.max(...newTransactions.map(t => t.id), 0) + 1;
        newTransactions.push({
          id: newId, date: today, description: rt.description + ' (Auto)',
          amount: rt.amount, type: rt.type, category: rt.category, payment: rt.payment
        });
        updated = true;
        return { ...rt, nextDueDate: calculateNextDate(today, rt.frequency) };
      }
      return rt;
    });
    if (updated) {
      try {
        for (const tx of newTransactions) {
          const existsLocally = transactions.find(t => t.id === tx.id);
          if (!existsLocally) {
            await db.addTransaction(tx);
          }
        }
        for (const rt of updatedRecurring) {
          const changed = recurringTransactions.find(r => r.id === rt.id && r.nextDueDate !== rt.nextDueDate);
          if (changed) {
            await db.updateRecurringTransaction(rt.id, rt);
          }
        }
        setTransactions(newTransactions);
        setRecurringTransactions(updatedRecurring);
      } catch (error) {
        console.error('Error adding recurring transactions:', error);
      }
    }
  };

  const calculateNextDate = (currentDate: string, frequency: Frequency): string => {
    const date = new Date(currentDate);
    if (frequency === 'daily') date.setDate(date.getDate() + 1);
    else if (frequency === 'weekly') date.setDate(date.getDate() + 7);
    else date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  };

  const getSmartSuggestions = (): Transaction[] => {
    if (!formData.description || formData.description.length < 2) return [];
    const desc = formData.description.toLowerCase();
    const matches = transactions.filter(t =>
      t.description.toLowerCase().includes(desc) && t.description.toLowerCase() !== desc
    );
    const suggestionMap: Record<string, Transaction & { count: number }> = {};
    matches.forEach(t => {
      const key = `${t.description}-${t.category}-${Math.abs(t.amount)}`;
      if (!suggestionMap[key]) suggestionMap[key] = { ...t, count: 0 };
      suggestionMap[key].count++;
    });
    return Object.values(suggestionMap).sort((a, b) => b.count - a.count).slice(0, 5);
  };

  const applySuggestion = (suggestion: Transaction) => {
    setFormData({
      ...formData, description: suggestion.description,
      amount: Math.abs(suggestion.amount).toString(), type: suggestion.type,
      category: suggestion.category, payment: suggestion.payment || 'Bank'
    });
    setShowSuggestions(false);
  };

  const getMonthlyData = () => {
    const filtered = transactions.filter(t => t.date.startsWith(selectedMonth));
    const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const allMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort();
    const idx = allMonths.indexOf(selectedMonth);
    let carryForward = 0;
    if (idx > 0) {
      for (let i = 0; i < idx; i++) {
        const monthTx = transactions.filter(t => t.date.startsWith(allMonths[i]));
        const exp = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
        const inc = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        carryForward += (inc - exp);
      }
    }
    const balance = income - expenses;
    return { transactions: filtered, expenses, income, balance, carryForward, totalBalance: carryForward + balance };
  };

  const getMonthlyInsights = (): MonthlyInsight | null => {
    const allMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort();
    const currentMonthIndex = allMonths.indexOf(selectedMonth);
    if (currentMonthIndex < 1) return null;

    const previousMonth = allMonths[currentMonthIndex - 1];
    const currentTx = transactions.filter(t => t.date.startsWith(selectedMonth));
    const previousTx = transactions.filter(t => t.date.startsWith(previousMonth));

    const currentExpenses = currentTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const previousExpenses = previousTx.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const currentIncome = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const previousIncome = previousTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const currentCats: Record<string, number> = {};
    const previousCats: Record<string, number> = {};

    currentTx.filter(t => t.type === 'expense').forEach(t => {
      currentCats[t.category] = (currentCats[t.category] || 0) + Math.abs(t.amount);
    });
    previousTx.filter(t => t.type === 'expense').forEach(t => {
      previousCats[t.category] = (previousCats[t.category] || 0) + Math.abs(t.amount);
    });

    const categoryChanges = Array.from(new Set([...Object.keys(currentCats), ...Object.keys(previousCats)]))
      .map(cat => {
        const current = currentCats[cat] || 0;
        const previous = previousCats[cat] || 0;
        const change = current - previous;
        const percentChange = previous > 0 ? ((change / previous) * 100) : (current > 0 ? 100 : 0);
        return { category: cat, current, previous, change, percentChange };
      })
      .filter(c => Math.abs(c.change) > 0.01)
      .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
      .slice(0, 10);

    return {
      previousMonth, currentTotalExpenses: currentExpenses, previousTotalExpenses: previousExpenses,
      expenseChange: currentExpenses - previousExpenses,
      expensePercentChange: previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses * 100) : 0,
      currentTotalIncome: currentIncome, previousTotalIncome: previousIncome,
      incomeChange: currentIncome - previousIncome,
      incomePercentChange: previousIncome > 0 ? ((currentIncome - previousIncome) / previousIncome * 100) : 0,
      categoryChanges
    };
  };

  const handleSave = async () => {
    if (!formData.description || !formData.amount) return;
    const amount = formData.type === 'expense' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount));

    try {
      if (formData.isRecurring) {
        let updatedRecurring: RecurringTransaction[];
        if (editingId && editingId.toString().startsWith('r')) {
          const recId = parseInt(editingId.toString().substring(1));
          await db.updateRecurringTransaction(recId, {
            description: formData.description, amount, type: formData.type,
            category: formData.category, payment: formData.payment,
            frequency: formData.frequency, nextDueDate: formData.nextDueDate
          });
          updatedRecurring = recurringTransactions.map(rt =>
            rt.id === recId ? { ...rt, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment, frequency: formData.frequency, nextDueDate: formData.nextDueDate } : rt
          );
        } else {
          await db.addRecurringTransaction({
            description: formData.description, amount, type: formData.type,
            category: formData.category, payment: formData.payment,
            frequency: formData.frequency, nextDueDate: formData.nextDueDate
          });
          const newId = Math.max(...recurringTransactions.map(r => r.id), 0) + 1;
          updatedRecurring = [...recurringTransactions, { id: newId, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment, frequency: formData.frequency, nextDueDate: formData.nextDueDate }];
        }
        setRecurringTransactions(updatedRecurring);
      } else {
        let updatedTransactions: Transaction[];
        if (editingId && !editingId.toString().startsWith('r')) {
          await db.updateTransaction(editingId as number, {
            date: formData.date, description: formData.description, amount,
            type: formData.type, category: formData.category, payment: formData.payment
          });
          updatedTransactions = transactions.map(t =>
            t.id === editingId ? { ...t, date: formData.date, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment } : t
          );
        } else {
          await db.addTransaction({
            date: formData.date, description: formData.description, amount,
            type: formData.type, category: formData.category, payment: formData.payment
          });
          const newId = Math.max(...transactions.map(t => t.id), 0) + 1;
          updatedTransactions = [...transactions, { id: newId, date: formData.date, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment }];
        }
        setTransactions(updatedTransactions);
      }
      setFormData({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'expense', category: 'Groceries', payment: 'Bank', isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0] });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to save transaction: ' + (error as Error).message);
    }
  };

  const handleEdit = (t: Transaction) => {
    setFormData({ date: t.date, description: t.description, amount: Math.abs(t.amount).toString(), type: t.type, category: t.category, payment: t.payment || '', isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0] });
    setEditingId(t.id);
    setShowForm(true);
    setActiveTab('transactions');
  };

  const handleEditRecurring = (rt: RecurringTransaction) => {
    setFormData({ date: new Date().toISOString().split('T')[0], description: rt.description, amount: Math.abs(rt.amount).toString(), type: rt.type, category: rt.category, payment: rt.payment || '', isRecurring: true, frequency: rt.frequency, nextDueDate: rt.nextDueDate });
    setEditingId('r' + rt.id);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await db.deleteTransaction(id);
            const updated = transactions.filter(t => t.id !== id);
            setTransactions(updated);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete transaction');
          }
        }
      }
    ]);
  };

  const handleDeleteRecurring = (id: number) => {
    Alert.alert('Delete Recurring Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await db.deleteRecurringTransaction(id);
            const updated = recurringTransactions.filter(rt => rt.id !== id);
            setRecurringTransactions(updated);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete recurring transaction');
          }
        }
      }
    ]);
  };

  const exportToJSON = async () => {
    try {
      Alert.alert(
        'Export Data',
        'Choose export format:',
        [
          {
            text: 'TXT (Android Compatible)',
            onPress: async () => {
              try {
                const jsonString = JSON.stringify({ transactions, recurringTransactions }, null, 2);
                const filename = `finance-tracker-${new Date().toISOString().split('T')[0]}.txt`;

                const cacheDir = (FileSystem as any).cacheDirectory;
                if (cacheDir) {
                  const fileUri = `${cacheDir}${filename}`;
                  await FileSystem.writeAsStringAsync(fileUri, jsonString);

                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: 'text/plain',
                      dialogTitle: `Share ${filename}`,
                    });
                    Alert.alert('Success', 'Data exported as TXT file!');
                    return;
                  }
                }

                // Fallback
                await Share.share({
                  message: jsonString,
                  title: filename,
                });
                Alert.alert('Success', 'Data exported and ready to share!');
              } catch (error) {
                Alert.alert('Error', 'Failed to export: ' + (error as Error).message);
              }
            }
          },
          {
            text: 'JSON',
            onPress: async () => {
              try {
                const jsonString = JSON.stringify({ transactions, recurringTransactions }, null, 2);
                const filename = `finance-tracker-${new Date().toISOString().split('T')[0]}.json`;

                const cacheDir = (FileSystem as any).cacheDirectory;
                if (cacheDir) {
                  const fileUri = `${cacheDir}${filename}`;
                  await FileSystem.writeAsStringAsync(fileUri, jsonString);

                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri, {
                      mimeType: 'application/json',
                      dialogTitle: `Share ${filename}`,
                    });
                    Alert.alert('Success', 'Data exported as JSON file!');
                    return;
                  }
                }

                // Fallback
                await Share.share({
                  message: jsonString,
                  title: filename,
                });
                Alert.alert('Success', 'Data exported and ready to share!');
              } catch (error) {
                Alert.alert('Error', 'Failed to export: ' + (error as Error).message);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to export data: ' + (error as Error).message);
    }
  };

  const importFromJSON = async () => {
    try {
      // Support both .txt and .json files (and database files)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream', 'application/x-sqlite3']
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const fileUri = result.assets[0].uri;
        const filename = result.assets[0].name;

        // Check if it's a database file
        if (filename.endsWith('.db')) {
          // For now, show instructions to replace database
          Alert.alert(
            'SQLite Database Import',
            'Database imports require app restart. This feature will be available in the next update.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Handle JSON and TXT import
        const content = await (await fetch(fileUri)).text();
        const data = JSON.parse(content);

        // Handle both formats: { transactions: [...], recurringTransactions: [...] } and just [...]
        let txs: Transaction[] = [];
        let recs: RecurringTransaction[] = [];

        if (Array.isArray(data)) {
          // Format: just an array of transactions
          txs = data;
          recs = [];
        } else if (data.transactions && Array.isArray(data.transactions)) {
          // Format: { transactions: [...], recurringTransactions: [...] }
          txs = data.transactions;
          recs = data.recurringTransactions || [];
        } else {
          Alert.alert('Error', 'Invalid JSON format. Expected transactions array or { transactions: [...] } object.');
          return;
        }

        Alert.alert(
          'Import Data',
          `Found ${txs.length} transactions and ${recs.length} recurring transactions.\n\nHow would you like to import?`,
          [
            {
              text: 'Merge',
              onPress: async () => {
                try {
                  const mergedTx = [
                    ...transactions,
                    ...txs.map((t: Transaction) => ({ ...t, id: Math.max(...transactions.map((x: Transaction) => x.id), 0) + Math.random() }))
                  ];
                  const mergedRec = [
                    ...recurringTransactions,
                    ...recs.map((rt: RecurringTransaction) => ({ ...rt, id: Math.max(...recurringTransactions.map((x: RecurringTransaction) => x.id), 0) + Math.random() }))
                  ];

                  // Save merged data to database
                  for (const tx of txs) {
                    await db.addTransaction(tx);
                  }
                  for (const rt of recs) {
                    await db.addRecurringTransaction(rt);
                  }

                  setTransactions(mergedTx);
                  setRecurringTransactions(mergedRec);
                  Alert.alert('Success', 'Data merged successfully!');
                } catch (error) {
                  Alert.alert('Error', 'Failed to merge data: ' + (error as Error).message);
                }
              }
            },
            {
              text: 'Replace',
              onPress: async () => {
                try {
                  await db.clearAllData();

                  for (const tx of txs) {
                    await db.addTransaction(tx);
                  }
                  for (const rt of recs) {
                    await db.addRecurringTransaction(rt);
                  }

                  setTransactions(txs);
                  setRecurringTransactions(recs);
                  Alert.alert('Success', 'Data replaced successfully!');
                } catch (error) {
                  Alert.alert('Error', 'Failed to replace data: ' + (error as Error).message);
                }
              },
              style: 'destructive'
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to import data: ' + (error as Error).message);
    }
  };

  const monthlyData = getMonthlyData();
  const sortedTransactions = [...monthlyData.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const availableMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const smartSuggestions = getSmartSuggestions();
  const insights = getMonthlyInsights();
  const categoryBreakdown = Object.entries(
    monthlyData.transactions.filter(t => t.type === 'expense').reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Icon name="dollar" size={32} color="#60a5fa" />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Finance Tracker</Text>
                <Text style={styles.subtitle}>Made by Mirang Bhandari</Text>
              </View>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.monthButton} onPress={() => setShowMonthPicker(true)} accessibilityLabel="Select month">
                <Icon name="calendar" size={16} color="#fff" />
                <Text style={styles.monthButtonText}>{new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportButton} onPress={importFromJSON} accessibilityLabel="Import data from JSON">
                <Icon name="upload" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportButton} onPress={exportToJSON} accessibilityLabel="Export data">
                <Icon name="download" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, styles.expenseCard]}>
              <Text style={styles.statLabel}>Expenses</Text>
              <Text style={styles.statValue}>€{monthlyData.expenses.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, styles.incomeCard]}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={styles.statValue}>€{monthlyData.income.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, styles.balanceCard]}>
              <Text style={styles.statLabel}>Balance</Text>
              <Text style={[styles.statValue, monthlyData.balance < 0 && { color: '#fca5a5' }]}>€{monthlyData.balance.toFixed(2)}</Text>
            </View>
            <View style={[styles.statCard, styles.totalCard]}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={[styles.statValue, monthlyData.totalBalance < 0 && { color: '#fca5a5' }]}>€{monthlyData.totalBalance.toFixed(2)}</Text>
            </View>
          </View>

          {/* Carryforward Section */}
          {monthlyData.carryForward !== 0 && (
            <View style={[styles.statCard, { marginHorizontal: 12, marginVertical: 8, borderColor: '#3b82f6', borderWidth: 1.5 }]}>
              <Text style={styles.statLabel}>Carried from Previous Months</Text>
              <Text style={[styles.statValue, monthlyData.carryForward < 0 && { color: '#fca5a5' }]}>€{monthlyData.carryForward.toFixed(2)}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                {monthlyData.carryForward > 0 ? '+' : ''}€{monthlyData.carryForward.toFixed(2)} included in total
              </Text>
            </View>
          )}

          {/* Categories */}
          {categoryBreakdown.length > 0 && (
            <View style={styles.categoryContainer}>
              <Text style={styles.categoryTitle}><Icon name="pie" size={16} /> All Categories</Text>
              <View style={styles.categoryGrid}>
                {categoryBreakdown.map(([cat, amount]) => (
                  <View key={cat} style={styles.categoryItem}>
                    <Text style={styles.categoryName} numberOfLines={1}>{cat}</Text>
                    <Text style={styles.categoryAmount}>€{amount.toFixed(2)}</Text>
                    <Text style={styles.categoryPercent}>{((amount / monthlyData.expenses) * 100).toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Button */}
          <TouchableOpacity style={styles.addButton} onPress={() => { setShowForm(!showForm); setEditingId(null); setFormData({ date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'expense', category: 'Groceries', payment: 'Bank', isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0] }); }} accessibilityLabel={showForm ? 'Cancel adding transaction' : 'Add new transaction'}>
            <View style={styles.addButtonGradient}>
              <Icon name={showForm ? 'close' : 'plus'} size={20} />
              <Text style={styles.addButtonText}>{showForm ? 'Cancel' : 'Add'}</Text>
            </View>
          </TouchableOpacity>

          {/* Form */}
          {showForm && (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>{editingId ? 'Edit' : 'New'} Transaction</Text>

              <View style={styles.typeSelector}>
                <TouchableOpacity style={[styles.typeButton, formData.type === 'expense' && styles.typeButtonActive]} onPress={() => setFormData({ ...formData, type: 'expense', category: 'Groceries' })} accessibilityLabel="Expense">
                  <Text style={formData.type === 'expense' ? styles.typeTextActive : styles.typeText}>Expense</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeButton, formData.type === 'income' && styles.typeButtonActiveIncome]} onPress={() => setFormData({ ...formData, type: 'income', category: 'Salary' })} accessibilityLabel="Income">
                  <Text style={formData.type === 'income' ? styles.typeTextActive : styles.typeText}>Income</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.checkboxContainer}>
                <Switch value={formData.isRecurring} onValueChange={(v) => setFormData({ ...formData, isRecurring: v })} thumbColor={formData.isRecurring ? '#2563eb' : '#475569'} trackColor={{ false: '#334155', true: '#1e40af' }} accessibilityLabel="Make recurring" />
                <Text style={styles.checkboxLabel}>Recurring</Text>
              </View>

              <Text style={styles.label}>Description</Text>
              <View style={styles.inputWrapper}>
                <TextInput style={styles.input} value={formData.description} onChangeText={(t) => { setFormData({ ...formData, description: t }); setShowSuggestions(t.length >= 2); }} placeholder="e.g., Aldi" placeholderTextColor="#9ca3af" />
                {smartSuggestions.length > 0 && <Icon name="sparkles" size={16} color="#fbbf24" />}
              </View>

              {showSuggestions && smartSuggestions.length > 0 && (
                <FlatList data={smartSuggestions} keyExtractor={(_, i) => i.toString()} scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.suggestionItem} onPress={() => applySuggestion(item)}>
                      <View><Text style={styles.suggestionDesc}>{item.description}</Text><Text style={styles.suggestionMeta}>{item.category} • €{Math.abs(item.amount).toFixed(2)}</Text></View>
                      <Icon name="sparkles" size={14} color="#fbbf24" />
                    </TouchableOpacity>
                  )}
                />
              )}

              <Text style={styles.label}>Amount (€)</Text>
              <TextInput style={styles.input} value={formData.amount} onChangeText={(t) => setFormData({ ...formData, amount: t })} placeholder="15.50" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />

              {!formData.isRecurring ? (
                <>
                  <Text style={styles.label}>Date</Text>
                  <TextInput style={styles.input} value={formData.date} onChangeText={(t) => setFormData({ ...formData, date: t })} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />
                </>
              ) : (
                <>
                  <Text style={styles.label}>Frequency</Text>
                  <View style={styles.frequencyButtons}>
                    {['daily', 'weekly', 'monthly'].map(f => (
                      <TouchableOpacity key={f} style={[styles.freqButton, formData.frequency === f && styles.freqButtonActive]} onPress={() => setFormData({ ...formData, frequency: f as Frequency })} accessibilityLabel={`${f} frequency`}>
                        <Text style={formData.frequency === f ? styles.freqButtonTextActive : styles.freqButtonText}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.label}>Next Due Date</Text>
                  <TextInput style={styles.input} value={formData.nextDueDate} onChangeText={(t) => setFormData({ ...formData, nextDueDate: t })} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />
                </>
              )}

              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories[formData.type].map(cat => (
                  <TouchableOpacity key={cat} style={[styles.categoryChip, formData.category === cat && styles.categoryChipActive]} onPress={() => setFormData({ ...formData, category: cat })} accessibilityLabel={cat}>
                    <Text style={[styles.categoryChipText, formData.category === cat && styles.categoryChipTextActive]} numberOfLines={1}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave} accessibilityLabel="Save transaction">
                <Icon name="save" size={20} />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)} accessibilityLabel="Cancel">
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {(['transactions', 'recurring', 'insights'] as const).map(tab => (
              <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)} accessibilityLabel={`${tab} tab`}>
                <Icon name={tab === 'insights' ? 'sparkles' : tab === 'recurring' ? 'repeat' : 'pie'} size={14} color={activeTab === tab ? '#fff' : '#9ca3af'} />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'transactions' ? `Txn (${sortedTransactions.length})` : tab === 'recurring' ? `Rec (${recurringTransactions.length})` : 'Insights'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Transactions */}
          {activeTab === 'transactions' && (
            <View style={styles.listContainer}>
              {sortedTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions</Text>
              ) : (
                sortedTransactions.map((t) => (
                  <TransactionItem key={t.id} item={t} onEdit={handleEdit} onDelete={handleDelete} />
                ))
              )}
            </View>
          )}

          {/* Recurring */}
          {activeTab === 'recurring' && (
            <View style={styles.listContainer}>
              {recurringTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No recurring transactions</Text>
              ) : (
                recurringTransactions.map((rt) => (
                  <RecurringItem key={rt.id} item={rt} onEdit={handleEditRecurring} onDelete={handleDeleteRecurring} />
                ))
              )}
            </View>
          )}

          {/* Insights */}
          {activeTab === 'insights' && (
            <View style={styles.listContainer}>
              {!insights ? (
                <View style={styles.emptyContainer}>
                  <Icon name="insights" size={48} color="#6b7280" />
                  <Text style={styles.emptyText}>Need 2+ months for insights</Text>
                </View>
              ) : (
                <>
                  <View style={[styles.insightCard, { backgroundColor: '#7f1d1d' }]}>
                    <Text style={styles.insightLabel}>Expenses vs Last Month</Text>
                    <View style={styles.insightRow}>
                      <View><Text style={styles.insightSmall}>Current</Text><Text style={styles.insightBig}>€{insights.currentTotalExpenses.toFixed(2)}</Text></View>
                      <View style={styles.insightDelta}><Icon name={insights.expenseChange > 0 ? 'up' : 'down'} size={16} color={insights.expenseChange > 0 ? '#fca5a5' : '#86efac'} /><Text style={[styles.insightDeltaText, { color: insights.expenseChange > 0 ? '#fca5a5' : '#86efac' }]}>{insights.expenseChange > 0 ? '+' : ''}€{insights.expenseChange.toFixed(2)}</Text></View>
                    </View>
                  </View>

                  <View style={[styles.insightCard, { backgroundColor: '#14532d' }]}>
                    <Text style={styles.insightLabel}>Income vs Last Month</Text>
                    <View style={styles.insightRow}>
                      <View><Text style={styles.insightSmall}>Current</Text><Text style={styles.insightBig}>€{insights.currentTotalIncome.toFixed(2)}</Text></View>
                      <View style={styles.insightDelta}><Icon name={insights.incomeChange > 0 ? 'up' : 'down'} size={16} color={insights.incomeChange > 0 ? '#86efac' : '#fca5a5'} /><Text style={[styles.insightDeltaText, { color: insights.incomeChange > 0 ? '#86efac' : '#fca5a5' }]}>{insights.incomeChange > 0 ? '+' : ''}€{insights.incomeChange.toFixed(2)}</Text></View>
                    </View>
                  </View>

                  {insights.categoryChanges.length > 0 && (
                    <View style={[styles.insightCard, { backgroundColor: '#1e293b' }]}>
                      <Text style={styles.insightLabel}>Top Changes</Text>
                      {insights.categoryChanges.slice(0, 3).map((cat, i) => (
                        <View key={i} style={styles.changeItem}>
                          <View><Text style={styles.changeCat}>{cat.category}</Text><Text style={styles.changeMeta}>€{cat.previous.toFixed(2)} → €{cat.current.toFixed(2)}</Text></View>
                          <Text style={[styles.changePercent, { color: Math.abs(cat.percentChange) > 50 ? '#fbbf24' : cat.change > 0 ? '#fca5a5' : '#86efac' }]}>{cat.percentChange > 0 ? '+' : ''}{cat.percentChange.toFixed(0)}%</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Month Picker Modal */}
          <Modal visible={showMonthPicker} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: '#1e293b' }]}>
                <Text style={styles.modalTitle}>Select Month</Text>
                <ScrollView>
                  {availableMonths.map(m => (
                    <TouchableOpacity key={m} style={styles.monthOption} onPress={() => { setSelectedMonth(m); setShowMonthPicker(false); }} accessibilityLabel={`Select ${m}`}>
                      <Text style={styles.monthOptionText}>{new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowMonthPicker(false)} accessibilityLabel="Close">
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default FinanceTracker;