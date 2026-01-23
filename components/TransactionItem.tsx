import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Transaction, RecurringTransaction } from '../app/(tabs)/types';
import { styles } from '../app/(tabs)/styles';

interface TransactionItemProps {
    item: Transaction;
    onEdit: (item: Transaction) => void;
    onDelete: (id: number) => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ item, onEdit, onDelete }) => (
    <View style={[styles.transactionItem, { backgroundColor: '#1e293b' }]}>
        <View style={styles.txLeft}>
            <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
            <View>
                <Text style={styles.txDesc}>{item.description}</Text>
                <Text style={styles.txCat}>{item.category}</Text>
            </View>
        </View>
        <View style={styles.txRight}>
            <Text style={[styles.txAmount, item.type === 'income' && styles.txIncomeAmount]}>
                {item.type === 'expense' ? '-' : '+'}€{Math.abs(item.amount).toFixed(2)}
            </Text>
            <View style={styles.txActions}>
                <TouchableOpacity onPress={() => onEdit(item)} accessibilityLabel="Edit"><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item.id)} accessibilityLabel="Delete"><Text>🗑️</Text></TouchableOpacity>
            </View>
        </View>
    </View>
);

interface RecurringItemProps {
    item: RecurringTransaction;
    onEdit: (item: RecurringTransaction) => void;
    onDelete: (id: number) => void;
}

export const RecurringItem: React.FC<RecurringItemProps> = ({ item, onEdit, onDelete }) => (
    <View style={[styles.transactionItem, { backgroundColor: '#1e293b' }]}>
        <View style={styles.txLeft}>
            <Text style={styles.recFreq}>{item.frequency.toUpperCase()}</Text>
            <View>
                <Text style={styles.txDesc}>{item.description}</Text>
                <Text style={styles.txCat}>Next: {new Date(item.nextDueDate).toLocaleDateString('en-GB')}</Text>
            </View>
        </View>
        <View style={styles.txRight}>
            <Text style={[styles.txAmount, item.type === 'income' && styles.txIncomeAmount]}>
                {item.type === 'expense' ? '-' : '+'}€{Math.abs(item.amount).toFixed(2)}
            </Text>
            <View style={styles.txActions}>
                <TouchableOpacity onPress={() => onEdit(item)} accessibilityLabel="Edit"><Text>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item.id)} accessibilityLabel="Delete"><Text>🗑️</Text></TouchableOpacity>
            </View>
        </View>
    </View>
);
