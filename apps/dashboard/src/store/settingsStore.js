import { create } from 'zustand';

const STORAGE_KEY = 'rc_dashboard_settings';

const DEFAULTS = {
  confirmSensitiveActions: true,
  autoReconnect: true,
  showActivity: true,
  censorConfidence: 35,
  censorIntensity: 'high',
  censorFps: '5',
  censorFallback: 'skin',
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

const useSettingsStore = create((set, get) => ({
  ...loadSettings(),
  updateSetting: (name, value) => {
    set({ [name]: value });
    const state = get();
    const saved = Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, state[key]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  },
  resetSettings: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    set(DEFAULTS);
  },
}));

export { DEFAULTS };
export default useSettingsStore;
