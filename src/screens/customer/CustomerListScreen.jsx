// src/screens/customer/CustomerListScreen.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EmptyState from '../../components/EmptyState';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { customerService } from '../../services/customerService';
import { filterCustomers, formatCurrency } from '../../utils/formatters';
import { theme } from '../../utils/theme';

export default function CustomerListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await customerService.list({ limit: 200 });
      const data = res?.data ?? res ?? {};
      setCustomers(Array.isArray(data) ? data : (data.customers ?? []));
    }
    catch (e) { setError(e?.message || 'Failed to load customers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  const filtered = filterCustomers(search, customers || []);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CustomerProfile', { customerId: item._id })} activeOpacity={0.75}>
      <View style={styles.row}>
        <View>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.mobile}>{item.mobile}  •  {item.city}</Text>
        </View>
        <View style={styles.outstanding}>
          <Text style={[styles.amount, { color: item.outstanding > 0 ? theme.colors.danger : theme.colors.secondary }]}>{formatCurrency(item.outstanding || 0)}</Text>
          <Text style={styles.outLabel}>Outstanding</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorMessage message={error} onRetry={load} />;

  return (
    <View style={styles.screen}>
      <TextInput style={styles.search} placeholder="Search by name or mobile..." placeholderTextColor={theme.colors.textDisabled} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={i => i._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon="👥" title="No customers found" />}
      />
      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => navigation.navigate('AddCustomer')} activeOpacity={0.85}>
        <Text style={styles.fabText}>+  Add Customer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: theme.colors.background },
  search:      { margin: 12, padding: 11, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, fontSize: 14, color: theme.colors.textPrimary },
  list:        { paddingHorizontal: 12, paddingBottom: 24 },
  card:        { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, elevation: 2 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  mobile:      { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  outstanding: { alignItems: 'flex-end' },
  amount:      { fontSize: 15, fontWeight: '700' },
  outLabel:    { fontSize: 11, color: theme.colors.textSecondary },
  fab:         { position: 'absolute', right: 16, bottom: 20, backgroundColor: theme.colors.accent, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  fabText:     { color: '#fff', fontWeight: '800', fontSize: 14 },
});
