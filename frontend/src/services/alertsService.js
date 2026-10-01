import { api } from './api';

/** Expiry and low-stock alerts. Requires a staff access token. */
export const alertsService = {
  list: (params) => api.get('/alerts', params),
  getSummary: () => api.get('/alerts/summary'),
  scan: () => api.post('/alerts/scan'),
  acknowledge: (id) => api.patch(`/alerts/${id}/acknowledge`),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
};
