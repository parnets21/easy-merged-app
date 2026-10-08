/**
 * sessionWriter — writes a verified login session into the SAME AsyncStorage
 * keys each sub-app reads on startup, so that mounting the Wholesaler or
 * Retailer shell lands the user straight on their home screen with NO second
 * login.
 *
 * The single shared login screen (RolePickerScreen) calls this right after it
 * verifies the OTP, then switches app mode. Each sub-app's AuthContext restores
 * the session from these keys on mount.
 *
 * Keys MUST match:
 *   Wholesaler → src/utils/storage.js            (@wholesaler_jwt / @wholesaler_user)
 *   Retailer   → src/retailer/constants/index.js (@ezy_auth_token / @ezy_user_data / @ezy_is_logged_in)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  wholesaler: { token: '@wholesaler_jwt', user: '@wholesaler_user' },
  retailer:   { token: '@ezy_auth_token', user: '@ezy_user_data', loggedIn: '@ezy_is_logged_in' },
};

/**
 * Persist a login session for the given role.
 * @param {'wholesaler'|'retailer'} role
 * @param {string} token  JWT returned by verify-otp
 * @param {object} user   user object returned by verify-otp
 */
export async function writeSession(role, token, user) {
  const k = KEYS[role];
  if (!k) throw new Error(`writeSession: unknown role "${role}"`);

  const ops = [];
  if (token) ops.push(AsyncStorage.setItem(k.token, token));
  if (user)  ops.push(AsyncStorage.setItem(k.user, JSON.stringify(user)));
  if (k.loggedIn) ops.push(AsyncStorage.setItem(k.loggedIn, 'true'));
  await Promise.all(ops);
}
