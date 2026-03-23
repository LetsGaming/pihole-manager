/**
 * Component Tests — HardwareView
 * All mock data is inlined inside vi.mock factories to avoid hoisting errors.
 */

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import HardwareView from "@/views/HardwareView.vue";
import { useInstanceStore } from "@/stores/instanceStore";

vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({
      status: "enabled",
      dns_queries_today: 0,
      ads_blocked_today: 0,
      ads_percentage_today: 0,
      domains_being_blocked: 0,
      unique_clients: 0,
    }),
    errorMessage: (e: unknown) => (e as Error)?.message ?? "Error",
  },
}));

// All mock data inlined — no outer const references
vi.mock("@/services/hardwareService", () => ({
  default: {
    getHardwareInfo: vi.fn().mockResolvedValue({
      cpuLoad: 45.2,
      cpuTemp: 52.0,
      cpuModel: "ARMv7",
      cpuCores: 4,
      memTotal: 1073741824,
      memUsed: 536870912,
      memFree: 536870912,
      memPercent: 50,
      diskTotal: 16000000000,
      diskUsed: 8000000000,
      diskPercent: 50,
      hostname: "raspberrypi",
      ipAddress: "192.168.1.100",
      interface: "eth0",
      uptimeSeconds: 86400,
      uptimeFormatted: "1d",
      piholeVersion: "v5.17.1",
      ftlVersion: "v5.23",
      webVersion: "v5.20.1",
      domainsBlocked: 90000,
      gravityLastUpdate: null,
    }),
    formatBytes: (b: number | null) =>
      b ? `${Math.round(b / 1048576)} MB` : null,
    formatTemp: (c: number | null) => (c != null ? `${c.toFixed(1)} °C` : null),
    severityClass: (p: number) =>
      p >= 90 ? "crit" : p >= 70 ? "warn" : "normal",
    tempSeverity: (c: number) =>
      c >= 75 ? "crit" : c >= 60 ? "warn" : "normal",
  },
}));

import HardwareService from "@/services/hardwareService";

const STUBS = {
  "ion-page": { template: '<div class="ion-page"><slot /></div>' },
  "ion-header": { template: "<div><slot /></div>" },
  "ion-toolbar": { template: "<div><slot /></div>" },
  "ion-content": { template: '<div class="ion-content"><slot /></div>' },
  "ion-buttons": { template: "<div><slot /></div>" },
  "ion-menu-button": { template: "<button />" },
  "ion-icon": { template: "<span />" },
  PageHeader: { template: '<div><slot name="actions" /></div>' },
  EmptyState: {
    template: '<div class="empty-state">{{ title }}</div>',
    props: ["icon", "title"],
  },
  HardwareCard: {
    template: '<div class="hw-card" />',
    props: ["instance", "hwData", "loading"],
  },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(HardwareView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe("HardwareView", () => {
  it("shows empty state when no instances configured", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".empty-state").exists()).toBe(true);
  });

  it("renders a HardwareCard for each instance", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Pi Alpha",
      url: "http://pi.a",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.addInstance({
      name: "Pi Beta",
      url: "http://pi.b",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await w.vm.$nextTick();
    expect(w.findAll(".hw-card")).toHaveLength(2);
  });

  it("calls getHardwareInfo on mount for each instance", async () => {
    vi.mocked(HardwareService.getHardwareInfo).mockResolvedValue({
      cpuLoad: 20,
      cpuTemp: null,
      cpuModel: null,
      cpuCores: null,
      memTotal: null,
      memUsed: null,
      memFree: null,
      memPercent: null,
      diskTotal: null,
      diskUsed: null,
      diskPercent: null,
      hostname: null,
      ipAddress: null,
      interface: null,
      uptimeSeconds: null,
      uptimeFormatted: null,
      piholeVersion: null,
      ftlVersion: null,
      webVersion: null,
      domainsBlocked: null,
      gravityLastUpdate: null,
    });
    // Add instance BEFORE mounting so onMounted finds it
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const _w = mount(HardwareView, {
      global: { plugins: [pinia], stubs: STUBS },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(HardwareService.getHardwareInfo).toHaveBeenCalledWith(
      expect.objectContaining({ url: "http://pi.hole" }),
    );
  });

  it("stores hwData keyed by instance id after fetch", async () => {
    // Restore the factory-default mock (cpuLoad: 45.2) before this test
    vi.mocked(HardwareService.getHardwareInfo).mockResolvedValue({
      cpuLoad: 45.2,
      cpuTemp: 52.0,
      cpuModel: "ARMv7",
      cpuCores: 4,
      memTotal: 1073741824,
      memUsed: 536870912,
      memFree: 536870912,
      memPercent: 50,
      diskTotal: 16000000000,
      diskUsed: 8000000000,
      diskPercent: 50,
      hostname: "raspberrypi",
      ipAddress: "192.168.1.100",
      interface: "eth0",
      uptimeSeconds: 86400,
      uptimeFormatted: "1d",
      piholeVersion: "v5.17.1",
      ftlVersion: "v5.23",
      webVersion: "v5.20.1",
      domainsBlocked: 90000,
      gravityLastUpdate: null,
    });
    // Add instance BEFORE mounting so onMounted fetches data for it
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    const inst = store.addInstance({
      name: "Pi",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const w = mount(HardwareView, {
      global: { plugins: [pinia], stubs: STUBS },
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(w.vm.hwData[inst.id]).toBeDefined();
    expect(w.vm.hwData[inst.id].cpuLoad).toBe(45.2);
  });

  it("refreshAll fetches hardware for all instances", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "A",
      url: "http://pi.a",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.addInstance({
      name: "B",
      url: "http://pi.b",
      apiToken: "tok",
      apiVersion: "v5",
    });
    vi.mocked(HardwareService.getHardwareInfo).mockClear();
    await w.vm.refreshAll();
    expect(HardwareService.getHardwareInfo).toHaveBeenCalledTimes(2);
  });

  it("hwData reactive object starts empty", () => {
    const w = createWrapper();
    expect(Object.keys(w.vm.hwData)).toHaveLength(0);
  });

  it("loading reactive object starts empty", () => {
    const w = createWrapper();
    expect(Object.keys(w.vm.loading)).toHaveLength(0);
  });
});
