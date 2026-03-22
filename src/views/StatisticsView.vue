<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Statistics">
      <template #actions>
        <select
          v-model="selectedInstanceId"
          class="field-input"
          style="width: 180px"
          aria-label="Select instance"
        >
          <option value="__all__">All Instances</option>
          <option
            v-for="inst in instancesStore.instances"
            :key="inst.id"
            :value="inst.id"
          >
            {{ inst.name }}
          </option>
        </select>
      </template>
    </PageHeader>

    <ion-content class="page-content">
      <EmptyState
        v-if="!instancesStore.instances.length"
        title="No instances configured"
        subtitle="Go to Settings to add your first Pi-hole instance."
      />

      <template v-else>
        <!-- Stat cards — same layout for both single and all-instances -->
        <StatsOverviewCards :summary="displaySummary" :aggregate-mode="isAllMode" />

        <!-- Chart -->
        <StatsChart
          :over-time-data="overTimeData"
          :loading="isLoadingCharts"
          :instance-name="chartLabel"
        />

        <!-- Top domains grid -->
        <div class="two-col-grid mb-3">
          <TopDomainsCard
            title="TOP QUERIED DOMAINS"
            :domains="topDomains"
            :loading="isLoadingTop"
            empty-message="No queried domains yet"
          />
          <TopDomainsCard
            title="TOP BLOCKED DOMAINS"
            :domains="topBlocked"
            :loading="isLoadingTop"
            variant="blocked"
            empty-message="No blocked domains yet"
          />
        </div>

        <!-- Top clients -->
        <TopDomainsCard
          title="TOP CLIENTS"
          :domains="topClients"
          :loading="isLoadingTop"
          variant="green"
          empty-message="No client data yet"
        />
      </template>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapStores } from "pinia";
import { IonPage, IonContent } from "@ionic/vue";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatsOverviewCards from "@/components/statistics/StatsOverviewCards.vue";
import StatsChart from "@/components/statistics/StatsChart.vue";
import TopDomainsCard from "@/components/statistics/TopDomainsCard.vue";

import { useInstanceStore } from "@/stores/instanceStore";
import { useFormatting } from "@/composables/useFormatting";
import PiholeApiService from "@/services/piholeApi";
import type {
  PiholeSummary,
  TopDomainsMap,
  TopClientsMap,
  OverTimeData,
} from "@/types/api";

/**
 * Merge multiple OverTimeData objects by summing counts per timestamp bucket.
 * Timestamps are rounded to 10-minute intervals by Pi-hole, so buckets align
 * across instances on the same network.
 */
function mergeOverTimeData(datasets: OverTimeData[]): OverTimeData {
  const domains: Record<string, number> = {};
  const ads: Record<string, number> = {};

  for (const d of datasets) {
    for (const [ts, count] of Object.entries(d.domains)) {
      domains[ts] = (domains[ts] ?? 0) + count;
    }
    for (const [ts, count] of Object.entries(d.ads)) {
      ads[ts] = (ads[ts] ?? 0) + count;
    }
  }

  // Sort by timestamp so the chart renders left-to-right
  const sortedDomains: Record<string, number> = {};
  const sortedAds: Record<string, number> = {};
  for (const k of Object.keys(domains).sort((a, b) => Number(a) - Number(b))) {
    sortedDomains[k] = domains[k];
    sortedAds[k] = ads[k] ?? 0;
  }

  return { domains: sortedDomains, ads: sortedAds };
}

/**
 * Merge multiple domain/client maps by summing counts, then return the
 * top N entries sorted descending. Using union of keys gives us "unique"
 * domains/clients across all instances naturally.
 */
function mergeTopMaps(
  maps: TopDomainsMap[],
  limit = 10,
): TopDomainsMap {
  const merged: Record<string, number> = {};
  for (const map of maps) {
    for (const [key, count] of Object.entries(map)) {
      merged[key] = (merged[key] ?? 0) + count;
    }
  }
  // Sort descending and keep top N
  return Object.fromEntries(
    Object.entries(merged)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit),
  );
}

