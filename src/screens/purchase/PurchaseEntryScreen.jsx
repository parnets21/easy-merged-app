// src/screens/purchase/PurchaseEntryScreen.jsx
//
// Wholesaler "Buy Item" — record a purchase into own inventory.
// Handles tiles (buy by boxes → sq ft) and granite (length × width → sq ft),
// with a live amount + GST + total calculation.
//
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import FormField from '../../components/FormField';
import { purchaseService } from '../../services/purchaseService';
import { wholesalerProductService } from '../../services/productService';
import { theme } from '../../utils/theme';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function PurchaseEntryScreen({ route, navigation }) {
  const preset = route?.params?.product || null;   // optional {_id,name,code,sqft_per_box,purchase_price,gst_percent,unit}

  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // ── Admin catalog product picker ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedName, setSelectedName] = useState(preset?.name || '');

  useEffect(() => {
    setCatalogLoading(true);
    wholesalerProductService.listCatalog({ catalog_only: true, limit: 200 })
      .then(res => setCatalog(res?.data?.products || res?.products || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }, []);

  const pickProduct = (p) => {
    setForm(f => ({
      ...f,
      product_id:   p._id,
      product_code: p.code || '',
      product_name: p.name || '',
      rate:         String(p.purchase_price || p.wholesale_rate || p.selling_price || ''),
      gst_percent:  String(p.gst_percent ?? 18),
      sqft_per_box: p.sqft_per_box ? String(p.sqft_per_box) : f.sqft_per_box,
    }));
    setSelectedName(p.name || '');
    setPickerOpen(false);
    setPickerSearch('');
  };

  const [form, setForm] = useState({
    supplier_name: '',
    purchase_date: new Date().toISOString().slice(0, 10),   // YYYY-MM-DD, defaults to today
    product_name:  preset?.name || '',
    product_id:    preset?._id || null,
    product_code:  preset?.code || '',
    rate:          preset ? String(preset.purchase_price || preset.wholesale_rate || '') : '',
    gst_percent:   preset ? String(preset.gst_percent ?? 18) : '18',
    // boxes mode
    boxes:         '',
    sqft_per_box:  preset?.sqft_per_box ? String(preset.sqft_per_box) : '',
    // granite mode (per piece dims in inches)
    slabL:         '',
    slabW:         '',
    slabPcs:       '1',
    // direct mode
    directQty:     '',
    notes:         '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const numOnly = (v) => v.replace(/[^0-9.]/g, '');

  // Quantity is entered directly (buy-mode selector removed).
  const qty = useMemo(() => parseFloat(form.directQty) || 0, [form.directQty]);

  const rate = parseFloat(form.rate) || 0;
  const gstPct = parseFloat(form.gst_percent);
  const amount = +(qty * rate).toFixed(2);
  const gstAmount = Math.round(amount * (isNaN(gstPct) ? 18 : gstPct) / 100);
  const total = amount + gstAmount;

  const handleSave = async () => {
    if (!form.product_id)           { Alert.alert('Required', 'Select a product from the catalog.'); return; }
    if (!form.supplier_name.trim()) { Alert.alert('Required', 'Enter supplier name.'); return; }
    if (qty <= 0)  { Alert.alert('Required', 'Quantity must be greater than 0.'); return; }
    if (rate <= 0) { Alert.alert('Required', 'Rate must be greater than 0.'); return; }

    const payload = {
      supplier_name: form.supplier_name.trim(),
      purchase_date: form.purchase_date || undefined,
      product_id:    form.product_id || null,
      product_code:  form.product_code || '',
      product_name:  form.product_name.trim(),
      qty, rate,
      gst_percent:   isNaN(gstPct) ? 18 : gstPct,
      notes: form.notes.trim(),
    };

    setSaving(true);
    try {
      await purchaseService.create(payload);
      Alert.alert('Success', 'Purchase recorded and stock added.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not record purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Buy / New Purchase</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">

        <View style={styles.card}>
          {/* Pick from admin catalog — this is the ONLY way to choose a product */}
          <Text style={styles.pickLabel}>Select Product from Catalog *</Text>
          <TouchableOpacity style={styles.pickBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
            <Text style={[styles.pickBtnText, !selectedName && styles.pickBtnPlaceholder]} numberOfLines={1}>
              {selectedName || 'Tap to choose an admin product…'}
            </Text>
            <Text style={styles.pickChevron}>▾</Text>
          </TouchableOpacity>
          {selectedName ? (
            <Text style={styles.pickSelected} numberOfLines={1}>
              Selected: {form.product_code ? form.product_code + ' · ' : ''}{selectedName}
            </Text>
          ) : (
            <Text style={styles.pickHint}>Choose a product from the admin catalog to continue.</Text>
          )}

          <FormField label="Supplier Name *" value={form.supplier_name}
            onChangeText={v => set('supplier_name', v)} placeholder="Supplier / vendor name" />

          {/* Purchase date — opens a calendar picker */}
          <Text style={styles.dateLabel}>Purchase Date</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateInput} onPress={() => setCalendarOpen(true)} activeOpacity={0.8}>
              <Text style={styles.dateInputText}>{form.purchase_date || 'Select date'}</Text>
              <Text style={styles.dateInputIcon}>📅</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayBtn}
              onPress={() => set('purchase_date', new Date().toISOString().slice(0, 10))} activeOpacity={0.8}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                  placeholder="Search catalog…"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                />
              </View>
              {catalogLoading ? (
                <Text style={styles.modalEmpty}>Loading catalog…</Text>
              ) : (
                <FlatList
                  data={catalog.filter(p => {
                    const q = pickerSearch.trim().toLowerCase();
                    return !q || (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                  })}
                  keyExtractor={p => p._id}
                  style={{ maxHeight: 380 }}
                  ListEmptyComponent={<Text style={styles.modalEmpty}>No catalog products found.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.pickRow} onPress={() => pickProduct(item)} activeOpacity={0.7}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickRowName}>{item.name}</Text>
                        <Text style={styles.pickRowMeta}>{item.code} · {item.size || '—'} · ₹{item.purchase_price || item.selling_price || 0}/{item.unit || 'Sq Ft'}</Text>
                      </View>
                      <Text style={styles.pickRowArrow}>›</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Calendar picker modal */}
        <CalendarModal
          visible={calendarOpen}
          value={form.purchase_date}
          onClose={() => setCalendarOpen(false)}
          onSelect={(d) => { set('purchase_date', d); setCalendarOpen(false); }}
        />

        {/* Quantity + Rate (buy-mode selector removed — always direct quantity) */}
        <View style={styles.card}>
          <View style={styles.row}>
              <View style={styles.col}>
                <FormField label="Quantity" value={form.directQty}
                  onChangeText={v => set('directQty', numOnly(v))} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={styles.col}>
                <FormField label="Rate" value={form.rate}
                  onChangeText={v => set('rate', numOnly(v))} keyboardType="numeric" placeholder="0" />
              </View>
            </View>

          <FormField label="GST %" value={form.gst_percent}
            onChangeText={v => set('gst_percent', numOnly(v))} keyboardType="numeric" placeholder="18" />
        </View>

        {/* Live calculation summary */}
        <View style={styles.summary}>
          <Row label="Quantity" value={`${qty}`} />
          <Row label="Rate" value={money(rate)} />
          <Row label="Amount" value={money(amount)} />
          <Row label={`GST (${isNaN(gstPct) ? 18 : gstPct}%)`} value={money(gstAmount)} />
          <View style={styles.divider} />
          <Row label="Total" value={money(total)} big />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnOff]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Confirm Purchase'}</Text>
        </TouchableOpacity>
      </ScrollView>
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

// ── Lightweight in-app calendar (no native dependency) ──────────
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function CalendarModal({ visible, value, onClose, onSelect }) {
  // Parse the currently selected date (or fall back to today) to position the view.
  const parsed = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (m) return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
    const t = new Date();
    return { y: t.getFullYear(), mo: t.getMonth(), d: t.getDate() };
  })();

  const [viewYear, setViewYear] = useState(parsed.y);
  const [viewMonth, setViewMonth] = useState(parsed.mo);

  // Re-sync the visible month whenever the picker is re-opened.
  useEffect(() => {
    if (visible) { setViewYear(parsed.y); setViewMonth(parsed.mo); }
  }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();      // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selISO = value;
  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.calOverlay}>
        <TouchableOpacity style={styles.calDismiss} onPress={onClose} activeOpacity={1} />
        <View style={styles.calCard}>
          {/* Month nav */}
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={goPrev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.calNav}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goNext} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.calNav}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.calWeekRow}>
            {WEEKDAYS.map(w => <Text key={w} style={styles.calWeekday}>{w}</Text>)}
          </View>

          {/* Day grid */}
          <View style={styles.calGrid}>
            {cells.map((d, i) => {
              if (d == null) return <View key={`e${i}`} style={styles.calCell} />;
              const iso = toISO(viewYear, viewMonth, d);
              const isSel = iso === selISO;
              const isToday = iso === todayISO;
              return (
                <TouchableOpacity key={iso} style={styles.calCell} onPress={() => onSelect(iso)} activeOpacity={0.7}>
                  <View style={[styles.calDay, isSel && styles.calDaySel, !isSel && isToday && styles.calDayToday]}>
                    <Text style={[styles.calDayText, isSel && styles.calDayTextSel]}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.calClose} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.calCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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

  container: { backgroundColor: theme.colors.background, padding: 16, paddingBottom: 320 },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  typeChipOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accentLight },
  typeChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textAlign: 'center' },
  typeChipTextOn: { color: theme.colors.accent },

  card: {
    backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },

  summary: {
    backgroundColor: theme.colors.primary, borderRadius: 14, padding: 18, marginBottom: 16,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  sumLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  sumValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sumLabelBig: { fontSize: 15, color: '#fff', fontWeight: '800' },
  sumValueBig: { fontSize: 20, fontWeight: '900', color: theme.colors.accent },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8 },

  saveBtn: {
    backgroundColor: theme.colors.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnOff: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  /* Purchase date */
  dateLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn:  { backgroundColor: theme.colors.accentLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.accent },
  todayBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: 13 },

  /* Date input (opens calendar) */
  dateInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 13, backgroundColor: theme.colors.surface,
  },
  dateInputText: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
  dateInputIcon: { fontSize: 15, marginLeft: 8 },

  /* Calendar modal */
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  calDismiss: { ...StyleSheet.absoluteFillObject },
  calCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  calNav: { fontSize: 28, color: theme.colors.primary, fontWeight: '700', paddingHorizontal: 12 },
  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDay: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calDaySel: { backgroundColor: theme.colors.accent },
  calDayToday: { borderWidth: 1.5, borderColor: theme.colors.accent },
  calDayText: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
  calDayTextSel: { color: '#fff', fontWeight: '800' },
  calClose: { marginTop: 10, alignItems: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: theme.colors.background },
  calCloseText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },

  /* Product picker */
  pickLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: theme.colors.accent, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: theme.colors.accentLight,
  },
  pickBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.accentDark },
  pickBtnPlaceholder: { color: theme.colors.textSecondary, fontWeight: '500' },
  pickChevron: { fontSize: 14, color: theme.colors.accentDark, marginLeft: 8 },
  pickHint: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 6, marginBottom: 6 },
  pickSelected: { fontSize: 12, fontWeight: '700', color: theme.colors.accentDark, marginTop: 6, marginBottom: 6 },

  /* Modal */
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
