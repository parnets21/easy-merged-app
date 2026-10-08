/**
 * ExitToLoginContext — lets any screen INSIDE a role shell (retailer or
 * wholesaler) ask the merged app to return to the SINGLE shared login screen.
 *
 * Why this exists:
 *   Each sub-app used to send the user to its OWN Login screen on logout. In
 *   the merged app we want logout to drop back to the one shared login. The
 *   sub-apps don't know about AppMode, so the shell provides this bridge and
 *   wires it to AppMode.resetMode().
 *
 * Usage inside a sub-app screen:
 *   const exitToLogin = useExitToLogin();
 *   await logout();          // clear the sub-app session
 *   exitToLogin();           // return to the shared login
 */
import React, { createContext, useContext } from 'react';

const ExitToLoginContext = createContext(() => {});

export function ExitToLoginProvider({ onExit, children }) {
  return (
    <ExitToLoginContext.Provider value={onExit || (() => {})}>
      {children}
    </ExitToLoginContext.Provider>
  );
}

/** Returns a function that returns the app to the shared login screen. */
export function useExitToLogin() {
  return useContext(ExitToLoginContext);
}
