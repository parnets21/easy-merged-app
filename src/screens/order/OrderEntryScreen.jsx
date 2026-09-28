// src/screens/order/OrderEntryScreen.jsx
// Create a new customer order. Product is chosen from the wholesaler's own
// catalog via a searchable dropdown; price + GST auto-fill on selection.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import FormField from '../../components/FormField';
import { orderService } from '../../services/orderService';
import { wholesalerProductService } from '../../services/productService';
import { employeeService } from '../../services/employeeService';
import { theme } from '../../utils/theme';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const numOnly = (v) => String(v).replace(/[^0-9.]/g, '');

export default function OrderEntryScreen({ navigation }) {
  const [customerName, setCustomerName]   = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [saving, setSaving] = useState(false);

  // Selected product + editable pricing
  const [product, setProduct] = useState(null);   // { _id, name, code, unit }
  const [qty, setQty]         = useState('');
  const [rate, setRate]       = useState('');
  const [gst, setGst]         = useState('18');
  const [discountPct, setDiscountPct] = useState('0');   // discount is a percentage

  // Catalog picker
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Sales staff assignment
  const [staff, setStaff] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState(null);   // { _id, name }
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);

  useEffect(() => {
    setCatalogLoading(true);
    wholesalerProductService.listCatalog({ mine: true, limit: 300 })
      .then(res => setCatalog(res?.data?.products || res?.products || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));

    // Staff members this wholesaler can assign the order to.
    employeeService.list({ limit: 300 })
      .then(res => setStaff(res?.data?.employees || res?.employees || res?.data || []))
      .catch(() => setStaff([]));
  }, []);

  const pickProduct = (p) => {
    const autoRate = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
    setProduct({ _id: p._id, name: p.name, code: p.code, unit: p.unit });
    setRate(String(autoRate || ''));
    setGst(String(p.gst_percent ?? 18));
    setPickerOpen(false);
    setPickerSearch('');
  };

  const filtered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q));
  }, [catalog, pickerSearch]);

  const qtyN  = parseFloat(qty)  || 0;
  const rateN = parseFloat(rate) || 0;
  const gstN  = parseFloat(gst); const gstPct = isNaN(gstN) ? 18 : gstN;
  const discPct = Math.min(Math.max(parseFloat(discountPct) || 0, 0), 100);
  const amount   = +(qtyN * rateN).toFixed(2);
  const discAmt  = +(amount * discPct / 100).toFixed(2);   // discount computed from %
  const taxable  = Math.max(amount - discAmt, 0);
  const gstAmt   = Math.round(taxable * gstPct / 100);
  const grand    = Math.max(taxable + gstAmt, 0);

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert('Required', 'Enter customer name.'); return; }
    if (!product)             { Alert.alert('Required', 'Select a product from the catalog.'); return; }
    if (qtyN <= 0)            { Alert.alert('Required', 'Quantity must be greater than 0.'); return; }
    if (rateN <= 0)           { Alert.alert('Required', 'Rate must be greater than 0.'); return; }

    setSaving(true);
    try {
      const res = await orderService.create({
        customer_name:  customerName.trim(),
        customer_mobile: customerMobile.trim(),
        product_id:     product._id,
        product_name:   product.name,
        product_code:   product.code || '',
        unit:           product.unit || '',
        qty:            qtyN,
        rate:           rateN,
        gst_percent:    gstPct,
        discount_percent: discPct,
        discount:       discAmt,
      });
      const order = res?.data ?? res;

      // Assign the order to the chosen sales staff, if any.
      if (assignedStaff && order?._id) {
        try {
          await orderService.assign(order._id, {
            assigned_to:      assignedStaff._id,
            assigned_to_name: assignedStaff.name,
          });
        } catch { /* order is created; assignment is best-effort */ }
      }

      Alert.alert('Success', 'Order created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not create order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Create Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <FormField label="Customer Name *" value={customerName} onChangeText={setCustomerName} placeholder="Customer name" />
          <FormField label="Customer Mobile" value={customerMobile} onChangeText={v => setCustomerMobile(numOnly(v))} keyboardType="phone-pad" placeholder="Optional" />
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Product *</Text>
          <TouchableOpacity style={styles.pickBtn} onPress={() => { setPickerOpen(true); setPickerSearch(''); }} activeOpacity={0.8}>
            <Text style={[styles.pickBtnText, !product && styles.pickBtnPlaceholder]} numberOfLines={1}>
              {product ? product.name : 'Tap to select a product…'}
            </Text>
            <Text style={styles.pickChevron}>▾</Text>
          </TouchableOpacity>
          {product?.code ? <Text style={styles.pickMeta}>Code: {product.code}</Text> : null}

          <View style={styles.row}>
            <View style={styles.col}><FormField label="Qty *"  value={qty}  onChangeText={v => setQty(numOnly(v))}  keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={styles.col}><FormField label="Rate *" value={rate} onChangeText={v => setRate(numOnly(v))} keyboardType="decimal-pad" placeholder="0" /></View>
            <View style={styles.col}><FormField label="GST %"  value={gst}  onChangeText={v => setGst(numOnly(v))}  keyboardType="decimal-pad" placeholder="18" /></View>
          </View>

          <FormField label="Discount (%)" value={discountPct} onChangeText={v => setDiscountPct(numOnly(v))} keyboardType="decimal-pad" placeholder="0" />
        </View>

        {/* Assign sales staff */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Assign to Sales Staff</Text>
          <TouchableOpacity style={styles.pickBtn} onPress={() => setStaffPickerOpen(true)} activeOpacity={0.8}>
            <Text style={[styles.pickBtnText, !assignedStaff && styles.pickBtnPlaceholder]} numberOfLines={1}>
              {assignedStaff ? assignedStaff.name : 'Tap to assign a staff member…'}
            </Text>
            <Text style={styles.pickChevron}>▾</Text>
          </TouchableOpacity>
          {assignedStaff ? (
            <TouchableOpacity onPress={() => setAssignedStaff(null)}>
              <Text style={styles.clearAssign}>Clear assignment</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Live summary */}
        <View style={styles.summary}>
          <Row label="Amount" value={money(amount)} />
          <Row label={`Discount (${discPct}%)`} value={`- ${money(discAmt)}`} />
          <Row label={`GST (${gstPct}%)`} value={money(gstAmt)} />
          <View style={styles.divider} />
          <Row label="Grand Total" value={money(grand)} big />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnOff]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Create Order'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Product picker modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPickerOpen(false)} activeOpacity={1} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Product</Text>
            <View style={styles.modalSearch}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search product name or code…"
                placeholderTextColor={theme.colors.textDisabled}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
              />
            </View>
            {catalogLoading ? (
              <Text style={styles.modalEmpty}>Loading products…</Text>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={p => p._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.modalEmpty}>No products found.</Text>}
                renderItem={({ item: p }) => {
                  const r = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
                  return (
                    <TouchableOpacity style={styles.pickRow} onPress={() => pickProduct(p)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickRowName}>{p.name}</Text>
                        <Text style={styles.pickRowMeta}>{p.code || '—'} · {money(r)}/{p.unit || 'unit'} · GST {p.gst_percent ?? 18}%</Text>
                      </View>
                      <Text style={styles.pickRowArrow}>›</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Staff picker modal */}
      <Modal visible={staffPickerOpen} animationType="slide" transparent onRequestClose={() => setStaffPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setStaffPickerOpen(false)} activeOpacity={1} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assign to Staff</Text>
            {staff.length === 0 ? (
              <Text style={styles.modalEmpty}>No staff members found.</Text>
            ) : (
              <FlatList
                data={staff}
                keyExtractor={s => s._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: s }) => (
                  <TouchableOpacity
                    style={styles.pickRow}
                    onPress={() => { setAssignedStaff({ _id: s._id, name: s.name }); setStaffPickerOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickRowName}>{s.name}</Text>
                      <Text style={styles.pickRowMeta}>{s.designation || s.role_access || '—'}{s.mobile ? ` · ${s.mobile}` : ''}</Text>
                    </View>
                    <Text style={styles.pickRowArrow}>›</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, big }) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, big && styles.sumLabelBig]}>{label}</Text>
      <Text style={[styles.sumValue, big && styles.sumValueBig]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

  container: { padding: 16, paddingBottom: 60, backgroundColor: theme.colors.background },
  card: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  pickBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pickBtnPlaceholder: { color: theme.colors.textSecondary, fontWeight: '500' },
  pickChevron: { fontSize: 14, color: theme.colors.primary, marginLeft: 8 },
  pickMeta: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 8 },
  clearAssign: { fontSize: 12, color: theme.colors.danger, fontWeight: '700', marginTop: 8 },

  summary: { backgroundColor: theme.colors.primary, borderRadius: 14, padding: 18, marginBottom: 16 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  sumValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sumLabelBig: { fontSize: 15, color: '#fff', fontWeight: '800' },
  sumValueBig: { fontSize: 20, fontWeight: '900', color: theme.colors.accent },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 },

  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnOff: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  modalSearch: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  modalSearchInput: { fontSize: 14, color: theme.colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  modalEmpty: { textAlign: 'center', color: theme.colors.textSecondary, padding: 20, fontSize: 13 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pickRowName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pickRowMeta: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
  pickRowArrow: { fontSize: 20, color: theme.colors.textDisabled, marginLeft: 8 },
});
