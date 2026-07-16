import { create } from 'zustand';

const useSessionStore = create((set) => ({
  token: localStorage.getItem('rc_token') || null,
  sessionCode: null,
  sessionStatus: null,
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
