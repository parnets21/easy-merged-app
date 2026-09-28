// src/screens/product/ProductDetailScreen.jsx
// Wholesaler — Product Detail (View Only)
//
// Admin ka Product Master data dikhata hai.
// Wholesaler kuch bhi edit nahi kar sakta — sirf dekh sakta hai.
// Stock / Inventory alag module hai (Purchase → Stock In → Inventory).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { wholesalerProductService } from '../../services/productService';
import { BASE_URL } from '../../services/api';
import { theme } from '../../utils/theme';

const NAV = theme.colors.primary;
const OR  = theme.colors.accent;

// Prefix relative image paths (/uploads/...) with the server host so the device can load them.
const IMG_HOST = BASE_URL.replace(/\/api\/?$/, '');
const resolveImg = (u) => (!u ? null : /^https?:\/\//.test(u) ? u : `${IMG_HOST}${u}`);

// ── Divider ───────────────────────────────────────────────────
const Divider = () => <View style={styles.divider} />;

// ── Info row ──────────────────────────────────────────────────
function InfoRow({ label, value, last }) {
  if (!value) return null;
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ── Section card ─────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIconWrap}>
          <Icon name={icon} size={14} color={NAV} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Divider />
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params ?? {};
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const loadProduct = useCallback(async () => {
    if (!productId) { setError('No product ID.'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res  = await wholesalerProductService.getProduct(productId);
      setProduct(res?.data ?? res);
    } catch (e) {
      setError(e?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  const statusBarH = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 24)
    : insets.top;

  // ── Shared header shell (used in loading & error too) ─────
  const Header = ({ title = 'Product Detail', subtitle = '', tags = [] }) => (
    <View style={[styles.header, { paddingTop: statusBarH + 10 }]}>
      <View style={styles.hC1} />
      <View style={styles.hC2} />
      {/* Back + title */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Icon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        </View>
        {/* View-only lock badge */}
        <View style={styles.viewOnlyBadge}>
          <Icon name="lock-outline" size={11} color={OR} />
          <Text style={styles.viewOnlyText}>View Only</Text>
        </View>
      </View>
      {/* Tag pills */}
      {tags.length > 0 && (
        <View style={styles.headerTags}>
          {tags.map((t, i) => (
            <View key={i} style={styles.headerTag}>
              <Icon name={t.icon} size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.headerTagText}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={NAV} />
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NAV} />
          <Text style={styles.centerText}>Loading product…</Text>
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error || !product) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={NAV} />
        <Header />
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={44} color="#DC2626" />
          <Text style={[styles.centerText, { color: '#DC2626' }]}>{error || 'Product not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProduct}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Data ───────────────────────────────────────────────────
  // category/brand may be a string, {name}, or {id,name,code} — never render the object.
  const nameOf = (v) => (v && typeof v === 'object' ? (v.name || null) : (v || null));
  const catName   = nameOf(product.category_id)     || nameOf(product.category) || null;
  const brandName = nameOf(product.brand_id)        || nameOf(product.brand)    || null;
  const subCat    = nameOf(product.sub_category_id) || null;
  const imageUrl  = resolveImg(product.image_urls?.[0]);

  const headerTags = [
    catName   && { icon: 'shape-outline',      label: catName   },
    brandName && { icon: 'star-circle-outline', label: brandName },
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={NAV} />

      <Header
        title={product.name || 'Product Detail'}
        subtitle={product.code}
        tags={headerTags}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product image */}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="image-outline" size={56} color={theme.colors.textDisabled} />
              <Text style={styles.imagePlaceholderText}>No Image Available</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>

          {/* Admin notice */}
          <View style={styles.adminNotice}>
            <Icon name="information-outline" size={15} color="#6B7280" />
            <Text style={styles.adminNoticeText}>
              This product is created and managed by Admin / Manufacturer.
              Wholesaler cannot edit any product information.
            </Text>
          </View>

          {/* ── Product Information ── */}
          <SectionCard icon="information-outline" title="PRODUCT INFORMATION">
            <InfoRow label="Product Code" value={product.code} />
            <InfoRow label="Design"       value={product.design || product.name} />
            <InfoRow label="Brand"        value={brandName} />
            <InfoRow label="Category"     value={catName} />
            <InfoRow label="Sub-Category" value={subCat} />
            <InfoRow label="Size"         value={product.size} />
            <InfoRow label="Finish"       value={product.finish} />
            <InfoRow label="Thickness"    value={product.thickness} />
            <InfoRow label="Material"     value={product.material} />
            <InfoRow label="Color"        value={product.color} />
            <InfoRow label="Surface"      value={product.surface} />
            <InfoRow label="Grade"        value={product.grade} />
            <InfoRow label="Tile Type"    value={product.tile_type} />
            <InfoRow label="Application"  value={product.application} />
            <InfoRow label="Anti-Skid"    value={product.anti_skid} />
            <InfoRow label="Origin"       value={product.origin} />
            <InfoRow label="Manufacturer" value={product.manufacturer} />
            <InfoRow label="Collection"   value={product.collection} />
            <InfoRow label="Barcode / EAN" value={product.barcode} />
            <InfoRow label="HSN Code"     value={product.hsn_code} />
            <InfoRow label="GST %"        value={product.gst_percent != null ? `${product.gst_percent}%` : null} />
            <InfoRow label="Unit"         value={product.unit} last />
          </SectionCard>

          {/* ── Description ── */}
          {product.description ? (
            <SectionCard icon="text-box-outline" title="DESCRIPTION">
              <Text style={styles.descText}>{product.description}</Text>
            </SectionCard>
          ) : null}

          {/* ── Images gallery ── */}
          {product.image_urls?.length > 1 && (
            <SectionCard icon="image-multiple-outline" title="IMAGES">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {product.image_urls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: resolveImg(url) }}
                    style={styles.galleryImg}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </SectionCard>
          )}

          {/* ── Packing info ── */}
          {(product.pcs_per_box || product.sqft_per_box || product.weight_per_box) && (
            <SectionCard icon="package-variant" title="PACKING INFO">
              <InfoRow label="Pcs / Box"    value={product.pcs_per_box    ? `${product.pcs_per_box} pcs`    : null} />
              <InfoRow label="Sq.ft / Box"  value={product.sqft_per_box   ? `${product.sqft_per_box} sq.ft` : null} />
              <InfoRow label="Weight / Box" value={product.weight_per_box ? `${product.weight_per_box} kg`  : null} last />
            </SectionCard>
          )}

          {/* ── Wholesale Price only (admin reference prices are hidden) ── */}
          {product.wholesale_rate ? (
            <SectionCard icon="tag-outline" title="WHOLESALE PRICE">
              <View style={styles.priceGrid}>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLbl}>Wholesale Rate</Text>
                  <Text style={styles.priceVal}>
                    ₹{Number(product.wholesale_rate).toLocaleString('en-IN')}
                    {product.unit ? ` / ${product.unit}` : ''}
                  </Text>
                </View>
              </View>
            </SectionCard>
          ) : null}

          {/* ── Inventory note ── */}
          <View style={styles.inventoryNote}>
            <View style={styles.inventoryNoteHead}>
              <Icon name="warehouse" size={16} color={NAV} />
              <Text style={styles.inventoryNoteTitle}>Your Stock for this Product</Text>
            </View>
            <Text style={styles.inventoryNoteText}>
              Stock is managed separately via{' '}
              <Text style={{ fontWeight: '700' }}>Purchase → Stock In → Inventory</Text>.
              {'\n'}Go to Inventory tab to view your stock for this product.
            </Text>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const SHADOW = {
  elevation: 2,
  shadowColor: '#1A0F40',
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 6,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F2F8' },

  /* Loading / error */
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn:   { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: NAV, borderRadius: 10 },
  retryText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  /* Header */
  header: {
    backgroundColor: NAV,
    paddingHorizontal: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  hC1: {
    position: 'absolute', top: -25, right: -25,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  hC2: {
    position: 'absolute', bottom: -10, left: 30,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  headerTitleBlock: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  viewOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: OR + '22',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: OR + '44',
  },
  viewOnlyText: { fontSize: 10, fontWeight: '700', color: OR },
  headerTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  headerTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  headerTagText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  /* Image */
  imageWrap:            { width: '100%', height: 220, backgroundColor: '#E8E4F5' },
  productImage:         { width: '100%', height: '100%' },
  imagePlaceholder:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 12, color: theme.colors.textDisabled },

  /* Content */
  content: { padding: 14, gap: 12 },

  /* Admin notice */
  adminNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  adminNoticeText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  /* Cards */
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: theme.colors.border, ...SHADOW,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: {
    fontSize: 11, fontWeight: '800', color: NAV,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  /* Divider */
  divider: { height: 1, backgroundColor: theme.colors.border, marginBottom: 8 },

  /* Info rows */
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoLabel:     { fontSize: 13, color: theme.colors.textSecondary },
  infoValue:     { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  /* Description */
  descText: { fontSize: 13, color: theme.colors.textPrimary, lineHeight: 20 },

  /* Gallery */
  galleryImg: { width: 100, height: 100, borderRadius: 10 },

  /* Price grid */
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceItem: {
    width: '31%', backgroundColor: '#F4F6FA', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  priceLbl: { fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 4 },
  priceVal: { fontSize: 13, fontWeight: '800', color: NAV },

  /* Inventory note */
  inventoryNote: {
    backgroundColor: theme.colors.primaryLight, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: NAV + '25',
  },
  inventoryNoteHead: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8,
  },
  inventoryNoteTitle: { fontSize: 13, fontWeight: '800', color: NAV },
  inventoryNoteText:  { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 19 },
});
