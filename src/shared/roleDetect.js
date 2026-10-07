/**
 * roleDetect — figures out whether a mobile number belongs to a Wholesaler
 * or a Retailer, using each side's existing (public) check-mobile endpoint.
 *
 * No backend change: both endpoints already exist and return { exists: bool }.
 * We call them in parallel and infer the role from whichever says exists:true.
 *
 * This helper uses plain fetch so it has NO dependency on either app's
 * internal api/service layer — keeping the two apps fully separate.
 */

const HOST = 'https://ezyenquiry-backend.onrender.com';
const WHOLESALER_CHECK = `${HOST}/api/wholesaler/auth/check-mobile`;
const RETAILER_CHECK   = `${HOST}/api/retailer/auth/check-mobile`;

async function checkExists(url, mobile) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });
    const json = await res.json().catch(() => null);
    // Backend shape: { success, data: { exists } }
    return !!(json?.data?.exists ?? json?.exists);
  } catch {
    return false;
  }
}

/**
 * Detect which app a mobile number belongs to.
 * @returns {Promise<{ role: 'wholesaler'|'retailer'|null, both: boolean }>}
 *   role  = the detected role, or null if the number is registered in neither
 *   both  = true if the number exists on BOTH sides (caller must let user pick)
 */
export async function detectRole(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return { role: null, both: false };

  const [isWholesaler, isRetailer] = await Promise.all([
    checkExists(WHOLESALER_CHECK, digits),
    checkExists(RETAILER_CHECK, digits),
  ]);

  if (isWholesaler && isRetailer) return { role: null, both: true };
  if (isWholesaler) return { role: 'wholesaler', both: false };
  if (isRetailer)   return { role: 'retailer',   both: false };
  return { role: null, both: false };
}
