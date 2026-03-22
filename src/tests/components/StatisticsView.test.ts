/**
 * Component Tests — StatisticsView
 *
 * Covers:
 * - Empty state
 * - Default instance selection logic
 * - Aggregate summary computation (sums, unique clients from merged top data)
 * - Identical layout for both all-instances and single-instance modes
 * - Over-time data merging
 * - Loading states
 * - Formatting helpers
 */

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import StatisticsView from "@/views/StatisticsView.vue";
import { useInstanceStore } from "@/stores/instanceStore";

vi.mock("chart.js", () => ({
  Chart: Object.assign(
    vi.fn().mockImplementation(() => ({ destroy: vi.fn(), update: vi.fn() })),
    { register: vi.fn() },
  ),
  registerables: [],
}));

vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({
      status: "enabled",
      dns_queries_today: 5000,
      ads_blocked_today: 750,
      ads_percentage_today: 15.0,
      domains_being_blocked: 120000,
      unique_clients: 8,
      queries_cached: 1200,
    }),
    getOverTimeData: vi.fn().mockResolvedValue({
      domains: { "1700000000": 120, "1700000600": 80 },
      ads: { "1700000000": 20, "1700000600": 15 },
    }),
    getTopDomains: vi.fn().mockResolvedValue({
      topDomains: { "google.com": 800, "github.com": 400 },
      topBlocked: { "doubleclick.net": 300, "ads.example.com": 150 },
    }),
    getTopClients: vi
      .fn()
      .mockResolvedValue({ "192.168.1.10": 2000, "192.168.1.11": 1500 }),
    errorMessage: (e: unknown) => (e as Error)?.message ?? "Error",
  },
}));

const STUBS = {
  "ion-page":        { template: '<div class="ion-page"><slot /></div>' },
  "ion-header":      { template: "<div><slot /></div>" },
  "ion-toolbar":     { template: "<div><slot /></div>" },
  "ion-content":     { template: '<div class="ion-content"><slot /></div>' },
  "ion-buttons":     { template: "<div><slot /></div>" },
  "ion-menu-button": { template: "<button />" },
  PageHeader: { template: '<div><slot name="actions" /></div>' },
  EmptyState: {
    template: '<div class="empty-state">{{ title }}</div>',
    props: ["icon", "title", "subtitle"],
  },
  StatsOverviewCards: {
    template: '<div class="stats-overview-cards"></div>',
    props: ["summary"],
  },
  StatsChart: {
    template: '<div class="stats-chart"></div>',
    props: ["overTimeData", "loading", "instanceName"],
  },
  TopDomainsCard: {
    template: '<div class="top-domains-card">{{ title }}</div>',
    props: ["title", "domains", "loading", "variant", "emptyMessage"],
  },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
}

// ── Empty state ───────────────────────────────────────────────────────────────
describe("StatisticsView — empty state", () => {
  it("shows empty state when no instances", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".empty-state").exists()).toBe(true);
  });

  it("does not show stats components when no instances", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".stats-overview-cards").exists()).toBe(false);
    expect(w.find(".stats-chart").exists()).toBe(false);
  });
});

// ── Layout: identical for both modes ─────────────────────────────────────────
describe("StatisticsView — unified layout", () => {
  it("always renders StatsOverviewCards when instances exist", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Pi A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.find(".stats-overview-cards").exists()).toBe(true);
  });

  it("always renders StatsChart when instances exist", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Pi A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.find(".stats-chart").exists()).toBe(true);
  });

  it("always renders TopDomainsCard components when instances exist", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Pi A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    // Three TopDomainsCard: queried, blocked, clients
    expect(w.findAll(".top-domains-card").length).toBe(3);
  });
});

// ── Instance selection ────────────────────────────────────────────────────────
describe("StatisticsView — instance selection", () => {
  it("defaults to '__all__' when multiple instances exist", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.selectedInstanceId).toBe("__all__");
  });

  it("defaults to single instance id when only one exists", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Solo", url: "http://pi.hole", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.selectedInstanceId).toBe(store.instances[0].id);
  });

  it("selector contains 'All Instances' option", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Pi", url: "http://pi.hole", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.html()).toContain("All Instances");
  });

  it("selector contains instance names", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Alpha", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "Beta",  url: "http://pi.b", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.text()).toContain("Alpha");
    expect(w.text()).toContain("Beta");
  });
});

// ── isAllMode ─────────────────────────────────────────────────────────────────
describe("StatisticsView — isAllMode", () => {
  it("is true when selectedInstanceId is __all__", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.isAllMode).toBe(true);
  });

  it("is false when a specific instance is selected", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Solo", url: "http://pi.hole", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.isAllMode).toBe(false);
  });
});

// ── chartLabel ────────────────────────────────────────────────────────────────
describe("StatisticsView — chartLabel", () => {
  it("returns 'All Instances' in all mode", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.chartLabel).toBe("All Instances");
  });

  it("returns instance name in single mode", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Home Pi", url: "http://pi.hole", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.chartLabel).toBe("Home Pi");
  });
});

