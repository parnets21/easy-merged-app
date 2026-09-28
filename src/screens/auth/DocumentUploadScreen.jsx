// src/screens/auth/DocumentUploadScreen.jsx
// Step 2 of registration — KYC document upload
// Uses @react-native-documents/picker (the maintained successor to react-native-document-picker)
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { authService } from '../../services/authService';
import { theme } from '../../utils/theme';
import { setRegStep } from '../../utils/storage';

const LOGO = require('../../assets/logo.png');

const DOCS = [
  {
    key:      'gst',
    label:    'GST Certificate',
    required: true,
    hint:     'GST registration certificate (PDF / Image)',
    icon:     '📄',
  },
  {
    key:      'pan',
    label:    'PAN Card',
    required: false,
    hint:     'Business or owner PAN card (PDF / Image) — optional',
    icon:     '🪪',
  },
  {
    key:      'trade',
    label:    'Trade / Shop License',
    required: false,
    hint:     'Trade license or shop establishment letter',
    icon:     '🏪',
  },
  {
    key:      'reg',
    label:    'Business Registration',
    required: false,
    hint:     'Partnership deed / incorporation certificate',
    icon:     '📋',
  },
];

export default function DocumentUploadScreen({ route, navigation }) {
  const mobile     = route?.params?.mobile ?? '';
  const uniqueCode = route?.params?.uniqueCode ?? '';

  const [files,   setFiles]   = useState({});
  const [loading, setLoading] = useState(false);

  // ── Pick a file from phone storage ──────────────────────
  const pickFile = async (key) => {
    try {
      const results = await pick({
        allowMultiSelection: false,
        type: [types.pdf, types.images],
        mode: 'import',    // copies file into app sandbox — safe for upload
      });

      if (!results || results.length === 0) return;
      const result = results[0];

      setFiles(prev => ({
        ...prev,
        [key]: {
          uri:  result.uri,
          name: result.name  || `${key}_document.pdf`,
          type: result.type  || 'application/pdf',
          size: result.size  || 0,
        },
      }));
    } catch (err) {
      if (isErrorWithCode(err)) {
        if (err.code === errorCodes.OPERATION_CANCELED) {
          // User pressed back — do nothing
          return;
        }
        if (err.code === errorCodes.IN_PROGRESS) {
          // Another pick is already open
          return;
        }
        if (err.code === errorCodes.UNABLE_TO_OPEN_FILE_TYPE) {
          Alert.alert('Unsupported File', 'Please select a PDF or image file (JPEG, PNG).');
          return;
        }
      }
      console.warn('[DocPicker]', err?.message, err?.code);
      Alert.alert('Error', err?.message || 'Could not open file picker. Please try again.');
    }
  };

  const removeFile = (key) => {
    setFiles(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Submit documents to server ───────────────────────────
  const handleSubmit = async () => {
    const missing = DOCS.filter(d => d.required && !files[d.key]);
    if (missing.length) {
      Alert.alert(
        'Required Documents Missing',
        `Please upload:\n• ${missing.map(d => d.label).join('\n• ')}`
      );
      return;
    }
    if (!mobile) {
      Alert.alert('Error', 'Mobile number missing. Please go back and register again.');
      return;
    }

    setLoading(true);
    try {
      await authService.uploadDocs(mobile, files);
      // Docs submitted — update step to 'waiting' so splash can resume here
      await setRegStep('waiting', mobile);

      Alert.alert(
        'Documents Submitted! 🎉',
        'Your KYC documents have been submitted.\n\nOur team will review your account within 24–48 hours.\n\nYou can login once approved.',
        [{ text: 'Go to Login', onPress: () => navigation.replace('Login', { mobile }) }],
        { cancelable: false }
      );
    } catch (e) {
      Alert.alert(
        'Upload Failed',
        e?.message || 'Could not upload documents. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const requiredDone  = DOCS.filter(d => d.required).every(d => !!files[d.key]);
  const totalUploaded = Object.keys(files).length;
  const progressPct   = DOCS.length > 0 ? Math.round((totalUploaded / DOCS.length) * 100) : 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.circleDecorTL} />
        <View style={styles.circleDecorBR} />
        <View style={styles.logoBox}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.headerTitle}>Upload Documents</Text>
        <Text style={styles.headerSub}>KYC verification for your business account</Text>
      </View>

      {/* ── Unique code banner (shown right after registration) ── */}
      {!!uniqueCode && (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Wholesaler Code</Text>
          <Text style={styles.codeValue}>{uniqueCode}</Text>
          <Text style={styles.codeHint}>Save this code — it's your unique account ID.</Text>
        </View>
      )}

      {/* ── Progress card ── */}
      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {totalUploaded} of {DOCS.length} uploaded
          </Text>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          GST Certificate is required
        </Text>
      </View>

      {/* ── Document cards ── */}
      <View style={styles.docsSection}>
        {DOCS.map(doc => {
          const uploaded = !!files[doc.key];
          const file     = files[doc.key];

          return (
            <View key={doc.key} style={[styles.docCard, uploaded && styles.docCardDone]}>
              <View style={[styles.docIconWrap, uploaded && styles.docIconWrapDone]}>
                <Text style={styles.docIcon}>{uploaded ? '✅' : doc.icon}</Text>
              </View>

              <View style={styles.docInfo}>
                <View style={styles.docTitleRow}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  {doc.required
                    ? <View style={styles.badgeRequired}><Text style={styles.badgeRequiredText}>Required</Text></View>
                    : <View style={styles.badgeOptional}><Text style={styles.badgeOptionalText}>Optional</Text></View>
                  }
                </View>

                {uploaded ? (
                  <View>
                    <Text style={styles.fileNameText} numberOfLines={1}>
                      📎 {file.name}
                    </Text>
                    {!!file.size && (
                      <Text style={styles.fileSizeText}>{formatSize(file.size)}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.hintText}>{doc.hint}</Text>
                )}
              </View>

              <View style={styles.docAction}>
                {uploaded ? (
                  <TouchableOpacity
                    onPress={() => removeFile(doc.key)}
                    style={styles.removeBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => pickFile(doc.key)}
                    style={styles.pickBtn}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pickBtnText}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Info note ── */}
      <View style={styles.infoNote}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          Accepted: PDF, JPEG, PNG — max 5 MB each.{'\n'}
          Tap "Select" to choose a file from your phone.
        </Text>
      </View>

      {/* ── Submit button ── */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!requiredDone || loading) && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!requiredDone || loading}
        activeOpacity={0.85}
      >
        <Text style={styles.submitBtnText}>
          {loading ? 'Uploading Documents…' : 'Submit Documents & Continue →'}
        </Text>
      </TouchableOpacity>

      {/* KYC is mandatory before approval — no skip. */}
      <Text style={styles.kycNote}>
        GST Certificate is mandatory for account verification. PAN Card is optional.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    paddingBottom: 48,
  },

  header: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 44,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  circleDecorTL: {
    position: 'absolute', top: -50, left: -50,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleDecorBR: {
    position: 'absolute', bottom: -40, right: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  logoBox: {
    width: 76, height: 76, borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  logoImage:   { width: 54, height: 54 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 5 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.78)' },

  codeCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    marginTop: -20,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  codeLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
  codeValue: { fontSize: 26, fontWeight: '900', color: theme.colors.accent, letterSpacing: 2, marginVertical: 4 },
  codeHint:  { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' },

  progressCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  progressPct:   { fontSize: 14, fontWeight: '800', color: theme.colors.primary },
  progressTrack: {
    height: 7, backgroundColor: theme.colors.border,
    borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: {
    height: 7, backgroundColor: theme.colors.accent, borderRadius: 4,
  },
  progressHint: { fontSize: 11, color: theme.colors.textSecondary },

  docsSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 18,
  },
  docCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  docCardDone: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  docIconWrap: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  docIconWrapDone: { backgroundColor: '#DCFCE7' },
  docIcon: { fontSize: 22 },

  docInfo: { flex: 1 },
  docTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 4, gap: 6, flexWrap: 'wrap',
  },
  docLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },

  badgeRequired: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeRequiredText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  badgeOptional: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeOptionalText: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '600' },

  fileNameText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  fileSizeText: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  hintText:     { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },

  docAction: { marginLeft: 8 },
  pickBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  pickBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  removeBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { fontSize: 14, color: '#DC2626', fontWeight: '800' },

  infoNote: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  infoIcon: { fontSize: 14, marginRight: 8, marginTop: 1 },
  infoText: {
    flex: 1, fontSize: 12,
    color: theme.colors.textSecondary, lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: theme.colors.accent,
    marginHorizontal: 20,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
    marginBottom: 14,
  },
  submitBtnDisabled: {
    backgroundColor: theme.colors.textDisabled,
    shadowOpacity: 0, elevation: 0,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },

  kycNote: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 14,
    paddingHorizontal: 24,
    lineHeight: 17,
  },
});
