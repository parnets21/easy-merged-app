// src/screens/expense/ExpenseListScreen.jsx
// Full expense management — dashboard summary, all 12 categories, filters

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon           from '../../components/Icon';
import EmptyState     from '../../components/EmptyState';
import ErrorMessage   from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { expenseService }            from '../../services/expenseService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { theme }                     from '../../utils/theme';

const PRIMARY = theme.colors.primary;
const ORANGE  = theme.colors.accent;
const BG      = '#F0F2F8';
const WHITE   = '#FFFFFF';
const TEXT    = '#171A2B';
const MUTED   = '#6B7280';
const BORDER  = '#E8EAF0';

const SHADOW = {
  shadowColor: '#111827', shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
};

// ── All 12 expense categories with colors ─────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { key: 'Rent',            color: '#EA580C', bg: '#FFF7ED', icon: 'home-city-outline' },
  { key: 'Salary',          color: '#9C27B0', bg: '#F3E8FF', icon: 'account-cash-outline' },
  { key: 'Electricity',     color: '#CA8A04', bg: '#FEFCE8', icon: 'lightning-bolt' },
  { key: 'Internet',        color: '#2563EB', bg: '#EFF6FF', icon: 'wifi' },
  { key: 'Fuel',            color: '#B45309', bg: '#FEF3C7', icon: 'fuel' },
  { key: 'Marketing',       color: '#F59E0B', bg: '#FFFBEB', icon: 'bullhorn-outline' },
  { key: 'Office Expense',  color: '#475569', bg: '#F1F5F9', icon: 'office-building-outline' },
  { key: 'Maintenance',     color: '#DC2626', bg: '#FEF2F2', icon: 'tools' },
  { key: 'Transport',       color: '#0D9488', bg: '#F0FDFA', icon: 'truck-delivery-outline' },
  { key: 'Warehouse Rent',  color: '#7C3AED', bg: '#F5F3FF', icon: 'warehouse' },
  { key: 'Packaging',       color: '#059669', bg: '#ECFDF5', icon: 'package-variant' },
  { key: 'Miscellaneous',   color: '#6B7280', bg: '#F3F4F6', icon: 'dots-horizontal-circle-outline' },
];

