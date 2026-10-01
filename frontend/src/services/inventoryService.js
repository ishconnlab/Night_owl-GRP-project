import { api } from './api';

/** Medicine batches and stock movements. Requires a staff access token. */
export const inventoryService = {
  listMedicines: (params) => api.get('/inventory/medicines', params),
  listForSalePicker: () => api.get('/inventory/medicines/picker'),
  getMedicine: (id) => api.get(`/inventory/medicines/${id}`),
  create: (medicine) => api.post('/inventory/medicines', medicine),
  update: (id, changes) => api.patch(`/inventory/medicines/${id}`, changes),
  retire: (id) => api.delete(`/inventory/medicines/${id}`),
  adjustStock: (id, quantityChange, reason) =>
    api.post(`/inventory/medicines/${id}/stock`, { quantityChange, reason }),
};
