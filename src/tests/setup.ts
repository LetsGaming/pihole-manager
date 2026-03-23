/**
 * Vitest global test setup
 * `vitest/globals` in tsconfig.types means describe/it/beforeEach etc.
 * are ambient — no explicit import needed here.
 */

import { vi } from "vitest";
import { config } from "@vue/test-utils";

// ─── Ionic stubs ──────────────────────────────────────────────────────────────
const slot = { template: "<div><slot /></div>" };
const btn = {
  template: "<button @click=\"$emit('click')\"><slot /></button>",
  emits: ["click"],
};

config.global.stubs = {
  "ion-page": { template: '<div class="ion-page"><slot /></div>' },
  "ion-header": slot,
  "ion-toolbar": slot,
  "ion-title": slot,
  "ion-content": { template: '<div class="ion-content"><slot /></div>' },
  "ion-footer": slot,
  "ion-buttons": slot,
  "ion-label": slot,
  "ion-button": btn,
  "ion-menu-button": { template: "<button />" },
  "ion-menu": slot,
  "ion-menu-toggle": slot,
  "ion-split-pane": slot,
  "ion-router-outlet": { template: "<div />" },
  "ion-list": { template: "<ul><slot /></ul>" },
  "ion-item": { template: "<li><slot /></li>" },
  "ion-icon": { template: '<span class="ion-icon" />' },
  "ion-badge": slot,
  "ion-chip": slot,
  "ion-modal": {
    template: '<div v-if="isOpen"><slot /></div>',
    props: ["isOpen"],
    emits: ["did-dismiss"],
  },
  "ion-alert": {
    template: '<div v-if="isOpen" class="ion-alert"></div>',
    props: ["isOpen", "header", "message", "buttons"],
    emits: ["did-dismiss"],
  },
  "ion-app": { template: '<div id="app"><slot /></div>' },
  "ion-loading": { template: "<div />" },
  "ion-spinner": { template: '<div class="spinner" />' },
  "ion-segment": slot,
  "ion-segment-button": btn,
  "ion-select": { template: "<select><slot /></select>" },
  "ion-select-option": { template: "<option><slot /></option>" },
};

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ─── sessionStorage mock ──────────────────────────────────────────────────────
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

// ─── Clipboard mock ───────────────────────────────────────────────────────────
Object.defineProperty(globalThis.navigator, "clipboard", {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true,
  configurable: true,
});

// ─── Reset between tests ─────────────────────────────────────────────────────
// `beforeEach` is available globally via vitest/globals (tsconfig types)
beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.clearAllMocks();
});