function getCatConfig(category) {
  return EXPENSE_CATEGORIES.find(c => c.key === category) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

const FILTER_TABS = ['All', ...EXPENSE_CATEGORIES.map(c => c.key)];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ExpenseListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [expenses,   setExpenses]   = useState([]);
  const [totalAmount, setTotal]     = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [filterTab,  setFilterTab]  = useState('All');
  const [search,     setSearch]     = useState('');
  const searchTimer = useRef(null);

  const load = useCallback(async (q = '') => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (filterTab !== 'All') params.category = filterTab;
      if (q.trim())            params.search   = q.trim();
      const res  = await expenseService.list(params);
      const data = res?.data ?? res;
      setExpenses(Array.isArray(data) ? data : data?.expenses ?? []);
      setTotal(data?.totalAmount ?? 0);
    } catch (e) { setError(e?.message || 'Failed to load expenses'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filterTab]);

  useEffect(() => { load(search); }, [filterTab]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const onRefresh = () => { setRefreshing(true); load(search); };

  // ── Summary by category ──────────────────────────────────────────────────
  const byCat = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.key)
                   .reduce((s, e) => s + (Number(e.amount) || 0), 0),
  })).filter(c => c.total > 0);

  const renderItem = ({ item }) => {
    const cfg = getCatConfig(item.category);
    return (
      <View style={styles.card}>
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.catIcon, { backgroundColor: cfg.bg }]}>
              <Icon name={cfg.icon} size={18} color={cfg.color} />
            </View>
            <View style={styles.cardInfo}>
              <View style={[styles.catBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.catText, { color: cfg.color }]}>{item.category}</Text>
              </View>
              <Text style={styles.cardDesc} numberOfLines={1}>
                {item.description || '—'}
              </Text>
              <Text style={styles.cardDate}>{formatDate(item.expense_date || item.created_at)}</Text>
            </View>
            <View style={styles.cardAmountWrap}>
              <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
              {item.payment_mode && (
                <Text style={styles.payMode}>{item.payment_mode}</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerDecor} />
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={22} color={WHITE} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Expenses</Text>
            <Text style={styles.headerSub}>Expense Management</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ExpenseReport')} style={[styles.headerAction, { marginRight: 8, backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Icon name="chart-bar" size={20} color={WHITE} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ExpenseEntry')} style={styles.headerAction}>
            <Icon name="plus" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Total banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>
            {filterTab === 'All' ? 'Total Expenses' : filterTab}
          </Text>
          <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          <Text style={styles.totalCount}>{expenses.length} records</Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={MUTED} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search description, reference..."
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 10 }}>
              <Icon name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Category Summary ────────────────────────────────────────────── */}
      {filterTab === 'All' && byCat.length > 0 && (
        <View style={styles.catSummary}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catSummaryContent}>
            {byCat.map(c => (
              <TouchableOpacity key={c.key} style={styles.catSummaryCard}
                onPress={() => setFilterTab(c.key)} activeOpacity={0.8}>
                <View style={[styles.catSummaryIcon, { backgroundColor: c.bg }]}>
                  <Icon name={c.icon} size={16} color={c.color} />
                </View>
                <Text style={styles.catSummaryAmt}>{formatCurrency(c.total)}</Text>
                <Text style={styles.catSummaryLbl} numberOfLines={1}>{c.key}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Filter Tabs ────────────────────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}>
          {FILTER_TABS.slice(0, 6).map(t => (
            <TouchableOpacity key={t}
              style={[styles.tabBtn, filterTab === t && styles.tabBtnActive]}
              onPress={() => setFilterTab(t)} activeOpacity={0.8}>
              <Text style={[styles.tabText, filterTab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {loading && !expenses.length ? <LoadingSpinner /> :
       error ? <ErrorMessage message={error} onRetry={() => load(search)} /> : (
        <FlatList
          data={expenses}
          keyExtractor={i => i._id || String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={<EmptyState icon="💸" title="No expenses recorded" subtitle="Tap + Add to record an expense" />}
        />
      )}

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.fab, { bottom: 22 + insets.bottom }]} onPress={() => navigation.navigate('ExpenseEntry')} activeOpacity={0.88}>
        <Icon name="plus" size={20} color={WHITE} />
        <Text style={styles.fabText}>Add Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: { backgroundColor: PRIMARY, paddingBottom: 12, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', top: -30, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: WHITE },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },

  totalBanner: {
    alignItems: 'center', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 10,
  },
  totalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase' },
  totalValue: { fontSize: 24, fontWeight: '900', color: WHITE, marginVertical: 2 },
  totalCount: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, paddingHorizontal: 10 },

  catSummary: { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  catSummaryContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catSummaryCard: {
    alignItems: 'center', backgroundColor: '#F8F9FC',
    borderRadius: 12, padding: 10, minWidth: 80,
  },
  catSummaryIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catSummaryAmt: { fontSize: 12, fontWeight: '800', color: TEXT },
  catSummaryLbl: { fontSize: 9, color: MUTED, fontWeight: '600', textAlign: 'center', marginTop: 2, maxWidth: 70 },

  tabsWrap:    { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F2F8' },
  tabBtnActive:{ backgroundColor: PRIMARY },
  tabText:     { fontSize: 12, fontWeight: '700', color: MUTED },
  tabTextActive:{ color: WHITE },

  list: { padding: 14, paddingBottom: 100 },

  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: WHITE, borderRadius: 16, marginBottom: 8,
    overflow: 'hidden', ...SHADOW,
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: 12 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catIcon:    { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo:   { flex: 1, gap: 3 },
  catBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  catText:    { fontSize: 11, fontWeight: '700' },
  cardDesc:   { fontSize: 12, color: TEXT, fontWeight: '500' },
  cardDate:   { fontSize: 10, color: MUTED },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 15, fontWeight: '800', color: theme.colors.danger },
  payMode:    { fontSize: 9, color: MUTED, fontWeight: '600', marginTop: 2 },

  fab: {
    position: 'absolute', bottom: 22, right: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 15, ...SHADOW,
  },
  fabText: { color: WHITE, fontWeight: '700', fontSize: 15 },
});
