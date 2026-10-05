// src/screens/sales/SalesEntryScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import FormField from '../../components/FormField';
import PrimaryButton from '../../components/PrimaryButton';
import { salesService } from '../../services/salesService';
import { wholesalerProductService } from '../../services/productService';
import { calculateLineTotal, formatCurrency } from '../../utils/formatters';
import { theme } from '../../utils/theme';

const emptyItem = () => ({
  product_id: null,
  product_name: '',
  product_code: '',
  qty: '',
  rate: '',
  gst_rate: '18',
});

export default function SalesEntryScreen({ navigation }) {
  const [customerName, setCustomerName] = useState('');
  const [discountPct, setDiscountPct] = useState('0');   // discount as a percentage
  const [items,    setItems]    = useState([emptyItem()]);
  const [loading,  setLoading]  = useState(false);

  // ── Wholesaler product catalog (for the picker) ──
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);   // index of the item row being edited
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    setCatalogLoading(true);
    // Products this wholesaler sells (their own catalog).
    wholesalerProductService.listCatalog({ mine: true, limit: 300 })
      .then(res => setCatalog(res?.data?.products || res?.products || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, []);

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i) => setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  const updateItem = (i, k, v) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  // When a product is picked from the dropdown, auto-fill its price + GST.
  const pickProduct = (p) => {
    const idx = pickerFor;
    if (idx == null) return;
    const rate = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      product_id:   p._id,
      product_name: p.name || '',
      product_code: p.code || '',
      rate:         String(rate || ''),
      gst_rate:     String(p.gst_percent ?? 18),
    } : it));
    setPickerFor(null);
    setPickerSearch('');
  };

  const filteredCatalog = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q));
  }, [catalog, pickerSearch]);

  let subtotal = 0, totalGST = 0;
  items.forEach(item => {
    subtotal += parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
  });
  const discPct  = Math.min(Math.max(parseFloat(discountPct) || 0, 0), 100);
  const discAmt  = +(subtotal * discPct / 100).toFixed(2);
  const taxable  = Math.max(subtotal - discAmt, 0);
  // GST computed on the discounted (taxable) value.
  items.forEach(item => {
    const line = parseFloat(item.qty || 0) * parseFloat(item.rate || 0);
    const share = subtotal > 0 ? line / subtotal : 0;
    totalGST += Math.round((taxable * share) * (parseFloat(item.gst_rate) || 0) / 100);
  });
  const grandTotal = Math.max(taxable + totalGST, 0);

  const handleSave = async () => {
    if (!customerName.trim()) { Alert.alert('', 'Please enter customer name'); return; }
    const validItems = items.filter(it => it.product_id && parseFloat(it.qty) > 0);
    if (validItems.length === 0) { Alert.alert('', 'Select at least one product with quantity.'); return; }
    setLoading(true);
    try {
      await salesService.create({
        customer_name: customerName.trim(),
        items: validItems.map(it => ({
          product_id:   it.product_id,
          product_name: it.product_name,
          product_code: it.product_code,
          qty:      parseFloat(it.qty),
          rate:     parseFloat(it.rate),
          gst_rate: parseFloat(it.gst_rate),
        })),
        discount_percent: discPct,
        discount: discAmt,
        date: new Date().toISOString(),
      });
      Alert.alert('Success', 'Sale recorded');
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <FormField label="Customer Name *" value={customerName} onChangeText={setCustomerName} />

        <Text style={styles.sectionTitle}>Products</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.itemBox}>
            {/* Product picker (searchable dropdown) */}
            <Text style={styles.fieldLabel}>Product *</Text>
            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => { setPickerFor(i); setPickerSearch(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickBtnText, !item.product_name && styles.pickBtnPlaceholder]} numberOfLines={1}>
                {item.product_name || 'Tap to select a product…'}
              </Text>
              <Text style={styles.pickChevron}>▾</Text>
            </TouchableOpacity>
            {item.product_code ? <Text style={styles.pickMeta}>Code: {item.product_code}</Text> : null}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}><FormField label="Qty"  value={item.qty}     onChangeText={v => updateItem(i, 'qty', v.replace(/[^0-9.]/g,''))}     keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1, marginLeft: 6 }}> <FormField label="Rate" value={item.rate}    onChangeText={v => updateItem(i, 'rate', v.replace(/[^0-9.]/g,''))}    keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1, marginLeft: 6 }}> <FormField label="GST %" value={item.gst_rate} onChangeText={v => updateItem(i, 'gst_rate', v.replace(/[^0-9.]/g,''))} keyboardType="decimal-pad" /></View>
            </View>

            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeItem}>
                <Text style={styles.removeItemText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addItem} onPress={addItem}>
          <Text style={styles.addItemText}>+ Add Product</Text>
        </TouchableOpacity>

        <FormField label="Discount (%)" value={discountPct} onChangeText={v => setDiscountPct(v.replace(/[^0-9.]/g,''))} keyboardType="decimal-pad" />

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Discount ({discPct}%)</Text><Text style={[styles.totalValue, { color: theme.colors.danger }]}>-{formatCurrency(discAmt)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalLabel}>GST</Text><Text style={styles.totalValue}>{formatCurrency(totalGST)}</Text></View>
          <View style={[styles.totalRow, styles.grandRow]}><Text style={styles.grandLabel}>Grand Total</Text><Text style={styles.grandValue}>{formatCurrency(grandTotal)}</Text></View>
        </View>

        <PrimaryButton title="Save Sale" onPress={handleSave} loading={loading} style={styles.btn} />
      </ScrollView>

      {/* Product picker modal — searchable */}
      <Modal visible={pickerFor != null} animationType="slide" transparent onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPickerFor(null)} activeOpacity={1} />
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
                data={filteredCatalog}
                keyExtractor={p => p._id}
                style={{ maxHeight: 380 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.modalEmpty}>No products found.</Text>}
                renderItem={({ item: p }) => {
                  const rate = p.selling_price || p.wholesale_rate || p.retail_price || p.mrp || 0;
                  return (
                    <TouchableOpacity style={styles.pickRow} onPress={() => pickProduct(p)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickRowName}>{p.name}</Text>
                        <Text style={styles.pickRowMeta}>{p.code || '—'} · ₹{Number(rate).toLocaleString('en-IN')}/{p.unit || 'unit'} · GST {p.gst_percent ?? 18}%</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { padding: 20, backgroundColor: theme.colors.background, flexGrow: 1, paddingBottom: 48 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8, textTransform: 'uppercase' },
  itemBox:      { backgroundColor: '#f0f4ff', borderRadius: 8, padding: 12, marginBottom: 8 },
  row:          { flexDirection: 'row' },

  fieldLabel:   { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  pickBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  pickBtnText:  { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pickBtnPlaceholder: { color: theme.colors.textSecondary, fontWeight: '500' },
  pickChevron:  { fontSize: 14, color: theme.colors.primary, marginLeft: 8 },
  pickMeta:     { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 2 },

  removeItem:   { alignSelf: 'flex-end', marginTop: 8 },
  removeItemText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },

  addItem:      { borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 16, borderStyle: 'dashed' },
  addItemText:  { color: theme.colors.primary, fontWeight: '600' },
  pills:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: theme.colors.border },
  pillActive:   { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText:     { fontSize: 12, color: theme.colors.textSecondary },
  pillTextActive:{ color: '#fff', fontWeight: '700' },
  totals:       { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 14, marginBottom: 16, elevation: 1 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel:   { fontSize: 13, color: theme.colors.textSecondary },
  totalValue:   { fontSize: 13, fontWeight: '600' },
  grandRow:     { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8, marginTop: 4 },
  grandLabel:   { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  grandValue:   { fontSize: 17, fontWeight: '800', color: theme.colors.primary },
  btn:          { marginTop: 8 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 10 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  modalSearch:  { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  modalSearchInput: { fontSize: 14, color: theme.colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 10 : 6 },
  modalEmpty:   { textAlign: 'center', color: theme.colors.textSecondary, padding: 20, fontSize: 13 },
  pickRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pickRowName:  { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pickRowMeta:  { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
  pickRowArrow: { fontSize: 20, color: theme.colors.textDisabled, marginLeft: 8 },
});
