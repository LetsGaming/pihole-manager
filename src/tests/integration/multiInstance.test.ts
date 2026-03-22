/**
 * Integration Tests — Multi-Instance Workflows
 *
 * Tests realistic user workflows spanning stores and services.
 * Axios is mocked at the HTTP boundary.
 *
 * NOTE: addInstance triggers an async refreshInstance internally.
 * Tests that rely on the refresh completing must await it explicitly
 * rather than relying on timers, which can cause timeouts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";

vi.mock("axios");
import axios from "axios";

type MockClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: ReturnType<typeof vi.fn<any[], any>>;
  interceptors: { request: { use: ReturnType<typeof vi.fn> } };
};

function makeClient(getImpl: (() => Promise<unknown>) | object): MockClient {
  const get =
    typeof getImpl === "function"
      ? vi.fn(getImpl as () => Promise<unknown>)
      : vi.fn().mockResolvedValue({ data: getImpl });
  const client: MockClient = {
    get,
    interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
  };
  vi.mocked(axios.create).mockReturnValue(client as never);
  return client;
}

function onlineSummary(overrides: Record<string, unknown> = {}) {
  return {
    status: "enabled",
    dns_queries_today: 1000,
    ads_blocked_today: 100,
    ads_percentage_today: 10,
    domains_being_blocked: 80000,
    unique_clients: 5,
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.clearAllMocks();
});

// ─── Add instance → refresh ───────────────────────────────────────────────────
describe("Workflow: Add instance and refresh", () => {
  it("adds instance and fetches summary on refreshAll", async () => {
    makeClient(onlineSummary());
    const store = useInstanceStore();
    store.addInstance({
      name: "Home Pi-hole",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await store.refreshAll();
    expect(store.instances[0].status).toBe("online");
    expect(store.summaryData[store.instances[0].id]).toBeDefined();
  });

  it("marks instance offline when connection fails", async () => {
    makeClient(() => Promise.reject(new Error("ECONNREFUSED")));
    const store = useInstanceStore();
    store.addInstance({
      name: "Dead Pi",
      url: "http://dead.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await store.refreshAll();
    expect(store.instances[0].status).toBe("offline");
    expect(store.errors[store.instances[0].id]).toBeTruthy();
  });
});

// ─── Multiple instances ───────────────────────────────────────────────────────
describe("Workflow: Multiple instances aggregate", () => {
  it("aggregates queries across all online instances", async () => {
    makeClient(onlineSummary());
    const store = useInstanceStore();
    store.addInstance({
      name: "Pi A",
      url: "http://pi.a",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.addInstance({
      name: "Pi B",
      url: "http://pi.b",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await store.refreshAll();
    expect(store.onlineCount).toBe(2);
    expect(store.offlineCount).toBe(0);
  });

  it("refreshAll handles mixed online/offline gracefully", async () => {
    let count = 0;
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn(() => {
        count++;
        return count % 2 === 0
          ? Promise.reject(new Error("offline"))
          : Promise.resolve({ data: onlineSummary() });
      }),
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    const store = useInstanceStore();
    store.addInstance({
      name: "Online",
      url: "http://online.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.addInstance({
      name: "Offline",
      url: "http://offline.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await store.refreshAll();
    expect(store.onlineCount).toBe(1);
    expect(store.offlineCount).toBe(1);
  });
});

// ─── Blocking control ─────────────────────────────────────────────────────────
describe("Workflow: Blocking control", () => {
  it("enable all → all instances become enabled", async () => {
    makeClient(onlineSummary({ status: "enabled" }));
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
    await store.refreshAll();
    await store.enableAllBlocking();
    expect(store.globalBlockingStatus).toBe("enabled");
  });

  it("disable with duration passes seconds to API", async () => {
    const mockGet = vi
      .fn()
      .mockResolvedValue({ data: onlineSummary({ status: "disabled" }) });
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    const store = useInstanceStore();
    store.addInstance({
      name: "Pi",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await store.refreshAll();
    await store.disableBlocking(store.instances[0].id, 600);
    const disableCall = mockGet.mock.calls.find(
      ([, cfg]: [unknown, { params?: Record<string, unknown> }]) =>
        cfg?.params?.disable !== undefined,
    );
    expect(disableCall).toBeDefined();
    expect(disableCall![1].params.disable).toBe(600);
  });
});

// ─── Persistence ─────────────────────────────────────────────────────────────
describe("Workflow: Persistence", () => {
  it("instances survive a simulated page reload", () => {
    const store1 = useInstanceStore();
    store1.addInstance({
      name: "Persistent Pi",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const savedId = store1.instances[0].id;

    setActivePinia(createPinia());
    const store2 = useInstanceStore();
    store2.loadFromStorage();
    expect(store2.instances).toHaveLength(1);
    expect(store2.instances[0].id).toBe(savedId);
  });

  it("activeInstanceId is restored correctly", () => {
    const store1 = useInstanceStore();
    store1.addInstance({
      name: "First",
      url: "http://a.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store1.addInstance({
      name: "Second",
      url: "http://b.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const secondId = store1.instances[1].id;
    store1.setActiveInstance(secondId);

    setActivePinia(createPinia());
    const store2 = useInstanceStore();
    store2.loadFromStorage();
    expect(store2.activeInstanceId).toBe(secondId);
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────
describe("Workflow: Notification feedback", () => {
  it("notificationStore queues and auto-dismisses", async () => {
    vi.useFakeTimers();
    const notif = useNotificationStore();
    notif.success("Saved successfully", 500);
    expect(notif.toasts).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(notif.toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it("multiple toasts are independent", () => {
    vi.useFakeTimers();
    const notif = useNotificationStore();
    notif.success("A", 1000);
    notif.error("B", 2000);
    notif.warning("C", 3000);
    vi.advanceTimersByTime(1001);
    expect(notif.toasts).toHaveLength(2);
    vi.advanceTimersByTime(1001);
    expect(notif.toasts).toHaveLength(1);
    expect(notif.toasts[0].type).toBe("warning");
    vi.useRealTimers();
  });
});

// ─── Gravity update ───────────────────────────────────────────────────────────
describe("Workflow: Gravity update", () => {
  it("updateGravity endpoint is called correctly", async () => {
    const mockGet = vi
      .fn()
      .mockResolvedValue({ data: { gravity_updated: true } });
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    const { default: PiholeApiService } = await import("@/services/piholeApi");
    await PiholeApiService.updateGravity({
      id: "x",
      name: "x",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
      status: "online",
      addedAt: "",
    });
    const call = mockGet.mock.calls.find(
      ([, cfg]: [unknown, { params?: Record<string, unknown> }]) =>
        "updateGravity" in (cfg?.params ?? {}),
    );
    expect(call).toBeDefined();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────
describe("Edge cases", () => {
  it("removing the last instance resets activeInstanceId to null", () => {
    const store = useInstanceStore();
    store.addInstance({
      name: "Solo",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.removeInstance(store.instances[0].id);
    expect(store.activeInstanceId).toBeNull();
  });

  it("refreshInstance on a removed instance is a no-op", async () => {
    const store = useInstanceStore();
    await expect(store.refreshInstance("ghost-id")).resolves.toBeUndefined();
  });

  it("two rapid refreshAll calls do not corrupt state", async () => {
    makeClient(onlineSummary());
    const store = useInstanceStore();
    store.addInstance({
      name: "Pi",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    await Promise.all([store.refreshAll(), store.refreshAll()]);
    expect(store.instances[0].status).toBe("online");
  });
});
