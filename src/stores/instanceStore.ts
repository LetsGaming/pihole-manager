/**
 * Instance Store — rewritten
 *
 * Key design decisions:
 *
 * 1. SINGLE POLLING OWNER
 *    The store owns the 30 s poll loop exclusively. Views must not call
 *    refreshAll / startPolling / loadFromStorage. Legacy call sites are kept
 *    as no-ops so nothing throws.
 *
 * 2. DEDUPLICATED REFRESHES
 *    Only one getSummary request is allowed in-flight per instance at a time.
 *    If refreshInstance is called while a request is already pending, the new
 *    call is dropped (the in-flight one will still update state when it lands).
 *    This eliminates all races from multiple concurrent polls.
 *
 * 3. BLOCKING TOGGLE OWNS THE STATUS
 *    disableBlocking / enableBlocking increment a per-instance
 *    _blockingInFlight counter BEFORE the optimistic write.
 *    refreshInstance checks the counter at WRITE TIME (not fetch-start time),
 *    so any getSummary response that resolves while a toggle is in-flight is
 *    silently dropped for the status field only. The counter is decremented
 *    in a finally block so it always clears.
 *
 * 4. NO STALE WRITES FROM VIEWS
 *    Views call instanceStore.refreshInstance(id) for the manual refresh
 *    button only. All other refreshes go through the store's own poll.
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
const OFFLINE_THRESHOLD = 2;

interface PersistedState {
  instances: PiholeInstance[];
  activeInstanceId: string | null;
}

interface InstanceStoreState {
  instances: PiholeInstance[];
  activeInstanceId: string | null;
  summaryData: Record<string, PiholeSummary>;
  errors: Record<string, string | null>;
  loading: Record<string, boolean>;
  _failCount: Record<string, number>;
  /** >0 while a blocking toggle API call is in-flight for this instance. */
  _blockingInFlight: Record<string, number>;
  /** >0 while a getSummary request is in-flight for this instance. */
  _refreshInFlight: Record<string, number>;
  _pollHandle: ReturnType<typeof setInterval> | null;
  _booted: boolean;
}

