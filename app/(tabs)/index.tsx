import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Types
interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  payment: string;
}

interface RecurringTransaction {
  id: number;
  description: string;
  amount: number;
  type: 'expense' | 'income';
  category: string;
  payment: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDueDate: string;
}

interface FormData {
  date: string;
  description: string;
  amount: string;
  type: 'expense' | 'income';
  category: string;
  payment: string;
  isRecurring: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextDueDate: string;
}

interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

// Icon component
const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#fff' }) => {
  const icons: Record<string, string> = {
    plus: '+',
    trash: '🗑️',
    down: '↓',
    up: '↑',
    dollar: '$',
    edit: '✏️',
    close: '✕',
    save: '💾',
    download: '⬇️',
    calendar: '📅',
    pie: '📊',
    database: '💾',
    folder: '📁',
    repeat: '🔄',
    sparkles: '✨',
  };
  return <Text style={{ fontSize: size, color }}>{icons[name] || '•'}</Text>;
};

const FinanceTracker: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring'>('transactions');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense',
    category: 'Groceries',
    payment: 'Bank',
    isRecurring: false,
    frequency: 'monthly',
    nextDueDate: new Date().toISOString().split('T')[0]
  });

  const categories: Record<'expense' | 'income', string[]> = {
    expense: ['Groceries', 'Restaurant & Dining', 'Fast Food & Snacks', 'Clothing & Accessories', 
      'Electronics', 'Household Items', 'Personal Care & Beauty', 'Healthcare & Medical', 
      'Public Transport', 'Gas & Fuel', 'Rent & Mortgage', 'Utilities (Electric, Water, Gas)', 
      'Internet & Phone Bills', 'Subscriptions (Netflix, Spotify, etc)', 'Insurance', 
      'Education & Courses', 'Entertainment & Movies', 'Travel & Vacation', 'Gifts & Donations', 
      'Pet Care', 'Other Expenses'],
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    checkAndAddRecurringTransactions();
  }, [selectedMonth, recurringTransactions, transactions]);

  const loadData = async () => {
    try {
      const txData = await AsyncStorage.getItem('transactions');
      const recData = await AsyncStorage.getItem('recurringTransactions');
      
      if (txData) {
        setTransactions(JSON.parse(txData));
      } else {
        setTransactions(initialData);
        await AsyncStorage.setItem('transactions', JSON.stringify(initialData));
      }
      
      if (recData) {
        setRecurringTransactions(JSON.parse(recData));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveData = async (txs?: Transaction[], recs?: RecurringTransaction[]) => {
    try {
      await AsyncStorage.setItem('transactions', JSON.stringify(txs || transactions));
      if (recs) {
        await AsyncStorage.setItem('recurringTransactions', JSON.stringify(recs));
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const checkAndAddRecurringTransactions = () => {
    if (recurringTransactions.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    let updated = false;
    const newTransactions = [...transactions];
    const updatedRecurring = recurringTransactions.map(rt => {
      if (rt.nextDueDate <= today) {
        const newId = Math.max(...newTransactions.map(t => t.id), 0) + 1;
        newTransactions.push({
          id: newId,
          date: today,
          description: rt.description + ' (Auto)',
          amount: rt.amount,
          type: rt.type,
          category: rt.category,
          payment: rt.payment
        });
        
        const nextDate = calculateNextDate(today, rt.frequency);
        updated = true;
        return { ...rt, nextDueDate: nextDate };
      }
      return rt;
    });

    if (updated) {
      setTransactions(newTransactions);
      setRecurringTransactions(updatedRecurring);
      saveData(newTransactions, updatedRecurring);
    }
  };

  const calculateNextDate = (currentDate: string, frequency: 'daily' | 'weekly' | 'monthly'): string => {
    const date = new Date(currentDate);
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const getMonthlyData = () => {
    const filtered = transactions.filter(t => t.date.startsWith(selectedMonth));
    const expenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    
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

  const handleSave = async () => {
    if (!formData.description || !formData.amount) return;
    
    const amount = formData.type === 'expense' ? -Math.abs(parseFloat(formData.amount)) : Math.abs(parseFloat(formData.amount));
    
    if (formData.isRecurring) {
      let updatedRecurring: RecurringTransaction[];
      if (editingId && editingId.toString().startsWith('r')) {
        const recId = parseInt(editingId.toString().substring(1));
        updatedRecurring = recurringTransactions.map(rt => 
          rt.id === recId ? { ...rt, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment, frequency: formData.frequency, nextDueDate: formData.nextDueDate } : rt
        );
      } else {
        const newId = Math.max(...recurringTransactions.map(r => r.id), 0) + 1;
        updatedRecurring = [...recurringTransactions, { 
          id: newId, 
          description: formData.description,
          amount, 
          type: formData.type,
          category: formData.category,
          payment: formData.payment,
          frequency: formData.frequency,
          nextDueDate: formData.nextDueDate
        }];
      }
      setRecurringTransactions(updatedRecurring);
      await saveData(transactions, updatedRecurring);
    } else {
      let updatedTransactions: Transaction[];
      if (editingId && !editingId.toString().startsWith('r')) {
        updatedTransactions = transactions.map(t => 
          t.id === editingId ? { ...t, date: formData.date, description: formData.description, amount, type: formData.type, category: formData.category, payment: formData.payment } : t
        );
      } else {
        const newId = Math.max(...transactions.map(t => t.id), 0) + 1;
        updatedTransactions = [...transactions, { 
          id: newId, 
          date: formData.date,
          description: formData.description,
          amount,
          type: formData.type,
          category: formData.category,
          payment: formData.payment
        }];
      }
      setTransactions(updatedTransactions);
      await saveData(updatedTransactions, recurringTransactions);
    }
    
    setFormData({ 
      date: new Date().toISOString().split('T')[0], description: '', amount: '', 
      type: 'expense', category: 'Groceries', payment: 'Bank', 
      isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0]
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (t: Transaction) => {
    setFormData({
      date: t.date, description: t.description, amount: Math.abs(t.amount).toString(),
      type: t.type, category: t.category, payment: t.payment || '', 
      isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0]
    });
    setEditingId(t.id);
    setShowForm(true);
    setActiveTab('transactions');
  };

  const handleEditRecurring = (rt: RecurringTransaction) => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: rt.description, 
      amount: Math.abs(rt.amount).toString(),
      type: rt.type, 
      category: rt.category, 
      payment: rt.payment || '',
      isRecurring: true,
      frequency: rt.frequency,
      nextDueDate: rt.nextDueDate
    });
    setEditingId('r' + rt.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = transactions.filter(t => t.id !== id);
            setTransactions(updated);
            await saveData(updated, recurringTransactions);
          }
        }
      ]
    );
  };

  const handleDeleteRecurring = async (id: number) => {
    Alert.alert(
      'Delete Recurring Transaction',
      'Are you sure you want to delete this recurring transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = recurringTransactions.filter(rt => rt.id !== id);
            setRecurringTransactions(updated);
            await saveData(transactions, updated);
          }
        }
      ]
    );
  };

  const exportToJSON = async () => {
    try {
      const jsonString = JSON.stringify({ transactions, recurringTransactions }, null, 2);
      const fileUri = FileSystem.documentDirectory + `finance-tracker-${new Date().toISOString().split('T')[0]}.json`;
      await FileSystem.writeAsStringAsync(fileUri, jsonString);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', 'Data exported to: ' + fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data: ' + (error as Error).message);
    }
  };

  const monthlyData = getMonthlyData();
  const sortedTransactions = [...monthlyData.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const availableMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort().reverse();

  const getCategoryBreakdown = (filtered: Transaction[]): [string, number][] => {
    const breakdown: Record<string, number> = {};
    filtered.filter(t => t.type === 'expense').forEach(t => {
      breakdown[t.category] = (breakdown[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 4);
  };

  const categoryBreakdown = getCategoryBreakdown(monthlyData.transactions);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Icon name="database" size={32} color="#60a5fa" />
              <Text style={styles.title}>Finance Tracker</Text>
            </View>
            
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.monthButton}
                onPress={() => setShowMonthPicker(true)}
              >
                <Icon name="calendar" size={16} color="#fff" />
                <Text style={styles.monthButtonText}>
                  {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.exportButton}
                onPress={exportToJSON}
              >
                <Icon name="download" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Cards */}
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
              <Text style={[styles.statValue, monthlyData.balance < 0 && styles.negativeText]}>
                €{monthlyData.balance.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.statCard, styles.totalCard]}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={[styles.statValue, monthlyData.totalBalance < 0 && styles.negativeText]}>
                €{monthlyData.totalBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <View style={styles.categoryContainer}>
              <Text style={styles.categoryTitle}>Top Categories</Text>
              <View style={styles.categoryGrid}>
                {categoryBreakdown.map(([cat, amount]) => (
                  <View key={cat} style={styles.categoryItem}>
                    <Text style={styles.categoryName} numberOfLines={1}>{cat}</Text>
                    <Text style={styles.categoryAmount}>€{amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Button */}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ 
                date: new Date().toISOString().split('T')[0], description: '', amount: '', 
                type: 'expense', category: 'Groceries', payment: 'Bank',
                isRecurring: false, frequency: 'monthly', nextDueDate: new Date().toISOString().split('T')[0]
              });
            }}
          >
            <Icon name={showForm ? 'close' : 'plus'} size={20} />
            <Text style={styles.addButtonText}>{showForm ? 'Cancel' : 'Add Transaction'}</Text>
          </TouchableOpacity>

          {/* Form Modal */}
          <Modal visible={showForm} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <ScrollView>
                  <Text style={styles.modalTitle}>{editingId ? 'Edit' : 'New'} Transaction</Text>
                  
                  {/* Type Selector */}
                  <View style={styles.typeSelector}>
                    <TouchableOpacity 
                      style={[styles.typeButton, formData.type === 'expense' && styles.typeButtonActive]}
                      onPress={() => setFormData({...formData, type: 'expense', category: 'Groceries'})}
                    >
                      <Text style={formData.type === 'expense' ? styles.typeTextActive : styles.typeText}>
                        Expense
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.typeButton, formData.type === 'income' && styles.typeButtonActiveIncome]}
                      onPress={() => setFormData({...formData, type: 'income', category: 'Salary'})}
                    >
                      <Text style={formData.type === 'income' ? styles.typeTextActive : styles.typeText}>
                        Income
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Description */}
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.description}
                    onChangeText={(text) => setFormData({...formData, description: text})}
                    placeholder="e.g., Aldi"
                    placeholderTextColor="#9ca3af"
                  />

                  {/* Amount */}
                  <Text style={styles.label}>Amount (€)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.amount}
                    onChangeText={(text) => setFormData({...formData, amount: text})}
                    placeholder="15.50"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />

                  {/* Category */}
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {categories[formData.type].slice(0, 8).map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip,
                            formData.category === cat && styles.categoryChipActive
                          ]}
                          onPress={() => setFormData({...formData, category: cat})}
                        >
                          <Text style={[
                            styles.categoryChipText,
                            formData.category === cat && styles.categoryChipTextActive
                          ]} numberOfLines={1}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleSave}
                  >
                    <Icon name="save" size={20} />
                    <Text style={styles.saveButtonText}>Save Transaction</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => setShowForm(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
              onPress={() => setActiveTab('transactions')}
            >
              <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
                Transactions ({sortedTransactions.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'recurring' && styles.tabActive]}
              onPress={() => setActiveTab('recurring')}
            >
              <Text style={[styles.tabText, activeTab === 'recurring' && styles.tabTextActive]}>
                Recurring ({recurringTransactions.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transaction List */}
          {activeTab === 'transactions' && (
            <View style={styles.listContainer}>
              {sortedTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No transactions this month</Text>
              ) : (
                sortedTransactions.map((t) => (
                  <View key={t.id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <Text style={styles.transactionDate}>
                        {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </Text>
                      <View>
                        <Text style={styles.transactionDescription}>{t.description}</Text>
                        <Text style={styles.transactionCategory}>{t.category}</Text>
                      </View>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text style={[styles.transactionAmount, t.type === 'income' && styles.incomeAmount]}>
                        {t.type === 'expense' ? '-' : '+'}€{Math.abs(t.amount).toFixed(2)}
                      </Text>
                      <View style={styles.transactionActions}>
                        <TouchableOpacity onPress={() => handleEdit(t)}>
                          <Text style={styles.actionButton}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(t.id)}>
                          <Text style={styles.actionButton}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Recurring List */}
          {activeTab === 'recurring' && (
            <View style={styles.listContainer}>
              {recurringTransactions.length === 0 ? (
                <Text style={styles.emptyText}>No recurring transactions</Text>
              ) : (
                recurringTransactions.map((rt) => (
                  <View key={rt.id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <Text style={styles.recurringFrequency}>{rt.frequency}</Text>
                      <View>
                        <Text style={styles.transactionDescription}>{rt.description}</Text>
                        <Text style={styles.transactionCategory}>
                          Next: {new Date(rt.nextDueDate).toLocaleDateString('en-GB')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text style={[styles.transactionAmount, rt.type === 'income' && styles.incomeAmount]}>
                        {rt.type === 'expense' ? '-' : '+'}€{Math.abs(rt.amount).toFixed(2)}
                      </Text>
                      <View style={styles.transactionActions}>
                        <TouchableOpacity onPress={() => handleEditRecurring(rt)}>
                          <Text style={styles.actionButton}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteRecurring(rt.id)}>
                          <Text style={styles.actionButton}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Month Picker Modal */}
          <Modal visible={showMonthPicker} animationType="slide" transparent={true}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Month</Text>
                <ScrollView>
                  {availableMonths.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={styles.monthOption}
                      onPress={() => {
                        setSelectedMonth(m);
                        setShowMonthPicker(false);
                      }}
                    >
                      <Text style={styles.monthOptionText}>
                        {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowMonthPicker(false)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  monthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
  },
  monthButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  expenseCard: {
    backgroundColor: '#7f1d1d',
    borderColor: '#991b1b',
  },
  incomeCard: {
    backgroundColor: '#14532d',
    borderColor: '#166534',
  },
  balanceCard: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e40af',
  },
  totalCard: {
    backgroundColor: '#581c87',
    borderColor: '#6b21a8',
  },
  statLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  negativeText: {
    color: '#fca5a5',
  },
  categoryContainer: {
    padding: 16,
    paddingTop: 0,
  },
  categoryTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItem: {
    width: '48%',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryName: {
    color: '#9ca3af',
    fontSize: 12,
  },
  categoryAmount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#dc2626',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#16a34a',
  },
  typeText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  label: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  categoryChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  categoryChipText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#9ca3af',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  transactionItem: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionDate: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 50,
  },
  transactionDescription: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionCategory: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  incomeAmount: {
    color: '#22c55e',
  },
  transactionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    fontSize: 18,
  },
  recurringFrequency: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    minWidth: 50,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 40,
  },
  monthOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  monthOptionText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default FinanceTracker;