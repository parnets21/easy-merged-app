// src/screens/staff/StaffListScreen.jsx
//
// Wholesaler staff management. Staff log in via the staff app using their
// mobile; their access is driven by the role (designation) set here.
//
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Alert, FlatList, Platform, RefreshControl, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { employeeService, STAFF_ROLES } from '../../services/employeeService';
import { theme } from '../../utils/theme';

const roleMeta = (designation = '') => {
  const d = designation.toLowerCase();
  if (d.includes('manager'))   return { bg: '#EDE8FF', fg: '#6D28D9', label: 'Manager' };
  if (d.includes('account'))   return { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Accountant' };
  if (d.includes('warehouse')) return { bg: '#DCFCE7', fg: '#047857', label: 'Warehouse Staff' };
  return { bg: '#FEF3C7', fg: '#B45309', label: designation || 'Sales Executive' };
};

export default function StaffListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const res = await employeeService.list({ limit: 100 });
      setRows(res?.data?.employees || res?.employees || res?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = (item) => {
    Alert.alert('Remove Staff', `Remove ${item.name}? They will lose app access.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try { await employeeService.delete(item._id); await load(); }
          catch (e) { Alert.alert('Failed', e?.message || 'Could not remove staff.'); }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const meta = roleMeta(item.designation);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}
        onPress={() => navigation.navigate('AddStaff', { staff: item })}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || 'S')[0].toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.mobile}>{item.mobile || 'No mobile'}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.badge, { backgroundColor: meta.bg }]}>
              <Text style={[styles.badgeText, { color: meta.fg }]}>{item.role_access || meta.label}</Text>
            </View>
            {Number(item.salary) > 0 && (
              <View style={styles.infoPill}>
                <Icon name="cash" size={11} color="#059669" />
                <Text style={styles.infoPillText}>₹{Number(item.salary).toLocaleString('en-IN')}</Text>
              </View>
            )}
            {Array.isArray(item.incentive_slabs) && item.incentive_slabs.length > 0 && (
              <View style={[styles.infoPill, { backgroundColor: theme.colors.accentLight }]}>
                <Icon name="chart-line-variant" size={11} color={theme.colors.accent} />
                <Text style={[styles.infoPillText, { color: theme.colors.accent }]}>
                  {item.incentive_slabs.length} slab{item.incentive_slabs.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="trash-can-outline" size={20} color={theme.colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Staff</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddStaff')}>
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
              <Icon name="account-group-outline" size={44} color={theme.colors.textDisabled} />
              <Text style={styles.emptyTitle}>No staff yet</Text>
              <Text style={styles.emptySub}>Add staff so they can log in with their role.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => navigation.navigate('AddStaff')} activeOpacity={0.9}>
        <Icon name="plus" size={20} color="#fff" />
        <Text style={styles.fabText}>Add Staff</Text>
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

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  mobile: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ECFDF5', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  infoPillText: { fontSize: 10.5, fontWeight: '800', color: '#059669' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  emptySub: { fontSize: 12.5, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },

  fab: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.accent, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 30,
    elevation: 4, shadowColor: theme.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
  },
  fabText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
