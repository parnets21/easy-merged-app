/**
 * RolePickerScreen — the shared landing / home screen of the merged app.
 *
 * Shown when the app opens and no one is logged in. The user can:
 *   • Enter their mobile number → we detect Wholesaler vs Retailer and open
 *     that app's own login/OTP flow (unchanged).
 *   • Tap "Register" → a popup offers Wholesaler Register / Retailer Register,
 *     opening that app directly on its registration screen.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, ScrollView, Modal,
} from 'react-native';
import { theme } from '../utils/theme';
import { useAppMode } from './AppModeContext';
import { detectRole } from './roleDetect';

const LOGO = require('../assets/logo.png');

export default function RolePickerScreen() {
  const { setMode } = useAppMode();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);

  const digits = mobile.replace(/\D/g, '').slice(0, 10);

  const onContinue = async () => {
    setError('');
    if (digits.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      const { role, both } = await detectRole(digits);
      if (both) { setError('This number is registered as both. Please contact support.'); return; }
      if (role) { setMode(role, 'login'); return; }   // open that app's own login/OTP
      // Not registered anywhere → nudge the user to register.
      setError('This number is not registered. Tap Register below to create an account.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openRegister = (role) => { setRegisterOpen(false); setMode(role, 'register'); };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.splashBg} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── Brand / hero ── */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.brand}>
            <Text style={styles.brandEzy}>Ezy</Text>Enquiry
          </Text>
          <Text style={styles.brandSub}>APP</Text>
          <Text style={styles.quote}>
            Your Tiles Business, One Smart App.
          </Text>
          <Text style={styles.quoteSub}>
            Search · Enquire · Order · Manage — Wholesaler &amp; Retailer together.
          </Text>
        </View>

        {/* ── Login card ── */}
        <View style={styles.card}>
          <Text style={styles.label}>Login with Mobile Number</Text>
          <View style={styles.inputRow}>
            <Text style={styles.cc}>+91</Text>
            <TextInput
              style={styles.input}
              value={digits}
              onChangeText={t => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.colors.textDisabled}
              maxLength={10}
            />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, (digits.length !== 10 || loading) && styles.btnDisabled]}
            disabled={digits.length !== 10 || loading}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
          </TouchableOpacity>

          {/* ── Register ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New here?</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity style={styles.registerBtn} activeOpacity={0.85} onPress={() => setRegisterOpen(true)}>
            <Text style={styles.registerBtnText}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Register popup: choose Wholesaler / Retailer ── */}
      <Modal transparent visible={registerOpen} animationType="fade" onRequestClose={() => setRegisterOpen(false)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create your account</Text>
            <Text style={styles.modalSub}>Which type of account do you want to register?</Text>

            <TouchableOpacity style={styles.choiceBtn} activeOpacity={0.85} onPress={() => openRegister('wholesaler')}>
              <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>🏭</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>Wholesaler Register</Text>
                <Text style={styles.choiceSub}>Sell products, manage orders, sales &amp; stock</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnAlt]} activeOpacity={0.85} onPress={() => openRegister('retailer')}>
              <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>🛒</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>Retailer Register</Text>
                <Text style={styles.choiceSub}>Search products, send enquiries &amp; place orders</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setRegisterOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: theme.colors.splashBg, padding: 24, justifyContent: 'center' },

  hero: { alignItems: 'center', marginBottom: 26 },
  logoBox: { width: 92, height: 92, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  logo: { width: 70, height: 70 },
  brand: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  brandEzy: { color: theme.colors.accent },
  brandSub: { fontSize: 12, fontWeight: '800', letterSpacing: 6, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  quote: { fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center', marginTop: 18, lineHeight: 24 },
  quoteSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 8, lineHeight: 18, paddingHorizontal: 10 },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  label: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surfaceTint, overflow: 'hidden' },
  cc: { paddingHorizontal: 12, fontSize: 15, fontWeight: '700', color: theme.colors.textSecondary },
  input: { flex: 1, paddingVertical: 13, paddingRight: 12, fontSize: 15, color: theme.colors.textPrimary },
  error: { color: theme.colors.danger, fontSize: 12.5, marginTop: 10, fontWeight: '600' },
  btn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { marginHorizontal: 10, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  registerBtn: { borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  registerBtnText: { color: theme.colors.primary, fontSize: 15, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, textAlign: 'center' },
  modalSub: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  choiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.primary, borderRadius: 14, padding: 16, marginBottom: 12 },
  choiceBtnAlt: { backgroundColor: theme.colors.accent },
  choiceIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  choiceIconText: { fontSize: 22 },
  choiceTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  choiceSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 3, lineHeight: 16 },
  modalCancel: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 6, paddingVertical: 8 },
});
