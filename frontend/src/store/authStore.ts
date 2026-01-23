import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (username: string, password: string) => {
        try {
          const response = await api.post('/auth/login', { username, password });
          const { token, user } = response.data;
          set({ user, token });
          // Also set manual localStorage keys for compatibility
          localStorage.setItem('auth_token', token);
          localStorage.setItem('user', JSON.stringify(user));
          return true;
        } catch (error) {
          console.error('Login failed:', error);
          return false;
        }
      },
      setAuth: (user, token) => {
        set({ user, token });
        // Also set manual localStorage keys for compatibility
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(user));
      },
      logout: () => {
        // Clear Zustand store
        set({ user: null, token: null });
        // Clear manual localStorage keys used by other parts of the app
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      },
    }),
    {
      name: 'tlink-auth',
    }
  )
);
