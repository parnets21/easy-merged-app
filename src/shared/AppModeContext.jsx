/**
 * AppModeContext — the top-level role switch for the merged app.
 *
 * One mobile app contains BOTH the Wholesaler and Retailer apps, kept fully
 * separate internally (own navigation, context, services, storage keys, API
 * namespace). This context only decides WHICH of the two is currently mounted:
 *
 *   mode = 'wholesaler' → mount the Wholesaler app (unchanged)
 *   mode = 'retailer'   → mount the Retailer app (unchanged)
 *   mode =  null        → show the shared mobile-number entry (role picker)
 *
 * On startup we auto-detect the mode from whichever app already has a saved
 * session token, so a logged-in user is taken straight back into their app.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Wholesaler stores its JWT under @wholesaler_jwt; Retailer under @ezy_auth_token.
const WHOLESALER_TOKEN_KEY = '@wholesaler_jwt';
const RETAILER_TOKEN_KEY   = '@ezy_auth_token';

const AppModeContext = createContext(null);

export function AppModeProvider({ children }) {
  const [mode, setModeState] = useState(null);   // 'wholesaler' | 'retailer' | null
  const [intent, setIntent]  = useState('login'); // 'login' | 'register' — where to land
  const [resolving, setResolving] = useState(true);

  // Decide the initial mode on launch purely from which app already has a
  // saved session token. We intentionally do NOT persist a separate mode flag:
  //   - If a token exists → go straight into that app (returning user).
  //   - If none exists    → shared role picker.
  // This makes logout "just work": clearing the token drops the user back to
  // the role picker on the next launch, with nothing stale to clean up.
  useEffect(() => {
    (async () => {
      try {
        const [whToken, rtToken] = await Promise.all([
          AsyncStorage.getItem(WHOLESALER_TOKEN_KEY),
          AsyncStorage.getItem(RETAILER_TOKEN_KEY),
        ]);
        if (whToken) { setModeState('wholesaler'); return; }
        if (rtToken) { setModeState('retailer');   return; }
        setModeState(null);
      } finally {
        setResolving(false);
      }
    })();
  }, []);

  // Called by the shared landing once the role is chosen. `nextIntent` tells
  // the mounted app whether to land on its login or its registration screen.
  const setMode = useCallback((next, nextIntent = 'login') => {
    setIntent(nextIntent || 'login');
    setModeState(next || null);
  }, []);

  // Return to the shared landing (used when switching apps).
  const resetMode = useCallback(() => {
    setIntent('login');
    setModeState(null);
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, intent, resolving, setMode, resetMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within an AppModeProvider');
  return ctx;
}
