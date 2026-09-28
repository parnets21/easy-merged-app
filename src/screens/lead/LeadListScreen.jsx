// src/screens/lead/LeadListScreen.jsx
// Lead capture + list + status filter + follow-up scheduling.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { leadService, followupService } from '../../services/leadService';
import { theme } from '../../utils/theme';

const SOURCES = ['Website', 'WhatsApp', 'Facebook', 'Instagram', 'Google Ads', 'Referral'];
const STATUSES = ['New', 'Follow-up', 'Interested', 'Not Interested', 'Converted'];
const STATUS_TABS = ['All', ...STATUSES];

const STATUS_COLOR = {
  New:             { bg: '#EFF6FF', color: '#2563EB' },
  'Follow-up':     { bg: '#FFF7ED', color: '#D97706' },
  Interested:      { bg: '#F5F3FF', color: '#7C3AED' },
  'Not Interested':{ bg: '#F3F4F6', color: '#6B7280' },
  Converted:       { bg: '#ECFDF5', color: '#059669' },
};

const EMPTY = { name: '', mobile: '', email: '', source: 'Website', status: 'New', notes: '' };

export default function LeadListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [leads, setLeads]     = useState([]);
  const [tab, setTab]         = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(null);

  // Add/Edit lead modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  // Follow-up modal
  const [fuLead, setFuLead]   = useState(null);
  const [fuDate, setFuDate]   = useState('');
  const [fuNote, setFuNote]   = useState('');
  const [fuSaving, setFuSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = tab === 'All' ? {} : { status: tab };
      const res = await leadService.list(params);
      const data = res?.data ?? res ?? {};
      setLeads(Array.isArray(data) ? data : (data.leads ?? []));
    } catch (e) { setError(e?.message || 'Failed to load leads'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (l) => {
    setEditing(l);
    setForm({ name: l.name || '', mobile: l.mobile || '', email: l.email || '', source: l.source || 'Website', status: l.status || 'New', notes: l.notes || '' });
    setShowForm(true);
  };

  const saveLead = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Lead name is required.'); return; }
    setSaving(true);
    try {
      if (editing) await leadService.update(editing._id, form);
      else         await leadService.create(form);
      setShowForm(false);
      load();
    } catch (e) { Alert.alert('Failed', e?.message || 'Could not save lead.'); }
    finally { setSaving(false); }
  };

  const convertLead = (l) => {
    Alert.alert('Convert Lead', `Convert "${l.name}" into a customer?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: async () => {
        try { await leadService.convert(l._id); Alert.alert('Done', 'Lead converted to customer.'); load(); }
        catch (e) { Alert.alert('Failed', e?.message || 'Could not convert.'); }
      } },
    ]);
  };

  const openFollowup = (l) => { setFuLead(l); setFuDate(new Date().toISOString().slice(0, 10)); setFuNote(''); };
  const saveFollowup = async () => {
    if (!fuDate.trim()) { Alert.alert('Required', 'Pick a follow-up date.'); return; }
    setFuSaving(true);
    try {
      await followupService.create({ lead_id: fuLead._id, followup_date: fuDate, notes: fuNote.trim() });
      // Also nudge the lead to Follow-up status.
      await leadService.update(fuLead._id, { status: 'Follow-up' }).catch(() => {});
      setFuLead(null);
      Alert.alert('Scheduled', 'Follow-up scheduled. You will get a reminder.');
      load();
    } catch (e) { Alert.alert('Failed', e?.message || 'Could not schedule follow-up.'); }
    finally { setFuSaving(false); }
  };

  const renderItem = ({ item }) => {
    const sc = STATUS_COLOR[item.status] || STATUS_COLOR.New;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.leadName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.color }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.leadSub}>
          {item.mobile || '—'}{item.source ? `  •  ${item.source}` : ''}
        </Text>
        {item.notes ? <Text style={styles.leadNotes} numberOfLines={2}>{item.notes}</Text> : null}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actBtn} onPress={() => openEdit(item)}>
            <Icon name="pencil-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.actText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actBtn} onPress={() => openFollowup(item)}>
            <Icon name="calendar-clock" size={15} color="#D97706" />
            <Text style={[styles.actText, { color: '#D97706' }]}>Follow-up</Text>
          </TouchableOpacity>
          {item.status !== 'Converted' && (
            <TouchableOpacity style={styles.actBtn} onPress={() => convertLead(item)}>
              <Icon name="account-check-outline" size={15} color="#059669" />
              <Text style={[styles.actText, { color: '#059669' }]}>Convert</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Leads</Text>
        <TouchableOpacity onPress={openAdd}><Icon name="plus" size={22} color="#fff" /></TouchableOpacity>
      </View>

      {/* Status tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {STATUS_TABS.map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <LoadingSpinner /> : (
        <FlatList
          data={leads}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[theme.colors.accent]} />}
          ListEmptyComponent={<EmptyState icon="🎯" title={error || 'No leads yet'} />}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={openAdd} activeOpacity={0.85}>
        <Text style={styles.fabText}>+  Add Lead</Text>
      </TouchableOpacity>

      {/* Add / Edit lead modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{editing ? 'Edit Lead' : 'New Lead'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}><Icon name="close" size={20} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <FormField label="Name *" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Lead name" />
              <FormField label="Mobile" value={form.mobile} onChangeText={v => setForm(f => ({ ...f, mobile: v.replace(/\D/g, '') }))} keyboardType="number-pad" maxLength={10} placeholder="10-digit" />
              <FormField label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" autoCapitalize="none" placeholder="Optional" />

              <Text style={styles.pickLabel}>Lead Source</Text>
              <View style={styles.chipWrap}>
                {SOURCES.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, form.source === s && styles.chipOn]} onPress={() => setForm(f => ({ ...f, source: s }))}>
                    <Text style={[styles.chipText, form.source === s && styles.chipTextOn]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.pickLabel}>Status</Text>
              <View style={styles.chipWrap}>
                {STATUSES.map(s => (
                  <TouchableOpacity key={s} style={[styles.chip, form.status === s && styles.chipOn]} onPress={() => setForm(f => ({ ...f, status: s }))}>
                    <Text style={[styles.chipText, form.status === s && styles.chipTextOn]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FormField label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline placeholder="Any detail…" />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveLead} disabled={saving} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Lead')}</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Follow-up modal */}
      <Modal visible={!!fuLead} animationType="slide" transparent onRequestClose={() => setFuLead(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Schedule Follow-up</Text>
              <TouchableOpacity onPress={() => setFuLead(null)}><Icon name="close" size={20} color={theme.colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={styles.fuFor}>For: {fuLead?.name}</Text>
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <FormField label="Follow-up Date *" value={fuDate} onChangeText={v => setFuDate(v.replace(/[^0-9-]/g, ''))} placeholder="YYYY-MM-DD" maxLength={10} />
              </View>
              <TouchableOpacity style={styles.todayBtn} onPress={() => setFuDate(new Date().toISOString().slice(0, 10))}>
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            </View>
            <FormField label="Notes" value={fuNote} onChangeText={setFuNote} multiline placeholder="Call about pricing…" />
            <TouchableOpacity style={[styles.saveBtn, fuSaving && { opacity: 0.6 }]} onPress={saveFollowup} disabled={fuSaving} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>{fuSaving ? 'Scheduling…' : 'Schedule Follow-up'}</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  tabsWrap: { backgroundColor: theme.colors.surface, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, marginRight: 8, backgroundColor: '#F1F5F9' },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 12.5, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#fff' },

  card: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leadName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  leadSub: { fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 4 },
  leadNotes: { fontSize: 12, color: theme.colors.textPrimary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: theme.colors.accent, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  fuFor: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 10 },

  pickLabel: { fontSize: 12.5, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 8, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipOn: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.accent },

  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  todayBtn: { backgroundColor: theme.colors.accentLight, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.accent, marginBottom: 4 },
  todayBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: 13 },

  saveBtn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
