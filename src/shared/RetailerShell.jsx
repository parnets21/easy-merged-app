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
import { ExitToLoginProvider } from './ExitToLoginContext';

export default function RetailerShell() {
  const { intent, resetMode } = useAppMode();
  const navRef = useRef(null);

  // When the user chose "Retailer Register", start the navigator DIRECTLY on
  // the Register screen (no Splash flash). Otherwise start on Splash as usual.
  const initialRoute = intent === 'register' ? 'Register' : undefined;

  return (
    <ExitToLoginProvider onExit={resetMode}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2340" />
      <AuthProvider>
        <AppNavigator ref={navRef} initialRoute={initialRoute} />
      </AuthProvider>
    </ExitToLoginProvider>
  );
}
