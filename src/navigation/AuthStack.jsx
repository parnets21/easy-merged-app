// src/navigation/AuthStack.jsx
//
// Auth flow:  Splash → Welcome → (Login | Registration) → OTP → DocumentUpload → ApprovalWaiting
//             Welcome → TermsOfService
//             Welcome → PrivacyPolicy
//
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SplashScreen          from '../screens/auth/SplashScreen';
import WelcomeScreen         from '../screens/auth/WelcomeScreen';
import LoginScreen           from '../screens/auth/LoginScreen';
import OTPScreen             from '../screens/auth/OTPScreen';
import RegistrationScreen    from '../screens/auth/RegistrationScreen';
import DocumentUploadScreen  from '../screens/auth/DocumentUploadScreen';
import ApprovalWaitingScreen from '../screens/auth/ApprovalWaitingScreen';
import TermsOfServiceScreen  from '../screens/auth/TermsOfServiceScreen';
import PrivacyPolicyScreen   from '../screens/auth/PrivacyPolicyScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack({ initialRouteName }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName || 'Splash'}
      screenOptions={{ headerShown: false }}
    >
      {/* 1. Splash — shows logo, auto-navigates after 2.5s */}
      <Stack.Screen name="Splash"          component={SplashScreen} />

      {/* 2. Welcome — login / create account entry point */}
      <Stack.Screen name="Welcome"         component={WelcomeScreen} />

      {/* 3a. Login — for existing users */}
      <Stack.Screen name="Login"           component={LoginScreen} />

      {/* 4. OTP Verification */}
      <Stack.Screen name="OTP"             component={OTPScreen} />

      {/* 3b. Registration — for new users */}
      <Stack.Screen name="Registration"    component={RegistrationScreen} />

      {/* 5. Document upload (post-registration) */}
      <Stack.Screen name="DocumentUpload"  component={DocumentUploadScreen} />

      {/* 6. Waiting for admin approval */}
      <Stack.Screen name="ApprovalWaiting" component={ApprovalWaitingScreen} />

      {/* Legal screens — linked from Welcome screen footer */}
      <Stack.Screen name="TermsOfService"  component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}
