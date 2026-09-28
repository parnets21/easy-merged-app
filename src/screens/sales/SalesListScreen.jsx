// src/screens/sales/SalesListScreen.jsx
// EzyEnquiry Wholesaler — Sales List with order linkage, status filters, sale detail

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon           from '../../components/Icon';
import EmptyState     from '../../components/EmptyState';
import ErrorMessage   from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { salesService }              from '../../services/salesService';
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

// ── Status configs ────────────────────────────────────────────────────────────
const PAY_STATUS = {
  Paid:    { bg: '#ECFDF5', color: '#059669' },
  Partial: { bg: '#EFF6FF', color: '#2563EB' },
  Pending: { bg: '#FFF7ED', color: '#D97706' },
  Overdue: { bg: '#FEF2F2', color: '#DC2626' },
};

const SALE_STATUS = {
  Confirmed:         { bg: '#EFF6FF', color: '#2563EB' },
  Reserved:          { bg: '#FEF3C7', color: '#D97706' },
  Picking:           { bg: '#F5F3FF', color: '#7C3AED' },
  Packed:            { bg: '#E0F2FE', color: '#0891B2' },
  'Ready for Dispatch': { bg: '#FFF7ED', color: '#EA580C' },
  Dispatched:        { bg: '#FFF0EA', color: '#FF6B35' },
  Delivered:         { bg: '#ECFDF5', color: '#059669' },
  Cancelled:         { bg: '#FEF2F2', color: '#DC2626' },
  Draft:             { bg: '#F3F4F6', color: '#6B7280' },
};

const FILTER_TABS = ['All', 'Pending', 'Partial', 'Paid', 'Overdue'];

