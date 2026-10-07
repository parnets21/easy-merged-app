/**
 * EzyEnquiry — ONE merged mobile app containing BOTH the Wholesaler and
 * Retailer apps, kept fully separate internally.
 *
 * Flow:
 *   Enter mobile → detect role → open the matching app (its own login/OTP,
 *   navigation, context, services, storage keys and API namespace, unchanged).
 *
 *   mode = 'wholesaler' → <WholesalerShell/>  (/api/wholesaler/*, @wholesaler_* keys, FCM)
 *   mode = 'retailer'   → <RetailerShell/>    (/api/retailer/*,   @ezy_* keys)
 *   mode =  null        → <RolePickerScreen/> (shared mobile entry)
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AppModeProvider, useAppMode } from './src/shared/AppModeContext';
import RolePickerScreen from './src/shared/RolePickerScreen';
import WholesalerShell from './src/shared/WholesalerShell';
import RetailerShell from './src/shared/RetailerShell';
import { theme } from './src/utils/theme';

function Root() {
  const { mode, resolving } = useAppMode();

  if (resolving) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (mode === 'wholesaler') return <WholesalerShell />;
  if (mode === 'retailer')   return <RetailerShell />;
  return <RolePickerScreen />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppModeProvider>
          <Root />
        </AppModeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.splashBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
