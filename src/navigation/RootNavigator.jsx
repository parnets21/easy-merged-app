// src/navigation/RootNavigator.jsx
//
// Decision layer — picks which navigator stack to show based on auth state.
//
// States:
//   isLoading=true          → loading spinner (session restore in progress)
//   token && isApproved     → AppStack  (full app — dashboard etc.)
//   token && !isApproved    → PendingStack (ApprovalWaitingScreen with real navigation)
//   no token                → AuthStack (Splash → Welcome → Login/Register → OTP → Docs)
//
// Why PendingStack instead of rendering ApprovalWaitingScreen directly?
//   • ApprovalWaitingScreen needs a real navigation object for:
//       - navigation.goBack() / navigation.navigate('Welcome')
//       - BackHandler integration
//   • The outer NavigationContainer is the only navigator above this component,
//     so we create a nested stack navigator to give the screen proper navigation.
//   • When isApproved becomes true (via FCM or polling), this component re-renders
//     and switches to AppStack automatically — no manual navigation call needed.
//
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuth from '../hooks/useAuth';
import { useAppMode } from '../shared/AppModeContext';
import { theme } from '../utils/theme';
import AuthStack from './AuthStack';
import AppStack  from './AppStack';
import ApprovalWaitingScreen from '../screens/auth/ApprovalWaitingScreen';
import WelcomeScreen         from '../screens/auth/WelcomeScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import RegistrationScreen    from '../screens/auth/RegistrationScreen';
import OTPScreen             from '../screens/auth/OTPScreen';
import DocumentUploadScreen  from '../screens/auth/DocumentUploadScreen';
import TermsOfServiceScreen  from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen   from '../screens/auth/PrivacyPolicyScreen';

// A minimal 2-screen stack:
//   Welcome (initial, can go back here from ApprovalWaiting)
//   ApprovalWaiting
// This gives ApprovalWaitingScreen a real navigation prop with canGoBack() === true.
const PendingNav = createNativeStackNavigator();

function PendingStack() {
  return (
    <PendingNav.Navigator
      // Start directly on ApprovalWaiting; Welcome is behind it so back works.
      initialRouteName="ApprovalWaiting"
      screenOptions={{ headerShown: false }}
    >
      {/* Back destination — lands here after pressing Back on ApprovalWaiting */}
      <PendingNav.Screen name="Welcome"         component={WelcomeScreen} />
      <PendingNav.Screen name="ApprovalWaiting" component={ApprovalWaitingScreen} />
      {/* Auth screens available here too, so Welcome's buttons always work */}
      <PendingNav.Screen name="Login"           component={LoginScreen} />
      <PendingNav.Screen name="Registration"    component={RegistrationScreen} />
      <PendingNav.Screen name="OTP"             component={OTPScreen} />
      <PendingNav.Screen name="DocumentUpload"  component={DocumentUploadScreen} />
      <PendingNav.Screen name="TermsOfService"  component={TermsOfServiceScreen} />
      <PendingNav.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} />
    </PendingNav.Navigator>
  );
}

export default function RootNavigator() {
  const { token, isApproved, isLoading } = useAuth();
  const { intent } = useAppMode();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Logged-in AND approved → main app
  if (token && isApproved) return <AppStack />;

  // Logged-in but NOT yet approved → show ApprovalWaiting with real navigation
  if (token && !isApproved) return <PendingStack />;

  // Not logged in → auth flow. If the user chose "Wholesaler Register" from the
  // shared screen, start DIRECTLY on Registration (no Splash/Welcome flash).
  return <AuthStack initialRouteName={intent === 'register' ? 'Registration' : undefined} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.splashBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
