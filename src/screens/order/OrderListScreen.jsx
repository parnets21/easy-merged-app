// src/screens/order/OrderListScreen.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon           from '../../components/Icon';
import EmptyState     from '../../components/EmptyState';
import ErrorMessage   from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { orderService }   from '../../services/orderService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { theme } from '../../utils/theme';

const TABS   = ['New', 'Accepted', 'Processing', 'Ready', 'Dispatched', 'Delivered', 'Cancelled'];
const STATUS_META = {
  New:        { bg: '#EFF6FF', text: '#2563EB', dot: '#3B82F6',  icon: 'plus-circle-outline' },
  Accepted:   { bg: '#F5F3FF', text: '#7C3AED', dot: '#8B5CF6',  icon: 'check-circle-outline' },
  Processing: { bg: '#FFF7ED', text: '#D97706', dot: '#F59E0B',  icon: 'cog-outline' },
  Ready:      { bg: '#FEFCE8', text: '#CA8A04', dot: '#EAB308',  icon: 'clock-outline' },
  Dispatched: { bg: '#EFF6FF', text: '#0369A1', dot: '#0EA5E9',  icon: 'truck-delivery-outline' },
  Delivered:  { bg: '#F0FDF4', text: '#059669', dot: '#10B981',  icon: 'check-all' },
  Cancelled:  { bg: '#FEF2F2', text: '#DC2626', dot: '#F87171',  icon: 'close-circle-outline' },
};

export default function OrderListScreen({ navigation }) {
  const [tabIdx,  setTabIdx]  = useState(0);
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await orderService.list({});
      // Backend returns { success, data: { orders: [...], pagination } }.
      // Guard against any shape and always land on an array.
      const list =
        res?.data?.orders ??
        res?.orders ??
        (Array.isArray(res?.data) ? res.data : null) ??
        (Array.isArray(res) ? res : []);
      setOrders(Array.isArray(list) ? list : []);
    } catch (e) { setError(e?.message || 'Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeStatus = TABS[tabIdx];
  const orderList    = Array.isArray(orders) ? orders : [];
  const filtered     = orderList.filter(o => o.status === activeStatus);

  if (loading && !orderList.length) return <LoadingSpinner />;
  if (error)                      return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={styles.screen}>
      {/* Create Order button */}
      <TouchableOpacity
        style={styles.createBtn}
        onPress={() => navigation.navigate('OrderEntry')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={18} color="#fff" />
        <Text style={styles.createBtnText}>Create Order</Text>
      </TouchableOpacity>

      {/* Tab bar */}
      <View style={styles.tabBarWrap}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={TABS} keyExtractor={t => t}
          contentContainerStyle={styles.tabList}
          renderItem={({ item: tab, index }) => {
            const active = index === tabIdx;
            const count  = orderList.filter(o => o.status === tab).length;
            return (
              <TouchableOpacity
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTabIdx(index)} activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i._id}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || STATUS_META.New;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item._id })}
              activeOpacity={0.78}
            >
              {/* Top: order code + status */}
              <View style={styles.cardTop}>
                <View style={styles.orderCodeWrap}>
                  <Icon name="receipt" size={14} color={theme.colors.primary} />
                  <Text style={styles.orderCode}>
                    {item.order_code || 'ORD-' + (item._id?.slice(-6) ?? '—')}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                  <Icon name={meta.icon} size={11} color={meta.text} />
                  <Text style={[styles.chipText, { color: meta.text }]}>{item.status}</Text>
                </View>
              </View>

              {/* Customer */}
              <View style={styles.customerRow}>
                <Icon name="store-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.customerName} numberOfLines={1}>
                  {item.customer_name || '—'}
                </Text>
              </View>

              {/* Footer: amount + date */}
              <View style={styles.cardFooter}>
                <Text style={styles.amount}>{formatCurrency(item.grand_total)}</Text>
                <View style={styles.dateRow}>
                  <Icon name="calendar-outline" size={12} color={theme.colors.textDisabled} />
                  <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[theme.colors.primary]} />}
        ListEmptyComponent={
          <EmptyState icon={<Icon name="package-variant-closed" size={48} color={theme.colors.textDisabled} />}
            title={`No ${activeStatus} orders`} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.colors.primary, margin: 12, marginBottom: 0,
    borderRadius: 12, paddingVertical: 13,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  tabBarWrap: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tabList: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F4F6FA' },
  tabActive:          { backgroundColor: theme.colors.primary },
  tabText:            { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive:      { color: '#FFFFFF' },
  tabBadge:           { backgroundColor: theme.colors.border, borderRadius: 8, minWidth: 18, paddingHorizontal: 4, alignItems: 'center' },
  tabBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabBadgeText:       { fontSize: 9, fontWeight: '800', color: theme.colors.textSecondary },
  tabBadgeTextActive: { color: '#FFFFFF' },

  list: { padding: 12, paddingBottom: 32 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10,
    padding: 14, borderWidth: 1, borderColor: theme.colors.border,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderCode:     { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700' },

  customerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerName: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, flex: 1 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 },
  amount:   { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: theme.colors.textDisabled },
});
