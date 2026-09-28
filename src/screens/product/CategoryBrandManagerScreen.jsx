// src/screens/product/CategoryBrandManagerScreen.jsx
//
// Category & Brand management — two clearly-separate sections (like the CRM):
//   • Category Management: Add Category (own modal), category list, each category
//     shows its sub-categories and an "+ Sub" action; the category modal also has
//     an "Add Sub-Category" button.
//   • Brand Management: Add Brand (own separate modal), brand list.
// Category and Brand are NEVER mixed in the same popup.
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { wholesalerProductService } from '../../services/productService';
import { theme } from '../../utils/theme';

const ORANGE = theme.colors.accent;
const NAVY   = theme.colors.primary;
const MUTED  = theme.colors.textSecondary;
const BORDER = theme.colors.border;

export default function CategoryBrandManagerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [taxonomy, setTaxonomy] = useState({ categories: [], brands: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  // Sub-category modal (opened for a specific parent)
  const [subModal, setSubModal] = useState(false);
  const [subParent, setSubParent] = useState(null);
  const [subName, setSubName] = useState('');
  // Brand modal (separate)
  const [brandModal, setBrandModal] = useState(false);
  const [brandName, setBrandName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wholesalerProductService.getTaxonomy();
      const data = res?.data ?? res ?? {};
      setTaxonomy({ categories: data.categories || [], brands: data.brands || [] });
    } catch {
      setTaxonomy({ categories: [], brands: [] });
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categories = taxonomy.categories || [];
  const brands = taxonomy.brands || [];

  // ── Category ──
  const saveCategory = async () => {
    const v = catName.trim();
    if (!v) return;
    setBusy(true);
    try {
      const res = await wholesalerProductService.createCategory(v);
      const created = res?.data ?? res;
      await load();
      setCatModal(false); setCatName('');
      // Offer to add a sub-category right away.
      Alert.alert('Category added', `Add a sub-category under "${v}" now?`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Add Sub-Category', onPress: () => openSub({ _id: created?._id, name: v }) },
      ]);
    } catch (err) { Alert.alert('Failed', err?.message || 'Could not add category.'); }
    finally { setBusy(false); }
  };

  const openSub = (cat) => { setSubParent(cat); setSubName(''); setSubModal(true); };
  const saveSub = async () => {
    const v = subName.trim();
    if (!v) return;
    if (!subParent?._id) { Alert.alert('Missing parent category'); return; }
    setBusy(true);
    try {
      await wholesalerProductService.createSubCategory(v, subParent._id);
      await load();
      setSubModal(false); setSubName('');
    } catch (err) { Alert.alert('Failed', err?.message || 'Could not add sub-category.'); }
    finally { setBusy(false); }
  };

  // ── Brand ──
  const saveBrand = async () => {
    const v = brandName.trim();
    if (!v) return;
    setBusy(true);
    try {
      await wholesalerProductService.createBrand(v);
      await load();
      setBrandModal(false); setBrandName('');
    } catch (err) { Alert.alert('Failed', err?.message || 'Could not add brand.'); }
    finally { setBusy(false); }
  };

  const delCategory = (c) => confirmDelete(c, 'category', () => wholesalerProductService.deleteCategory(c._id));
  const delSub      = (s) => confirmDelete(s, 'sub-category', () => wholesalerProductService.deleteSubCategory(s._id));
  const delBrand    = (b) => confirmDelete(b, 'brand', () => wholesalerProductService.deleteBrand(b._id));
  const confirmDelete = (item, label, fn) => {
    Alert.alert('Delete', `Delete "${item.name}" ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await fn(); await load(); } catch (err) { Alert.alert('Cannot delete', err?.message || 'Delete failed.'); }
      } },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories & Brands</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>

          {/* ══ CATEGORY MANAGEMENT ══ */}
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.accentLight }]}>
                <Icon name="shape-outline" size={18} color={ORANGE} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Category Management</Text>
                <Text style={styles.sectionSub}>{categories.length} categorie(s)</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => { setCatName(''); setCatModal(true); }} activeOpacity={0.85}>
              <Icon name="plus" size={15} color="#fff" />
              <Text style={styles.addBtnText}>Add Category</Text>
            </TouchableOpacity>
          </View>

          {categories.length === 0 ? (
            <Empty text="No categories yet. Tap “Add Category”." />
          ) : (
            categories.map(c => (
              <View key={c._id} style={styles.catCard}>
                <View style={styles.catRow}>
                  <View style={[styles.dot, { backgroundColor: ORANGE }]} />
                  <Text style={styles.catName}>{c.name}</Text>
                  {c.master && <View style={styles.tag}><Text style={styles.tagText}>Default</Text></View>}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={styles.subAddBtn} onPress={() => openSub(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="plus" size={13} color={ORANGE} />
                    <Text style={styles.subAddText}>Sub</Text>
                  </TouchableOpacity>
                  {!c.master && (
                    <TouchableOpacity onPress={() => delCategory(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 10 }}>
                      <Icon name="trash-can-outline" size={18} color={theme.colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                {(c.sub_categories || []).length > 0 && (
                  <View style={styles.subList}>
                    {c.sub_categories.map(s => (
                      <View key={s._id} style={styles.subRow}>
                        <Icon name="subdirectory-arrow-right" size={14} color={MUTED} />
                        <Text style={styles.subName}>{s.name}</Text>
                        {s.master && <View style={styles.tag}><Text style={styles.tagText}>Default</Text></View>}
                        <View style={{ flex: 1 }} />
                        {!s.master && (
                          <TouchableOpacity onPress={() => delSub(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Icon name="close" size={16} color={theme.colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}

          {/* ══ BRAND MANAGEMENT ══ */}
          <View style={[styles.sectionHead, { marginTop: 26 }]}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: '#EEF1F6' }]}>
                <Icon name="tag-outline" size={18} color={NAVY} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Brand Management</Text>
                <Text style={styles.sectionSub}>{brands.length} brand(s)</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: NAVY }]} onPress={() => { setBrandName(''); setBrandModal(true); }} activeOpacity={0.85}>
              <Icon name="plus" size={15} color="#fff" />
              <Text style={styles.addBtnText}>Add Brand</Text>
            </TouchableOpacity>
          </View>

          {brands.length === 0 ? (
            <Empty text="No brands yet. Tap “Add Brand”." />
          ) : (
            <View style={styles.brandWrap}>
              {brands.map(b => (
                <View key={b._id} style={styles.brandChip}>
                  <Text style={styles.brandChipText}>{b.name}</Text>
                  {b.master ? (
                    <View style={styles.tagSm}><Text style={styles.tagText}>Default</Text></View>
                  ) : (
                    <TouchableOpacity onPress={() => delBrand(b)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close-circle" size={16} color={theme.colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Continue → Add the actual item/product */}
          {(categories.length > 0 && brands.length > 0) && (
            <TouchableOpacity
              style={styles.continueBtn}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('AddProduct')}
            >
              <Icon name="package-variant-closed" size={18} color="#fff" />
              <Text style={styles.continueText}>Add Item / Product</Text>
              <Icon name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── Category modal (separate) ── */}
      <FormModal
        visible={catModal} title="Add Category" placeholder="e.g. Granite"
        value={catName} onChange={setCatName} busy={busy}
        onClose={() => setCatModal(false)} onSave={saveCategory}
        note="After adding, you can add sub-categories under it."
      />

      {/* ── Sub-Category modal (under a category) ── */}
      <FormModal
        visible={subModal} title={`Add Sub-Category${subParent ? ` in ${subParent.name}` : ''}`}
        placeholder="e.g. Imported Granite"
        value={subName} onChange={setSubName} busy={busy}
        onClose={() => setSubModal(false)} onSave={saveSub}
      />

      {/* ── Brand modal (completely separate) ── */}
      <FormModal
        visible={brandModal} title="Add Brand" placeholder="e.g. Kajaria"
        value={brandName} onChange={setBrandName} busy={busy}
        onClose={() => setBrandModal(false)} onSave={saveBrand} accent={NAVY}
      />
    </View>
  );
}

function Empty({ text }) {
  return (
    <View style={styles.empty}>
      <Icon name="information-outline" size={22} color="#CBD5E1" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function FormModal({ visible, title, placeholder, value, onChange, busy, onClose, onSave, note, accent = ORANGE }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          {!!note && <Text style={styles.modalNote}>{note}</Text>}
          <TextInput style={styles.modalInput} value={value} onChangeText={onChange} autoFocus
            placeholder={placeholder} placeholderTextColor={MUTED} />
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: accent }, busy && { opacity: 0.6 }]} onPress={onSave} disabled={busy}>
              <Text style={styles.btnPrimaryText}>{busy ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { backgroundColor: NAVY, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  sectionSub: { fontSize: 11.5, color: MUTED, marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ORANGE, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  catCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  subAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1.2, borderColor: ORANGE, backgroundColor: theme.colors.accentLight },
  subAddText: { fontSize: 11, fontWeight: '800', color: ORANGE },
  subList: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subName: { fontSize: 13.5, color: theme.colors.textPrimary, fontWeight: '600' },

  brandWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9 },
  brandChipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },

  tag: { backgroundColor: '#EEF1F6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  tagSm: { backgroundColor: '#EEF1F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 9.5, fontWeight: '800', color: MUTED },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 22 },
  emptyText: { fontSize: 12.5, color: MUTED },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  continueText: { fontSize: 15, fontWeight: '900', color: '#fff' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  modalNote: { fontSize: 12, color: MUTED, marginTop: 4 },
  modalInput: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: theme.colors.textPrimary, backgroundColor: '#F8FAFC', marginTop: 14 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnGhost: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  btnGhostText: { fontSize: 14, fontWeight: '800', color: MUTED },
  btnPrimary: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
