// src/screens/auth/RegistrationScreen.jsx
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FormField from '../../components/FormField';
import PrimaryButton from '../../components/PrimaryButton';
import { authService } from '../../services/authService';
import { validateMobile, validateRequired } from '../../utils/validators';
import { theme } from '../../utils/theme';
import { setRegStep } from '../../utils/storage';

const LOGO = require('../../assets/logo.png');

export default function RegistrationScreen({ route, navigation }) {
  const prefilledMobile = route?.params?.mobile ?? '';

  const [form, setForm] = useState({
    companyName: '', ownerName: '', mobile: prefilledMobile,
    email: '', gstNumber: '', panNumber: '',
    address: '', city: '', state: '', pincode: '',
  });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: null }));
  };

  const handleRegister = async () => {
    const required = [
      'companyName','ownerName','mobile','email',
      'address','city','state','pincode',
    ];
    const newErrors = {};
    required.forEach(k => { const err = validateRequired(form[k], k); if (err) newErrors[k] = err; });
    const mobileCheck = validateMobile(form.mobile);
    if (!mobileCheck.valid) newErrors.mobile = mobileCheck.error;
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setLoading(true);
    try {
      // Step 1 — Create company + user (backend returns a unique company code).
      // Business type is no longer collected from the user — default to
      // 'Wholesaler' so the backend (which still expects the field) accepts it.
      const regRes     = await authService.register({ ...form, businessType: 'Wholesaler' });
      const uniqueCode = regRes?.data?.companyCode || regRes?.companyCode || null;

      // Step 2 — Send OTP for verification before document upload
      const otpRes = await authService.sendOTP(form.mobile, 'register');
      const devOtp = otpRes?.data?.otp || otpRes?.otp || null;

      // Save step so app can resume here if closed before docs are uploaded
      await setRegStep('otp', form.mobile);

      // Step 3 — Go to OTP screen; on success it will go to DocumentUpload.
      // Carry the unique code forward so it can be shown to the wholesaler.
      navigation.replace('OTP', {
        mobile:   form.mobile,
        devOtp,
        purpose:  'register',
        nextScreen: 'DocumentUpload',
        uniqueCode,
      });
    } catch (e) {
      Alert.alert('Registration Failed', e?.message || 'Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ color, title }) => (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.splashBg} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.circleDecor} />
          <View style={styles.logoBox}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.headerTitle}>Register Your Business</Text>
          <Text style={styles.headerSub}>Fill in your company details to get started</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>

          <Section color={theme.colors.primary} title="Business Information" />
          <FormField label="Company Name *" value={form.companyName}
            onChangeText={v => set('companyName', v)} placeholder="Enter company name" error={errors.companyName} />
          <FormField label="Owner Name *" value={form.ownerName}
            onChangeText={v => set('ownerName', v)} placeholder="Enter owner full name" error={errors.ownerName} />

          <Section color={theme.colors.accent} title="Contact Details" />
          <FormField label="Mobile Number *" value={form.mobile}
            onChangeText={v => set('mobile', v.replace(/\D/g, ''))}
            keyboardType="number-pad" placeholder="10-digit mobile number" maxLength={10} error={errors.mobile} />
          <FormField label="Email Address *" value={form.email}
            onChangeText={v => set('email', v)} keyboardType="email-address"
            autoCapitalize="none" placeholder="company@email.com" error={errors.email} />

          <Section color={theme.colors.secondary} title="Tax Information" />
          <FormField label="GST Number (optional)" value={form.gstNumber}
            onChangeText={v => set('gstNumber', v.toUpperCase())}
            autoCapitalize="characters" placeholder="22AAAAA0000A1Z5" maxLength={15} error={errors.gstNumber} />
          <FormField label="PAN Number (optional)" value={form.panNumber}
            onChangeText={v => set('panNumber', v.toUpperCase())}
            autoCapitalize="characters" placeholder="AAAAA0000A" maxLength={10} error={errors.panNumber} />

          <Section color={theme.colors.warning} title="Business Address" />
          <FormField label="Address *" value={form.address}
            onChangeText={v => set('address', v)} multiline numberOfLines={3}
            placeholder="Street / Area / Locality" error={errors.address} />
          <FormField label="City *" value={form.city}
            onChangeText={v => set('city', v)} placeholder="City" error={errors.city} />
          <FormField label="State *" value={form.state}
            onChangeText={v => set('state', v)} placeholder="State" error={errors.state} />
          <FormField label="Pincode *" value={form.pincode}
            onChangeText={v => set('pincode', v.replace(/\D/g, ''))}
            keyboardType="number-pad" maxLength={6} placeholder="6-digit pincode" error={errors.pincode} />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'Registering…' : 'Register Business →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>
              Already registered?{'  '}
              <Text style={styles.loginLinkBold}>Login here</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.background, paddingBottom: 320 },

  header: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center', paddingTop: 48, paddingBottom: 40,
    borderBottomLeftRadius: 36, borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  circleDecor: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: theme.colors.primaryMid, opacity: 0.5,
  },
  logoBox: {
    width: 76, height: 76, borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 6,
  },
  logoImage:   { width: 56, height: 56 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.78)' },

  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16, marginTop: -18,
    borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 10,
  },
  sectionBar: {
    width: 4, height: 18, borderRadius: 2, marginRight: 10,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, letterSpacing: 0.2,
  },

  submitBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: theme.colors.textDisabled, shadowOpacity: 0, elevation: 0 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },

  loginLink: { marginTop: 16, alignItems: 'center' },
  loginLinkText: { fontSize: 14, color: theme.colors.textSecondary },
  loginLinkBold: { color: theme.colors.primary, fontWeight: '700' },
});
