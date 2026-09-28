/**
 * src/services/authService.js
 * All auth-related API calls for the Wholesaler app.
 * Base URL is defined once in api.js — do not redefine here.
 */
import api from './api';
import { BASE_URL } from './api';
import { getToken } from '../utils/storage';

export const authService = {

  /** Check if mobile is registered → WelcomeScreen routing */
  checkMobile: (mobile) =>
    api.post('/wholesaler/auth/check-mobile', { mobile }),

  /** Send OTP to mobile */
  sendOTP: (mobile, purpose = 'login') =>
    api.post('/wholesaler/auth/send-otp', { mobile, purpose }),

  /** Verify OTP — returns { token, user } on login, { verified: true } otherwise */
  verifyOTP: (mobile, otp, purpose = 'login') =>
    api.post('/wholesaler/auth/verify-otp', { mobile, otp, purpose }),

  /** Register new wholesaler company (Step 1) */
  register: (data) =>
    api.post('/wholesaler/auth/register', data),

  /**
   * Upload KYC documents (Step 2) — multipart/form-data
   * docs = { gst: { uri, name, type }, pan, trade, reg }
   */
  uploadDocs: async (mobile, docs) => {
    const token = await getToken().catch(() => null);
    const formData = new FormData();
    formData.append('mobile', mobile);

    Object.entries(docs).forEach(([field, file]) => {
      if (file) {
        formData.append(field, {
          uri:  file.uri,
          name: file.name  || `${field}.pdf`,
          type: file.type  || 'application/pdf',
        });
      }
    });

    const headers = { 'Content-Type': 'multipart/form-data' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}/wholesaler/auth/upload-docs`, {
      method:  'POST',
      headers,
      body:    formData,
    });

    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json?.message || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return json;
  },

  /** Get logged-in user profile + company status */
  getMe: () =>
    api.get('/wholesaler/auth/me'),

  /**
   * Lightweight approval status check — faster than getMe.
   * Returns: { status, ownerName, companyId, companyName, approvedAt, rejectReason }
   */
  getApprovalStatus: () =>
    api.get('/wholesaler/auth/approval-status'),

  /** Save FCM push notification token */
  saveFCMToken: (token, deviceInfo = '') =>
    api.post('/wholesaler/auth/fcm-token', { token, deviceInfo }),

  /** Logout — clear FCM token on server */
  logout: () =>
    api.post('/wholesaler/auth/logout', {}),

  /** Update profile (name, email etc.) */
  updateProfile: (data) =>
    api.patch('/wholesaler/auth/profile', data),
};
