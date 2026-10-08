/**
 * WholesalerShell — the original Wholesaler app, unchanged.
 *
 * This is exactly what the old App.jsx mounted: AuthProvider + NavigationContainer
 * + RootNavigator + the FCM handlers + the Approval success modal. It is rendered
 * only when the merged app's mode === 'wholesaler', so the wholesaler experience
 * is byte-for-byte the same as before.
 */
import React, { useEffect, useRef } from 'react';
import {
  Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAppMode } from './AppModeContext';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { AuthProvider, AuthContext } from '../context/AuthContext';
import RootNavigator from '../navigation/RootNavigator';
import { theme } from '../utils/theme';
import { ExitToLoginProvider } from './ExitToLoginContext';

const NAV_THEME = {
  dark: false,
  colors: {
    primary:      theme.colors.primary,
    background:   theme.colors.splashBg,
    card:         theme.colors.surface,
    text:         theme.colors.textPrimary,
    border:       theme.colors.border,
    notification: theme.colors.danger,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium:  { fontFamily: 'System', fontWeight: '500' },
    bold:    { fontFamily: 'System', fontWeight: '700' },
    heavy:   { fontFamily: 'System', fontWeight: '900' },
  },
};

async function askNotificationPermission() {
  try {
    const msgInstance = getMessaging();
    const status      = await requestPermission(msgInstance);
    const granted =
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL;
    console.log('[FCM] Permission', granted ? 'granted' : 'denied');
    return granted;
  } catch (err) {
    console.warn('[FCM] requestPermission error:', err.message);
    return false;
  }
}

function ApprovalSuccessModal() {
  return (
    <AuthContext.Consumer>
      {({ approvalModal, dismissApprovalModal }) => {
        if (!approvalModal?.visible) return null;
        const name = approvalModal.ownerName
          ? `Congratulations ${approvalModal.ownerName}!`
          : 'Congratulations!';
        return (
          <Modal transparent animationType="fade" visible={approvalModal.visible}
            onRequestClose={dismissApprovalModal} statusBarTranslucent>
            <View style={modalStyles.overlay}>
              <View style={modalStyles.card}>
                <View style={modalStyles.iconCircle}>
                  <Text style={modalStyles.iconText}>✓</Text>
                </View>
                <Text style={modalStyles.title}>Registration Approved{'\n'}Successfully</Text>
                <Text style={modalStyles.name}>{name}</Text>
                <Text style={modalStyles.body}>
                  Your registration has been approved successfully.{'\n'}
                  You can now access your dashboard.
                </Text>
                <TouchableOpacity style={modalStyles.okBtn} onPress={dismissApprovalModal} activeOpacity={0.85}>
                  <Text style={modalStyles.okBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      }}
    </AuthContext.Consumer>
  );
}

export default function WholesalerShell() {
  const { resetMode } = useAppMode();
  const navRef = useRef(null);

  // Register deep-linking is handled by RootNavigator starting AuthStack on the
  // Registration screen directly (no Splash flash), so no onReady hop is needed.
  const onReady = () => {};

  useEffect(() => {
    const msgInstance = getMessaging();
    askNotificationPermission();

    const unsubForeground = onMessage(msgInstance, async remoteMessage => {
      const data = remoteMessage?.data ?? {};
      if (data.type === 'approval') return;
      const title = remoteMessage?.notification?.title || 'EzyEnquiry';
      const body  = remoteMessage?.notification?.body  || '';
      if (title || body) {
        const { Alert } = require('react-native');
        Alert.alert(title, body);
      }
    });

    const unsubBackground = onNotificationOpenedApp(msgInstance, remoteMessage => {
      console.log('[FCM] Background tap:', JSON.stringify(remoteMessage?.data ?? {}));
    });

    getInitialNotification(msgInstance).then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] Quit-state tap:', JSON.stringify(remoteMessage?.data ?? {}));
      }
    });

    return () => { unsubForeground(); unsubBackground(); };
  }, []);

  return (
    <ExitToLoginProvider onExit={resetMode}>
      <AuthProvider>
        <NavigationContainer theme={NAV_THEME} ref={navRef} onReady={onReady}>
          <StatusBar barStyle="light-content" backgroundColor={theme.colors.splashBg} translucent={false} />
          <RootNavigator />
          <ApprovalSuccessModal />
        </NavigationContainer>
      </AuthProvider>
    </ExitToLoginProvider>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 36, paddingHorizontal: 28, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#F0FDF4', borderWidth: 3, borderColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  iconText: { fontSize: 36, color: '#16A34A', fontWeight: '900', lineHeight: 42 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 10, lineHeight: 28 },
  name: { fontSize: 16, fontWeight: '700', color: '#059669', textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  okBtn: { backgroundColor: '#059669', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 8, elevation: 5 },
  okBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
});
