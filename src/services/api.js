// src/services/api.js
// Uses React Native built-in fetch — no axios needed.
import { getToken, removeToken } from '../utils/storage';

// ── Base URL ────────────────────────────────────────────────────────────────
// Android Emulator  : 10.0.2.2  maps to host machine localhost
// iOS Simulator     : localhost or 127.0.0.1
// Physical Device   : replace with your machine's current WiFi IP
//                     Run `ipconfig` (Windows) / `ifconfig` (Mac) to find it
//
// YOUR CURRENT SERVER IP: 192.168.1.38  (using adb reverse over Wi-Fi → localhost)
// If network changes, update this line and rebuild the app.
//
// LOCAL backend on the PC's Wi-Fi IP (works over wireless — phone + PC on same Wi-Fi).
// For USB use 'https://ezyenquiry-backend.onrender.com/api' with `adb reverse tcp:5000`.
// For production use the Render URL below.
// Using localhost over USB (`adb reverse tcp:5000 tcp:5000`). This is reliable
// even when the WiFi router has AP/client isolation enabled (which blocks
// phone → PC traffic over WiFi, e.g. 192.168.1.38 was unreachable).
// Production backend (Render) — used for installable APK builds so the app
// works on any device over the internet (no PC/localhost dependency).
export const BASE_URL = 'https://ezyenquiry-backend.onrender.com/api';
// export const BASE_URL = 'http://localhost:5000/api';          // local USB (adb reverse)
// export const BASE_URL = 'http://192.168.1.38:5000/api';       // local WiFi IP

const TIMEOUT_MS = 20000; // 20s — generous for slow mobile networks

async function request(method, path, data, params) {
  const token = await getToken().catch(() => null);

  const headers = {
    'Content-Type': 'application/json',
    // Force fresh data — prevents stale 304 "Not Modified" responses that were
    // showing old product lists after tab/filter changes.
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Build URL + optional query string
  let url = `${BASE_URL}${path}`;
  if (params && Object.keys(params).length > 0) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const options = { method, headers };
  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  // Timeout wrapper
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Request timed out.\n\nTroubleshooting:\n' +
              '• Make sure the backend server is running\n' +
              '• Phone and PC must be on the same WiFi network\n' +
              `• Current server IP: ${BASE_URL}\n` +
              '• Run ipconfig on PC to verify the IP is correct'
          )
        ),
      TIMEOUT_MS
    )
  );

  let response;
  try {
    response = await Promise.race([fetch(url, options), timeoutPromise]);
  } catch (networkErr) {
    const msg = networkErr.message.includes('timed out')
      ? networkErr.message
      : `Cannot reach server.\n\nTroubleshooting:\n` +
        `• Start the backend: run start-backend.bat on your PC\n` +
        `• Phone and PC must be on the same WiFi\n` +
        `• Current server IP: ${BASE_URL}\n` +
        `• Original error: ${networkErr.message}`;
    throw new Error(msg);
  }

  // 401 — clear stored token
  if (response.status === 401) {
    await removeToken().catch(() => {});
  }

  let json;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    json = await response.json();
  } else {
    const text = await response.text();
    json = { message: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const err = new Error(json?.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return json;
}

// Multipart upload — sends FormData. Do NOT set Content-Type; RN/fetch adds the
// correct multipart boundary automatically.
async function upload(path, formData) {
  const token = await getToken().catch(() => null);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, { method: 'POST', headers, body: formData });
  } catch (networkErr) {
    throw new Error(`Upload failed. Cannot reach server.\n${networkErr.message}`);
  }
  if (response.status === 401) await removeToken().catch(() => {});

  let json;
  const ct = response.headers.get('content-type') || '';
  json = ct.includes('application/json') ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const err = new Error(json?.message || `HTTP ${response.status}`);
    err.status = response.status; err.data = json;
    throw err;
  }
  return json;
}

const api = {
  get:    (path, opts = {}) => request('GET',    path, null,  opts.params),
  post:   (path, data)      => request('POST',   path, data),
  patch:  (path, data)      => request('PATCH',  path, data),
  put:    (path, data)      => request('PUT',    path, data),
  delete: (path)            => request('DELETE', path),
  upload,
};

export default api;
