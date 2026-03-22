/**
 * Component Tests — QueryLogView (refactored)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import QueryLogView from "@/views/QueryLogView.vue";
import { useInstanceStore } from "@/stores/instanceStore";

// All mock data inlined to avoid vi.mock hoisting issues
vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi
      .fn()
      .mockResolvedValue({
        status: "enabled",
        dns_queries_today: 0,
        ads_blocked_today: 0,
        ads_percentage_today: 0,
        domains_being_blocked: 0,
        unique_clients: 0,
      }),
    getQueryLog: vi.fn().mockResolvedValue([
      {
        timestamp: 1700000000000,
        type: "A",
        domain: "example.com",
        client: "192.168.1.10",
        statusCode: 2,
        status: "allowed",
      },
      {
        timestamp: 1700000001000,
        type: "A",
        domain: "ads.tracker.io",
        client: "192.168.1.11",
        statusCode: 1,
        status: "blocked",
      },
      {
        timestamp: 1700000002000,
        type: "AAAA",
        domain: "safe.org",
        client: "192.168.1.12",
        statusCode: 3,
        status: "cached",
      },
    ]),
    addToList: vi.fn().mockResolvedValue({ success: true }),
    errorMessage: (e: unknown) => (e as Error)?.message ?? "Error",
  },
}));

vi.mock("date-fns", () => ({
  format: vi.fn((_d: Date, _fmt: string) => "12:00:00"),
}));

const STUBS = {
  "ion-page": { template: '<div class="ion-page"><slot /></div>' },
  "ion-header": { template: "<div><slot /></div>" },
  "ion-toolbar": { template: "<div><slot /></div>" },
  "ion-content": { template: '<div class="ion-content"><slot /></div>' },
  "ion-buttons": { template: "<div><slot /></div>" },
  "ion-menu-button": { template: "<button />" },
  "ion-icon": { template: "<span />" },
  PageHeader: { template: "<div />" },
  EmptyState: {
    template: '<div class="empty-state">{{ title }}</div>',
    props: ["icon", "title", "subtitle"],
  },
  QueryLogToolbar: {
    template: '<div class="log-toolbar" />',
    props: [
      "instances",
      "instanceId",
      "statusFilter",
      "searchQuery",
      "fetchCount",
      "isLive",
      "entryCount",
    ],
    emits: [
      "update:instanceId",
      "update:statusFilter",
      "update:searchQuery",
      "update:fetchCount",
      "toggle-live",
      "clear",
    ],
  },
  QueryLogRow: {
    template: '<div class="log-row" />',
    props: ["entry"],
    emits: ["whitelist", "blacklist", "copy"],
  },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(QueryLogView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe("QueryLogView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows empty state when no instances", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".empty-state").exists()).toBe(true);
  });

  it("fetches and stores entries when instances exist", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.instances[0].status = "online";
    await w.vm.fetchLog();
    expect(w.vm.entries.length).toBeGreaterThan(0);
  });

  it("filteredEntries filters by status=blocked", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.instances[0].status = "online";
    await w.vm.fetchLog();
    w.vm.statusFilter = "blocked";
    expect(
      w.vm.filteredEntries.every(
        (e: { status: string }) => e.status === "blocked",
      ),
    ).toBe(true);
  });

  it("filteredEntries filters by status=allowed", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.instances[0].status = "online";
    await w.vm.fetchLog();
    w.vm.statusFilter = "allowed";
    expect(
      w.vm.filteredEntries.every(
        (e: { status: string }) => e.status === "allowed",
      ),
    ).toBe(true);
  });

  it("filteredEntries filters by domain search", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.instances[0].status = "online";
    await w.vm.fetchLog();
    w.vm.searchQuery = "example";
    expect(
      w.vm.filteredEntries.every((e: { domain: string }) =>
        e.domain.includes("example"),
      ),
    ).toBe(true);
  });

  it("filteredEntries filters by client search", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Test",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.instances[0].status = "online";
    await w.vm.fetchLog();
    w.vm.searchQuery = "192.168.1.10";
    expect(
      w.vm.filteredEntries.some(
        (e: { client: string }) => e.client === "192.168.1.10",
      ),
    ).toBe(true);
  });

  it("totalPages is at least 1", () => {
    const w = createWrapper();
    expect(w.vm.totalPages).toBe(1);
  });

  it("pagedEntries slices at PAGE_SIZE (50)", () => {
    const w = createWrapper();
    w.vm.entries = Array.from({ length: 60 }, (_, i) => ({
      timestamp: i,
      domain: `d${i}.com`,
      client: "10.0.0.1",
      type: "A",
      status: "allowed",
      statusCode: 2,
      _instanceId: "test",
      _instanceName: "Test",
      _key: `k-${i}`,
    }));
    expect(w.vm.pagedEntries).toHaveLength(50);
    w.vm.page = 2;
    expect(w.vm.pagedEntries).toHaveLength(10);
  });

  it("clearLog empties entries", () => {
    const w = createWrapper();
    w.vm.entries = [{ domain: "x.com", status: "allowed" }] as never;
    w.vm.entries = [];
    expect(w.vm.entries).toHaveLength(0);
  });

  it("toggleLive flips isLive", () => {
    const w = createWrapper();
    expect(w.vm.isLive).toBe(true);
    w.vm.toggleLive();
    expect(w.vm.isLive).toBe(false);
    w.vm.toggleLive();
    expect(w.vm.isLive).toBe(true);
  });

  it("copyToClipboard calls navigator.clipboard", async () => {
    const w = createWrapper();
    await w.vm.copyToClipboard("test.domain.com");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "test.domain.com",
    );
  });
});
