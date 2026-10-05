// src/screens/enquiry/CreateEnquiryScreen.jsx
//
// The wholesaler's "raise an enquiry" form, reached from the Enquiries tab
// (the floating "＋ Enquiry" button and the empty-state button).
//
// Ported from RetailerApp/src/screens/enquiries/CreateEnquiryScreen.jsx so both
// apps behave identically: a wholesaler that needs material it does not stock
// can ask, exactly like a retailer.
//
// ── Where it goes ───────────────────────────────────────────────────────────
// One enquiry is created PER RECIPIENT. The backend's `broadcastEnquiry` fans
// out to every approved, active RETAILER company, every approved, active
// WHOLESALER company, and the Admin team. Each recipient answers on its own
// copy, so replies arrive as separate threads. The response carries
// `recipients` (how many were sent), which the success state reports.
//
// Admin replies land in CRM → Market Management; retailers/wholesalers reply
// from their own apps.
//
// ── Design rules ────────────────────────────────────────────────────────────
//   • The product section is PLAIN TEXT — product name, category, brand, size,
//     finish, colour, grade and a free description. No catalogue picker, no
//     codes, no HSN, no expected-rate number.
//   • No "specific seller" picker — every enquiry is a broadcast.
//   • No Contact section — identity comes from the auth token server-side.
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Same icon family as the retailer's create screen, so the two forms match.
import Ionicons from 'react-native-vector-icons/Ionicons';
import PrimaryButton from '../../components/PrimaryButton';
import { enquiryService } from '../../services/enquiryService';
import useAuth from '../../hooks/useAuth';
import { theme } from '../../utils/theme';

const UNITS = ['Boxes', 'Sq Ft', 'Sq Mtr', 'Pieces', 'Pallets'];

