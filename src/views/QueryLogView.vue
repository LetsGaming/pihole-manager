<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Query Log" />

    <ion-content class="page-content">
      <EmptyState
        v-if="!instanceStore.instances.length"
        :icon="listOutline"
        title="No instances configured"
        subtitle="Add a Pi-hole instance in Settings first."
      />

      <template v-else>
        <QueryLogToolbar
          :instance-id="selectedInstanceId"
          :status-filter="statusFilter"
          :search-query="searchQuery"
          :fetch-count="fetchCount"
          :instances="instanceStore.instances"
          :is-live="isLive"
          :entry-count="totalFiltered"
          @update:instance-id="changeInstance"
          @update:status-filter="(v) => { statusFilter = v; }"
          @update:search-query="(v) => { searchQuery = v; }"
          @update:fetch-count="changeFetchCount"
          @toggle-live="toggleLive"
          @clear="clearEntries"
        />

        <!-- Active sort pills -->
        <div v-if="sortKey" class="sort-pills sort-pills--above-card mb-2">
          <span class="text-xs text-muted" style="line-height: 24px">Sort:</span>
          <span
            v-for="(level, idx) in sort.levels"
            :key="level.col"
            class="sort-pill"
          >
            <span class="sort-pill-priority">{{ idx + 1 }}</span>
            {{ COLUMN_LABELS[level.col] ?? level.col }}
            {{ level.dir === "asc" ? "↑" : "↓" }}
            <button
              class="sort-pill-remove"
              :aria-label="`Remove ${level.col} sort`"
              @click="onSortRemove(level.col)"
            >×</button>
          </span>
          <button
            class="btn btn-ghost btn-sm"
            style="padding: 2px 8px; font-size: 11px"
            @click="onSortClear"
          >Clear sort</button>
        </div>

        <div class="log-container">
          <div class="log-header-row">
            <SortableHeader tag="div" col="timestamp" label="Time"   :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
            <SortableHeader tag="div" col="domain"    label="Domain" :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
            <SortableHeader tag="div" col="client"    label="Client" :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
            <SortableHeader tag="div" col="type"      label="Type"   :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
            <SortableHeader tag="div" col="status"    label="Status" :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
            <div class="log-header-actions">Actions</div>
          </div>

          <div v-if="isLoading && !totalFiltered" class="p-4">
            <div v-for="i in 8" :key="i" class="skeleton" style="height: 36px; margin-bottom: 4px" />
          </div>

          <QueryLogRow
            v-for="entry in pagedEntries"
            :key="entry._key"
            :entry="entry"
            @whitelist="whitelistDomain"
            @blacklist="blacklistDomain"
            @copy="copyToClipboard"
          />

          <EmptyState
            v-if="!isLoading && !totalFiltered"
            title="No entries match your filters"
            style="padding: 40px"
          />
        </div>

        <div v-if="totalPages > 1" class="pagination-row">
          <button class="btn btn-ghost btn-sm" :disabled="page === 1" @click="page--">←</button>
          <span class="text-xs text-muted">Page {{ page }} / {{ totalPages }}</span>
          <button class="btn btn-ghost btn-sm" :disabled="page === totalPages" @click="page++">→</button>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import { IonPage, IonContent } from "@ionic/vue";
import { listOutline } from "ionicons/icons";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import SortableHeader from "@/components/ui/SortableHeader.vue";
import QueryLogToolbar from "@/components/querylog/QueryLogToolbar.vue";
import QueryLogRow from "@/components/querylog/QueryLogRow.vue";

import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useClipboard } from "@/composables/useClipboard";
import { useMultiSort } from "@/composables/useMultiSort";
import type { MultiSort } from "@/composables/useMultiSort";
import PiholeApiService from "@/services/piholeApi";
import type { EnrichedQueryEntry } from "@/types/api";

const PAGE_SIZE = 50;
const LIVE_INTERVAL_MS = 5_000;

const COLUMN_LABELS: Record<string, string> = {
  timestamp: "Time",
  domain:    "Domain",
  client:    "Client",
  type:      "Type",
  status:    "Status",
};

