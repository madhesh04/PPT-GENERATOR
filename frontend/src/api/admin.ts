import apiClient from './apiClient';

export const adminApi = {
  getStats: async () => {
    const response = await apiClient.get('/admin/stats');
    return response.data;
  },

  getUsers: async () => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },

  getPendingUsers: async () => {
    const response = await apiClient.get('/admin/pending');
    return response.data;
  },

  approveUser: async (id: string) => {
    const response = await apiClient.post(`/admin/approve/${id}`);
    return response.data;
  },

  rejectUser: async (id: string) => {
    const response = await apiClient.post(`/admin/reject/${id}`);
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await apiClient.delete(`/admin/users/${id}`);
    return response.data;
  },

  updateUserPassword: async (id: string, password: string) => {
    const response = await apiClient.patch(`/admin/users/${id}/password`, { password });
    return response.data;
  },

  updateUserStatus: async (id: string, status: string) => {
    const response = await apiClient.patch(`/admin/users/${id}/status`, { status });
    return response.data;
  },

  updateUserRole: async (id: string, role: string) => {
    const response = await apiClient.patch(`/admin/users/${id}/role`, { role });
    return response.data;
  },

  createUser: async (userData: any) => {
    const response = await apiClient.post('/admin/users/create', userData);
    return response.data;
  },

  getGenerations: async (userId?: string) => {
    const url = userId ? `/admin/users/${userId}/ppts` : '/admin/generations';
    const response = await apiClient.get(url);
    return response.data;
  },

  deleteGeneration: async (id: string) => {
    const response = await apiClient.delete(`/admin/generations/${id}`);
    return response.data;
  },
  
  getPublicSettings: async () => {
    const response = await apiClient.get('/admin/public/settings');
    return response.data;
  }
};
