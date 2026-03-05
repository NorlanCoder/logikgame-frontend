import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Intercepteur : ajoute le token d'auth automatiquement
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const adminToken = localStorage.getItem('admin_token');
    const playerToken = localStorage.getItem('player_token');
    const token = adminToken || playerToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Intercepteur de réponse : gestion centralisée des erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const isAdmin = window.location.pathname.startsWith('/admin');
        localStorage.removeItem(isAdmin ? 'admin_token' : 'player_token');
        window.location.href = isAdmin ? '/admin/login' : '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
