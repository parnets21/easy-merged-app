/**
 * RetailerShell — the original Retailer app, unchanged.
 *
 * Mounts the retailer app's own AuthProvider + AppNavigator (which brings its
 * own NavigationContainer). Rendered only when mode === 'retailer', so the
 * retailer experience is identical to the standalone Retailer app.
 */
import React, { useRef } from 'react';
import { StatusBar } from 'react-native';
import { AuthProvider } from '../retailer/context/AuthContext';
import AppNavigator from '../retailer/navigation/AppNavigator';
import { useAppMode } from './AppModeContext';

export default function RetailerShell() {
  const { intent } = useAppMode();
  const navRef = useRef(null);

  // When the user chose "Retailer Register", deep-link straight to the
  // retailer app's own Register screen once the navigator is ready.
  const onReady = () => {
    if (intent === 'register') {
      // Small delay so the Splash's own replace() settles first.
      setTimeout(() => {
        try { navRef.current?.navigate('Register'); } catch (_) {}
      }, 1400);
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <AppNavigator ref={navRef} onReady={onReady} />
      </AuthProvider>
    </>
  );
}
