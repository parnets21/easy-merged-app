// src/screens/product/AddProductScreen.jsx
//
// Category-driven Add Product flow (real-world granite/marble/tiles/
// sanitaryware/blocks inventory).
//
// Steps:
//   1. Select Category (+ Add Category, + Add Sub-Category, + Add Brand)
//   2. Select Sub-Category (optional) + Select Brand
//   3. Category-specific fields (dynamic) + common price/stock/images
//
// Category-specific values are stored in Product.attributes on the backend.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FormField from '../../components/FormField';
import Icon from '../../components/Icon';
import { wholesalerProductService } from '../../services/productService';
import { fieldOptionsService } from '../../services/fieldOptionsService';
import { BASE_URL } from '../../services/api';
import { theme } from '../../utils/theme';
import {
  fieldsForType, categoryTypeFromName, CATEGORY_UNIT, UNIT_OPTIONS,
} from '../../utils/categoryFields';

const ORANGE = theme.colors.accent;
const NAVY   = theme.colors.primary;
const MUTED  = theme.colors.textSecondary;
const BORDER = theme.colors.border;

const IMG_HOST = BASE_URL.replace(/\/api\/?$/, '');
const resolveImg = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : `${IMG_HOST}${u}`);
const numOnly = (v) => String(v).replace(/[^0-9.]/g, '');

