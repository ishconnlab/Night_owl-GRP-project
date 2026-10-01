import { api } from './api';

/** Sale recording and receipt history. Requires a staff access token. */
export const salesService = {
  record: (sale) => api.post('/sales', sale),
  list: (params) => api.get('/sales', params),
  getSale: (id) => api.get(`/sales/${id}`),
};
