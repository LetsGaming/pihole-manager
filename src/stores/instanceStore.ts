/**
 * Instance Store
 *
 * Manages Pi-hole instances: CRUD, status polling, summary data, blocking control.
 * Persists to localStorage under STORAGE_KEY.
 *
 * Status resilience: an instance is only marked offline after
 * OFFLINE_THRESHOLD consecutive failed refreshes. One transient error
 * (network hiccup, slow response, tab switch) does not flip the status.
 *
 * Reactivity note: all per-instance state objects (summaryData, errors,
 * loading, _failCount) are replaced via full object spread on every write
 * so Vue's reactivity system always detects the change.
 */

import { defineStore } from "pinia";
import PiholeApiService from "@/services/piholeApi";
import type {
  PiholeInstance,
  NewInstanceConfig,
  UpdateInstanceConfig,
} from "@/types/instance";
import type { PiholeSummary } from "@/types/api";

const STORAGE_KEY = "orbital_instances";
const POLL_INTERVAL_MS = 30_000;
/** Number of consecutive failures before an instance is marked offline */
const OFFLINE_THRESHOLD = 2;

interface InstanceStoreState {
  instances: PiholeInstance[];
  activeInstanceId: string | null;
  summaryData: Record<string, PiholeSummary>;
  errors: Record<string, string | null>;
  loading: Record<string, boolean>;
  /** Consecutive failure count per instance — not persisted */
  _failCount: Record<string, number>;
  _pollHandle: ReturnType<typeof setInterval> | null;
}

interface PersistedState {
  instances: PiholeInstance[];
  activeInstanceId: string | null;
}

