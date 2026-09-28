// src/services/orderService.js
import api from './api';

export const orderService = {
  list:         (params)    => api.get('/orders', { params }),
  get:          (id)        => api.get(`/orders/${id}`),
  create:       (data)      => api.post('/orders', data),
  // Idempotent — copies product/qty/rate/gst from the (Confirmed) enquiry into a new order.
  createFromEnquiry: (data) => api.post('/orders/from-enquiry', data),
  updateStatus: (id, data)  => api.patch(`/orders/${id}/status`, data),
  // Assign an order to a staff member (POST /orders/:id/assign).
  assign:       (id, data)  => api.post(`/orders/${id}/assign`, data),
  // Generate a GST invoice from an order (idempotent).
  generateInvoice: (id)     => api.post(`/orders/${id}/invoice`, {}),
};