export default function CreateEnquiryScreen({ navigation }) {
  const { user } = useAuth();
  // Bottom safe-area inset — on Android gesture-nav / iOS home-indicator the
  // footer button was being clipped by the system bar. We add this to the
  // footer's bottom padding so "Send Enquiry" always sits fully above it.
  const insets = useSafeAreaInsets();
  // Prefill the delivery city from the signed-in company when we can. The
  // wholesaler's `buildUserResponse` exposes `company_name` but not the nested
  // company city, so fall back through the flat fields it does send.
  const companyCity = user?.company?.city || user?.city || user?.company_city || '';

  // ── Product details (all free text) ───────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [category, setCategory]       = useState('');
  const [brand, setBrand]             = useState('');
  const [size, setSize]               = useState('');
  const [finish, setFinish]           = useState('');
  const [colour, setColour]           = useState('');
  const [grade, setGrade]             = useState('');
  const [details, setDetails]         = useState('');

  // ── Requirement ───────────────────────────────────────────────────────────
  const [qty, setQty]           = useState('');
  const [unit, setUnit]         = useState('Boxes');
  const [location, setLocation] = useState(companyCity);
  const [remarks, setRemarks]   = useState('');

  const [errors, setErrors]   = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(null);

  const scrollRef = useRef(null);

  const unitOptions = useMemo(() => [...new Set(UNITS.filter(Boolean).map(String))], []);

  const clearError = (key) => setErrors(e => (e[key] ? { ...e, [key]: undefined } : e));

  const validate = () => {
    const next = {};
    if (!productName.trim()) next.productName = 'Enter the product name.';
    const n = Number(qty);
    if (!qty.trim()) next.qty = 'Enter a quantity.';
    else if (!Number.isFinite(n) || n <= 0) next.qty = 'Quantity must be greater than zero.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (sending) return;
    if (!validate()) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSending(true);
    try {
      // `broadcast: true` is REQUIRED — it routes the request to
      // `broadcastEnquiry` in the backend's enquiryController, which fans out one
      // Enquiry row per recipient. Without it the generic createEnquiry path runs
      // and rejects the payload (a broadcast has no retailer_name/retailer_mobile).
      //
      // `audience: 'both'` reaches every approved+active RETAILER company and
      // every approved+active WHOLESALER company. The Admin company is seeded as
      // `biz_type: 'Wholesaler'`, so it is included by the wholesaler filter —
      // which is exactly the "admin + all retailers + all wholesalers" fan-out
      // the user asked for. `broadcastEnquiry` also excludes the sender's own
      // company, so a wholesaler never receives its own broadcast.
      const created = await enquiryService.create({
        broadcast: true,
        audience: 'both',
        product_name: productName.trim(),
        category: category.trim(),
        brand: brand.trim(),
        size: size.trim(),
        finish: finish.trim(),
        colour: colour.trim(),
        grade: grade.trim(),
        details: details.trim(),
        qty: Number(qty),
        unit,
        location: location.trim(),
        remarks: remarks.trim(),
      });
      setSent(created?.data ?? created ?? {});
    } catch (err) {
      setErrors({ submit: err?.message || 'Could not send the enquiry. Please try again.' });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSending(false);
    }
  };

  const openCreated = () => {
    const id = sent?.id || sent?._id || (Array.isArray(sent?.ids) ? sent.ids[0] : undefined);
    if (id) navigation.replace('EnquiryDetail', { enquiryId: id });
    else navigation.goBack();
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Enquiries'));

  // ── Success state ─────────────────────────────────────────────────────────
  if (sent) {
    const count = Number(sent.recipients) || 0;
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
        <View style={styles.navbar}>
          <View style={styles.navCircle1} />
          <View style={styles.navCircle2} />
          <View style={styles.navRow}>
            <View style={styles.navTitleWrap}>
              <Text style={styles.navTitle}>Enquiry Sent</Text>
              <Text style={styles.navSub}>Your request is on its way</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.successWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#FFF" />
          </View>
          <Text style={styles.successTitle}>Enquiry submitted</Text>
          <Text style={styles.successMsg}>
            {count > 0
              ? `Sent to ${count} recipient${count === 1 ? '' : 's'} — retailers, wholesalers and the Admin team. `
              : 'Sent to all retailers, wholesalers and the Admin team. '}
            Replies will appear here as they come in.
          </Text>

          <View style={styles.successCard}>
            {sent.enquiry_code ? (
              <SuccessRow icon="pricetag-outline" label="Enquiry code" value={sent.enquiry_code} />
            ) : null}
            <SuccessRow
              icon="cube-outline"
              label="Product"
              value={productName || '—'}
            />
            {category.trim() ? (
              <SuccessRow icon="grid-outline" label="Category" value={category.trim()} />
            ) : null}
            <SuccessRow icon="calculator-outline" label="Quantity" value={`${qty} ${unit}`} />
            {location.trim() ? (
              <SuccessRow icon="location-outline" label="Location" value={location.trim()} last />
            ) : null}
          </View>

          <PrimaryButton title="View enquiry" onPress={openCreated} style={styles.successBtn} />
          <PrimaryButton
            title="Back to enquiries"
            variant="outline"
            onPress={goBack}
            style={styles.successBtnSecondary}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      <View style={styles.navbar}>
        <View style={styles.navCircle1} />
        <View style={styles.navCircle2} />
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navIconBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>New Enquiry</Text>
            <Text style={styles.navSub}>Type the product details and send</Text>
          </View>
        </View>
      </View>

      {/* The navbar sits ABOVE this wrapper on purpose. On Android the screen
          uses `adjustResize`, so when the keyboard opens the window shrinks and
          this KAV (height behaviour) shrinks with it: the scroll area gets short
          and scrolls, while the footer button rises to sit directly on top of
          the keyboard. Wrapping the navbar too would also shove the title. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {errors.submit ? (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={styles.bannerText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* ══════ 1 · Product details ══════ */}
          <Section
            step="1"
            title="Product details"
            hint="Just type what you need — no codes required."
          >
            <Field label="Product name" required error={errors.productName}>
              <TextInput
                style={[styles.fieldInput, errors.productName && styles.fieldInputError]}
                placeholder="e.g. Vitrified floor tile"
                placeholderTextColor={theme.colors.textDisabled}
                value={productName}
                onChangeText={t => { setProductName(t); clearError('productName'); }}
              />
            </Field>

            <Field label="Category" hint="e.g. Floor tiles, Wall tiles, Sanitaryware">
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Floor tiles"
                placeholderTextColor={theme.colors.textDisabled}
                value={category}
                onChangeText={setCategory}
              />
            </Field>

            <FieldRow>
              <Field label="Brand" half>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Kajaria"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={brand}
                  onChangeText={setBrand}
                />
              </Field>
              <Field label="Size" half>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 600 x 600 mm"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={size}
                  onChangeText={setSize}
                />
              </Field>
            </FieldRow>

            <FieldRow>
              <Field label="Finish" half>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Glossy"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={finish}
                  onChangeText={setFinish}
                />
              </Field>
              <Field label="Colour" half>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Ivory"
                  placeholderTextColor={theme.colors.textDisabled}
                  value={colour}
                  onChangeText={setColour}
                />
              </Field>
            </FieldRow>

            <Field label="Grade">
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. A"
                placeholderTextColor={theme.colors.textDisabled}
                value={grade}
                onChangeText={setGrade}
              />
            </Field>

            <Field label="More details" hint="Anything else the seller should know." last>
              <TextInput
                style={[styles.fieldInput, styles.multiline]}
                placeholder="e.g. Anti-skid surface, matte look, branded packing"                placeholderTextColor={theme.colors.textDisabled}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </Field>
          </Section>

          {/* ══════ 2 · Your requirement ══════ */}
          <Section
            step="2"
            title="Your requirement"
            hint="Quantity is required — the rest helps the seller quote faster."
          >
            <Field label="Quantity" required error={errors.qty}>
              <TextInput
                style={[styles.fieldInput, errors.qty && styles.fieldInputError]}
                placeholder="e.g. 500"
                placeholderTextColor={theme.colors.textDisabled}
                value={qty}
                onChangeText={t => { setQty(t.replace(/[^0-9.]/g, '')); clearError('qty'); }}
                keyboardType="numeric"
              />
            </Field>

            <Field label="Unit">
              <View style={styles.chipRow}>
                {unitOptions.map(u => {
                  const active = u === unit;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setUnit(u)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Delivery location" hint="City / site where you need the material.">
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Pune, Maharashtra"
                placeholderTextColor={theme.colors.textDisabled}
                value={location}
                onChangeText={setLocation}
              />
            </Field>

            <Field label="Notes" hint="Optional — delivery timeline or anything else." last>
              <TextInput
                style={[styles.fieldInput, styles.multiline]}
                placeholder="e.g. Need delivery within 2 weeks"
                placeholderTextColor={theme.colors.textDisabled}
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
                maxLength={1000}
                textAlignVertical="top"
              />
            </Field>
          </Section>

          {/* Destination note. Every enquiry is broadcast, so the sender needs to
              know that up front rather than discovering it in the list. */}
          <View style={styles.noteStrip}>
            <Ionicons name="megaphone-outline" size={16} color="#185FA5" />
            <View style={styles.flex}>
              <Text style={styles.noteStripTitle}>
                Goes to every retailer, every wholesaler and the Admin team
              </Text>
              <Text style={styles.noteStripText}>
                Each reply comes back as its own thread so you can compare quotes.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer lives INSIDE the KAV so it is always lifted clear of the soft
            keyboard: on Android the KAV shrinks with the window (adjustResize),
            on iOS the padding behaviour pushes this bar up. Either way the Send
            button stays visible and tappable while typing. */}
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <PrimaryButton
            title="Send Enquiry"
            onPress={submit}
            loading={sending}
            disabled={sending}
            icon={<Ionicons name="paper-plane" size={17} color="#FFF" />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const Section = ({ step, title, hint, children }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const FieldRow = ({ children }) => <View style={styles.fieldRow}>{children}</View>;

const Field = ({ label, required, error, hint, children, last, half }) => (
  <View style={[styles.field, last && styles.fieldLast, half && styles.fieldHalf]}>
    <Text style={styles.fieldLabel}>
      {label}{required ? <Text style={styles.fieldRequired}> *</Text> : null}
    </Text>
    {children}
    {error ? (
      <Text style={styles.errText}>{error}</Text>
    ) : hint ? (
      <Text style={styles.fieldHint}>{hint}</Text>
    ) : null}
  </View>
);

const SuccessRow = ({ icon, label, value, last }) => (
  <View style={[styles.successRow, last && styles.successRowLast]}>
    <Ionicons name={icon} size={15} color={theme.colors.textDisabled} />
    <Text style={styles.successRowLabel}>{label}</Text>
    <Text style={styles.successRowValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },

  /* ── Navbar ── */
  navbar: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  navCircle1: {
    position: 'absolute', top: -30, right: -30,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  navCircle2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navTitleWrap: { flex: 1 },
  navTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  navSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  navIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── Scroll ──
     Generous bottom padding leaves room to scroll the LAST fields (Notes,
     Delivery location) clear of the soft keyboard. Without it those inputs sit
     flush against the bottom and the keyboard covers them while typing. */
  scroll: { padding: 16, paddingBottom: 160 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    borderWidth: 1, borderColor: '#F5C6C0',
    padding: 12, marginBottom: 16,
  },
  bannerText: { fontSize: 12.5, color: theme.colors.danger, flex: 1, fontWeight: '600' },

  /* ── Section ── */
  section: { marginBottom: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingHorizontal: 2 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  sectionHint: { fontSize: 11, color: theme.colors.textDisabled, marginTop: 1 },

  sectionBody: {
    backgroundColor: '#FFF', borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14,
    elevation: 2, shadowColor: '#1A0F40', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },

  /* ── Fields ── */
  field: { marginBottom: 14 },
  fieldLast: { marginBottom: 0 },
  fieldHalf: { flex: 1, marginBottom: 0 },
  fieldRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  fieldLabel: {
    fontSize: 10.5, fontWeight: '800', color: theme.colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
  },
  fieldRequired: { color: theme.colors.danger },
  fieldInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1.5, borderColor: theme.colors.border,
    paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, color: theme.colors.textPrimary, minHeight: 46,
  },
  fieldInputError: { borderColor: theme.colors.danger },
  multiline: { minHeight: 84, paddingTop: 11, paddingBottom: 11 },
  fieldHint: { fontSize: 10.5, color: theme.colors.textDisabled, marginTop: 5 },
  errText: { fontSize: 11, color: theme.colors.danger, marginTop: 5, fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 18, backgroundColor: theme.colors.background,
    borderWidth: 1.5, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.accentLight, borderColor: theme.colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.accent, fontWeight: '800' },

  /* ── Destination note ── */
  noteStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EAF3FB',
    borderRadius: 14,
    borderWidth: 1, borderColor: '#B5D4F4',
    padding: 12, marginTop: 2,
  },
  noteStripTitle: { fontSize: 12.5, fontWeight: '800', color: '#185FA5' },
  noteStripText: { fontSize: 11.5, color: '#378ADD', marginTop: 3, lineHeight: 16 },

  /* ── Footer ──
     Sticky bar under the scroll area. `Shadows.md` from the retailer theme is
     inlined here (this app has no Shadows export) so the bar visibly floats
     above the form and the Send button reads as always-available. */
  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    shadowColor: '#1A2340',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },

  /* ── Success ── */
  successWrap: { padding: 24, alignItems: 'center' },
  successIcon: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center',
    marginTop: 24, marginBottom: 20,
    elevation: 4,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8 },
  successMsg: {
    fontSize: 14, color: theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 21, marginBottom: 24,
  },
  successCard: {
    width: '100%', backgroundColor: '#FFF',
    borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 14, marginBottom: 20,
    elevation: 1,
  },
  successRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  successRowLast: { borderBottomWidth: 0 },
  successRowLabel: { fontSize: 12, color: theme.colors.textSecondary, flex: 1 },
  successRowValue: { fontSize: 12.5, fontWeight: '800', color: theme.colors.textPrimary, maxWidth: '58%', textAlign: 'right' },
  successBtn: { width: '100%' },
  successBtnSecondary: { width: '100%', marginTop: 10 },
});
