// src/screens/inventory/WarehouseListScreen.jsx
// Manage warehouses — list + create/edit.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { inventoryService } from '../../services/inventoryService';
import { theme } from '../../utils/theme';

const NAVY = theme.colors.primary;
const EMPTY = { name: '', city: '', state: '', address: '', contact_person: '', mobile: '' };

export default function WarehouseListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.listWarehouses();
      const data = res?.data ?? res ?? [];
      setWarehouses(Array.isArray(data) ? data : (data.warehouses ?? []));
    } catch { setWarehouses([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (w) => {
    setEditing(w);
    setForm({ name: w.name || '', city: w.city || '', state: w.state || '', address: w.address || '', contact_person: w.contact_person || '', mobile: w.mobile || '' });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Warehouse name is required.'); return; }
    setSaving(true);
    try {
      if (editing) await inventoryService.updateWarehouse(editing._id, form);
      else         await inventoryService.createWarehouse(form);
      setShowForm(false);
      load();
    } catch (e) { Alert.alert('Failed', e?.message || 'Could not save warehouse.'); }
    finally { setSaving(false); }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.8}>
      <View style={[styles.icon, { backgroundColor: '#ECFEFF' }]}>
        <Icon name="warehouse" size={20} color="#0891B2" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.sub}>{[item.city, item.state].filter(Boolean).join(', ') || item.warehouse_code || '—'}</Text>
      </View>
      <Icon name="pencil-outline" size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Warehouses</Text>
        <TouchableOpacity onPress={openAdd}><Icon name="plus" size={22} color="#fff" /></TouchableOpacity>
      </View>

      {loading ? <LoadingSpinner /> : (
        <FlatList
          data={warehouses}
          keyExtractor={(i, idx) => i._id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          ListEmptyComponent={<EmptyState icon="🏬" title="No warehouses yet" subtitle="Tap + to add one" />}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={openAdd} activeOpacity={0.85}>
        <Text style={styles.fabText}>+  Add Warehouse</Text>
      </TouchableOpacity>

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editing ? 'Edit Warehouse' : 'New Warehouse'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}><Icon name="close" size={20} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <FormField label="Warehouse Name *" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Main Godown" />
              <View style={styles.row}>
                <View style={styles.col}><FormField label="City" value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} placeholder="City" /></View>
                <View style={styles.col}><FormField label="State" value={form.state} onChangeText={v => setForm(f => ({ ...f, state: v }))} placeholder="State" /></View>
              </View>
              <FormField label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline placeholder="Full address" />
              <View style={styles.row}>
                <View style={styles.col}><FormField label="Contact Person" value={form.contact_person} onChangeText={v => setForm(f => ({ ...f, contact_person: v }))} placeholder="Name" /></View>
                <View style={styles.col}><FormField label="Mobile" value={form.mobile} onChangeText={v => setForm(f => ({ ...f, mobile: v.replace(/\D/g, '') }))} keyboardType="number-pad" maxLength={10} placeholder="Phone" /></View>
              </View>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Warehouse')}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: theme.colors.accent, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
