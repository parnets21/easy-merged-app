// src/screens/settings/DocumentListScreen.jsx
// Document repository — GST Certificate, Purchase/Sales Bills, Catalogues, Price Lists.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Linking, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { documentService } from '../../services/documentService';
import { BASE_URL } from '../../services/api';
import { theme } from '../../utils/theme';

const NAVY = theme.colors.primary;
const IMG_HOST = BASE_URL.replace(/\/api\/?$/, '');
const resolveUrl = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : `${IMG_HOST}${u}`);

const DOC_TYPES = ['GST Certificate', 'Purchase Bill', 'Sales Bill', 'Product Catalogue', 'Price List', 'Other'];
const TABS = ['All', ...DOC_TYPES];

export default function DocumentListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [docs, setDocs]     = useState([]);
  const [tab, setTab]       = useState('All');
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);   // choose doc_type before upload
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'All' ? {} : { doc_type: tab };
      const res = await documentService.list(params);
      const data = res?.data ?? res ?? {};
      setDocs(Array.isArray(data) ? data : (data.documents ?? []));
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const uploadWith = async (doc_type) => {
    setPicker(false);
    try {
      const results = await pick({ allowMultiSelection: false, type: [types.pdf, types.images], mode: 'import' });
      if (!results || results.length === 0) return;
      const file = results[0];
      setUploading(true);
      await documentService.upload({ uri: file.uri, name: file.name, type: file.type }, doc_type);
      Alert.alert('Uploaded', `${doc_type} saved.`);
      load();
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Upload failed', err?.message || 'Could not upload.');
    } finally { setUploading(false); }
  };

  const removeDoc = (d) => {
    Alert.alert('Delete', `Delete "${d.title || d.file_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await documentService.delete(d._id); load(); } catch (e) { Alert.alert('Failed', e?.message || 'Could not delete.'); }
      } },
    ]);
  };

  const renderItem = ({ item }) => {
    const isPdf = /\.pdf$/i.test(item.file_name || item.file_url || '');
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.8}
        onPress={() => { const u = resolveUrl(item.file_url); if (u) Linking.openURL(u); }}>
        <View style={[styles.icon, { backgroundColor: isPdf ? '#FEF2F2' : '#EFF6FF' }]}>
          <Icon name={isPdf ? 'file-pdf-box' : 'file-image-outline'} size={20} color={isPdf ? '#DC2626' : '#2563EB'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.title || item.file_name || 'Document'}</Text>
          <Text style={styles.sub}>{item.doc_type || 'Other'}</Text>
        </View>
        <TouchableOpacity onPress={() => removeDoc(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="trash-can-outline" size={18} color={theme.colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <TouchableOpacity onPress={() => setPicker(true)} disabled={uploading}>
          <Icon name={uploading ? 'progress-upload' : 'plus'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsWrap}>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={TABS} keyExtractor={t => t}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item: t }) => (
            <TouchableOpacity style={[styles.tab, tab === t && styles.tabOn]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
            </TouchableOpacity>
          )} />
      </View>

      {loading ? <LoadingSpinner /> : (
        <FlatList
          data={docs}
          keyExtractor={(i, idx) => i._id || String(idx)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          ListEmptyComponent={<EmptyState icon="📁" title="No documents" subtitle="Tap + to upload GST, bills, catalogues" />}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 20 + insets.bottom }]} onPress={() => setPicker(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+  Upload Document</Text>
      </TouchableOpacity>

      {/* Choose doc type before picking file */}
      <Modal visible={picker} animationType="slide" transparent onRequestClose={() => setPicker(false)}>
        <View style={styles.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPicker(false)} activeOpacity={1} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Document Type</Text>
            {DOC_TYPES.map(dt => (
              <TouchableOpacity key={dt} style={styles.typeRow} onPress={() => uploadWith(dt)}>
                <Icon name="file-outline" size={18} color={NAVY} />
                <Text style={styles.typeText}>{dt}</Text>
                <Icon name="chevron-right" size={18} color="#C7CCD6" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { backgroundColor: NAVY, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  tabsWrap: { backgroundColor: theme.colors.surface, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#F1F5F9' },
  tabOn: { backgroundColor: NAVY },
  tabText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextOn: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: theme.colors.accent, borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  typeText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
});