// Accessors operate on plain values — no Proxy overhead in sort comparisons
const ACCESSORS: Partial<Record<string, (e: EnrichedQueryEntry) => string | number>> = {
  timestamp: (e) => e.timestamp,
  domain:    (e) => e.domain,
  client:    (e) => e.client,
  type:      (e) => e.type,
  status:    (e) => e.status,
};

export default defineComponent({
  name: "QueryLogView",
  components: { IonPage, IonContent, PageHeader, EmptyState, SortableHeader, QueryLogToolbar, QueryLogRow },

  data() {
    return {
      // ── Filter / toolbar state (reactive scalars — cheap to track) ─────────
      selectedInstanceId: "all" as string,
      statusFilter:       "all" as string,
      searchQuery:        ""   as string,
      fetchCount:         100  as number,
      isLive:             true as boolean,
      isLoading:          false as boolean,
      page:               1    as number,

      // ── Sort state ──────────────────────────────────────────────────────────
      // sort is markRaw: Vue never deep-proxies its methods or levels array.
      // sortKey is the cheap reactive signal — a string fingerprint updated
      // synchronously on every click so headers re-render instantly.
      sort:    markRaw(useMultiSort()) as MultiSort,
      sortKey: "" as string,

      // ── Entry data — stored raw, never deep-proxied ─────────────────────────
      // Keeping 100-500 entry objects outside Vue's Proxy system eliminates
      // the per-property tracking overhead that caused the sort delay.
      _rawEntries: markRaw([] as EnrichedQueryEntry[]),

      // ── Derived display data — also raw, written by _rebuildView() ─────────
      // pagedEntries and totalFiltered/totalPages are plain reactive scalars;
      // the actual page slice is stored as a shallowRef (tracks the array
      // reference, not its contents) so the template re-renders when we
      // assign a new slice without proxying every entry.
      pagedEntries:  [] as EnrichedQueryEntry[],
      totalFiltered: 0  as number,
      totalPages:    1  as number,

      COLUMN_LABELS,
      listOutline,
      liveHandle: null as ReturnType<typeof setInterval> | null,
    };
  },

  computed: {
    instanceStore() {
      return useInstanceStore();
    },
  },

  watch: {
    // Any filter or sort change → rebuild the view immediately
    statusFilter() { this._rebuildView(); },
    searchQuery()  { this._rebuildView(); },
    sortKey()      { this._rebuildView(); },
  },

  mounted() {
    this.instanceStore.loadFromStorage();
    void this.instanceStore.refreshAll().then(() => {
      void this.fetchLog();
      this.startLive();
    });
  },

  beforeUnmount() {
    this.stopLive();
  },

  methods: {
    // ── Sort event handlers ──────────────────────────────────────────────────

    onSortChanged(): void {
      // Update the reactive signal — SortableHeader already mutated sort.levels
      this.sortKey = this.sort.levels.map((l) => `${l.col}:${l.dir}`).join(",");
    },

    onSortRemove(col: string): void {
      this.sort.remove(col);
      this.onSortChanged();
    },

    onSortClear(): void {
      this.sort.clear();
      this.onSortChanged();
    },

    // ── View rebuild — runs filter + sort + paginate on raw data ─────────────

    _rebuildView(resetPage = false): void {
      const q = this.searchQuery.toLowerCase();
      const sf = this.statusFilter;

      // 1. Filter — runs on plain objects, no Proxy traps
      let result = this._rawEntries as EnrichedQueryEntry[];
      if (sf !== "all" || q) {
        result = result.filter((e) => {
          if (sf !== "all" && e.status !== sf) return false;
          if (q && !e.domain.toLowerCase().includes(q) && !e.client.toLowerCase().includes(q)) return false;
          return true;
        });
      }

      // 2. Sort
      if (this.sort.levels.length) {
        result = this.sort.apply(result, ACCESSORS);
      } else {
        // Default: newest first
        result = [...result].sort((a, b) => b.timestamp - a.timestamp);
      }

      // 3. Paginate
      const total = result.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const newPage = resetPage ? 1 : Math.min(this.page, pages);
      const start = (newPage - 1) * PAGE_SIZE;

      // Write results — Vue tracks only these scalar/array-ref changes
      this.totalFiltered = total;
      this.totalPages    = pages;
      this.page          = newPage;
      this.pagedEntries  = result.slice(start, start + PAGE_SIZE);
    },

    // ── Data fetch ───────────────────────────────────────────────────────────

    clearEntries(): void {
      this._rawEntries = markRaw([]);
      this._rebuildView(true);
    },

    async fetchLog(): Promise<void> {
      const targets =
        this.selectedInstanceId === "all"
          ? this.instanceStore.instances.filter((i) => i.status === "online" || i.status === "unknown")
          : this.instanceStore.instances.filter((i) => i.id === this.selectedInstanceId);
      if (!targets.length) return;

      this.isLoading = true;
      try {
        const results = await Promise.allSettled(
          targets.map((inst) =>
            PiholeApiService.getQueryLog(inst, this.fetchCount).then((rows) =>
              rows.map((e) => ({
                ...e,
                _instanceId:   inst.id,
                _instanceName: inst.name,
                _key:          "",
              }) as EnrichedQueryEntry),
            ),
          ),
        );

        const combined: EnrichedQueryEntry[] = [];
        const notifications = useNotificationStore();
        results.forEach((r) => {
          if (r.status === "fulfilled") combined.push(...r.value);
          else notifications.error(`Query log: ${(r.reason as Error)?.message ?? "Fetch failed"}`);
        });

        // Stamp globally unique keys after combining
        for (let i = 0; i < combined.length; i++) {
          combined[i]._key = `${combined[i]._instanceId}-${combined[i].timestamp}-${combined[i].domain}-${i}`;
        }

        this._rawEntries = markRaw(combined);
        this._rebuildView(true);
      } catch (err) {
        useNotificationStore().error(`Failed to fetch log: ${(err as Error).message}`);
      } finally {
        this.isLoading = false;
      }
    },

    // ── Instance / fetch count changes ───────────────────────────────────────

    changeInstance(id: string): void {
      this.selectedInstanceId = id;
      this._rawEntries = markRaw([]);
      this._rebuildView(true);
      void this.fetchLog();
    },

    changeFetchCount(n: number): void {
      this.fetchCount = n;
      void this.fetchLog();
    },

    // ── Live polling ─────────────────────────────────────────────────────────

    startLive(): void {
      this.stopLive();
      if (this.isLive) this.liveHandle = setInterval(() => void this.fetchLog(), LIVE_INTERVAL_MS);
    },

    stopLive(): void {
      if (this.liveHandle !== null) { clearInterval(this.liveHandle); this.liveHandle = null; }
    },

    toggleLive(): void {
      this.isLive = !this.isLive;
      this.isLive ? this.startLive() : this.stopLive();
    },

    // ── Domain actions ───────────────────────────────────────────────────────

    async whitelistDomain(domain: string, instanceId: string): Promise<void> {
      const inst = this.instanceStore.instances.find((i) => i.id === instanceId);
      if (!inst) return;
      const n = useNotificationStore();
      try { await PiholeApiService.addToList(inst, "white", domain); n.success(`Whitelisted: ${domain}`); }
      catch (err) { n.error(`Failed: ${(err as Error).message}`); }
    },

    async blacklistDomain(domain: string, instanceId: string): Promise<void> {
      const inst = this.instanceStore.instances.find((i) => i.id === instanceId);
      if (!inst) return;
      const n = useNotificationStore();
      try { await PiholeApiService.addToList(inst, "black", domain); n.success(`Blacklisted: ${domain}`); }
      catch (err) { n.error(`Failed: ${(err as Error).message}`); }
    },

    copyToClipboard(text: string): void {
      useClipboard().copyToClipboard(text);
    },
  },
});
</script>

<style scoped>
/*
 * Header row must match .log-entry exactly:
 * grid-template-columns: 90px 1fr 140px 80px 90px 80px
 * gap: 12px  |  padding: 8px 16px
 */
.log-header-row {
  display: grid;
  grid-template-columns: 90px 1fr 140px 80px 90px 80px;
  gap: 12px;
  padding: 0 16px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  align-items: center;
}

.log-header-row :deep(.sortable-th) {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.log-header-actions {
  display: flex;
  align-items: center;
  padding: 8px 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.sort-pills--above-card {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.pagination-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}

@media (max-width: 768px) {
  .log-header-row {
    grid-template-columns: 70px 1fr 80px 60px;
  }
}
</style>
