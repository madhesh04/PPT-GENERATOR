import { create } from 'zustand';

/**
 * AUTH ARCHITECTURE NOTE:
 * Current implementation uses localStorage for JWT storage to facilitate rapid development 
 * and persistent sessions across reloads. 
 * 
 * SECURITY ADVISORY:
 * Storing sensitive tokens in localStorage is vulnerable to XSS. 
 * PRODUCTION_ROADMA_ITEM: Migrate to httpOnly secure cookies for token handling 
 * and use a CSRF token mechanism for state-changing requests.
 */

interface User {
  email: string;
  full_name: string;
  role?: string;
  status?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  initialize: () => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        const isExpired = payload.exp && payload.exp * 1000 < Date.now();
        if (!isExpired) {
          const savedUser = localStorage.getItem('auth_user');
          set({ user: JSON.parse(savedUser!), isAuthenticated: true });
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      } catch (err) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    set({ loading: false });
  },

  login: (token, user) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({ user: null, isAuthenticated: false });
  },
}));
