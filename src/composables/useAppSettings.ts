/**
 * useAppSettings
 *
 * Loads and saves user-adjustable app settings to localStorage.
 * Shared by SettingsView and any composable that needs polling intervals.
 */

import { reactive } from 'vue';

export interface AppSettings {
  pollInterval:         number; // ms
  logRefreshInterval:   number; // ms
  defaultDisableDuration: number; // seconds; 0 = indefinite
  queryLogLimit:        number;
}

const SETTINGS_KEY = 'orbital_app_settings';

const DEFAULTS: AppSettings = {
  pollInterval:           30_000,
  logRefreshInterval:      5_000,
  defaultDisableDuration:      0,
  queryLogLimit:             100,
};

export function useAppSettings() {
  const settings = reactive<AppSettings>({ ...DEFAULTS });

  function load(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(settings, JSON.parse(raw) as Partial<AppSettings>);
    } catch { /* ignore corrupt data */ }
  }

  function save(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function reset(): void {
    Object.assign(settings, DEFAULTS);
    localStorage.removeItem(SETTINGS_KEY);
  }

  return { settings, load, save, reset };
}
