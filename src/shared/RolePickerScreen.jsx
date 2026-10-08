/**
 * RolePickerScreen — the SINGLE shared login screen for the merged app.
 *
 * One login for both roles:
 *   1. User enters their mobile number.
 *   2. We detect whether it belongs to a Wholesaler or a Retailer.
 *   3. We send the login OTP and show the OTP step right here.
 *   4. On verify we save the session into that app's storage keys and switch
 *      app mode — the user lands DIRECTLY on their home screen, with NO second
 *      login inside the role app.
 *
 * "Register" still opens a popup offering Wholesaler / Retailer registration,
 * which deep-links into that app's own registration screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, ScrollView, Modal,
} from 'react-native';
import { theme } from '../utils/theme';
import { useAppMode } from './AppModeContext';
import {
  detectRole, sendLoginOtp, verifyLoginOtp,
  RoleDetectNetworkError, AuthRequestError,
} from './roleDetect';
import { writeSession } from './sessionWriter';

const LOGO = require('../assets/logo.png');
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function RolePickerScreen() {
  const { setMode } = useAppMode();

  const [step, setStep]   = useState('phone');  // 'phone' | 'choose' | 'otp'
  const [mobile, setMobile] = useState('');
  const [role, setRole]   = useState(null);     // detected role for the OTP step
  const [otp, setOtp]     = useState('');
  const [shownOtp, setShownOtp] = useState(''); // dev-mode OTP (no real SMS yet)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const digits = mobile.replace(/\D/g, '').slice(0, 10);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCountdown = () => {
    setCountdown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: enter number → detect role → send OTP ──
  const onContinue = async () => {
    setError('');
    if (digits.length !== 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    try {
      const { role: detected, both } = await detectRole(digits);
      if (both) {
        // Number exists on BOTH sides — let the user choose which account.
        setStep('choose');
        return;
      }
      if (!detected) {
        setError('This number is not registered. Tap Register below to create an account.');
        return;
      }
      await proceedWithRole(detected);
    } catch (e) {
      if (e instanceof RoleDetectNetworkError) {
        setError('Server is waking up or unreachable. Please wait a moment and tap Continue again.');
      } else if (e instanceof AuthRequestError) {
        setError(e.message || 'Could not send OTP. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Send the login OTP for a specific role, then show the OTP step.
  const proceedWithRole = async (chosen) => {
    setError('');
    setLoading(true);
    try {
      const data = await sendLoginOtp(chosen, digits);
      setRole(chosen);
      setShownOtp(data?.otp || '');
      setOtp('');
      setStep('otp');
      startCountdown();
    } catch (e) {
      if (e instanceof RoleDetectNetworkError) {
        setError('Server is waking up or unreachable. Please try again in a moment.');
      } else if (e instanceof AuthRequestError) {
        setError(e.message || 'Could not send OTP. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      // Stay on the choose step so the user can retry.
      setStep('choose');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP → save session → enter the app ──
  const onVerify = async () => {
    const code = otp.trim();
    if (code.length !== OTP_LENGTH) { setError('Enter the 6-digit OTP.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await verifyLoginOtp(role, digits, code);
      const token = data?.token;
      const user  = data?.user;
      if (!token || !user) {
        setError('Verification failed. Please try again.');
        return;
      }
      // Persist into the role app's own keys, then mount that app already
      // logged in — no second login inside the shell.
      await writeSession(role, token, user);
      setMode(role, 'login');
    } catch (e) {
      if (e instanceof RoleDetectNetworkError) {
        setError('Server is waking up or unreachable. Please try again in a moment.');
      } else if (e instanceof AuthRequestError) {
        setError(e.message || 'Invalid OTP. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (countdown > 0 || !role) return;
    setError('');
    try {
      const data = await sendLoginOtp(role, digits);
      setShownOtp(data?.otp || '');
      setOtp('');
      startCountdown();
    } catch (e) {
      setError(e?.message || 'Could not resend OTP.');
    }
  };

  const onChangeNumber = () => {
    clearInterval(timerRef.current);
    setStep('phone'); setOtp(''); setShownOtp(''); setRole(null); setError(''); setCountdown(0);
  };

  const openRegister = (r) => { setRegisterOpen(false); setMode(r, 'register'); };

  const maskedMobile = digits ? `${digits.slice(0, 2)}****${digits.slice(-4)}` : '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.splashBg} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >

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
          {step === 'phone' ? (
            <>
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
            </>
          ) : step === 'choose' ? (
            <>
              <Text style={styles.label}>Choose your account</Text>
              <Text style={styles.otpSub}>
                +91 {digits} is registered as both. Which account do you want to sign into?
              </Text>
              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.choiceBtn, loading && styles.btnDisabled]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={() => proceedWithRole('wholesaler')}
              >
                <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>🏭</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.choiceTitle}>Login as Wholesaler</Text>
                  <Text style={styles.choiceSub}>Manage orders, sales &amp; stock</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceBtn, styles.choiceBtnAlt, loading && styles.btnDisabled]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={() => proceedWithRole('retailer')}
              >
                <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>🛒</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.choiceTitle}>Login as Retailer</Text>
                  <Text style={styles.choiceSub}>Search products, enquiries &amp; orders</Text>
                </View>
              </TouchableOpacity>

              {loading && <ActivityIndicator color={theme.colors.accent} style={styles.chooseSpinner} />}

              <TouchableOpacity onPress={onChangeNumber} style={styles.chooseBack}>
                <Text style={styles.linkText}>← Change Number</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Verify OTP</Text>
              <Text style={styles.otpSub}>Code sent to +91 {maskedMobile}</Text>

              {!!shownOtp && (
                <View style={styles.devOtpBox}>
                  <Text style={styles.devOtpLabel}>Your OTP</Text>
                  <Text style={styles.devOtpCode}>{shownOtp}</Text>
                </View>
              )}

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={t => { setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH)); setError(''); }}
                  keyboardType="number-pad"
                  placeholder="● ● ● ● ● ●"
                  placeholderTextColor={theme.colors.textDisabled}
                  maxLength={OTP_LENGTH}
                  autoFocus
                />
              </View>
              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.btn, (otp.trim().length !== OTP_LENGTH || loading) && styles.btnDisabled]}
                disabled={otp.trim().length !== OTP_LENGTH || loading}
                onPress={onVerify}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify &amp; Login</Text>}
              </TouchableOpacity>

              <View style={styles.otpLinks}>
                <TouchableOpacity onPress={onResend} disabled={countdown > 0}>
                  <Text style={[styles.linkText, countdown > 0 && styles.linkDisabled]}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onChangeNumber}>
                  <Text style={styles.linkText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
              <View style={styles.flex}>
                <Text style={styles.choiceTitle}>Wholesaler Register</Text>
                <Text style={styles.choiceSub}>Sell products, manage orders, sales &amp; stock</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.choiceBtn, styles.choiceBtnAlt]} activeOpacity={0.85} onPress={() => openRegister('retailer')}>
              <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>🛒</Text></View>
              <View style={styles.flex}>
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
  flex: { flex: 1 },
  container: { flexGrow: 1, backgroundColor: theme.colors.splashBg, padding: 24, paddingBottom: 48, justifyContent: 'center' },

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
  otpSub: { fontSize: 12.5, color: theme.colors.textSecondary, marginTop: -4, marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surfaceTint, overflow: 'hidden' },
  cc: { paddingHorizontal: 12, fontSize: 15, fontWeight: '700', color: theme.colors.textSecondary },
  input: { flex: 1, paddingVertical: 13, paddingRight: 12, fontSize: 15, color: theme.colors.textPrimary },
  otpInput: { paddingLeft: 14, letterSpacing: 6, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 12.5, marginTop: 10, fontWeight: '600' },
  btn: { backgroundColor: theme.colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  devOtpBox: { alignItems: 'center', marginBottom: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(244,80,10,0.08)', borderWidth: 1, borderColor: 'rgba(244,80,10,0.30)' },
  devOtpLabel: { fontSize: 11, color: theme.colors.textSecondary, letterSpacing: 0.5 },
  devOtpCode: { fontSize: 24, fontWeight: '900', color: theme.colors.accent, letterSpacing: 6, marginTop: 2 },

  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  linkText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  linkDisabled: { color: theme.colors.textDisabled },
  chooseSpinner: { marginTop: 4, marginBottom: 4 },
  chooseBack: { alignItems: 'center', marginTop: 10 },

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
