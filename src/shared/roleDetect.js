/**
 * roleDetect — figures out whether a mobile number belongs to a Wholesaler
 * or a Retailer, using each side's existing (public) check-mobile endpoint.
 *
 * No backend change: both endpoints already exist and return { exists: bool }.
 * We call them in parallel and infer the role from whichever says exists:true.
 *
 * This helper uses plain fetch so it has NO dependency on either app's
 * internal api/service layer — keeping the two apps fully separate.
 *
 * IMPORTANT — error handling:
 *   The backend runs on Render's free tier, which sleeps when idle. The FIRST
 *   request after a sleep period takes 30-60s to wake the server (cold start).
 *   A naive fetch would time out / error and be wrongly treated as "not
 *   registered". To avoid that we:
 *     • give each request a generous timeout,
 *     • retry a couple of times (covers the cold-start wake-up), and
 *     • surface a REAL network error instead of silently returning "false",
 *       so the UI can say "server waking up, try again" rather than the
 *       misleading "this number is not registered".
 */

const HOST = 'https://ezyenquiry-backend.onrender.com';
const WHOLESALER_CHECK = `${HOST}/api/wholesaler/auth/check-mobile`;
const RETAILER_CHECK   = `${HOST}/api/retailer/auth/check-mobile`;

// Per-role auth endpoints used by the single shared login screen.
const AUTH_BASE = {
  wholesaler: `${HOST}/api/wholesaler/auth`,
  retailer:   `${HOST}/api/retailer/auth`,
};

const REQUEST_TIMEOUT_MS = 30000; // 30s per attempt — covers slow mobile networks
const MAX_ATTEMPTS       = 3;     // retries cover Render free-tier cold starts

// A sentinel error so callers can tell "couldn't reach the server" apart from
// a successful "this number does not exist".
export class RoleDetectNetworkError extends Error {
  constructor(message) {
    super(message || 'Could not reach the server.');
    this.name = 'RoleDetectNetworkError';
  }
}

function fetchWithTimeout(url, options, timeoutMs) {
  // AbortController isn't available in every RN runtime, so race a timeout too.
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutPromise = new Promise((_, reject) => {
    const t = setTimeout(() => {
      if (controller) { try { controller.abort(); } catch (abortErr) { /* noop */ } }
      reject(new Error('timeout'));
    }, timeoutMs);
    // Let the fetch win the race normally.
    if (t && t.unref) t.unref();
  });
  const req = fetch(url, controller ? { ...options, signal: controller.signal } : options);
  return Promise.race([req, timeoutPromise]);
}

/**
 * Hits one check-mobile endpoint.
 * @returns {Promise<boolean>} whether the number exists on that side.
 * @throws {RoleDetectNetworkError} if the server could not be reached after retries.
 */
async function checkExists(url, mobile) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile }),
        },
        REQUEST_TIMEOUT_MS,
      );

      // A 5xx usually means the server is still waking up — retry.
      if (res.status >= 500) { lastErr = new Error(`HTTP ${res.status}`); continue; }

      const json = await res.json().catch(() => null);
      // Backend shape: { success, data: { exists } }
      return !!(json?.data?.exists ?? json?.exists);
    } catch (err) {
      lastErr = err;
      // brief backoff before retrying (helps the server finish waking up)
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1200 * attempt));
      }
    }
  }
  throw new RoleDetectNetworkError(lastErr?.message || 'Could not reach the server.');
}

/**
 * Detect which app a mobile number belongs to.
 * @returns {Promise<{ role: 'wholesaler'|'retailer'|null, both: boolean }>}
 *   role  = the detected role, or null if the number is registered in neither
 *   both  = true if the number exists on BOTH sides (caller must let user pick)
 * @throws {RoleDetectNetworkError} if neither backend could be reached — so the
 *   UI shows a "try again" message instead of a false "not registered".
 */
