// src/services/notificationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const NOTIF_KEY = '@wholesaler_notifications';

export const notificationService = {
  list:        ()       => api.get('/wholesaler/notifications'),
  markRead:    (id)     => api.patch(`/wholesaler/notifications/${id}/read`),
  saveFCMToken:(token)  => api.post('/wholesaler/auth/fcm-token', { token }),
  saveLocal: async (notification) => {
    const existing = await notificationService.getLocal();
    const updated = [notification, ...existing].slice(0, 100);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  },
  getLocal: async () => {
    const raw = await AsyncStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  },
};