export default defineComponent({
  name: "StatisticsView",
  components: {
    IonPage,
    IonContent,
    PageHeader,
    EmptyState,
    StatsOverviewCards,
    StatsChart,
    TopDomainsCard,
  },

  data() {
    const { fmt, fmtPct } = useFormatting();
    return {
      /** '__all__' for aggregate view, or an instance id */
      selectedInstanceId: "__all__" as string,
      overTimeData: null as OverTimeData | null,
      topDomains: {} as TopDomainsMap,
      topBlocked: {} as TopDomainsMap,
      topClients: {} as TopClientsMap,
      isLoadingCharts: false,
      isLoadingTop: false,
      fmt,
      fmtPct,
    };
  },

  computed: {
    ...mapStores(useInstanceStore),

    isAllMode(): boolean {
      return this.selectedInstanceId === "__all__";
    },

    currentInstance() {
      if (this.isAllMode) return null;
      return (
        this.instancesStore.instances.find(
          (i) => i.id === this.selectedInstanceId,
        ) ?? null
      );
    },

    /** Label shown next to the chart title */
    chartLabel(): string | null {
      if (this.isAllMode) return "All Instances";
      return this.currentInstance?.name ?? null;
    },

    /**
     * Summary shown in the stat cards.
     * - Single instance: data straight from the store.
     * - All instances: summed totals; unique_clients and domains_being_blocked
     *   are derived from the union of top-N keys (see topClients / topBlocked
     *   which are already merged across instances).
     */
    displaySummary(): PiholeSummary | null {
      if (!this.isAllMode) {
        return this.selectedInstanceId
          ? (this.instancesStore.summaryData[this.selectedInstanceId] ?? null)
          : null;
      }

      const instances = this.instancesStore.instances;
      if (!instances.length) return null;

      let totalQueries = 0;
      let totalBlocked = 0;
      let totalCached = 0;
      let hasData = false;

      instances.forEach((inst) => {
        const s = this.instancesStore.summaryData[inst.id];
        if (!s) return;
        hasData = true;
        totalQueries += Number(s.dns_queries_today) || 0;
        totalBlocked += Number(s.ads_blocked_today) || 0;
        totalCached  += Number(s.queries_cached)    || 0;
      });

      if (!hasData) return null;

      const blockPct =
        totalQueries > 0 ? (totalBlocked / totalQueries) * 100 : 0;

      // Unique clients: count of distinct keys in the merged top-clients map.
      // After mergeTopMaps() the union of IPs/names across all instances is
      // already deduplicated, so key count = unique clients seen network-wide.
      // Falls back to 0 while top data is still loading.
      const uniqueClients = Object.keys(this.topClients).length;

      // Domains in blocklist: summed across instances — deduplication is not
      // possible because the API only returns a count, not the actual list.
      // The label in StatsOverviewCards makes this transparent to the user.
      let domainsBeingBlocked = 0;
      instances.forEach((inst) => {
        domainsBeingBlocked +=
          Number(this.instancesStore.summaryData[inst.id]?.domains_being_blocked) || 0;
      });

      return {
        status: "enabled",
        dns_queries_today:    totalQueries,
        ads_blocked_today:    totalBlocked,
        ads_percentage_today: parseFloat(blockPct.toFixed(1)),
        domains_being_blocked: domainsBeingBlocked,
        unique_clients:       uniqueClients,
        queries_cached:       totalCached,
      };
    },
  },

  watch: {
    selectedInstanceId() {
      void this.loadData();
    },
  },

  mounted() {
    this.instancesStore.loadFromStorage();
    void this.instancesStore.refreshAll();
    this.instancesStore.startPolling();

    // Default: aggregate view when multiple instances, single instance otherwise
    this.selectedInstanceId =
      this.instancesStore.instances.length === 1
        ? this.instancesStore.instances[0].id
        : "__all__";

    void this.loadData();
  },

  beforeUnmount() {
    this.instancesStore.stopPolling();
  },

  methods: {
    async loadData(): Promise<void> {
      if (this.isAllMode) {
        await this.loadAllInstancesData();
      } else {
        await this.loadSingleInstanceData();
      }
    },

    // ── Single instance ──────────────────────────────────────────────────────

    async loadSingleInstanceData(): Promise<void> {
      await Promise.allSettled([
        this.loadOverTime(),
        this.loadTopData(),
      ]);
    },

    async loadOverTime(): Promise<void> {
      if (!this.currentInstance) return;
      this.isLoadingCharts = true;
      try {
        this.overTimeData = await PiholeApiService.getOverTimeData(
          this.currentInstance,
        );
      } catch (err) {
        console.error("[StatisticsView] loadOverTime failed:", err);
        this.overTimeData = null;
      } finally {
        this.isLoadingCharts = false;
      }
    },

    async loadTopData(): Promise<void> {
      if (!this.currentInstance) return;
      this.isLoadingTop = true;
      try {
        const [topResult, clientsResult] = await Promise.allSettled([
          PiholeApiService.getTopDomains(this.currentInstance, 10),
          PiholeApiService.getTopClients(this.currentInstance, 10),
        ]);

        this.topDomains =
          topResult.status === "fulfilled" ? topResult.value.topDomains : {};
        this.topBlocked =
          topResult.status === "fulfilled" ? topResult.value.topBlocked : {};
        this.topClients =
          clientsResult.status === "fulfilled" ? clientsResult.value : {};

        if (topResult.status === "rejected")
          console.error("[StatisticsView] topDomains failed:", topResult.reason);
        if (clientsResult.status === "rejected")
          console.error("[StatisticsView] topClients failed:", clientsResult.reason);
      } finally {
        this.isLoadingTop = false;
      }
    },

    // ── All instances ────────────────────────────────────────────────────────

    async loadAllInstancesData(): Promise<void> {
      const instances = this.instancesStore.instances.filter(
        (i) => i.status !== "offline",
      );
      if (!instances.length) return;

      await Promise.allSettled([
        this.loadAllOverTime(instances),
        this.loadAllTopData(instances),
      ]);
    },

    async loadAllOverTime(
      instances: ReturnType<typeof useInstanceStore>["instances"],
    ): Promise<void> {
      this.isLoadingCharts = true;
      try {
        const results = await Promise.allSettled(
          instances.map((inst) => PiholeApiService.getOverTimeData(inst)),
        );
        const datasets = results
          .filter((r): r is PromiseFulfilledResult<OverTimeData> => r.status === "fulfilled")
          .map((r) => r.value);

        this.overTimeData = datasets.length ? mergeOverTimeData(datasets) : null;
      } catch (err) {
        console.error("[StatisticsView] loadAllOverTime failed:", err);
        this.overTimeData = null;
      } finally {
        this.isLoadingCharts = false;
      }
    },

    async loadAllTopData(
      instances: ReturnType<typeof useInstanceStore>["instances"],
    ): Promise<void> {
      this.isLoadingTop = true;
      try {
        const [topResults, clientResults] = await Promise.all([
          Promise.allSettled(
            instances.map((inst) => PiholeApiService.getTopDomains(inst, 10)),
          ),
          Promise.allSettled(
            instances.map((inst) => PiholeApiService.getTopClients(inst, 10)),
          ),
        ]);

        const topMaps = topResults
          .filter((r): r is PromiseFulfilledResult<{ topDomains: TopDomainsMap; topBlocked: TopDomainsMap }> => r.status === "fulfilled")
          .map((r) => r.value);

        // Merge and deduplicate — union of keys gives unique domains/clients
        this.topDomains = mergeTopMaps(topMaps.map((t) => t.topDomains));
        this.topBlocked = mergeTopMaps(topMaps.map((t) => t.topBlocked));

        const clientMaps = clientResults
          .filter((r): r is PromiseFulfilledResult<TopClientsMap> => r.status === "fulfilled")
          .map((r) => r.value);

        this.topClients = mergeTopMaps(clientMaps);
      } finally {
        this.isLoadingTop = false;
      }
    },
  },
});
</script>

<style scoped>
.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .two-col-grid {
    grid-template-columns: 1fr;
  }
}
</style>