export async function detectRole(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return { role: null, both: false };

  // Run both checks; tolerate ONE side failing (e.g. only one backed is slow)
  // but fail loudly if BOTH are unreachable.
  const [wh, rt] = await Promise.allSettled([
    checkExists(WHOLESALER_CHECK, digits),
    checkExists(RETAILER_CHECK, digits),
  ]);

  const whFailed = wh.status === 'rejected';
  const rtFailed = rt.status === 'rejected';

  // If we couldn't reach EITHER server, don't guess — tell the caller.
  if (whFailed && rtFailed) {
    throw new RoleDetectNetworkError('Could not reach the server. Please try again.');
  }

  const isWholesaler = wh.status === 'fulfilled' ? wh.value : false;
  const isRetailer   = rt.status === 'fulfilled' ? rt.value : false;

  // A number should normally belong to exactly ONE app. But some legacy
  // numbers exist on BOTH sides. We DON'T guess and we DON'T block — instead
  // we report `both:true` so the login screen can let the user pick which
  // account to sign into.
  if (isWholesaler && isRetailer) return { role: null, both: true };
  if (isWholesaler) return { role: 'wholesaler', both: false };
  if (isRetailer)   return { role: 'retailer',   both: false };

  // Reached at least one server and it clearly said "not found".
  // But if the OTHER side errored, we can't be 100% sure — surface that so the
  // user can retry rather than being wrongly told "not registered".
  if (whFailed || rtFailed) {
    throw new RoleDetectNetworkError('Could not reach the server. Please try again.');
  }

  return { role: null, both: false };
}

/**
 * Guard used at REGISTRATION time to enforce "one number = one role".
 *
 * Before a user registers on a given side, we check whether the number is
 * already registered on the OTHER side. If it is, registration must be blocked
 * so we never create a dual-registered number again.
 *
 * @param {string} mobile  the 10-digit number being registered
 * @param {'wholesaler'|'retailer'} side  the side the user is trying to register on
 * @returns {Promise<{ blocked: boolean, otherRole: 'wholesaler'|'retailer'|null }>}
 * @throws {RoleDetectNetworkError} if the other side could not be reached (so
 *   the caller can ask the user to retry instead of silently allowing a dup).
 */
export async function checkOppositeRegistration(mobile, side) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return { blocked: false, otherRole: null };

  const otherRole = side === 'wholesaler' ? 'retailer' : 'wholesaler';
  const url = otherRole === 'wholesaler' ? WHOLESALER_CHECK : RETAILER_CHECK;

  // checkExists throws RoleDetectNetworkError if unreachable — let it bubble up.
  const existsOnOther = await checkExists(url, digits);
  return { blocked: existsOnOther, otherRole: existsOnOther ? otherRole : null };
}

// A sentinel for a server-reported failure (bad OTP, not registered, etc.) so
// the login screen can show the backend's message to the user.
export class AuthRequestError extends Error {
  constructor(message, status) {
    super(message || 'Request failed.');
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

async function authPost(role, path, body) {
  const base = AUTH_BASE[role];
  if (!base) throw new AuthRequestError('Unknown account type.');
  const url = `${base}/${path}`;

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS,
      );
    } catch (err) {
      // Network / timeout — retry (covers Render cold starts).
      lastErr = new RoleDetectNetworkError(err?.message);
      if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 1200 * attempt)); continue; }
      throw lastErr;
    }

    // 5xx = server still waking up → retry.
    if (res.status >= 500) {
      lastErr = new RoleDetectNetworkError(`HTTP ${res.status}`);
      if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, 1200 * attempt)); continue; }
      throw lastErr;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok || (json && json.success === false)) {
      throw new AuthRequestError(json?.message || `Request failed (${res.status}).`, res.status);
    }
    // Unwrap { success, data } → data, else the raw body.
    return json?.data !== undefined ? json.data : json;
  }
  throw lastErr || new RoleDetectNetworkError();
}

/**
 * Send a login OTP for the given role.
 * @returns {Promise<{ otp?: string }>}  dev-mode OTP if the backend returns one.
 * @throws {AuthRequestError} on 4xx (e.g. 404 not registered)
 * @throws {RoleDetectNetworkError} if the server could not be reached.
 */
export function sendLoginOtp(role, mobile) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  return authPost(role, 'send-otp', { mobile: digits, purpose: 'login' });
}

/**
 * Verify a login OTP for the given role.
 * @returns {Promise<{ token: string, user: object }>}
 * @throws {AuthRequestError} on bad/expired OTP
 * @throws {RoleDetectNetworkError} if the server could not be reached.
 */
export function verifyLoginOtp(role, mobile, otp) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  return authPost(role, 'verify-otp', { mobile: digits, otp: String(otp).trim(), purpose: 'login' });
}
