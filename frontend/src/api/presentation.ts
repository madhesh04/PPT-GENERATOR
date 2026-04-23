import apiClient from './apiClient';

export interface Presentation {
  id: string;
  title: string;
  theme: string;
  created_at: string;
  updated_at?: string;
  last_edited_by?: string | null;
  status: string;
  generated_by?: string;
  user_id?: string;
  slides?: number;
  tone?: string;
  track?: string;
  type?: string;
}

export const presentationApi = {
  getMyPresentations: async (params?: { skip?: number; limit?: number }) => {
    const response = await apiClient.get('/presentations/me', { params });
    return response.data.presentations;
  },

  getAllPresentations: (params?: { skip?: number; limit?: number }) =>
    apiClient.get('/presentations/all', { params }),

  searchPresentations: (q: string, scope: 'mine' | 'all' = 'mine') =>
    apiClient.get('/presentations/search', { params: { q, scope } }),

  getMyActivity: (limit = 5) =>
    apiClient.get('/my/activity', { params: { limit } }),

  updatePresentation: (id: string, data: { title?: string; track?: string; client?: string }) =>
    apiClient.patch(`/presentations/${id}`, data),

  downloadPresentation: async (id: string) => {
    const response = await apiClient.get(`/download/${id}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  generatePresentation: async (params: any) => {
    const response = await apiClient.post('/generate', params);
    return response.data;
  },

  exportPresentation: async (params: any) => {
    const response = await apiClient.post('/export', params);
    return response.data;
  },

  exportPdf: async (params: any) => {
    const response = await apiClient.post('/export-pdf', params, {
      responseType: 'blob'
    });
    return response.data;
  },

  regenerateSlide: async (params: any) => {
    const response = await apiClient.post('/regenerate-slide', params);
    return response.data;
  },

  extractFromUrl: async (url: string) => {
    const response = await apiClient.post('/extract-url', { url });
    return response.data;
  },
};

