// src/screens/staff/AddStaffScreen.jsx
//
// Add or edit a staff member (belongs to the logged-in wholesaler).
// Captures: Name, Mobile (required), Email (optional), Role Access
// (preset roles + a custom "Add Role Access" name), Salary, and Incentive
// slabs (sales amount → incentive %). The backend maps the role to app access
// and stores salary + incentive_slabs on the Employee (scoped by company_id).
//
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormField from '../../components/FormField';
import Icon from '../../components/Icon';
import { employeeService, STAFF_ROLES } from '../../services/employeeService';
import { wholesalerProductService } from '../../services/productService';
import { theme } from '../../utils/theme';

const ORANGE = theme.colors.accent;
const NAVY   = theme.colors.primary;
const MUTED  = theme.colors.textSecondary;

export default function AddStaffScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const editing = route?.params?.staff || null;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Existing role_access (custom) or matched preset
  const presetMatch = STAFF_ROLES.find(r =>
    (editing?.role_access || editing?.designation || '').toLowerCase() === r.key.toLowerCase(),
  )?.key;
  const existingCustom = (editing?.role_access && !presetMatch) ? editing.role_access : '';

  const [form, setForm] = useState({
    name:   editing?.name   || '',
    mobile: editing?.mobile || '',
    email:  editing?.email  || '',
    role:   presetMatch || (existingCustom ? '' : 'Sales Executive'),
    salary: editing?.salary ? String(editing.salary) : '',
  });

  // Custom role access (admin-defined). When set, it overrides the preset role.
  const [customRoles, setCustomRoles] = useState(existingCustom ? [existingCustom] : []);
  const [selectedCustom, setSelectedCustom] = useState(existingCustom || '');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  // Incentive slabs
  const [slabs, setSlabs] = useState(
    Array.isArray(editing?.incentive_slabs) && editing.incentive_slabs.length
      ? editing.incentive_slabs.map(s => ({ sales_amount: String(s.sales_amount), incentive_pct: String(s.incentive_pct) }))
      : [],
  );

  // Discount Authorized Access: per-item max discount % this staff can offer.
  // [{ product_id, product_name, product_code, max_discount_pct: '10' }]
  const [discountAuth, setDiscountAuth] = useState(
    Array.isArray(editing?.discount_authorizations) && editing.discount_authorizations.length
      ? editing.discount_authorizations.map(d => ({
          product_id:       String(d.product_id),
          product_name:     d.product_name || '',
          product_code:     d.product_code || '',
          max_discount_pct: String(d.max_discount_pct ?? ''),
        }))
      : [],
  );
  const [showItemModal, setShowItemModal] = useState(false);
  const [items, setItems] = useState([]);          // wholesaler's own products
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  // Live current-month sales + earned incentive (edit mode only).
  const [earned, setEarned] = useState(null);
  useEffect(() => {
    if (!editing?._id) return;
    let alive = true;
    employeeService.incentive(editing._id)
      .then(res => { if (alive) setEarned(res?.data ?? res ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [editing?._id]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };

  const pickPreset = (key) => { set('role', key); setSelectedCustom(''); };
  const pickCustom = (name) => { setSelectedCustom(name); set('role', ''); };

  const addCustomRole = () => {
    const n = newRoleName.trim();
    if (!n) return;
    if (!customRoles.some(r => r.toLowerCase() === n.toLowerCase())) {
      setCustomRoles(prev => [...prev, n]);
    }
    setSelectedCustom(n);
    set('role', '');
    setNewRoleName('');
    setShowRoleModal(false);
  };

  const addSlab   = () => setSlabs(s => [...s, { sales_amount: '', incentive_pct: '' }]);
  const removeSlab = (i) => setSlabs(s => s.filter((_, idx) => idx !== i));
  const setSlab   = (i, k, v) => setSlabs(s => s.map((row, idx) => idx === i ? { ...row, [k]: v.replace(/[^\d.]/g, '') } : row));

  // ── Discount Authorized Access helpers ──────────────────────────────────
  // Open the item picker and fetch the wholesaler's own items (their account).
  const openItemPicker = async () => {
    setShowItemModal(true);
    if (items.length) return;
    setItemsLoading(true);
    try {
      const res = await wholesalerProductService.listMine({ page: 1, limit: 500 });
      const list = res?.data?.products || res?.products || [];
      setItems(list);
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not load your items.');
    } finally {
      setItemsLoading(false);
    }
  };

  // Toggle an item into/out of the authorization list.
  const toggleItem = (item) => {
    const id = String(item._id);
    setDiscountAuth(prev => {
      const exists = prev.some(d => d.product_id === id);
      if (exists) return prev.filter(d => d.product_id !== id);
      return [...prev, {
        product_id:       id,
        product_name:     item.name || '',
        product_code:     item.code || '',
        max_discount_pct: '',
      }];
    });
  };

  const removeAuth = (id) => setDiscountAuth(prev => prev.filter(d => d.product_id !== id));
  const setAuthPct = (id, v) =>
    setDiscountAuth(prev => prev.map(d =>
      d.product_id === id ? { ...d, max_discount_pct: v.replace(/[^\d.]/g, '') } : d
    ));

  const filteredItems = items.filter(it => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return true;
    return (it.name || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q);
  });

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    const mob = form.mobile.replace(/\D/g, '');
    if (mob.length !== 10) e.mobile = 'Enter a valid 10-digit mobile';
    const roleAccess = selectedCustom || form.role;
    if (!roleAccess) e.role = 'Select or add a role access';
    setErrors(e);
    if (Object.keys(e).length) return;

    // Clean slabs: keep only valid rows.
    const cleanSlabs = slabs
      .map(s => ({ sales_amount: Number(s.sales_amount), incentive_pct: Number(s.incentive_pct) }))
      .filter(s => isFinite(s.sales_amount) && s.sales_amount > 0 && isFinite(s.incentive_pct) && s.incentive_pct >= 0)
      .sort((a, b) => a.sales_amount - b.sales_amount);

    // Clean discount authorizations: keep rows with a valid item + max % (0–100).
    const cleanDiscountAuth = discountAuth
      .map(d => ({
        product_id:       d.product_id,
        product_name:     d.product_name,
        product_code:     d.product_code,
        max_discount_pct: Number(d.max_discount_pct),
      }))
      .filter(d => d.product_id && isFinite(d.max_discount_pct) && d.max_discount_pct >= 0 && d.max_discount_pct <= 100);

    const payload = {
      name:        form.name.trim(),
      mobile:      mob,
      email:       form.email.trim(),
      // A preset role also drives app access mapping; a custom name is stored as role_access.
      designation: form.role || roleAccess,
      role_access: roleAccess,
      salary:      Number(form.salary) || 0,
      incentive_slabs: cleanSlabs,
      discount_authorizations: cleanDiscountAuth,
    };

    setSaving(true);
    try {
      if (editing) {
        await employeeService.update(editing._id, payload);
        Alert.alert('Success', 'Staff updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await employeeService.create(payload);
        Alert.alert('Success', 'Staff added. They can now log in via the staff app with their mobile.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save staff.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : (StatusBar.currentHeight || 0)}
    >
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Staff' : 'Add Staff'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 320 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Basic details */}
        <SectionLabel icon="account-outline" text="Staff Details" />
        <View style={styles.card}>
          <FormField label="Full Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="Staff member name" error={errors.name} />
          <FormField label="Mobile *" value={form.mobile} onChangeText={v => set('mobile', v.replace(/[^0-9]/g, ''))} keyboardType="phone-pad" placeholder="10-digit mobile" error={errors.mobile} maxLength={10} />
          <FormField label="Email (optional)" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" placeholder="name@example.com" />
        </View>

        {/* Role access */}
        <SectionLabel icon="shield-key-outline" text="Role Access" />
        <View style={styles.card}>
          {STAFF_ROLES.map(r => {
            const active = !selectedCustom && form.role === r.key;
            return (
              <TouchableOpacity key={r.key} style={styles.roleRow} onPress={() => pickPreset(r.key)} activeOpacity={0.85}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Icon name="check" size={13} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleLabel, active && { color: ORANGE }]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Custom roles created by admin */}
          {customRoles.map(name => {
            const active = selectedCustom === name;
            return (
              <TouchableOpacity key={name} style={styles.roleRow} onPress={() => pickCustom(name)} activeOpacity={0.85}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Icon name="check" size={13} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleLabel, active && { color: ORANGE }]}>{name}</Text>
                  <Text style={styles.roleDesc}>Custom access</Text>
                </View>
                <View style={styles.customTag}><Text style={styles.customTagText}>Custom</Text></View>
              </TouchableOpacity>
            );
          })}

          {!!errors.role && <Text style={styles.errText}>{errors.role}</Text>}

          <TouchableOpacity style={styles.addRoleBtn} onPress={() => { setNewRoleName(''); setShowRoleModal(true); }} activeOpacity={0.8}>
            <Icon name="plus-circle-outline" size={18} color={ORANGE} />
            <Text style={styles.addRoleText}>Add Role Access</Text>
          </TouchableOpacity>
        </View>

        {/* Salary */}
        <SectionLabel icon="cash" text="Salary Details" />
        <View style={styles.card}>
          <FormField
            label="Monthly Salary (₹)"
            value={form.salary}
            onChangeText={v => set('salary', v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="e.g. 15000"
          />
        </View>

        {/* Earned incentive this month (edit mode) */}
        {earned && (
          <>
            <SectionLabel icon="wallet-outline" text={`This Month${earned.periodLabel ? ` · ${earned.periodLabel}` : ''}`} />
            <View style={styles.earnedCard}>
              <View style={styles.earnedItem}>
                <Text style={styles.earnedLabel}>Sales</Text>
                <Text style={styles.earnedValue}>₹{Number(earned.monthSales || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.earnedDivider} />
              <View style={styles.earnedItem}>
                <Text style={styles.earnedLabel}>Rate</Text>
                <Text style={styles.earnedValue}>{earned.pct || 0}%</Text>
              </View>
              <View style={styles.earnedDivider} />
              <View style={styles.earnedItem}>
                <Text style={styles.earnedLabel}>Incentive</Text>
                <Text style={[styles.earnedValue, { color: ORANGE }]}>₹{Number(earned.amount || 0).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </>
        )}

        {/* Incentive slabs */}
        <SectionLabel icon="chart-line-variant" text="Incentive Details" />
        <View style={styles.card}>
          <Text style={styles.incentiveHint}>
            Add slabs: when the staff's sales reach an amount, they earn that %.
            The highest reached slab applies.
          </Text>

          {slabs.length > 0 && (
            <View style={styles.slabHead}>
              <Text style={[styles.slabHeadText, { flex: 1.4 }]}>Sales ≥ (₹)</Text>
              <Text style={[styles.slabHeadText, { flex: 1 }]}>Incentive %</Text>
              <View style={{ width: 30 }} />
            </View>
          )}

          {slabs.map((s, i) => (
            <View key={i} style={styles.slabRow}>
              <TextInput
                style={[styles.slabInput, { flex: 1.4 }]}
                value={s.sales_amount}
                onChangeText={v => setSlab(i, 'sales_amount', v)}
                keyboardType="decimal-pad"
                placeholder="50000"
                placeholderTextColor="#B8C0CC"
              />
              <TextInput
                style={[styles.slabInput, { flex: 1 }]}
                value={s.incentive_pct}
                onChangeText={v => setSlab(i, 'incentive_pct', v)}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor="#B8C0CC"
              />
              <TouchableOpacity style={{ width: 30, alignItems: 'center' }} onPress={() => removeSlab(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close-circle" size={20} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSlabBtn} onPress={addSlab} activeOpacity={0.8}>
            <Icon name="plus" size={16} color={ORANGE} />
            <Text style={styles.addSlabText}>Add Incentive Slab</Text>
          </TouchableOpacity>

          {slabs.length > 0 && (
            <View style={styles.slabExample}>
              <Text style={styles.slabExampleText}>
                Example: Sales ₹50,000 → 1% · ₹1,00,000 → 2% · ₹2,00,000 → 3%
              </Text>
            </View>
          )}
        </View>

        {/* Discount Authorized Access */}
        <SectionLabel icon="sale" text="Discount Authorized Access" />
        <View style={styles.card}>
          <Text style={styles.incentiveHint}>
            Choose items this staff member can offer a discount on, then set the
            maximum discount % allowed per item. Staff cannot exceed these limits.
            This is private to the staff profile — customers never see it.
          </Text>

          {discountAuth.length > 0 && (
            <View style={styles.slabHead}>
              <Text style={[styles.slabHeadText, { flex: 2 }]}>Item</Text>
              <Text style={[styles.slabHeadText, { flex: 1, textAlign: 'center' }]}>Max %</Text>
              <View style={{ width: 30 }} />
            </View>
          )}

          {discountAuth.map((d) => (
            <View key={d.product_id} style={styles.authRow}>
              <View style={{ flex: 2, paddingRight: 8 }}>
                <Text style={styles.authName} numberOfLines={1}>{d.product_name || 'Item'}</Text>
                {!!d.product_code && <Text style={styles.authCode}>{d.product_code}</Text>}
              </View>
              <TextInput
                style={[styles.slabInput, { flex: 1, textAlign: 'center' }]}
                value={d.max_discount_pct}
                onChangeText={v => setAuthPct(d.product_id, v)}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor="#B8C0CC"
                maxLength={5}
              />
              <TouchableOpacity style={{ width: 30, alignItems: 'center' }} onPress={() => removeAuth(d.product_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="close-circle" size={20} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSlabBtn} onPress={openItemPicker} activeOpacity={0.8}>
            <Icon name="plus" size={16} color={ORANGE} />
            <Text style={styles.addSlabText}>Select Items</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          <Icon name="content-save-outline" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Staff')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Role Access modal */}
      <Modal visible={showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowRoleModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Role Access</Text>
            <Text style={styles.modalSub}>Create a custom access name for this staff member.</Text>
            <TextInput
              style={styles.modalInput}
              value={newRoleName}
              onChangeText={setNewRoleName}
              placeholder="e.g. Cashier, Floor Manager"
              placeholderTextColor={MUTED}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhost} onPress={() => setShowRoleModal(false)}>
                <Text style={styles.modalGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={addCustomRole}>
                <Text style={styles.modalPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Select Items modal — pick items this staff can discount */}
      <Modal visible={showItemModal} transparent animationType="slide" onRequestClose={() => setShowItemModal(false)}>
        <View style={styles.itemModalOverlay}>
          <View style={styles.itemModalCard}>
            <View style={styles.itemModalHeader}>
              <Text style={styles.modalTitle}>Select Items</Text>
              <TouchableOpacity onPress={() => setShowItemModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Tap items to authorize discounts. Set the max % after closing.</Text>

            <TextInput
              style={styles.modalInput}
              value={itemSearch}
              onChangeText={setItemSearch}
              placeholder="Search by name or code"
              placeholderTextColor={MUTED}
            />

            {itemsLoading ? (
              <View style={styles.itemLoading}>
                <ActivityIndicator color={ORANGE} />
                <Text style={styles.itemLoadingText}>Loading your items…</Text>
              </View>
            ) : (
              <FlatList
                data={filteredItems}
                keyExtractor={it => String(it._id)}
                style={{ marginTop: 12, maxHeight: 360 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.itemEmpty}>
                    {items.length ? 'No items match your search.' : 'No items found in your account.'}
                  </Text>
                }
                renderItem={({ item }) => {
                  const selected = discountAuth.some(d => d.product_id === String(item._id));
                  return (
                    <TouchableOpacity style={styles.itemRow} onPress={() => toggleItem(item)} activeOpacity={0.8}>
                      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                        {selected && <Icon name="check" size={13} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Item'}</Text>
                        {!!item.code && <Text style={styles.itemCode}>{item.code}</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity style={styles.modalPrimary} onPress={() => setShowItemModal(false)}>
              <Text style={styles.modalPrimaryText}>
                Done{discountAuth.length ? ` (${discountAuth.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <View style={styles.sectionLabel}>
      <Icon name={icon} size={16} color={ORANGE} />
      <Text style={styles.sectionLabelText}>{text}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: NAVY,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  container: { padding: 16, backgroundColor: theme.colors.background },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 },
  sectionLabelText: { fontSize: 12, fontWeight: '800', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  roleLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  roleDesc: { fontSize: 11.5, color: MUTED, marginTop: 1 },
  customTag: { backgroundColor: theme.colors.accentLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  customTagText: { fontSize: 9.5, fontWeight: '800', color: ORANGE },

  addRoleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight },
  addRoleText: { fontSize: 13, fontWeight: '800', color: ORANGE },
  errText: { fontSize: 12, color: theme.colors.danger, fontWeight: '600', marginTop: 8 },

  incentiveHint: { fontSize: 12, color: MUTED, lineHeight: 17, marginBottom: 12 },
  slabHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  slabHeadText: { fontSize: 11, fontWeight: '800', color: MUTED },
  slabRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  slabInput: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 10, height: 44, paddingHorizontal: 12, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, backgroundColor: '#fff' },
  addSlabBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight },
  addSlabText: { fontSize: 13, fontWeight: '800', color: ORANGE },
  slabExample: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  slabExampleText: { fontSize: 11, color: MUTED, lineHeight: 16 },

  earnedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: NAVY, borderRadius: 14, paddingVertical: 16, marginBottom: 16 },
  earnedItem: { flex: 1, alignItems: 'center' },
  earnedLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  earnedValue: { fontSize: 15, fontWeight: '900', color: '#fff' },
  earnedDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.15)' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  /* discount authorization rows */
  authRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authName: { fontSize: 13.5, fontWeight: '700', color: theme.colors.textPrimary },
  authCode: { fontSize: 11, color: MUTED, marginTop: 1 },

  /* item picker modal */
  itemModalOverlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'flex-end' },
  itemModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28 },
  itemModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemLoading: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  itemLoadingText: { fontSize: 12.5, color: MUTED },
  itemEmpty: { fontSize: 13, color: MUTED, textAlign: 'center', paddingVertical: 24 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  itemName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  itemCode: { fontSize: 11.5, color: MUTED, marginTop: 1 },

  /* modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12.5, color: MUTED, marginTop: 3, marginBottom: 14 },
  modalInput: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: theme.colors.textPrimary, backgroundColor: '#F8FAFC' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalGhost: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  modalGhostText: { fontSize: 14, fontWeight: '800', color: MUTED },
  modalPrimary: { flex: 1, height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
