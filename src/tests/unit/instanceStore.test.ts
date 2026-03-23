/**
 * Unit Tests — instanceStore
 *
 * Covers: CRUD, status resilience, blocking control, getters, persistence, polling.
 * Uses immutable reactive-update pattern introduced in the refactored store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";
import type { NewInstanceConfig, PiholeInstance } from "@/types/instance";
import type { PiholeSummary } from "@/types/api";

vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn(),
    enableBlocking: vi.fn(),
    disableBlocking: vi.fn(),
    testConnection: vi.fn(),
    errorMessage: (err: unknown) => (err as Error)?.message ?? "Unknown error",
  },
}));

import PiholeApiService from "@/services/piholeApi";

const VALID_SUMMARY: PiholeSummary = {
  status: "enabled",
  dns_queries_today: 500,
  ads_blocked_today: 50,
  ads_percentage_today: 10,
  domains_being_blocked: 80000,
  unique_clients: 5,
};

function cfg(overrides: Partial<NewInstanceConfig> = {}): NewInstanceConfig {
  return {
    name: "Test Pi-hole",
    url: "http://192.168.1.100",
    apiToken: "abc123",
    apiVersion: "v5",
    ...overrides,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.mocked(PiholeApiService.getSummary).mockResolvedValue(VALID_SUMMARY);
  vi.mocked(PiholeApiService.enableBlocking).mockResolvedValue({
    status: "enabled",
  });
  vi.mocked(PiholeApiService.disableBlocking).mockResolvedValue({
    status: "disabled",
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── addInstance ───────────────────────────────────────────────────────────────
describe("instanceStore.addInstance", () => {
  it("adds an instance with generated id", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    expect(store.instances).toHaveLength(1);
    expect(store.instances[0].id).toMatch(/^ph_/);
    expect(store.instances[0].name).toBe("Test Pi-hole");
  });

  it("sets the first instance as active", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    expect(store.activeInstanceId).toBe(store.instances[0].id);
  });

  it("sets status to unknown initially", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    expect(store.instances[0].status).toBe("unknown");
  });

  it("strips trailing slash from URL", () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ url: "http://pi.hole/" }));
    expect(store.instances[0].url).toBe("http://pi.hole");
  });

  it("does not change active when adding a second instance", () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "First" }));
    const firstId = store.instances[0].id;
    store.addInstance(cfg({ name: "Second" }));
    expect(store.activeInstanceId).toBe(firstId);
  });

  it("persists to localStorage", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const saved = JSON.parse(localStorage.getItem("orbital_instances") ?? "{}");
    expect(saved.instances).toHaveLength(1);
  });

  it("initialises loading[id] = false after refresh settles", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    expect(store.loading[id]).toBe(false);
  });

  it("initialises errors[id] = null", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    expect(store.errors[id]).toBeNull();
  });
});

// ── updateInstance ────────────────────────────────────────────────────────────
describe("instanceStore.updateInstance", () => {
  it("updates allowed fields", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    store.updateInstance(id, { name: "Updated Name", apiToken: "new-token" });
    expect(store.instances[0].name).toBe("Updated Name");
    expect(store.instances[0].apiToken).toBe("new-token");
  });

  it("resets fail counter after update", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    store.updateInstance(id, { name: "New" });
    expect(store._failCount[id]).toBe(0);
  });

  it("throws when instance not found", () => {
    const store = useInstanceStore();
    expect(() => store.updateInstance("nonexistent", { name: "x" })).toThrow();
  });
});

// ── removeInstance ────────────────────────────────────────────────────────────
describe("instanceStore.removeInstance", () => {
  it("removes the instance", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    store.removeInstance(store.instances[0].id);
    expect(store.instances).toHaveLength(0);
  });

  it("clears summaryData for removed instance", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    store.removeInstance(id);
    expect(store.summaryData[id]).toBeUndefined();
  });

  it("clears loading/errors/failCount for removed instance", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    store.removeInstance(id);
    expect(store.loading[id]).toBeUndefined();
    expect(store.errors[id]).toBeUndefined();
    expect(store._failCount[id]).toBeUndefined();
  });

  it("promotes next instance as active when active is removed", () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "A" }));
    store.addInstance(cfg({ name: "B" }));
    const firstId = store.instances[0].id;
    store.removeInstance(firstId);
    expect(store.activeInstanceId).toBe(store.instances[0].id);
  });

  it("sets activeInstanceId to null when last instance removed", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    store.removeInstance(store.instances[0].id);
    expect(store.activeInstanceId).toBeNull();
  });
});

// ── setActiveInstance ─────────────────────────────────────────────────────────
describe("instanceStore.setActiveInstance", () => {
  it("sets the active instance", () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "A" }));
    store.addInstance(cfg({ name: "B" }));
    const secondId = store.instances[1].id;
    store.setActiveInstance(secondId);
    expect(store.activeInstanceId).toBe(secondId);
  });

  it("ignores unknown id", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const originalId = store.activeInstanceId;
    store.setActiveInstance("nonexistent");
    expect(store.activeInstanceId).toBe(originalId);
  });
});

// ── refreshInstance ───────────────────────────────────────────────────────────
describe("instanceStore.refreshInstance", () => {
  it("sets status to online on success", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    await store.refreshInstance(store.instances[0].id);
    expect(store.instances[0].status).toBe("online");
  });

  it("stores summary data", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    expect(store.summaryData[id].dns_queries_today).toBe(500);
  });

  it("updates summaryData reactively (new object reference)", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    const before = store.summaryData;
    await store.refreshInstance(id);
    expect(store.summaryData).not.toBe(before);
    expect(store.summaryData[id]).toBeDefined();
  });

  it("keeps status as-is on first failure (resilience)", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);

    vi.mocked(PiholeApiService.getSummary).mockRejectedValue(
      new Error("refused"),
    );
    await store.refreshInstance(id);
    expect(store.instances[0].status).not.toBe("offline");
    expect(store.errors[id]).toBeTruthy();
  });

  it("sets status to offline after OFFLINE_THRESHOLD consecutive failures", async () => {
    vi.mocked(PiholeApiService.getSummary).mockRejectedValue(
      new Error("refused"),
    );
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    await store.refreshInstance(id);
    expect(store.instances[0].status).toBe("offline");
  });

  it("resets fail counter and goes back online after recovery", async () => {
    vi.mocked(PiholeApiService.getSummary).mockRejectedValue(
      new Error("refused"),
    );
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    await store.refreshInstance(id);
    expect(store.instances[0].status).toBe("offline");

    vi.mocked(PiholeApiService.getSummary).mockResolvedValue(VALID_SUMMARY);
    await store.refreshInstance(id);
    expect(store.instances[0].status).toBe("online");
    expect(store._failCount[id]).toBe(0);
  });

  it("stores error message on failure", async () => {
    vi.mocked(PiholeApiService.getSummary).mockRejectedValue(
      new Error("Timeout"),
    );
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    expect(store.errors[id]).toBeTruthy();
  });

  it("clears loading flag after completion", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.refreshInstance(id);
    expect(store.loading[id]).toBe(false);
  });

  it("is a no-op for unknown id", async () => {
    const store = useInstanceStore();
    await expect(store.refreshInstance("ghost")).resolves.toBeUndefined();
  });
});

// ── Blocking control ──────────────────────────────────────────────────────────
describe("instanceStore.enableBlocking", () => {
  it("calls API and refreshes", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.enableBlocking(id);
    expect(PiholeApiService.enableBlocking).toHaveBeenCalled();
    expect(PiholeApiService.getSummary).toHaveBeenCalled();
  });

  it("throws for unknown instance", async () => {
    const store = useInstanceStore();
    await expect(store.enableBlocking("bad-id")).rejects.toThrow(
      "Instance not found",
    );
  });
});

describe("instanceStore.disableBlocking", () => {
  it("calls API with seconds", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    const id = store.instances[0].id;
    await store.disableBlocking(id, 300);
    expect(PiholeApiService.disableBlocking).toHaveBeenCalledWith(
      expect.objectContaining({ id }),
      300,
    );
  });
});

describe("instanceStore.enableAllBlocking", () => {
  it("calls enableBlocking for each online instance", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "A" }));
    store.addInstance(cfg({ name: "B" }));
    await store.refreshAll();
    vi.mocked(PiholeApiService.enableBlocking).mockClear();
    await store.enableAllBlocking();
    expect(PiholeApiService.enableBlocking).toHaveBeenCalledTimes(2);
  });
});

// ── Getters ───────────────────────────────────────────────────────────────────
describe("instanceStore getters", () => {
  it("onlineCount and offlineCount", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "Online" }));
    store.addInstance(cfg({ name: "Offline" }));

    vi.mocked(PiholeApiService.getSummary)
      .mockResolvedValueOnce(VALID_SUMMARY)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(VALID_SUMMARY)
      .mockRejectedValueOnce(new Error("down"));

    await store.refreshAll();
    await store.refreshAll();
    expect(store.onlineCount).toBe(1);
    expect(store.offlineCount).toBe(1);
  });

  it("sortedInstances puts online first", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "Offline" }));
    store.addInstance(cfg({ name: "Online" }));
    vi.mocked(PiholeApiService.getSummary)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(VALID_SUMMARY);
    await store.refreshAll();
    expect(store.sortedInstances[0].status).toBe("online");
  });

  it("activeInstance returns the correct instance", () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "Alpha" }));
    expect(store.activeInstance?.name).toBe("Alpha");
  });

  it("activeSummary returns null with no active instance", () => {
    const store = useInstanceStore();
    expect(store.activeSummary).toBeNull();
  });

  it("globalBlockingStatus is enabled when all online are enabled", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    await store.refreshAll();
    expect(store.globalBlockingStatus).toBe("enabled");
  });

  it("globalBlockingStatus is mixed when statuses differ", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg({ name: "A" }));
    store.addInstance(cfg({ name: "B" }));
    vi.mocked(PiholeApiService.getSummary)
      .mockResolvedValueOnce({ ...VALID_SUMMARY, status: "enabled" })
      .mockResolvedValueOnce({ ...VALID_SUMMARY, status: "disabled" });
    await store.refreshAll();
    expect(store.globalBlockingStatus).toBe("mixed");
  });

  it("globalBlockingStatus is unknown when no instances are online", () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    expect(store.globalBlockingStatus).toBe("unknown");
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────
describe("instanceStore persistence", () => {
  it("loadFromStorage restores instances", () => {
    const mockStorage = {
      instances: [
        {
          id: "ph_abc",
          name: "Restored",
          url: "http://pi.hole",
          apiToken: "tok",
          apiVersion: "v5",
          status: "unknown",
          addedAt: "",
        },
      ],
      activeInstanceId: "ph_abc",
    };
    localStorage.setItem("orbital_instances", JSON.stringify(mockStorage));

    const store = useInstanceStore();
    store.loadFromStorage();
    expect(store.instances).toHaveLength(1);
    expect(store.instances[0].name).toBe("Restored");
    expect(store.activeInstanceId).toBe("ph_abc");
  });

  it("initialises transient state for restored instances", () => {
    localStorage.setItem(
      "orbital_instances",
      JSON.stringify({
        instances: [
          {
            id: "ph_abc",
            name: "R",
            url: "http://pi.hole",
            apiToken: "t",
            apiVersion: "v5",
            status: "unknown",
            addedAt: "",
          },
        ],
        activeInstanceId: "ph_abc",
      }),
    );
    const store = useInstanceStore();
    store.loadFromStorage();
    expect(store.loading["ph_abc"]).toBe(false);
    expect(store.errors["ph_abc"]).toBeNull();
    expect(store._failCount["ph_abc"]).toBe(0);
  });

  it("falls back to first instance if saved activeId is gone", () => {
    localStorage.setItem(
      "orbital_instances",
      JSON.stringify({
        instances: [
          {
            id: "ph_xyz",
            name: "Only",
            url: "http://pi.hole",
            apiToken: "t",
            apiVersion: "v5",
            status: "unknown",
            addedAt: "",
          },
        ],
        activeInstanceId: "ph_gone",
      }),
    );
    const store = useInstanceStore();
    store.loadFromStorage();
    expect(store.activeInstanceId).toBe("ph_xyz");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("orbital_instances", "not-valid-json{{{");
    const store = useInstanceStore();
    expect(() => store.loadFromStorage()).not.toThrow();
    expect(store.instances).toHaveLength(0);
  });
});

// ── Polling ───────────────────────────────────────────────────────────────────
describe("instanceStore polling", () => {
  it("startPolling calls refreshAll on interval", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    await store.refreshAll();
    vi.mocked(PiholeApiService.getSummary).mockClear();

    store.startPolling();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    expect(vi.mocked(PiholeApiService.getSummary)).toHaveBeenCalled();
    store.stopPolling();
  });

  it("stopPolling prevents further calls", async () => {
    const store = useInstanceStore();
    store.addInstance(cfg());
    store.startPolling();
    store.stopPolling();
    vi.mocked(PiholeApiService.getSummary).mockClear();
    vi.advanceTimersByTime(3000);
    expect(PiholeApiService.getSummary).not.toHaveBeenCalled();
  });

  it("calling startPolling twice does not double-poll", () => {
    const store = useInstanceStore();
    store.startPolling();
    store.startPolling();
    expect(store._pollHandle).toBeTruthy();
    store.stopPolling();
  });
});
