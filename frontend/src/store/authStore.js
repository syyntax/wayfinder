import { create } from 'zustand';
import { authApi } from '../utils/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('wayfinder_token'),
  workspaces: [],
  isLoading: true,
  isAuthenticated: false,

  // Initialize auth state from stored token
  initialize: async () => {
    const token = localStorage.getItem('wayfinder_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await authApi.getProfile();
      set({
        user: response.data.user,
        workspaces: response.data.workspaces || [],
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('wayfinder_token');
      set({
        user: null,
        token: null,
        workspaces: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // Login
  login: async (email, password) => {
    try {
      const response = await authApi.login({ email, password });
      const { user, token, workspaces } = response.data;

      localStorage.setItem('wayfinder_token', token);
      set({
        user,
        token,
        workspaces: workspaces || [],
        isAuthenticated: true,
      });

      return response;
    } catch (error) {
      // Re-throw with additional data for pending approval handling
      if (error.status === 403) {
        const enhancedError = new Error(error.message);
        enhancedError.status = error.status;
        enhancedError.data = { pending_approval: true };
        throw enhancedError;
      }
      throw error;
    }
  },

  // Register
  register: async (data) => {
    const response = await authApi.register(data);
    const { user, token, workspace, pending_approval } = response.data;

    // If registration requires approval, don't set authentication state
    if (pending_approval) {
      return {
        ...response,
        pending_approval: true
      };
    }

    localStorage.setItem('wayfinder_token', token);
    set({
      user,
      token,
      workspaces: workspace ? [workspace] : [],
      isAuthenticated: true,
    });

    return response;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('wayfinder_token');
    set({
      user: null,
      token: null,
      workspaces: [],
      isAuthenticated: false,
    });
  },

  // Update profile
  updateProfile: async (data) => {
    const response = await authApi.updateProfile(data);
    set({ user: response.data.user });
    return response;
  },

  // Update user (without API call, for local updates)
  updateUser: (user) => {
    set({ user });
  },

  // Add workspace to list
  addWorkspace: (workspace) => {
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
    }));
  },

  // Update workspace in list
  updateWorkspace: (workspace) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspace.id ? { ...w, ...workspace } : w
      ),
    }));
  },
}));

export default useAuthStore;