export default function AddProductScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const editing = route?.params?.product || null;

  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [errors, setErrors]       = useState({});

  // Taxonomy (own categories + brands)
  const [taxonomy, setTaxonomy] = useState({ categories: [], brands: [] });
  const [taxLoading, setTaxLoading] = useState(true);

  // Selection
  const [category, setCategory]       = useState(null);   // { _id, name, sub_categories }
  const [subCategory, setSubCategory] = useState(null);   // { _id, name }
  const [brand, setBrand]             = useState(null);    // { _id, name }

  // Category-specific attribute values
  const [attrs, setAttrs] = useState(editing?.attributes || {});

  // Common fields
  const [name, setName] = useState(editing?.name || '');
  const [unit, setUnit] = useState(editing?.unit || 'Sq Ft');
  const [prices, setPrices] = useState({
    purchase_price: editing?.purchase_price != null ? String(editing.purchase_price) : '',
    selling_price:  editing?.selling_price  != null ? String(editing.selling_price)  : '',
    wholesale_rate: editing?.wholesale_rate != null ? String(editing.wholesale_rate) : '',
    mrp:            editing?.mrp            != null ? String(editing.mrp)            : '',
    gst_percent:    editing?.gst_percent    != null ? String(editing.gst_percent)   : '18',
    opening_stock:  editing?.opening_stock  != null ? String(editing.opening_stock) : '',
    hsn_code:       editing?.hsn_code || '',
  });

  const [imageUrls, setImageUrls] = useState(Array.isArray(editing?.image_urls) ? editing.image_urls : []);
  const [catalogPdf, setCatalogPdf] = useState(editing?.catalog_pdf_url || '');

  // Modals: add category / sub / brand / unit picker
  const [modal, setModal] = useState(null);   // 'category' | 'sub' | 'brand' | 'unit' | select:{field}
  const [modalInput, setModalInput] = useState('');
  const [selectField, setSelectField] = useState(null); // for dynamic select fields

  // Custom dropdown options the user has added (persisted), keyed by field key.
  const [customOptions, setCustomOptions] = useState({});
  const [hiddenOptions, setHiddenOptions] = useState({}); // built-in options the user removed
  const [optModalField, setOptModalField] = useState(null); // field def when adding a new option
  const [optInput, setOptInput] = useState('');

  useEffect(() => {
    fieldOptionsService.all().then(map => {
      const { __hidden__ = {}, ...custom } = map || {};
      setCustomOptions(custom);
      setHiddenOptions(__hidden__);
    }).catch(() => {});
  }, []);

  // Merge built-in options with the user's custom ones, minus any hidden defaults.
  const optionsFor = (f) => {
    const base = Array.isArray(f.options) ? f.options : [];
    const custom = customOptions[f.key] || [];
    const hidden = (hiddenOptions[f.key] || []).map(x => String(x).toLowerCase());
    const seen = new Set();
    return [...base, ...custom].filter(o => {
      const k = String(o).toLowerCase();
      if (seen.has(k)) return false; seen.add(k);
      return !hidden.includes(k);
    });
  };

  const addCustomOption = async () => {
    const v = optInput.trim();
    if (!v || !optModalField) return;
    const list = await fieldOptionsService.add(optModalField.key, v);
    setCustomOptions(prev => ({ ...prev, [optModalField.key]: list }));
    setAttr(optModalField.key, v);   // auto-select the newly added option
    setOptInput(''); setOptModalField(null);
  };

  const isCustomOption = (f, opt) =>
    (customOptions[f.key] || []).some(x => String(x).toLowerCase() === String(opt).toLowerCase());

  // Delete any option: custom → remove from storage; built-in default → hide it.
  const deleteOption = async (f, opt) => {
    if (isCustomOption(f, opt)) {
      const list = await fieldOptionsService.remove(f.key, opt);
      setCustomOptions(prev => ({ ...prev, [f.key]: list }));
    } else {
      const list = await fieldOptionsService.hide(f.key, opt);
      setHiddenOptions(prev => ({ ...prev, [f.key]: list }));
    }
    if (String(attrs[f.key] ?? '').toLowerCase() === String(opt).toLowerCase()) setAttr(f.key, '');
  };

  // ── Load taxonomy ──────────────────────────────────────────
  const loadTaxonomy = async () => {
    setTaxLoading(true);
    try {
      const res = await wholesalerProductService.getTaxonomy();
      const data = res?.data ?? res ?? {};
      const next = { categories: data.categories || [], brands: data.brands || [] };
      setTaxonomy(next);
      return next;
    } catch {
      const empty = { categories: [], brands: [] };
      setTaxonomy(empty);
      return empty;
    } finally {
      setTaxLoading(false);
    }
  };
  useEffect(() => { loadTaxonomy(); }, []);

  // Pre-select when editing.
  useEffect(() => {
    if (!editing || !taxonomy.categories.length) return;
    const cat = taxonomy.categories.find(c => c.name === editing.category_name || String(c._id) === String(editing.category_id));
    if (cat) {
      setCategory(cat);
      const sub = (cat.sub_categories || []).find(s => s.name === editing.sub_category_name || String(s._id) === String(editing.sub_category_id));
      if (sub) setSubCategory(sub);
    }
    const br = taxonomy.brands.find(b => b.name === editing.brand_name || String(b._id) === String(editing.brand_id));
    if (br) setBrand(br);
  }, [editing, taxonomy]);

  const catType = useMemo(
    () => (editing?.category_type) || categoryTypeFromName(category?.name || ''),
    [category, editing],
  );
  const fields = useMemo(() => fieldsForType(catType), [catType]);

  // When category changes, default the unit to the category's typical unit.
  useEffect(() => {
    if (category && !editing) setUnit(CATEGORY_UNIT[categoryTypeFromName(category.name)] || 'Piece');
  }, [category, editing]);

  const setAttr  = (k, v) => { setAttrs(a => ({ ...a, [k]: v })); setErrors(e => ({ ...e, [k]: null })); };
  const setPrice = (k, v) => setPrices(p => ({ ...p, [k]: v }));

  // ── Taxonomy creation ──────────────────────────────────────
  // After creating, reload the saved list and re-select the exact object from
  // that fresh list (by id/name) so the chip stays highlighted and persists.
  const submitModal = async () => {
    const val = modalInput.trim();
    if (!val) return;
    try {
      if (modal === 'category') {
        const res = await wholesalerProductService.createCategory(val);
        const cat = res?.data ?? res;
        const fresh = await loadTaxonomy();
        const picked = (fresh.categories || []).find(
          c => String(c._id) === String(cat?._id) || c.name?.toLowerCase() === val.toLowerCase(),
        );
        setCategory(picked || { ...cat, sub_categories: [] });
        setSubCategory(null);
      } else if (modal === 'sub') {
        if (!category?._id) { Alert.alert('Select a category first'); return; }
        const res = await wholesalerProductService.createSubCategory(val, category._id);
        const sub = res?.data ?? res;
        const fresh = await loadTaxonomy();
        // Re-point category to the fresh object so its sub_categories include the new one.
        const freshCat = (fresh.categories || []).find(c => String(c._id) === String(category._id));
        if (freshCat) setCategory(freshCat);
        const picked = (freshCat?.sub_categories || []).find(
          s => String(s._id) === String(sub?._id) || s.name?.toLowerCase() === val.toLowerCase(),
        );
        setSubCategory(picked || sub);
      } else if (modal === 'brand') {
        const res = await wholesalerProductService.createBrand(val);
        const br = res?.data ?? res;
        const fresh = await loadTaxonomy();
        const picked = (fresh.brands || []).find(
          b => String(b._id) === String(br?._id) || b.name?.toLowerCase() === val.toLowerCase(),
        );
        setBrand(picked || br);
      }
      setModal(null); setModalInput('');
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save.');
    }
  };

  // ── Image / PDF upload ─────────────────────────────────────
  const pickImage = async () => {
    try {
      const results = await pick({ allowMultiSelection: false, type: [types.images], mode: 'import' });
      if (!results?.length) return;
      const file = results[0];
      setUploading(true);
      const res = await wholesalerProductService.uploadImage({ uri: file.uri, name: file.name, type: file.type });
      const url = res?.data?.url || res?.url;
      if (url) setImageUrls(prev => [...prev, url]);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Upload failed', err?.message || 'Could not upload the image.');
    } finally { setUploading(false); }
  };
  const removeImage = (url) => setImageUrls(prev => prev.filter(u => u !== url));

  const pickPdf = async () => {
    try {
      const results = await pick({ allowMultiSelection: false, type: [types.pdf], mode: 'import' });
      if (!results?.length) return;
      const file = results[0];
      setPdfUploading(true);
      const res = await wholesalerProductService.uploadDoc({ uri: file.uri, name: file.name, type: file.type });
      const url = res?.data?.url || res?.url;
      if (url) setCatalogPdf(url);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Upload failed', err?.message || 'Could not upload the PDF.');
    } finally { setPdfUploading(false); }
  };

  // ── Save ───────────────────────────────────────────────────
  const handleSave = async () => {
    const e = {};
    if (!category) e._category = 'Select a category';
    if (!name.trim()) e.name = 'Product name is required';
    fields.forEach(f => { if (f.required && !String(attrs[f.key] ?? '').trim()) e[f.key] = `${f.label} is required`; });
    if (!prices.purchase_price) e.purchase_price = 'Purchase price required';
    setErrors(e);
    if (Object.keys(e).length) {
      Alert.alert('Missing details', Object.values(e)[0]);
      return;
    }

    // Derive size string from length/width/thickness attrs where present (for card chips + filters).
    const sizeStr = attrs.size
      || (attrs.length && attrs.width ? `${attrs.length}x${attrs.width}` : '')
      || '';

    const payload = {
      name: name.trim(),
      category_id: category._id,
      category_name: category.name,
      sub_category_id: subCategory?._id || null,
      sub_category_name: subCategory?.name || '',
      brand_id: brand?._id || null,
      brand_name: brand?.name || '',
      category_type: catType,
      attributes: attrs,
      // Mirror a few common attrs onto real columns for search/filter/cards.
      size: sizeStr,
      finish: attrs.finish || '',
      color: attrs.colour || attrs.color || '',
      material: attrs.material || '',
      thickness: attrs.thickness || '',
      pcs_per_box: attrs.pcs_per_box || null,
      sqft_per_box: attrs.coverage_per_box || null,
      unit,
      hsn_code: prices.hsn_code.trim(),
      gst_percent: prices.gst_percent || 18,
      purchase_price: prices.purchase_price || 0,
      selling_price:  prices.selling_price || 0,
      wholesale_rate: prices.wholesale_rate || 0,
      mrp:            prices.mrp || 0,
      opening_stock:  prices.opening_stock || 0,
      image_urls: imageUrls,
      catalog_pdf_url: catalogPdf,
    };

    setSaving(true);
    try {
      if (editing) {
        await wholesalerProductService.update(editing._id, payload);
        Alert.alert('Success', 'Product updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await wholesalerProductService.create(payload);
        Alert.alert('Success', 'Product added to your catalogue.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (err) {
      Alert.alert('Failed', err?.message || 'Could not save product.');
    } finally { setSaving(false); }
  };

  const subs = category?.sub_categories || [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : (StatusBar.currentHeight || 0)}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 320 + insets.bottom }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>

        {/* STEP 1 — Category */}
        <SectionLabel n="1" text="Select Category" />
        <View style={styles.card}>
          {taxLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : (
            <View style={styles.chipWrap}>
              {taxonomy.categories.map(c => {
                const on = category?._id === c._id;
                return (
                  <TouchableOpacity key={c._id} style={[styles.pick, on && styles.pickOn]} onPress={() => { setCategory(c); setSubCategory(null); }} activeOpacity={0.8}>
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {taxonomy.categories.length === 0 && <Text style={styles.muted}>No categories yet. Tap "Manage Categories & Brands" to add.</Text>}
            </View>
          )}
          {/* Category & Brand are created on their own management screen (separate popups). */}
          <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('CategoryBrandManager')} activeOpacity={0.85}>
            <Icon name="cog-outline" size={15} color={ORANGE} />
            <Text style={styles.manageBtnText}>Manage Categories & Brands</Text>
            <Icon name="chevron-right" size={16} color={ORANGE} />
          </TouchableOpacity>
          {!!errors._category && <Text style={styles.errText}>{errors._category}</Text>}
        </View>

        {/* STEP 2 — Sub-Category + Brand */}
        {category && (
          <>
            {subs.length > 0 && (
              <>
                <SectionLabel n="2" text="Select Sub-Category" />
                <View style={styles.card}>
                  <View style={styles.chipWrap}>
                    {subs.map(s => {
                      const on = subCategory?._id === s._id;
                      return (
                        <TouchableOpacity key={s._id} style={[styles.pick, on && styles.pickOn]} onPress={() => setSubCategory(on ? null : s)} activeOpacity={0.8}>
                          <Text style={[styles.pickText, on && styles.pickTextOn]}>{s.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            <SectionLabel n={subs.length > 0 ? '3' : '2'} text="Select Brand" />
            <View style={styles.card}>
              <View style={styles.chipWrap}>
                {taxonomy.brands.map(b => {
                  const on = brand?._id === b._id;
                  return (
                    <TouchableOpacity key={b._id} style={[styles.pick, on && styles.pickOn]} onPress={() => setBrand(on ? null : b)} activeOpacity={0.8}>
                      <Text style={[styles.pickText, on && styles.pickTextOn]}>{b.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                {taxonomy.brands.length === 0 && <Text style={styles.muted}>No brands yet. Use "Add Brand" above.</Text>}
              </View>
            </View>
          </>
        )}

        {/* Hint until both category AND brand are chosen */}
        {category && !brand && (
          <View style={styles.gateHint}>
            <Icon name="arrow-up" size={16} color={ORANGE} />
            <Text style={styles.gateHintText}>Select a Brand to continue adding the item.</Text>
          </View>
        )}

        {/* STEP 3 — Category-specific fields (only after category + brand) */}
        {category && brand && (
          <>
            <SectionLabel n={subs.length > 0 ? '4' : '3'} text={`${cap(catType)} Details`} />
            <View style={styles.card}>
              <FormField label="Product Name *" value={name} onChangeText={setName} placeholder="e.g. Black Galaxy Slab" error={errors.name} />

              <View style={styles.grid}>
                {fields.map(f => {
                  const val = attrs[f.key] ?? '';
                  const wrapStyle = f.half ? styles.halfCol : styles.fullCol;
                  if (f.type === 'select') {
                    return (
                      <View key={f.key} style={wrapStyle}>
                        <Text style={styles.fieldLabel}>{f.label}{f.required ? ' *' : ''}</Text>
                        <View style={styles.selectRow}>
                          <TouchableOpacity style={[styles.selectBox, { flex: 1 }, errors[f.key] && styles.selectErr]} activeOpacity={0.7}
                            onPress={() => { setSelectField(f); setModal('select'); }}>
                            <Text style={[styles.selectText, !val && { color: '#B8C0CC' }]}>{val || `Select ${f.label}`}</Text>
                            <Icon name="chevron-down" size={18} color={MUTED} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.optAddBtn} activeOpacity={0.8}
                            onPress={() => { setOptModalField(f); setOptInput(''); }}>
                            <Icon name="plus" size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View key={f.key} style={wrapStyle}>
                      <Text style={styles.fieldLabel}>{f.label}{f.unit ? ` (${f.unit})` : ''}{f.required ? ' *' : ''}</Text>
                      <TextInput
                        style={[styles.input, errors[f.key] && styles.selectErr]}
                        value={String(val)}
                        onChangeText={t => setAttr(f.key, f.type === 'number' ? numOnly(t) : t)}
                        keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                        placeholder={f.placeholder || ''}
                        placeholderTextColor="#B8C0CC"
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Unit + Pricing */}
            <SectionLabel n={subs.length > 0 ? '5' : '4'} text="Unit, Pricing & Stock" />
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Unit of Measurement</Text>
              <TouchableOpacity style={styles.selectBox} activeOpacity={0.7} onPress={() => setModal('unit')}>
                <Text style={styles.selectText}>{unit}</Text>
                <Icon name="chevron-down" size={18} color={MUTED} />
              </TouchableOpacity>

              <View style={styles.grid}>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Purchase Price *</Text>
                  <TextInput style={[styles.input, errors.purchase_price && styles.selectErr]} value={prices.purchase_price} onChangeText={t => setPrice('purchase_price', numOnly(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B8C0CC" />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Selling Price</Text>
                  <TextInput style={styles.input} value={prices.selling_price} onChangeText={t => setPrice('selling_price', numOnly(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B8C0CC" />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Wholesale / Dealer</Text>
                  <TextInput style={styles.input} value={prices.wholesale_rate} onChangeText={t => setPrice('wholesale_rate', numOnly(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B8C0CC" />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>MRP</Text>
                  <TextInput style={styles.input} value={prices.mrp} onChangeText={t => setPrice('mrp', numOnly(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B8C0CC" />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>GST %</Text>
                  <TextInput style={styles.input} value={prices.gst_percent} onChangeText={t => setPrice('gst_percent', numOnly(t))} keyboardType="decimal-pad" placeholder="18" placeholderTextColor="#B8C0CC" />
                </View>
                <View style={styles.halfCol}>
                  <Text style={styles.fieldLabel}>Opening Stock ({unit})</Text>
                  <TextInput style={styles.input} value={prices.opening_stock} onChangeText={t => setPrice('opening_stock', numOnly(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B8C0CC" />
                </View>
              </View>
              <Text style={styles.fieldLabel}>HSN Code</Text>
              <TextInput style={styles.input} value={prices.hsn_code} onChangeText={t => setPrice('hsn_code', t)} placeholder="Optional" placeholderTextColor="#B8C0CC" />
            </View>

            {/* Images + PDF */}
            <SectionLabel n={subs.length > 0 ? '6' : '5'} text="Images & Catalogue" />
            <View style={styles.card}>
              <View style={styles.imgRow}>
                {imageUrls.map(u => (
                  <View key={u} style={styles.imgWrap}>
                    <Image source={{ uri: resolveImg(u) }} style={styles.imgThumb} resizeMode="cover" />
                    <TouchableOpacity style={styles.imgRemove} onPress={() => removeImage(u)}>
                      <Icon name="close" size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.imgAdd} onPress={pickImage} disabled={uploading} activeOpacity={0.8}>
                  <Icon name={uploading ? 'progress-upload' : 'camera-plus-outline'} size={22} color={ORANGE} />
                  <Text style={styles.imgAddText}>{uploading ? 'Uploading…' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
              {catalogPdf ? (
                <View style={styles.pdfRow}>
                  <Icon name="file-pdf-box" size={22} color="#DC2626" />
                  <Text style={styles.pdfName} numberOfLines={1}>Catalogue attached</Text>
                  <TouchableOpacity onPress={() => setCatalogPdf('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="close-circle" size={18} color={MUTED} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.pdfBtn} onPress={pickPdf} disabled={pdfUploading} activeOpacity={0.8}>
                  <Icon name={pdfUploading ? 'progress-upload' : 'file-upload-outline'} size={20} color={ORANGE} />
                  <Text style={styles.pdfBtnText}>{pdfUploading ? 'Uploading…' : 'Attach PDF (optional)'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              <Icon name="content-save-outline" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Product')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Unit picker */}
      <Modal visible={modal === 'unit'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.overlay} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Unit of Measurement</Text>
            {UNIT_OPTIONS.map(u => (
              <TouchableOpacity key={u} style={[styles.optRow, unit === u && styles.optRowOn]} onPress={() => { setUnit(u); setModal(null); }}>
                <Text style={[styles.optText, unit === u && { color: ORANGE, fontWeight: '800' }]}>{u}</Text>
                {unit === u && <Icon name="check" size={18} color={ORANGE} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dynamic select-field picker */}
      <Modal visible={modal === 'select'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={styles.overlay} onPress={() => setModal(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{selectField?.label}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {(selectField ? optionsFor(selectField) : []).map(opt => {
                const on = attrs[selectField.key] === opt;
                return (
                  <View key={opt} style={[styles.optRow, on && styles.optRowOn]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => { setAttr(selectField.key, opt); setModal(null); }}>
                      <Text style={[styles.optText, on && { color: ORANGE, fontWeight: '800' }]}>{opt}</Text>
                    </TouchableOpacity>
                    {on && <Icon name="check" size={18} color={ORANGE} style={{ marginRight: 6 }} />}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => deleteOption(selectField, opt)}
                    >
                      <Icon name="trash-can-outline" size={18} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            {/* Add a new custom option from inside the picker too */}
            <TouchableOpacity
              style={styles.optAddInline}
              onPress={() => { const f = selectField; setModal(null); setOptModalField(f); setOptInput(''); }}
            >
              <Icon name="plus-circle-outline" size={18} color={ORANGE} />
              <Text style={styles.optAddInlineText}>Add new {selectField?.label}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add custom option modal */}
      <Modal visible={!!optModalField} transparent animationType="fade" onRequestClose={() => setOptModalField(null)}>
        <Pressable style={styles.overlay} onPress={() => setOptModalField(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add {optModalField?.label}</Text>
            <TextInput style={styles.modalInput} value={optInput} onChangeText={setOptInput} autoFocus
              placeholder={`Enter ${optModalField?.label || 'value'}`} placeholderTextColor={MUTED} />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => setOptModalField(null)}><Text style={styles.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={addCustomOption}><Text style={styles.btnPrimaryText}>Add</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Product');

function SectionLabel({ n, text }) {
  return (
    <View style={styles.sectionLabel}>
      <View style={styles.stepDot}><Text style={styles.stepDotText}>{n}</Text></View>
      <Text style={styles.sectionLabelText}>{text}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}



const styles = StyleSheet.create({
  header: { backgroundColor: NAVY, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  container: { backgroundColor: theme.colors.background, padding: 16 },

  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 10 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  sectionLabelText: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  sectionLine: { flex: 1, height: 1, backgroundColor: BORDER },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  muted: { fontSize: 13, color: MUTED },
  errText: { fontSize: 12, color: theme.colors.danger, fontWeight: '600', marginTop: 8 },
  gateHint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.accentLight, borderRadius: 12, padding: 14, marginBottom: 16 },
  gateHintText: { flex: 1, fontSize: 13, fontWeight: '700', color: ORANGE },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: '#fff' },
  pickOn: { backgroundColor: theme.colors.accentLight, borderColor: ORANGE },
  pickText: { fontSize: 13, fontWeight: '700', color: MUTED },
  pickTextOn: { color: ORANGE },

  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight },
  manageBtnText: { flex: 1, fontSize: 13, fontWeight: '800', color: ORANGE },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  fullCol: { width: '100%' },
  halfCol: { width: '48%' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 46, paddingHorizontal: 12, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: '#fff' },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: BORDER, borderRadius: 10, height: 46, paddingHorizontal: 12, backgroundColor: '#fff' },
  selectText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  selectErr: { borderColor: theme.colors.danger },
  optAddBtn: { width: 46, height: 46, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  optAddInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight },
  optAddInlineText: { fontSize: 13, fontWeight: '800', color: ORANGE },

  imgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgWrap: { width: 74, height: 74, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  imgThumb: { width: '100%', height: '100%', borderRadius: 10 },
  imgRemove: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  imgAdd: { width: 74, height: 74, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  imgAddText: { fontSize: 10.5, fontWeight: '700', color: ORANGE, marginTop: 3 },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2' },
  pdfName: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, height: 46, borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed', backgroundColor: theme.colors.accentLight },
  pdfBtnText: { fontSize: 13, fontWeight: '800', color: ORANGE },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, marginTop: 4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,22,38,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 14 },
  modalInput: { borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, color: theme.colors.textPrimary, backgroundColor: '#F8FAFC' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btnGhost: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  btnGhostText: { fontSize: 14, fontWeight: '800', color: MUTED },
  btnPrimary: { flex: 1, height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  optRowOn: { backgroundColor: theme.colors.accentLight },
  optText: { fontSize: 15, color: theme.colors.textPrimary },
});
