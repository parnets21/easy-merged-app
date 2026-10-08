/**
 * RegisterScreen (Retailer) — single-page registration, styled to match the
 * Wholesaler register page.
 *
 * One scrolling page with grouped sections (Business Information, Contact
 * Details, Tax Information, Business Address), a single "Register Business"
 * button, and an "Already registered? Login here" link at the bottom.
 *
 * Backend: the RETAILER register endpoint (`authApi.register`) creates the
 * account and returns a token immediately, so we save the session and the app
 * lands straight on Home/PendingApproval — no OTP step. KYC documents are NOT
 * collected here; the user uploads them later from Profile → Documents.
 *
 * Navigation: this screen lives inside the merged app's RetailerShell. "Login
 * here" and the Back button both return to the SINGLE shared login screen via
 * the ExitToLogin bridge — never the retailer's own Login, never closing the app.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, Image, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import TextInput from '../../components/common/TextInput';
import PrimaryButton from '../../components/common/PrimaryButton';
import { SCREENS } from '../../constants';
import { authApi, session } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useExitToLogin } from '../../../shared/ExitToLoginContext';

const LOGO = require('../../assets/logo.jpeg');

// Small coloured section header (bar + title), mirroring the wholesaler layout.
const Section = ({ color, title }) => (
  <View style={s.sectionHeader}>
    <View style={[s.sectionBar, { backgroundColor: color }]} />
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
);

export default function RegisterScreen({ navigation }) {
  const { setUser } = useAuth();
  const exitToLogin = useExitToLogin();

  const [form, setForm] = useState({
    companyName: '', ownerName: '', mobile: '', email: '',
    gstNumber: '', panNumber: '',
    address: '', city: '', state: '', pincode: '',
  });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
    setApiError('');
  };

  // Back → shared login (never close the app, never the retailer's own Login).
  const goBackToLogin = useCallback(() => { exitToLogin(); }, [exitToLogin]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => { goBackToLogin(); return true; };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [goBackToLogin]),
  );

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = 'Business name is required';
    if (!form.ownerName.trim())   e.ownerName   = 'Owner name is required';
    if (!form.mobile.trim() || form.mobile.replace(/\D/g, '').length !== 10)
      e.mobile = 'Valid 10-digit mobile required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = 'Valid email is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim())    e.city    = 'City is required';
    if (!form.state.trim())   e.state   = 'State is required';
    if (!form.pincode.trim() || form.pincode.replace(/\D/g, '').length !== 6)
      e.pincode = 'Valid 6-digit pincode required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (loading) return;
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const regData = await authApi.register({
        companyName: form.companyName.trim(),
        ownerName:   form.ownerName.trim(),
        mobile:      form.mobile.trim(),
        email:       form.email.trim(),
        businessType:'Retailer',
        gstNumber:   form.gstNumber.trim(),
        panNumber:   form.panNumber.trim(),
        address:     form.address.trim(),
        city:        form.city.trim(),
        state:       form.state.trim(),
        pincode:     form.pincode.trim(),
      });

      if (!regData?.token) {
        setApiError('Account created, but sign-in could not be completed. Please return to login.');
        setLoading(false);
        return;
      }

      // Auto sign-in: save the session + user, then land in the retailer app.
      await session.save(regData.token, regData.user);
      setUser(regData.user || null);
      setLoading(false);

      const u = regData.user;
      const approved = u?.is_approved || u?.company?.status === 'Approved' || u?.company_status === 'Approved';
      navigation.replace(approved ? SCREENS.HOME : SCREENS.PENDING_APPROVAL);
    } catch (err) {
      setLoading(false);
      setApiError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <SafeAreaView style={s.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={goBackToLogin}>
              <Text style={s.backArrow}>←</Text>
            </TouchableOpacity>
            <View style={s.logoBox}>
              <Image source={LOGO} style={s.logoImage} resizeMode="cover" />
            </View>
            <Text style={s.headerTitle}>Register Your Business</Text>
            <Text style={s.headerSub}>Fill in your details to create a retailer account</Text>
          </View>

          {/* ── Form card ── */}
          <View style={s.card}>
            <Section color={Colors.primary} title="Business Information" />
            <TextInput
              label="Company / Shop Name" required
              value={form.companyName}
              onChangeText={v => set('companyName', v)}
              placeholder="Enter business name"
              error={errors.companyName}
            />
            <TextInput
              label="Owner Name" required
              value={form.ownerName}
              onChangeText={v => set('ownerName', v)}
              placeholder="Enter owner full name"
              error={errors.ownerName}
            />

            <Section color={Colors.info} title="Contact Details" />
            <TextInput
              label="Mobile Number" required
              value={form.mobile}
              onChangeText={v => set('mobile', v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.mobile}
            />
            <TextInput
              label="Email Address" required
              value={form.email}
              onChangeText={v => set('email', v)}
              placeholder="company@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Section color={Colors.secondary} title="Tax Information" />
            <TextInput
              label="GST Number"
              value={form.gstNumber}
              onChangeText={v => set('gstNumber', v.toUpperCase())}
              placeholder="22AAAAA0000A1Z5 (optional)"
              autoCapitalize="characters"
              maxLength={15}
            />
            <TextInput
              label="PAN Number"
              value={form.panNumber}
              onChangeText={v => set('panNumber', v.toUpperCase())}
              placeholder="AAAAA0000A (optional)"
              autoCapitalize="characters"
              maxLength={10}
            />

            <Section color={Colors.warning} title="Business Address" />
            <TextInput
              label="Address" required
              value={form.address}
              onChangeText={v => set('address', v)}
              placeholder="Street / Area / Locality"
              multiline
              numberOfLines={3}
              error={errors.address}
            />
            <View style={s.row}>
              <View style={s.half}>
                <TextInput
                  label="City" required
                  value={form.city}
                  onChangeText={v => set('city', v)}
                  placeholder="City"
                  error={errors.city}
                />
              </View>
              <View style={s.half}>
                <TextInput
                  label="State" required
                  value={form.state}
                  onChangeText={v => set('state', v)}
                  placeholder="State"
                  error={errors.state}
                />
              </View>
            </View>
            <TextInput
              label="Pincode" required
              value={form.pincode}
              onChangeText={v => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit pincode"
              keyboardType="number-pad"
              maxLength={6}
              error={errors.pincode}
            />

            {!!apiError && (
              <View style={s.apiErrBox}>
                <Text style={s.apiErrText}>{apiError}</Text>
              </View>
            )}

            {/* Submit */}
            <PrimaryButton
              title="Register Business"
              onPress={handleRegister}
              loading={loading}
              size="lg"
              style={s.submitBtn}
            />

            <Text style={s.kycNote}>
              You can upload KYC documents later from Profile → Documents.
            </Text>

            {/* Already registered → shared login */}
            <TouchableOpacity onPress={goBackToLogin} style={s.loginLink}>
              <Text style={s.loginLinkText}>
                Already registered?{'  '}
                <Text style={s.loginLinkBold}>Login here</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, backgroundColor: Colors.background, paddingBottom: 24 },

  header: {
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  backBtn: {
    position: 'absolute', top: 14, left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { color: '#FFF', fontSize: 22, fontWeight: '700', marginTop: -2 },
  logoBox: {
    width: 76, height: 76, borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 6,
  },
  logoImage:   { width: 76, height: 76 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.78)', textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16, marginTop: -18,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  sectionBar: { width: 4, height: 18, borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.2 },

  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  apiErrBox: {
    backgroundColor: Colors.errorBg, borderRadius: 10,
    padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#FECACA',
  },
  apiErrText: { fontSize: 12.5, color: Colors.errorText, fontWeight: '600' },

  submitBtn: { marginTop: 20 },
  kycNote: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 12, lineHeight: 17 },

  loginLink: { marginTop: 14, alignItems: 'center' },
  loginLinkText: { fontSize: 14, color: Colors.textSecondary },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },

  bottomSpace: { height: 24 },
});
