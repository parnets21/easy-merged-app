// src/services/employeeService.js
// Wholesaler staff = Employees. Their login role is derived from designation
// by the backend (staffAuthController.roleFromDesignation).
import api from './api';

export const employeeService = {
  list:   (params)   => api.get('/employees', { params }),
  get:    (id)       => api.get(`/employees/${id}`),
  create: (data)     => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id)       => api.delete(`/employees/${id}`),
  // Current-month sales + earned incentive for a staff member.
  incentive: (id)    => api.get(`/employees/${id}/incentive`),
};

// The role a staff member gets in the app, keyed to what they can access.
export const STAFF_ROLES = [
  { key: 'Manager',         label: 'Manager',         desc: 'Orders, Inventory, Staff activities' },
  { key: 'Accountant',      label: 'Accountant',      desc: 'Sales, Purchase, Expenses, Payments' },
  { key: 'Sales Executive', label: 'Sales Executive', desc: 'Customers, Enquiries, Orders' },
  { key: 'Warehouse Staff', label: 'Warehouse Staff', desc: 'Stock In/Out, Transfer, Dispatch' },
];
