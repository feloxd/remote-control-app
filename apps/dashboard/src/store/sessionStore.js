import { create } from 'zustand';

const previewMode = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('preview') === '1';

const useSessionStore = create((set) => ({
  token: previewMode ? 'local-preview' : (localStorage.getItem('rc_token') || null),
  sessionCode: previewMode ? 'DEMO31' : null,
  sessionStatus: previewMode ? 'active' : null,
  activityLog: [],

  setToken: (token) => {
    localStorage.setItem('rc_token', token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem('rc_token');
    set({ token: null, sessionCode: null, sessionStatus: null, activityLog: [] });
  },

  setSession: (code, status) => set({ sessionCode: code, sessionStatus: status }),

  setSessionStatus: (status) => set({ sessionStatus: status }),

  addLog: (entry) =>
    set((state) => ({
      activityLog: [entry, ...state.activityLog].slice(0, 200),
    })),

  clearLog: () => set({ activityLog: [] }),
}));

export default useSessionStore;