export const useInstanceStore = defineStore("instances", {
  state: (): InstanceStoreState => ({
    instances: [],
    activeInstanceId: null,
    summaryData: {},
    errors: {},
    loading: {},
    _failCount: {},
    _pollHandle: null,
  }),

  getters: {
    sortedInstances(state): PiholeInstance[] {
      return [...state.instances].sort((a, b) => {
        if (a.status === "online" && b.status !== "online") return -1;
        if (a.status !== "online" && b.status === "online") return 1;
        return a.name.localeCompare(b.name);
      });
    },

    onlineCount(state): number {
      return state.instances.filter((i) => i.status === "online").length;
    },

    offlineCount(state): number {
      return state.instances.filter((i) => i.status === "offline").length;
    },

    activeInstance(state): PiholeInstance | null {
      return state.instances.find((i) => i.id === state.activeInstanceId) ?? null;
    },

    activeSummary(state): PiholeSummary | null {
      if (!state.activeInstanceId) return null;
      return state.summaryData[state.activeInstanceId] ?? null;
    },

    globalBlockingStatus(state): "enabled" | "disabled" | "mixed" | "unknown" {
      const online = state.instances.filter((i) => i.status === "online");
      if (online.length === 0) return "unknown";
      const allEnabled  = online.every((i) => state.summaryData[i.id]?.status === "enabled");
      const allDisabled = online.every((i) => state.summaryData[i.id]?.status === "disabled");
      if (allEnabled)  return "enabled";
      if (allDisabled) return "disabled";
      return "mixed";
    },
  },

  actions: {
    // ── Persistence ─────────────────────────────────────────────────────────

    loadFromStorage(): void {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PersistedState;
        this.instances = parsed.instances ?? [];
        this.activeInstanceId = parsed.activeInstanceId ?? null;

        // Ensure activeInstanceId points to a real instance
        if (
          this.activeInstanceId &&
          !this.instances.find((i) => i.id === this.activeInstanceId)
        ) {
          this.activeInstanceId = this.instances[0]?.id ?? null;
        }

        // Initialise transient state for every restored instance
        const failCount: Record<string, number> = {};
        const loading: Record<string, boolean> = {};
        const errors: Record<string, string | null> = {};
        this.instances.forEach((i) => {
          failCount[i.id] = 0;
          loading[i.id]   = false;
          errors[i.id]    = null;
        });
        this._failCount = failCount;
        this.loading    = loading;
        this.errors     = errors;
      } catch (err) {
        console.error("[InstanceStore] loadFromStorage failed:", err);
      }
    },

    _saveToStorage(): void {
      try {
        const payload: PersistedState = {
          instances: this.instances,
          activeInstanceId: this.activeInstanceId,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error("[InstanceStore] _saveToStorage failed:", err);
      }
    },

    // ── CRUD ────────────────────────────────────────────────────────────────

    addInstance(config: NewInstanceConfig): PiholeInstance {
      const instance: PiholeInstance = {
        id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: config.name,
        url: config.url.replace(/\/$/, ""),
        apiToken: config.apiToken,
        apiVersion: config.apiVersion ?? "v5",
        status: "unknown",
        addedAt: new Date().toISOString(),
      };

      this.instances = [...this.instances, instance];

      // Initialise all per-instance reactive maps with new entry
      this._failCount = { ...this._failCount, [instance.id]: 0 };
      this.loading    = { ...this.loading,    [instance.id]: false };
      this.errors     = { ...this.errors,     [instance.id]: null };

      if (!this.activeInstanceId) this.activeInstanceId = instance.id;
      this._saveToStorage();
      void this.refreshInstance(instance.id);
      return instance;
    },

    updateInstance(id: string, updates: UpdateInstanceConfig): void {
      const idx = this.instances.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Instance ${id} not found`);

      const allowed = ["name", "url", "apiToken", "apiVersion"] as const;
      const updated = { ...this.instances[idx] };
      allowed.forEach((key) => {
        if (key in updates) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (updated as any)[key] = (updates as any)[key];
        }
      });

      // Replace array immutably for reactivity
      const newInstances = [...this.instances];
      newInstances[idx] = updated;
      this.instances = newInstances;

      // Reset fail counter so updated credentials get a fresh chance
      this._failCount = { ...this._failCount, [id]: 0 };
      this._saveToStorage();
      void this.refreshInstance(id);
    },

    removeInstance(id: string): void {
      this.instances = this.instances.filter((i) => i.id !== id);

      // Remove from all reactive maps
      const { [id]: _s, ...restSummary } = this.summaryData;
      const { [id]: _e, ...restErrors  } = this.errors;
      const { [id]: _l, ...restLoading } = this.loading;
      const { [id]: _f, ...restFail    } = this._failCount;
      this.summaryData = restSummary;
      this.errors      = restErrors;
      this.loading     = restLoading;
      this._failCount  = restFail;

      if (this.activeInstanceId === id) {
        this.activeInstanceId = this.instances[0]?.id ?? null;
      }
      this._saveToStorage();
    },

    setActiveInstance(id: string): void {
      if (this.instances.find((i) => i.id === id)) {
        this.activeInstanceId = id;
        this._saveToStorage();
      }
    },

    // ── Data Fetching ────────────────────────────────────────────────────────

    async refreshInstance(id: string): Promise<void> {
      const instance = this.instances.find((i) => i.id === id);
      if (!instance) return;

      // Mark as loading — use spread to trigger reactivity
      this.loading = { ...this.loading, [id]: true };
      this.errors  = { ...this.errors,  [id]: null };

      try {
        const summary = await PiholeApiService.getSummary(instance);

        // Immutably update summaryData so Vue detects the change
        this.summaryData = { ...this.summaryData, [id]: summary };

        // Reset failure counter and mark online
        this._failCount = { ...this._failCount, [id]: 0 };
        this._setStatus(id, "online");
      } catch (err) {
        const failCount = (this._failCount[id] ?? 0) + 1;
        this._failCount = { ...this._failCount, [id]: failCount };
        this.errors     = { ...this.errors, [id]: PiholeApiService.errorMessage(err) };

        if (failCount >= OFFLINE_THRESHOLD) {
          this._setStatus(id, "offline");
        }
        // Below threshold: keep current status — avoids false-positive offline flash
      } finally {
        this.loading = { ...this.loading, [id]: false };
      }
    },

    async refreshAll(): Promise<void> {
      await Promise.allSettled(
        this.instances.map((i) => this.refreshInstance(i.id)),
      );
    },

    /** Immutably update the status field of a single instance. */
    _setStatus(id: string, status: PiholeInstance["status"]): void {
      const idx = this.instances.findIndex((i) => i.id === id);
      if (idx === -1) return;
      const newInstances = [...this.instances];
      newInstances[idx] = { ...newInstances[idx], status };
      this.instances = newInstances;
    },

    // ── Blocking Control ─────────────────────────────────────────────────────

    async enableBlocking(id: string): Promise<void> {
      const inst = this.instances.find((i) => i.id === id);
      if (!inst) throw new Error("Instance not found");
      await PiholeApiService.enableBlocking(inst);
      await this.refreshInstance(id);
    },

    async disableBlocking(id: string, seconds = 0): Promise<void> {
      const inst = this.instances.find((i) => i.id === id);
      if (!inst) throw new Error("Instance not found");
      await PiholeApiService.disableBlocking(inst, seconds);
      await this.refreshInstance(id);
    },

    async enableAllBlocking(): Promise<void> {
      await Promise.allSettled(
        this.instances
          .filter((i) => i.status === "online" || i.status === "unknown")
          .map((i) => this.enableBlocking(i.id)),
      );
    },

    async disableAllBlocking(seconds = 0): Promise<void> {
      await Promise.allSettled(
        this.instances
          .filter((i) => i.status === "online" || i.status === "unknown")
          .map((i) => this.disableBlocking(i.id, seconds)),
      );
    },

    // ── Polling ──────────────────────────────────────────────────────────────

    startPolling(intervalMs = POLL_INTERVAL_MS): void {
      if (this._pollHandle) return; // already running
      this._pollHandle = setInterval(() => void this.refreshAll(), intervalMs);
    },

    stopPolling(): void {
      if (this._pollHandle) {
        clearInterval(this._pollHandle);
        this._pollHandle = null;
      }
    },
  },
});
