import apiClient from './apiClient';

export interface Presentation {
  id: string;
  title: string;
  theme: string;
  created_at: string;
  status: string;
  generated_by?: string;
  slides?: number;
  tone?: string;
}

export const presentationApi = {
  getMyPresentations: async () => {
    const response = await apiClient.get('/presentations/me');
    return response.data.presentations;
  },

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
  }
};
