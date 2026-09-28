// src/screens/auth/OTPScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
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
import useAuth from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { theme } from '../../utils/theme';
import { clearRegStep } from '../../utils/storage';

const LOGO = require('../../assets/logo.png');

export default function OTPScreen({ route, navigation }) {
  const { mobile, devOtp, purpose = 'login', nextScreen, uniqueCode } = route.params ?? {};
  const { login } = useAuth();

  // Box starts empty — user types the OTP. We DISPLAY the code on screen
  // (shownOtp) since there is no real SMS delivery yet.
  const [otp,       setOtp]       = useState('');
  const [shownOtp,  setShownOtp]  = useState(devOtp || '');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef(null);

  const startCountdown = () => {
    setCountdown(30);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCountdown();
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      const res = await authService.sendOTP(mobile, purpose);
      // Update the displayed OTP with the newly sent code, clear the input box.
      const newOtp = res?.data?.otp || res?.otp || '';
      setShownOtp(newOtp);
      setOtp('');
      startCountdown();
      Alert.alert('OTP Sent', 'A new OTP has been sent.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to resend OTP');
    }
  };

  const handleVerify = async () => {
    const trimmedOtp = String(otp).trim();
    if (trimmedOtp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authService.verifyOTP(mobile, trimmedOtp, purpose);

      // ── Registration OTP verified → go to document upload ──────────────
      if (purpose === 'register') {
        await clearRegStep();
        navigation.replace(nextScreen || 'DocumentUpload', { mobile, uniqueCode });
        return;
      }

      // ── Login OTP verified ──────────────────────────────────────────────
      const token = res?.token  || res?.data?.token;
      const user  = res?.user   || res?.data?.user;

      if (!token || !user) {
        setError('Verification failed. Please try again.');
        return;
      }

      // Save token + user first
      await login(token, user);
      await clearRegStep();

      // Route based on approval
      const approved = user?.company_status === 'Approved' || user?.is_approved === true;
      if (!approved) {
        navigation.replace('ApprovalWaiting');
      }
      // If approved → RootNavigator auto-switches to AppStack
    } catch (e) {
      setError(e?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const maskedMobile = mobile
    ? `${mobile.slice(0, 2)}****${mobile.slice(-4)}`
    : '**********';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.splashBg} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.circleDecor} />
          <View style={styles.logoBox}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>OTP Verification</Text>
          <Text style={styles.subtitle}>Code sent to +91 {maskedMobile}</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>📱</Text>
            <Text style={styles.infoBannerText}>
              {shownOtp ? (
                <>
                  Your OTP is{' '}
                  <Text style={styles.otpCode}>{shownOtp}</Text>
                  {'\n'}Enter it below to verify <Text style={styles.infoBannerBold}>+91 {mobile}</Text>
                </>
              ) : (
                <>
                  {purpose === 'register'
                    ? `Enter the 6-digit OTP to verify your mobile number `
                    : `Enter the 6-digit OTP sent to `}
                  <Text style={styles.infoBannerBold}>+91 {mobile}</Text>
                </>
              )}
            </Text>
          </View>

          <FormField
            label="Enter OTP"
            value={otp}
            onChangeText={t => {
              setOtp(t.replace(/\D/g, ''));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="● ● ● ● ● ●"
            error={error}
          />

          {/* Countdown bar */}
          {countdown > 0 && (
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(countdown / 30) * 100}%` },
                ]}
              />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.btn,
              (loading || otp.trim().length < 6) && styles.btnDisabled,
            ]}
            onPress={handleVerify}
            disabled={loading || otp.trim().length < 6}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? 'Verifying…' : 'Verify OTP ✓'}
            </Text>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it?  </Text>
            <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.changeBtn}
          onPress={() => navigation.navigate('Welcome')}
        >
          <Text style={styles.changeText}>← Change Mobile Number</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: 32,
  },

  header: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  circleDecor: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: theme.colors.primaryMid, opacity: 0.5,
  },
  logoBox: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  logoImage: { width: 62, height: 62 },
  title:     { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  subtitle:  { fontSize: 13, color: 'rgba(255,255,255,0.78)' },

  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20, marginTop: -20,
    borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09, shadowRadius: 12, elevation: 6,
  },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12, padding: 12, marginBottom: 18,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  infoBannerIcon: { fontSize: 16, marginRight: 10, marginTop: 1 },
  infoBannerText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 },
  infoBannerBold: { fontWeight: '700', color: theme.colors.primary },
  otpCode: { fontWeight: '900', fontSize: 18, color: theme.colors.accent, letterSpacing: 3 },

  progressBarBg: {
    height: 4, backgroundColor: theme.colors.border,
    borderRadius: 2, marginBottom: 16, overflow: 'hidden',
  },
  progressBarFill: {
    height: 4, backgroundColor: theme.colors.accent, borderRadius: 2,
  },

  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 6,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  btnDisabled: {
    backgroundColor: theme.colors.textDisabled,
    shadowOpacity: 0, elevation: 0,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },

  resendRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 16,
  },
  resendLabel:   { fontSize: 13, color: theme.colors.textSecondary },
  resendText:    { fontSize: 13, color: theme.colors.accent, fontWeight: '700' },
  resendDisabled:{ color: theme.colors.textDisabled },

  changeBtn: { marginTop: 20, alignItems: 'center' },
  changeText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
});
