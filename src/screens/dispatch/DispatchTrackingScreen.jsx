// src/screens/dispatch/DispatchTrackingScreen.jsx
// Enhanced: shows order info, inventory status, status update actions

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../../services/api';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Icon           from '../../components/Icon';
import EmptyState     from '../../components/EmptyState';
import ErrorMessage   from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { dispatchService } from '../../services/dispatchService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { theme }           from '../../utils/theme';

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

const STATUS_META = {
  Dispatched:   { bg: '#FFF7ED', color: '#EA580C', icon: 'truck-delivery' },
  'In Transit': { bg: '#EFF6FF', color: '#2563EB', icon: 'truck-fast' },
  Delivered:    { bg: '#ECFDF5', color: '#059669', icon: 'check-circle-outline' },
  Returned:     { bg: '#FEF2F2', color: '#DC2626', icon: 'keyboard-return' },
};

const FILTER_TABS = ['All', 'Dispatched', 'In Transit', 'Delivered'];

const IMG_HOST = BASE_URL.replace(/\/api\/?$/, '');
const resolveImg = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : `${IMG_HOST}${u}`);

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function DispatchDetailModal({ visible, dispatchId, onClose, onStatusChanged }) {
  const [dispatch, setDispatch] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!visible || !dispatchId) return;
    setLoading(true);
    dispatchService.get(dispatchId)
      .then(r => setDispatch(r?.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, dispatchId]);

  const markInTransit = async () => {
    setUpdating(true);
    try {
      await dispatchService.markInTransit(dispatchId);
      Alert.alert('Updated', 'Marked as In Transit.');
      onStatusChanged?.();
      onClose();
    } catch (e) { Alert.alert('Error', e?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const doDeliver = async (podUrl) => {
    setUpdating(true);
    try {
      await dispatchService.markDelivered(dispatchId, podUrl ? { pod_image_url: podUrl } : {});
      Alert.alert('Delivered!', 'Marked delivered. Sale auto-created.');
      onStatusChanged?.();
      onClose();
    } catch (e) { Alert.alert('Error', e?.message || 'Failed'); }
    finally { setUpdating(false); }
  };

  const attachPodAndDeliver = async () => {
    try {
      const results = await pick({ allowMultiSelection: false, type: [types.images], mode: 'import' });
      if (!results || results.length === 0) return;
      const file = results[0];
      setUpdating(true);
      const res = await dispatchService.uploadPod({ uri: file.uri, name: file.name, type: file.type });
      const url = res?.data?.url || res?.url;
      await doDeliver(url);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) { setUpdating(false); return; }
      Alert.alert('Upload failed', err?.message || 'Could not upload proof.');
      setUpdating(false);
    }
  };

  const markDelivered = () => {
    Alert.alert('Mark Delivered', 'Add proof of delivery (photo/signature)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', onPress: () => doDeliver(null) },
      { text: 'Add Photo', onPress: attachPodAndDeliver },
    ]);
  };

  if (!visible) return null;
  const d    = dispatch;
  const meta = STATUS_META[d?.status] || STATUS_META.Dispatched;
  const order = d?.order_id;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Icon name="arrow-left" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Dispatch Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? <LoadingSpinner /> : !d ? (
          <EmptyState icon="🚛" title="Not found" />
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Status + code */}
            <View style={styles.detailCard}>
              <View style={styles.dispatchHeader}>
                <Text style={styles.dispatchCode}>{d.dispatch_code || '—'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                  <Icon name={meta.icon} size={14} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{d.status}</Text>
                </View>
              </View>
              <Text style={styles.dispatchDate}>{formatDate(d.dispatch_date || d.created_at)}</Text>
              {d.invoice_number && (
                <View style={styles.invRow}>
                  <Icon name="file-document-outline" size={13} color={MUTED} />
                  <Text style={styles.invText}>Invoice: {d.invoice_number}</Text>
                </View>
              )}
            </View>

            {/* Order info */}
            {order && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionLabel}>ORDER INFORMATION</Text>
                <InfoRow label="Order #"      value={order.order_code || '—'} />
                <InfoRow label="Customer"     value={d.customer_name  || '—'} />
                <InfoRow label="Product"      value={order.product_name || '—'} />
                <InfoRow label="Quantity"     value={`${order.qty || 0} ${order.unit || ''}`} />
                <InfoRow label="Order Value"  value={formatCurrency(order.total_amount || 0)} />
                {order.delivery_address && (
                  <InfoRow label="Delivery Address" value={order.delivery_address} />
                )}
              </View>
            )}

            {/* Transport */}
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>TRANSPORT DETAILS</Text>
              <InfoRow label="Transporter"  value={d.transport_name || '—'} />
              <InfoRow label="Vehicle #"    value={d.vehicle_number || '—'} />
              <InfoRow label="LR Number"    value={d.lr_number      || '—'} />
              <InfoRow label="Driver"       value={d.driver_name    || '—'} />
              {d.driver_mobile && <InfoRow label="Driver Mobile" value={d.driver_mobile} />}
            </View>

            {/* Dates */}
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>DATES</Text>
              <InfoRow label="Dispatch Date"        value={formatDate(d.dispatch_date)         || '—'} />
              <InfoRow label="Expected Delivery"    value={formatDate(d.expected_delivery)     || '—'} />
              {d.delivered_date && (
                <InfoRow label="Delivered On" value={formatDate(d.delivered_date)} />
              )}
            </View>

            {/* Proof of delivery */}
            {d.pod_image_url ? (
              <View style={styles.detailCard}>
                <Text style={styles.sectionLabel}>PROOF OF DELIVERY</Text>
                <Image source={{ uri: resolveImg(d.pod_image_url) }} style={styles.podImg} resizeMode="cover" />
              </View>
            ) : null}

            {/* Sale info */}
            {d.sale && (
              <View style={styles.detailCard}>
                <Text style={styles.sectionLabel}>LINKED SALE</Text>
                <InfoRow label="Sale #"         value={d.sale.sale_code || '—'} />
                <InfoRow label="Payment Status" value={d.sale.payment_status || '—'} />
                <InfoRow label="Grand Total"    value={formatCurrency(d.sale.grand_total || 0)} />
                {d.sale.outstanding > 0 && (
                  <InfoRow label="Outstanding" value={formatCurrency(d.sale.outstanding)} />
                )}
              </View>
            )}

            {/* Action buttons */}
            {d.status === 'Dispatched' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
                onPress={markInTransit} disabled={updating} activeOpacity={0.85}>
                <Icon name="truck-fast" size={18} color={WHITE} />
                <Text style={styles.actionBtnText}>
                  {updating ? 'Updating…' : 'Mark In Transit'}
                </Text>
              </TouchableOpacity>
            )}
            {d.status === 'In Transit' && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                onPress={markDelivered} disabled={updating} activeOpacity={0.85}>
                <Icon name="check-circle-outline" size={18} color={WHITE} />
                <Text style={styles.actionBtnText}>
                  {updating ? 'Updating…' : 'Mark Delivered'}
                </Text>
              </TouchableOpacity>
            )}
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function DispatchTrackingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [dispatches, setDispatches] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [activeTab,  setActiveTab]  = useState('All');
  const [detailId,   setDetailId]   = useState(null);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (activeTab !== 'All') params.status = activeTab;
      if (search.trim())       params.search = search.trim();
      const res = await dispatchService.list(params);
      const data = res?.data ?? res;
      setDispatches(Array.isArray(data) ? data : data?.dispatches ?? []);
    } catch (e) { setError(e?.message || 'Failed to load dispatches'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab, search]);

  useEffect(() => { load(); }, [activeTab]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => {
    const meta   = STATUS_META[item.status] || STATUS_META.Dispatched;
    const order  = item.order_id;
    const customer = item.customer_name || order?.customer_name || '—';
    const code     = item.dispatch_code || item._id?.slice(-6) || '——';

    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetailId(item._id)} activeOpacity={0.82}>
        <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.customerName} numberOfLines={1}>{customer}</Text>
              <View style={styles.codeRow}>
                <Icon name="pound" size={11} color={MUTED} />
                <Text style={styles.codeText}>{code}</Text>
              </View>
            </View>
            <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
              <Icon name={meta.icon} size={13} color={meta.color} />
              <Text style={[styles.statusText2, { color: meta.color }]}>{item.status}</Text>
            </View>
          </View>

          {/* Product info */}
          {order?.product_name && (
            <View style={styles.productRow}>
              <Icon name="package-variant-closed" size={12} color={MUTED} />
              <Text style={styles.productText} numberOfLines={1}>{order.product_name}</Text>
              {order.qty > 0 && <Text style={styles.productQty}> · {order.qty} {order.unit || ''}</Text>}
            </View>
          )}

          {/* Vehicle + LR */}
          <View style={styles.infoRow2}>
            {item.vehicle_number && (
              <View style={styles.infoChip}>
                <Icon name="truck-outline" size={12} color={MUTED} />
                <Text style={styles.infoChipText}>{item.vehicle_number}</Text>
              </View>
            )}
            {item.transport_name && (
              <View style={styles.infoChip}>
                <Icon name="domain" size={12} color={MUTED} />
                <Text style={styles.infoChipText}>{item.transport_name}</Text>
              </View>
            )}
            {item.lr_number && (
              <View style={styles.infoChip}>
                <Icon name="receipt" size={12} color={MUTED} />
                <Text style={styles.infoChipText}>LR: {item.lr_number}</Text>
              </View>
            )}
          </View>

          {/* Dates */}
          <View style={styles.datesRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Dispatched</Text>
              <Text style={styles.dateValue}>{formatDate(item.dispatch_date) || '—'}</Text>
            </View>
            <View style={styles.dateSep} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>{item.delivered_date ? 'Delivered' : 'Expected Delivery'}</Text>
              <Text style={styles.dateValue}>{formatDate(item.delivered_date || item.expected_delivery) || '—'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !dispatches.length) return <LoadingSpinner fullScreen />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

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
            <Text style={styles.headerTitle}>Dispatch</Text>
            <Text style={styles.headerSub}>Tracking & Status</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('DispatchEntry')} style={styles.headerAction}>
            <Icon name="plus" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Icon name="magnify" size={18} color={MUTED} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dispatch, vehicle, LR..."
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); load(); }} style={{ marginRight: 10 }}>
              <Icon name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter Tabs ────────────────────────────────────────────────── */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)} activeOpacity={0.8}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <FlatList
        data={dispatches}
        keyExtractor={i => i._id || String(Math.random())}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
        ListEmptyComponent={<EmptyState icon="🚛" title="No dispatches found" subtitle="New dispatches appear here after orders are dispatched" />}
      />

      {/* ── FAB ────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.fab, { bottom: 22 + insets.bottom }]} onPress={() => navigation.navigate('DispatchEntry')} activeOpacity={0.88}>
        <Icon name="plus" size={20} color={WHITE} />
        <Text style={styles.fabText}>New Dispatch</Text>
      </TouchableOpacity>

      {/* ── Detail Modal ────────────────────────────────────────────────── */}
      <DispatchDetailModal
        visible={!!detailId}
        dispatchId={detailId}
        onClose={() => setDetailId(null)}
        onStatusChanged={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },

  header: { backgroundColor: PRIMARY, paddingBottom: 12, overflow: 'hidden' },
  headerDecor: {
    position: 'absolute', top: -30, right: -40, width: 160, height: 160,
    borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)',
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
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLeft: { flex: 1, marginRight: 10 },
  customerName: { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 3 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  codeText: { fontSize: 11, color: MUTED, fontWeight: '600' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  statusText2: { fontSize: 11, fontWeight: '700' },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  productText: { fontSize: 12, color: TEXT, fontWeight: '600', flex: 1 },
  productQty: { fontSize: 11, color: MUTED },

  infoRow2: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F5F8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoChipText: { fontSize: 11, color: TEXT, fontWeight: '600' },

  datesRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FC', borderRadius: 10, padding: 9 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 9, color: MUTED, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  dateValue: { fontSize: 12, fontWeight: '700', color: TEXT },
  dateSep: { width: 1, height: 26, backgroundColor: BORDER },

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
  podImg: { width: '100%', height: 200, borderRadius: 12, marginTop: 8, backgroundColor: '#F1F5F9' },
  dispatchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dispatchCode: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  dispatchDate: { fontSize: 12, color: MUTED },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  invText: { fontSize: 12, color: MUTED, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BORDER },
  infoLabel: { fontSize: 12, color: MUTED },
  infoValue: { fontSize: 13, fontWeight: '600', color: TEXT, textAlign: 'right', flex: 1, marginLeft: 8 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14, marginTop: 4,
  },
  actionBtnText: { color: WHITE, fontWeight: '700', fontSize: 15 },
});
