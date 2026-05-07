import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LoginVO, UserInfo } from '@/types/auth';

interface AuthState {
  token: string | null;
  userInfo: UserInfo | null;
  permissions: string[];
  roles: string[];
  setToken: (token: string | null) => void;
  setUserInfo: (userInfo: UserInfo | null) => void;
  setPermissions: (permissions: string[]) => void;
  setRoles: (roles: string[]) => void;
  login: (data: LoginVO) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      userInfo: null,
      permissions: [],
      roles: [],

      setToken: (token) => set({ token }),
      setUserInfo: (userInfo) => set({ userInfo }),
      setPermissions: (permissions) => set({ permissions }),
      setRoles: (roles) => set({ roles }),

      login: (data) => {
        set({
          token: data.token,
          userInfo: data.userInfo,
          permissions: data.userInfo?.permissions || [],
          roles: data.userInfo?.roles || [],
        });
      },

      logout: () => {
        set({
          token: null,
          userInfo: null,
          permissions: [],
          roles: [],
        });
      },

      checkAuth: async () => {
        const token = get().token;
        if (!token) return;

        try {
          const response = await fetch('/api/auth/check', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            get().logout();
          }
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: 'agri-auth-storage',
      partialize: (state) => ({
        token: state.token,
        userInfo: state.userInfo,
        permissions: state.permissions,
        roles: state.roles,
      }),
    }
  )
);
