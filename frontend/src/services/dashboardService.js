import { api } from './api';

/** Staff reporting. Requires a staff access token. */
export const dashboardService = {
  getSummary: (params) => api.get('/dashboard/summary', params),
};