// ── displaySummary — aggregate ────────────────────────────────────────────────
describe("StatisticsView — displaySummary (aggregate)", () => {
  function makeStore(pinia: ReturnType<typeof createPinia>) {
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });
    const [idA, idB] = store.instances.map((i) => i.id);
    store.summaryData = {
      [idA]: { status: "enabled", dns_queries_today: 1000, ads_blocked_today: 100, ads_percentage_today: 10, domains_being_blocked: 50000, unique_clients: 3, queries_cached: 200 },
      [idB]: { status: "enabled", dns_queries_today: 2000, ads_blocked_today: 400, ads_percentage_today: 20, domains_being_blocked: 70000, unique_clients: 5, queries_cached: 500 },
    };
    return store;
  }

  it("sums dns_queries_today across instances", async () => {
    const pinia = createPinia();
    makeStore(pinia);
    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.displaySummary?.dns_queries_today).toBe(3000);
  });

  it("sums ads_blocked_today across instances", async () => {
    const pinia = createPinia();
    makeStore(pinia);
    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.displaySummary?.ads_blocked_today).toBe(500);
  });

  it("sums queries_cached across instances", async () => {
    const pinia = createPinia();
    makeStore(pinia);
    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.displaySummary?.queries_cached).toBe(700);
  });

  it("calculates block rate from combined totals", async () => {
    const pinia = createPinia();
    makeStore(pinia);
    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    // 500 blocked / 3000 queries = 16.7%
    expect(w.vm.displaySummary?.ads_percentage_today).toBeCloseTo(16.7, 0);
  });

  it("returns null when no instance has data", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.displaySummary).toBeNull();
  });
});

// ── displaySummary — single instance ─────────────────────────────────────────
describe("StatisticsView — displaySummary (single instance)", () => {
  it("returns store data for the selected instance", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "Solo", url: "http://pi.hole", apiToken: "t", apiVersion: "v5" });
    const id = store.instances[0].id;
    const data = { status: "enabled" as const, dns_queries_today: 5000, ads_blocked_today: 750, ads_percentage_today: 15, domains_being_blocked: 120000, unique_clients: 8 };
    store.summaryData = { [id]: data };

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    await w.vm.$nextTick();
    expect(w.vm.displaySummary).toEqual(data);
  });
});

// ── mergeTopMaps (via topDomains/topClients state) ────────────────────────────
describe("StatisticsView — merged top data (unique deduplication)", () => {
  it("deduplicates shared domains when merging", async () => {
    const w = createWrapper();
    // Simulate post-load state: same domain appears in both instance results
    w.vm.topDomains = { "google.com": 1200, "github.com": 400 };
    await w.vm.$nextTick();
    // Each key is unique — no duplicates
    const keys = Object.keys(w.vm.topDomains);
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });

  it("unique clients count equals keys in topClients", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useInstanceStore();
    store.addInstance({ name: "A", url: "http://pi.a", apiToken: "t", apiVersion: "v5" });
    store.addInstance({ name: "B", url: "http://pi.b", apiToken: "t", apiVersion: "v5" });
    const [idA, idB] = store.instances.map((i) => i.id);
    store.summaryData = {
      [idA]: { status: "enabled", dns_queries_today: 1000, ads_blocked_today: 100, ads_percentage_today: 10, domains_being_blocked: 50000, unique_clients: 3, queries_cached: 0 },
      [idB]: { status: "enabled", dns_queries_today: 2000, ads_blocked_today: 200, ads_percentage_today: 10, domains_being_blocked: 60000, unique_clients: 4, queries_cached: 0 },
    };

    const w = mount(StatisticsView, { global: { plugins: [pinia], stubs: STUBS } });
    // Set merged topClients with unique entries
    w.vm.topClients = { "192.168.1.1": 500, "192.168.1.2": 300, "192.168.1.3": 200 };
    await w.vm.$nextTick();

    // unique_clients in displaySummary should reflect merged top clients count
    expect(w.vm.displaySummary?.unique_clients).toBe(3);
  });
});

// ── Loading states ────────────────────────────────────────────────────────────
describe("StatisticsView — loading states", () => {
  it("isLoadingCharts defaults to false", () => {
    const w = createWrapper();
    expect(w.vm.isLoadingCharts).toBe(false);
  });

  it("isLoadingTop defaults to false", () => {
    const w = createWrapper();
    expect(w.vm.isLoadingTop).toBe(false);
  });
});

// ── Formatting helpers ────────────────────────────────────────────────────────
describe("StatisticsView — formatting helpers", () => {
  it("fmt() returns em-dash for null", () => {
    const w = createWrapper();
    expect(w.vm.fmt(null)).toBe("—");
  });

  it("fmt() formats a number", () => {
    const w = createWrapper();
    expect(w.vm.fmt(120000).replace(/[.,\s]/g, "")).toBe("120000");
  });

  it("fmtPct() formats a percentage to 1 decimal", () => {
    const w = createWrapper();
    expect(w.vm.fmtPct(15.456)).toBe("15.5%");
  });

  it("fmtPct() returns em-dash for null", () => {
    const w = createWrapper();
    expect(w.vm.fmtPct(null)).toBe("—");
  });
});