// ─────────────────────────────────────────────────────────────────────────────
// SALE DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function SaleDetailModal({ visible, saleId, onClose }) {
  const [sale,    setSale]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !saleId) return;
    setLoading(true);
    salesService.get(saleId)
      .then(r => setSale(r?.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, saleId]);

  if (!visible) return null;

  const pMeta = PAY_STATUS[sale?.payment_status] || PAY_STATUS.Pending;
  const sMeta = SALE_STATUS[sale?.sale_status]   || SALE_STATUS.Confirmed;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Icon name="arrow-left" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Sale Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? <LoadingSpinner /> : !sale ? (
          <EmptyState icon="📄" title="Not found" />
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Sale header */}
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.saleCode}>{sale.sale_code || '—'}</Text>
                <View style={[styles.badge, { backgroundColor: pMeta.bg }]}>
                  <View style={[styles.badgeDot, { backgroundColor: pMeta.color }]} />
                  <Text style={[styles.badgeText, { color: pMeta.color }]}>
                    {sale.payment_status || 'Pending'}
                  </Text>
                </View>
              </View>
              <Text style={styles.detailDate}>{formatDate(sale.sale_date || sale.created_at)}</Text>
              {sale.sale_status && (
                <View style={[styles.badge, { backgroundColor: sMeta.bg, marginTop: 8, alignSelf: 'flex-start' }]}>
                  <Text style={[styles.badgeText, { color: sMeta.color }]}>{sale.sale_status}</Text>
                </View>
              )}
            </View>

            {/* Retailer info */}
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>RETAILER INFORMATION</Text>
              <InfoRow label="Name"     value={sale.customer_name     || '—'} />
              {sale.customer_id?.mobile  && <InfoRow label="Phone" value={sale.customer_id.mobile} />}
              {sale.customer_id?.gstin   && <InfoRow label="GSTIN" value={sale.customer_id.gstin} />}
              {sale.billing_address      && <InfoRow label="Billing Address" value={sale.billing_address} />}
              {sale.delivery_address     && <InfoRow label="Delivery Address" value={sale.delivery_address} />}
            </View>

            {/* Order info */}
            {sale.order_id && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionLabel}>ORDER INFORMATION</Text>
                <InfoRow label="Order #"    value={sale.order_id?.order_code || '—'} />
                <InfoRow label="Order Status" value={sale.order_id?.status || '—'} />
                {sale.invoice_number && <InfoRow label="Invoice #" value={sale.invoice_number} />}
                {sale.warehouse_name && <InfoRow label="Warehouse"  value={sale.warehouse_name} />}
              </View>
            )}

            {/* Products */}
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>PRODUCT DETAILS</Text>
              <View style={styles.productRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{sale.product_name || '—'}</Text>
                  {sale.product_code && (
                    <Text style={styles.productCode}>{sale.product_code}</Text>
                  )}
                </View>
              </View>
              <View style={styles.productTable}>
                <TableRow label="Quantity" value={`${sale.qty || 0}`} />
                <TableRow label="Rate"     value={formatCurrency(sale.rate || 0)} />
                <TableRow label="Amount"   value={formatCurrency(sale.amount || 0)} />
                <TableRow label={`GST (${sale.gst_percent || 18}%)`} value={formatCurrency(sale.gst_amount || 0)} />
                {sale.discount > 0 && (
                  <TableRow label="Discount" value={`-${formatCurrency(sale.discount)}`} color={theme.colors.danger} />
                )}
              </View>
            </View>

            {/* Financials */}
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>FINANCIAL SUMMARY</Text>
              <TableRow label="Subtotal"    value={formatCurrency(sale.amount || 0)} />
              <TableRow label="GST"         value={formatCurrency(sale.gst_amount || 0)} />
              {sale.discount > 0 && (
                <TableRow label="Discount"  value={`-${formatCurrency(sale.discount)}`} color={theme.colors.danger} />
              )}
              <View style={styles.divider} />
              <TableRow label="Grand Total" value={formatCurrency(sale.grand_total || sale.total_amount || 0)} bold />
              <TableRow label="Paid Amount" value={formatCurrency(sale.paid_amount || 0)} color="#059669" />
              <TableRow label="Outstanding" value={formatCurrency(sale.outstanding || 0)} color={sale.outstanding > 0 ? '#DC2626' : '#059669'} />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TableRow({ label, value, bold, color }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableLabel}>{label}</Text>
      <Text style={[styles.tableValue, bold && styles.tableBold, color && { color }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function SalesListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [sales,      setSales]      = useState([]);
  const [summary,    setSummary]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [filterTab,  setFilterTab]  = useState('All');
  const [search,     setSearch]     = useState('');
  const [detailId,   setDetailId]   = useState(null);
  const searchTimer = useRef(null);

  const load = useCallback(async (q = '') => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (filterTab !== 'All') params.payment_status = filterTab;
      if (q.trim())            params.search         = q.trim();
      const res = await salesService.list(params);
      const data = res?.data ?? res;
      setSales(Array.isArray(data) ? data : data?.sales ?? []);
      if (data?.summary) setSummary(data.summary);
    } catch (e) { setError(e?.message || 'Failed to load sales'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filterTab]);

  useEffect(() => { load(search); }, [filterTab]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(search), 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const onRefresh = () => { setRefreshing(true); load(search); };

  const renderItem = ({ item }) => {
    const pMeta = PAY_STATUS[item.payment_status] || PAY_STATUS.Pending;
    const sMeta = SALE_STATUS[item.sale_status]   || null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetailId(item._id)} activeOpacity={0.82}>
        <View style={[styles.cardAccent, { backgroundColor: pMeta.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.custName} numberOfLines={1}>
                {item.customer_name || '—'}
              </Text>
              <Text style={styles.saleDate}>{formatDate(item.sale_date || item.created_at)}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.amount}>{formatCurrency(item.grand_total || item.total_amount || 0)}</Text>
              <View style={[styles.badge, { backgroundColor: pMeta.bg }]}>
                <View style={[styles.badgeDot, { backgroundColor: pMeta.color }]} />
                <Text style={[styles.badgeText, { color: pMeta.color }]}>{item.payment_status || 'Pending'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardMeta}>
            {item.sale_code && (
              <View style={styles.metaChip}>
                <Icon name="receipt-text-outline" size={11} color={MUTED} />
                <Text style={styles.metaText}>{item.sale_code}</Text>
              </View>
            )}
            {item.invoice_number && (
              <View style={styles.metaChip}>
                <Icon name="file-document-outline" size={11} color={MUTED} />
                <Text style={styles.metaText}>Inv #{item.invoice_number}</Text>
              </View>
            )}
            {item.warehouse_name && (
              <View style={styles.metaChip}>
                <Icon name="warehouse" size={11} color={MUTED} />
                <Text style={styles.metaText}>{item.warehouse_name}</Text>
              </View>
            )}
            {sMeta && (
              <View style={[styles.badge, { backgroundColor: sMeta.bg }]}>
                <Text style={[styles.badgeText, { color: sMeta.color }]}>{item.sale_status}</Text>
              </View>
            )}
          </View>
          {item.outstanding > 0 && (
            <View style={styles.outstandingRow}>
              <Icon name="alert-circle-outline" size={12} color="#DC2626" />
              <Text style={styles.outstandingText}>
                Outstanding: {formatCurrency(item.outstanding)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.cardArrow}>
          <Icon name="chevron-right" size={16} color="#B0B5C3" />
        </View>
      </TouchableOpacity>
    );
  };

  const s = summary || {};

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
            <Text style={styles.headerTitle}>Sales</Text>
            <Text style={styles.headerSub}>Revenue & Transactions</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('SalesReport')} style={[styles.headerAction, { marginRight: 8 }]}>
            <Icon name="chart-bar" size={20} color={WHITE} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SalesEntry')} style={styles.headerAction}>
            <Icon name="plus" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Summary strip */}
        {s.total_sales > 0 && (
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{formatCurrency(s.total_revenue || 0)}</Text>
              <Text style={styles.summaryLbl}>Revenue</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{s.total_sales || 0}</Text>
              <Text style={styles.summaryLbl}>Sales</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#4ADE80' }]}>{s.paid_count || 0}</Text>
              <Text style={styles.summaryLbl}>Paid</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: '#FCD34D' }]}>{s.pending_count || 0}</Text>
              <Text style={styles.summaryLbl}>Pending</Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={MUTED} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer, invoice, code..."
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

      {/* ── Filter Tabs ────────────────────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}>
          {FILTER_TABS.map(t => (
            <TouchableOpacity key={t}
              style={[styles.tabBtn, filterTab === t && styles.tabBtnActive]}
              onPress={() => setFilterTab(t)} activeOpacity={0.8}>
              <Text style={[styles.tabText, filterTab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {loading && !sales.length ? <LoadingSpinner /> :
       error ? <ErrorMessage message={error} onRetry={() => load(search)} /> : (
        <FlatList
          data={sales}
          keyExtractor={i => i._id || String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={<EmptyState icon="📈" title="No sales found" subtitle="Sales appear here after orders are delivered" />}
        />
      )}

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.fab, { bottom: 22 + insets.bottom }]} onPress={() => navigation.navigate('SalesEntry')} activeOpacity={0.88}>
        <Icon name="plus" size={20} color={WHITE} />
        <Text style={styles.fabText}>New Sale</Text>
      </TouchableOpacity>

      {/* ── Detail Modal ────────────────────────────────────────────────── */}
      <SaleDetailModal visible={!!detailId} saleId={detailId} onClose={() => setDetailId(null)} />
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
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
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
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryStrip: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 10,
  },
  summaryItem:   { flex: 1, alignItems: 'center' },
  summaryVal:    { fontSize: 15, fontWeight: '800', color: WHITE },
  summaryLbl:    { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  summaryDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 12,
    marginHorizontal: 16, marginBottom: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, paddingHorizontal: 10 },

  tabsWrap:    { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F2F8' },
  tabBtnActive:{ backgroundColor: PRIMARY },
  tabText:     { fontSize: 12, fontWeight: '700', color: MUTED },
  tabTextActive:{ color: WHITE },

  list: { padding: 14, paddingBottom: 100 },

  card: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: WHITE, borderRadius: 16, marginBottom: 10,
    overflow: 'hidden', ...SHADOW,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 6 },
  cardArrow: { width: 32, alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: 8 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  custName: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 2 },
  saleDate: { fontSize: 11, color: MUTED },
  amount:   { fontSize: 15, fontWeight: '800', color: PRIMARY },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F5F8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  metaText: { fontSize: 10, color: MUTED, fontWeight: '600' },

  outstandingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  outstandingText: { fontSize: 11, color: '#DC2626', fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 22, right: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 15, ...SHADOW,
  },
  fabText: { color: WHITE, fontWeight: '700', fontSize: 15 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: PRIMARY, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
  },
  modalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { flex: 1, textAlign: 'center', color: WHITE, fontSize: 16, fontWeight: '800' },
  modalContent: { padding: 16, paddingBottom: 40, gap: 12 },

  detailCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, ...SHADOW },
  detailRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  saleCode:   { fontSize: 18, fontWeight: '800', color: PRIMARY },
  detailDate: { fontSize: 12, color: MUTED },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', marginBottom: 10 },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: BORDER },
  infoLabel:  { fontSize: 12, color: MUTED },
  infoValue:  { fontSize: 13, fontWeight: '600', color: TEXT, textAlign: 'right', flex: 1, marginLeft: 8 },
  productRow: { flexDirection: 'row', marginBottom: 10 },
  productName:{ fontSize: 14, fontWeight: '700', color: TEXT },
  productCode:{ fontSize: 11, color: MUTED },
  productTable:{ gap: 0 },
  tableRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableLabel: { fontSize: 13, color: MUTED },
  tableValue: { fontSize: 13, fontWeight: '600', color: TEXT },
  tableBold:  { fontWeight: '800', fontSize: 15, color: PRIMARY },
  divider:    { height: 1, backgroundColor: BORDER, marginVertical: 6 },
});
