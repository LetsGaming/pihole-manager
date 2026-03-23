/**
 * Component Tests — QueryLogView
 *
 * Covers the refactored markRaw architecture:
 * - entries are stored in rawEntries (markRaw), not exposed as `entries`
 * - filter/sort results are in pagedEntries / totalFiltered
 * - rebuildView() is the single pipeline trigger
 *
 * Tests use the public API the component actually exposes:
 *   rawEntries, pagedEntries, totalFiltered, totalPages, page,
 *   statusFilter, searchQuery, isLive, fetchLog(), clearEntries(), toggleLive()
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import QueryLogView from "@/views/QueryLogView.vue";
import { useInstanceStore } from "@/stores/instanceStore";
import { markRaw } from "vue";

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
  SortableHeader: {
    template: "<div />",
    props: ["col", "label", "sort", "sortKey", "tag"],
    emits: ["sort-changed"],
  },
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

import type { EnrichedQueryEntry } from "@/types/api";

/** Build a minimal EnrichedQueryEntry for test data. */
function makeEntry(
  i: number,
  status: "allowed" | "blocked" | "cached" = "allowed",
): EnrichedQueryEntry {
  return {
    timestamp: 1700000000000 + i,
    type: "A",
    domain: `d${i}.com`,
    client: "192.168.1.1",
    statusCode: 2,
    status,
    _instanceId: "test",
    _instanceName: "Test",
    _key: `k-${i}`,
  };
}

describe("QueryLogView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ── Empty state ─────────────────────────────────────────────────────────────
  it("shows empty state when no instances", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".empty-state").exists()).toBe(true);
  });

  // ── Fetch & store entries ───────────────────────────────────────────────────
  it("fetchLog populates rawEntries and totalFiltered", async () => {
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
    // rawEntries holds the raw data (markRaw array)
    expect((w.vm.rawEntries as EnrichedQueryEntry[]).length).toBeGreaterThan(0);
    // totalFiltered reflects the filtered+sorted count
    expect(w.vm.totalFiltered).toBeGreaterThan(0);
  });

  // ── Filter by status ────────────────────────────────────────────────────────
  it("statusFilter=blocked shows only blocked entries in pagedEntries", async () => {
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
    // Watch fires synchronously in tests after assignment since it's a setter
    await w.vm.$nextTick();
    expect(
      (w.vm.pagedEntries as EnrichedQueryEntry[]).every(
        (e) => e.status === "blocked",
      ),
    ).toBe(true);
  });

  it("statusFilter=allowed shows only allowed entries in pagedEntries", async () => {
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
    await w.vm.$nextTick();
    expect(
      (w.vm.pagedEntries as EnrichedQueryEntry[]).every(
        (e) => e.status === "allowed",
      ),
    ).toBe(true);
  });

  it("searchQuery filters by domain in pagedEntries", async () => {
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
    await w.vm.$nextTick();
    expect(
      (w.vm.pagedEntries as EnrichedQueryEntry[]).every((e) =>
        e.domain.includes("example"),
      ),
    ).toBe(true);
  });

  it("searchQuery filters by client in pagedEntries", async () => {
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
    await w.vm.$nextTick();
    expect(
      (w.vm.pagedEntries as EnrichedQueryEntry[]).some(
        (e) => e.client === "192.168.1.10",
      ),
    ).toBe(true);
  });

  // ── Pagination ──────────────────────────────────────────────────────────────
  it("totalPages is at least 1", () => {
    const w = createWrapper();
    expect(w.vm.totalPages).toBe(1);
  });

  it("pagedEntries slices at PAGE_SIZE (50)", () => {
    const w = createWrapper();
    // Inject 60 raw entries and trigger a rebuild
    w.vm.rawEntries = markRaw(
      Array.from({ length: 60 }, (_, i) => makeEntry(i)),
    );
    w.vm.rebuildView();
    expect((w.vm.pagedEntries as EnrichedQueryEntry[]).length).toBe(50);
    w.vm.page = 2;
    w.vm.rebuildView();
    expect((w.vm.pagedEntries as EnrichedQueryEntry[]).length).toBe(10);
  });

  // ── clearEntries ────────────────────────────────────────────────────────────
  it("clearEntries empties rawEntries and resets totalFiltered", () => {
    const w = createWrapper();
    w.vm.rawEntries = markRaw([makeEntry(0)]);
    w.vm.rebuildView();
    w.vm.clearEntries();
    expect((w.vm.rawEntries as EnrichedQueryEntry[]).length).toBe(0);
    expect(w.vm.totalFiltered).toBe(0);
  });

  // ── toggleLive ──────────────────────────────────────────────────────────────
  it("toggleLive flips isLive", () => {
    const w = createWrapper();
    expect(w.vm.isLive).toBe(true);
    w.vm.toggleLive();
    expect(w.vm.isLive).toBe(false);
    w.vm.toggleLive();
    expect(w.vm.isLive).toBe(true);
  });

  // ── copyToClipboard ─────────────────────────────────────────────────────────
  it("copyToClipboard calls navigator.clipboard", async () => {
    const w = createWrapper();
    await w.vm.copyToClipboard("test.domain.com");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "test.domain.com",
    );
  });
});
