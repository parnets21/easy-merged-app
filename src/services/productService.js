// src/services/productService.js
import api from './api';

// ── Admin/internal product APIs (for stock/inventory management) ─────────────
export const productService = {
  list:          (params) => api.get('/products', { params }),
  get:           (id)     => api.get(`/products/${id}`),
  create:        (data)   => api.post('/products', data),
  update:        (id, d)  => api.patch(`/products/${id}`, d),
  delete:        (id)     => api.delete(`/products/${id}`),
  stockIn:       (data)   => api.post('/inventory/stock-in', data),
  stockOut:      (data)   => api.post('/inventory/stock-out', data),
  stockTransfer: (data)   => api.post('/inventory/transfer', data),
  lowStockList:  ()       => api.get('/products/low-stock'),
};

// ── Wholesaler product catalog API (view only — admin products) ───────────────
// Products are created by Admin. Wholesaler can only view them.
// Stock is managed via Purchase → Inventory (separate module).
export const wholesalerProductService = {
  // GET /api/wholesaler/products?page=1&limit=20&search=&size=&finish=...
  // Pass { catalog_only: true } to get ONLY admin catalog products (exclude wholesaler-added).
  listCatalog: (params) => api.get('/wholesaler/products', { params }),

  // GET /api/wholesaler/products/:id
  getProduct: (id) => api.get(`/wholesaler/products/${id}`),

  // GET /api/wholesaler/products/filters  — distinct size/finish/material/color values
  getFilters: () => api.get('/wholesaler/products/filters'),

  // POST /api/wholesaler/products  — wholesaler creates their own product/item
  create: (data) => api.post('/wholesaler/products', data),

  // PUT /api/wholesaler/products/:id  — edit own product
  update: (id, data) => api.put(`/wholesaler/products/${id}`, data),

  // POST /api/wholesaler/products/upload-image  — multipart image → { url }
  // `file` = { uri, name, type } from react-native image picker
  uploadImage: (file) => {
    const form = new FormData();
    form.append('image', {
      uri: file.uri,
      name: file.name || `photo_${Date.now()}.jpg`,
      type: file.type || 'image/jpeg',
    });
    return api.upload('/wholesaler/products/upload-image', form);
  },

  // POST /api/wholesaler/products/upload-doc  — multipart PDF → { url }
  uploadDoc: (file) => {
    const form = new FormData();
    form.append('doc', {
      uri: file.uri,
      name: file.name || `catalog_${Date.now()}.pdf`,
      type: file.type || 'application/pdf',
    });
    return api.upload('/wholesaler/products/upload-doc', form);
  },

  // POST /api/wholesaler/products/bulk-import  — multipart xlsx/csv → { created, updated, skipped, errors }
  bulkImport: (file) => {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name || `import_${Date.now()}.xlsx`,
      type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return api.upload('/wholesaler/products/bulk-import', form);
  },

  // GET /api/wholesaler/products/mine  — products this wholesaler created
  listMine: (params) => api.get('/wholesaler/products/mine', { params }),

  // DELETE /api/wholesaler/products/:id  — delete own product
  delete: (id) => api.delete(`/wholesaler/products/${id}`),

  // ── Taxonomy (own categories / sub-categories / brands) ──────
  // GET → { categories: [{ _id, name, sub_categories: [...] }], brands: [...] }
  getTaxonomy:      ()     => api.get('/wholesaler/products/taxonomy'),
  createCategory:   (name) => api.post('/wholesaler/products/categories', { name }),
  createSubCategory:(name, category_id) => api.post('/wholesaler/products/sub-categories', { name, category_id }),
  createBrand:      (name) => api.post('/wholesaler/products/brands', { name }),
  deleteCategory:    (id) => api.delete(`/wholesaler/products/categories/${id}`),
  deleteSubCategory: (id) => api.delete(`/wholesaler/products/sub-categories/${id}`),
  deleteBrand:       (id) => api.delete(`/wholesaler/products/brands/${id}`),
};
