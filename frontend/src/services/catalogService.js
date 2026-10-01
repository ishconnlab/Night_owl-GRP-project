import { api } from './api';

/** Public product catalogue. No token required. */
export const catalogService = {
  listMedicines: (params) => api.get('/catalog/medicines', params),
  getMedicine: (id) => api.get(`/catalog/medicines/${id}`),
  getPharmacy: () => api.get('/catalog/pharmacy'),
};

/**
 * Reservations. The first two are customer-facing and unauthenticated; the rest
 * are the staff queue and need a token.
 */
export const reservationsService = {
  create: (body) => api.post('/reservations', body),
  getByReference: (reference) => api.get(`/reservations/${reference}`),
  list: (params) => api.get('/reservations', params),
  getCounts: () => api.get('/reservations/counts'),
  updateStatus: (id, status) => api.patch(`/reservations/${id}/status`, { status }),
};
