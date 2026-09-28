// src/screens/quotation/QuotationListScreen.jsx
//
// Wholesaler's quotations: requests they raised + admin's quoted prices.
// When status is "Quoted", show ✓ (accept → places order) and ✗ (reject).
//
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Alert, FlatList, Platform, RefreshControl, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { quotationService } from '../../services/quotationService';
import { theme } from '../../utils/theme';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const STATUS_META = {
  Requested: { bg: '#FEF3C7', fg: '#B45309', label: 'Awaiting Quote' },
  Quoted:    { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Quote Received' },
  Accepted:  { bg: '#DCFCE7', fg: '#059669', label: 'Accepted' },
  Ordered:   { bg: '#DCFCE7', fg: '#047857', label: 'Ordered' },
  Rejected:  { bg: '#FEE2E2', fg: '#DC2626', label: 'Rejected' },
};

export default function QuotationListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(null);   // id being accepted/rejected

  const load = useCallback(async (isRefresh) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await quotationService.list({ limit: 100 });
      setRows(res?.data?.requests || res?.requests || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = (item, action) => {
    const verb = action === 'accept' ? 'Accept & Order' : 'Reject';
    Alert.alert(
      `${verb}?`,
      action === 'accept'
        ? `Accept the quote of ${money(item.quoted_total)} and place the order?`
        : 'Reject this quotation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb, style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setActing(item._id);
            try {
              await quotationService.respond(item._id, action);
              await load();
            } catch (e) {
              Alert.alert('Failed', e?.message || 'Could not respond.');
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const meta = STATUS_META[item.status] || STATUS_META.Requested;
    const isQuoted = item.status === 'Quoted';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.product_name}</Text>
            <Text style={styles.meta}>{item.request_no} · Qty {item.requested_qty || '—'} {item.unit}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>

        {item.status !== 'Requested' && (
          <View style={styles.quoteBox}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Quoted Rate</Text>
              <Text style={styles.quoteVal}>{money(item.quoted_price)} /{item.unit}</Text>
            </View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>Total (incl. {item.quoted_gst}% GST)</Text>
              <Text style={styles.quoteTotal}>{money(item.quoted_total)}</Text>
            </View>
            {item.admin_note ? <Text style={styles.adminNote}>Admin: {item.admin_note}</Text> : null}
          </View>
        )}

        {isQuoted && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actBtn, styles.rejectBtn]}
              disabled={acting === item._id}
              onPress={() => respond(item, 'reject')}
              activeOpacity={0.85}
            >
              <Icon name="close" size={18} color="#DC2626" />
              <Text style={[styles.actText, { color: '#DC2626' }]}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actBtn, styles.acceptBtn]}
              disabled={acting === item._id}
              onPress={() => respond(item, 'accept')}
              activeOpacity={0.85}
            >
              <Icon name="check" size={18} color="#fff" />
              <Text style={[styles.actText, { color: '#fff' }]}>{acting === item._id ? '...' : 'Accept & Order'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'Ordered' && (
          <Text style={styles.orderedNote}>✓ Order placed{item.purchase_id ? '' : ''}.</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>My Quotations</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ProductRequest')}>
          <Icon name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.accent} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.accent]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="file-document-outline" size={44} color={theme.colors.textDisabled} />
              <Text style={styles.emptyTitle}>No quotations yet</Text>
              <Text style={styles.emptySub}>Tap + to request a quotation for a product.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => navigation.navigate('ProductRequest')} activeOpacity={0.9}>
        <Icon name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>Request Quotation</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  meta: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },

  quoteBox: { backgroundColor: '#FAFBFC', borderRadius: 10, padding: 12, marginTop: 12 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  quoteLabel: { fontSize: 12.5, color: theme.colors.textSecondary },
  quoteVal: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  quoteTotal: { fontSize: 15, fontWeight: '900', color: theme.colors.accent },
  adminNote: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 6, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10 },
  rejectBtn: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  acceptBtn: { backgroundColor: theme.colors.secondary },
  actText: { fontSize: 13.5, fontWeight: '800' },
  orderedNote: { marginTop: 10, fontSize: 12.5, fontWeight: '700', color: '#047857' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  emptySub: { fontSize: 12.5, color: theme.colors.textSecondary },

  fab: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.accent, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30,
    elevation: 4, shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