export const useInstanceStore = defineStore("instance", {
  state: (): InstanceStoreState => ({
    instances: [],
    activeInstanceId: null,
    summaryData: {},
    errors: {},
    loading: {},
    _failCount: {},
    _blockingInFlight: {},
    _refreshInFlight: {},
    _pollHandle: null,
    _booted: false,
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
      return (
        state.instances.find((i) => i.id === state.activeInstanceId) ?? null
      );
    },

    activeSummary(state): PiholeSummary | null {
      if (!state.activeInstanceId) return null;
      return state.summaryData[state.activeInstanceId] ?? null;
    },

    globalBlockingStatus(state): "enabled" | "disabled" | "mixed" | "unknown" {
      const online = state.instances.filter((i) => i.status === "online");
      if (online.length === 0) return "unknown";
      const allEnabled = online.every(
        (i) => state.summaryData[i.id]?.status === "enabled",
      );
      const allDisabled = online.every(
        (i) => state.summaryData[i.id]?.status === "disabled",
      );
      if (allEnabled) return "enabled";
      if (allDisabled) return "disabled";
      return "mixed";
    },
  },

  actions: {
    // ── Boot ─────────────────────────────────────────────────────────────────

    _boot(): void {
      if (this._booted) return;
      this._booted = true;
      this._loadFromStorage();
      void this.refreshAll();
      this._startPolling();
    },

    // ── Persistence ──────────────────────────────────────────────────────────

    _loadFromStorage(): void {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PersistedState;
        this.instances = parsed.instances ?? [];
        this.activeInstanceId = parsed.activeInstanceId ?? null;

        if (
          this.activeInstanceId &&
          !this.instances.find((i) => i.id === this.activeInstanceId)
        ) {
          this.activeInstanceId = this.instances[0]?.id ?? null;
        }

        // Initialise all transient maps
        const failCount: Record<string, number> = {};
        const loading: Record<string, boolean> = {};
        const errors: Record<string, string | null> = {};
        const blockingInFlight: Record<string, number> = {};
        const refreshInFlight: Record<string, number> = {};

        this.instances.forEach((i) => {
          failCount[i.id] = 0;
          loading[i.id] = false;
          errors[i.id] = null;
          blockingInFlight[i.id] = 0;
          refreshInFlight[i.id] = 0;
        });

        this._failCount = failCount;
        this.loading = loading;
        this.errors = errors;
        this._blockingInFlight = blockingInFlight;
        this._refreshInFlight = refreshInFlight;
      } catch (err) {
        console.error("[InstanceStore] _loadFromStorage failed:", err);
      }
    },

    _saveToStorage(): void {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            instances: this.instances,
            activeInstanceId: this.activeInstanceId,
          } satisfies PersistedState),
        );
      } catch (err) {
        console.error("[InstanceStore] _saveToStorage failed:", err);
      }
    },

    // ── CRUD ─────────────────────────────────────────────────────────────────

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
      this._failCount = { ...this._failCount, [instance.id]: 0 };
      this.loading = { ...this.loading, [instance.id]: false };
      this.errors = { ...this.errors, [instance.id]: null };
      this._blockingInFlight = { ...this._blockingInFlight, [instance.id]: 0 };
      this._refreshInFlight = { ...this._refreshInFlight, [instance.id]: 0 };

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
        if (key in updates) (updated as any)[key] = (updates as any)[key]; // eslint-disable-line @typescript-eslint/no-explicit-any
      });

      const next = [...this.instances];
      next[idx] = updated;
      this.instances = next;
      this._failCount = { ...this._failCount, [id]: 0 };
      this._saveToStorage();
      void this.refreshInstance(id);
    },

    removeInstance(id: string): void {
      this.instances = this.instances.filter((i) => i.id !== id);

      const { [id]: _s, ...s } = this.summaryData;
      const { [id]: _e, ...e } = this.errors;
      const { [id]: _l, ...l } = this.loading;
      const { [id]: _f, ...f } = this._failCount;
      const { [id]: _b, ...b } = this._blockingInFlight;
      const { [id]: _r, ...r } = this._refreshInFlight;
      this.summaryData = s;
      this.errors = e;
      this.loading = l;
      this._failCount = f;
      this._blockingInFlight = b;
      this._refreshInFlight = r;

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

      // DEDUPLICATION: if a request is already in-flight, drop this call.
      // The pending request will update state when it resolves.
      if ((this._refreshInFlight[id] ?? 0) > 0) return;

      this._refreshInFlight = { ...this._refreshInFlight, [id]: 1 };
      this.loading = { ...this.loading, [id]: true };
      this.errors = { ...this.errors, [id]: null };

      try {
        const summary = await PiholeApiService.getSummary(instance);

        // WRITE-TIME CHECK: if a blocking toggle is still in-flight, discard
        // the status from this poll response entirely — the toggle owns the
        // status until its own API call resolves and writes the confirmed value.
        const blockingOwned = (this._blockingInFlight[id] ?? 0) > 0;
        const safeStatus = blockingOwned
          ? (this.summaryData[id]?.status ?? summary.status)
          : summary.status;

        this.summaryData = {
          ...this.summaryData,
          [id]: { ...summary, status: safeStatus },
        };
        this._failCount = { ...this._failCount, [id]: 0 };
        this._setInstanceStatus(id, "online");
      } catch (err) {
        const count = (this._failCount[id] ?? 0) + 1;
        this._failCount = { ...this._failCount, [id]: count };
        this.errors = {
          ...this.errors,
          [id]: PiholeApiService.errorMessage(err),
        };
        if (count >= OFFLINE_THRESHOLD) this._setInstanceStatus(id, "offline");
      } finally {
        this._refreshInFlight = { ...this._refreshInFlight, [id]: 0 };
        this.loading = { ...this.loading, [id]: false };
      }
    },

    async refreshAll(): Promise<void> {
      await Promise.allSettled(
        this.instances.map((i) => this.refreshInstance(i.id)),
      );
    },

    // ── Internal helpers ─────────────────────────────────────────────────────

    _setInstanceStatus(id: string, status: PiholeInstance["status"]): void {
      const idx = this.instances.findIndex((i) => i.id === id);
      if (idx === -1) return;
      const next = [...this.instances];
      next[idx] = { ...next[idx], status };
      this.instances = next;
    },

    /**
     * Write a blocking status directly into summaryData.
     * Only called by blocking toggle actions — never by poll-driven code.
     */
    _writeSummaryStatus(id: string, status: "enabled" | "disabled"): void {
      const existing = this.summaryData[id];
      if (!existing) return;
      this.summaryData = { ...this.summaryData, [id]: { ...existing, status } };
    },

    // ── Blocking Control ─────────────────────────────────────────────────────

    async enableBlocking(id: string): Promise<void> {
      const inst = this.instances.find((i) => i.id === id);
      if (!inst) throw new Error("Instance not found");

      // Grab the counter BEFORE the optimistic write so any getSummary that
      // is already in-flight and resolves after this point will see > 0.
      this._blockingInFlight = {
        ...this._blockingInFlight,
        [id]: (this._blockingInFlight[id] ?? 0) + 1,
      };
      this._writeSummaryStatus(id, "enabled");

      try {
        const result = await PiholeApiService.enableBlocking(inst);
        this._writeSummaryStatus(id, result.status);
      } catch (err) {
        // On error, revert optimistic write so UI isn't stuck
        this._writeSummaryStatus(id, "disabled");
        throw err;
      } finally {
        this._blockingInFlight = {
          ...this._blockingInFlight,
          [id]: Math.max(0, (this._blockingInFlight[id] ?? 1) - 1),
        };
      }
    },

    async disableBlocking(id: string, seconds = 0): Promise<void> {
      const inst = this.instances.find((i) => i.id === id);
      if (!inst) throw new Error("Instance not found");

      this._blockingInFlight = {
        ...this._blockingInFlight,
        [id]: (this._blockingInFlight[id] ?? 0) + 1,
      };
      this._writeSummaryStatus(id, "disabled");

      try {
        const result = await PiholeApiService.disableBlocking(inst, seconds);
        this._writeSummaryStatus(id, result.status);
      } catch (err) {
        // Revert optimistic write
        this._writeSummaryStatus(id, "enabled");
        throw err;
      } finally {
        this._blockingInFlight = {
          ...this._blockingInFlight,
          [id]: Math.max(0, (this._blockingInFlight[id] ?? 1) - 1),
        };
      }
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

    _startPolling(): void {
      if (this._pollHandle !== null) return;
      this._pollHandle = setInterval(
        () => void this.refreshAll(),
        POLL_INTERVAL_MS,
      );
    },

    _stopPolling(): void {
      if (this._pollHandle !== null) {
        clearInterval(this._pollHandle);
        this._pollHandle = null;
      }
    },

    // ── Legacy no-op shims (called from views, now handled by _boot) ─────────
    loadFromStorage(): void {
      /* no-op */
    },
    startPolling(): void {
      /* no-op */
    },
    stopPolling(): void {
      /* no-op */
    },
  },
});
