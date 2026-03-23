<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Dashboard">
      <template #actions>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="anyLoading"
          @click="refreshAll"
        >
          <ion-icon :icon="refreshOutline" style="font-size: 14px" />
          Refresh
        </button>
      </template>
    </PageHeader>

    <ion-content class="page-content">
      <EmptyState
        v-if="!instanceStore.instances.length"
        :icon="addCircleOutline"
        title="No instances configured"
        subtitle="Go to Settings to add your first Pi-hole instance."
      >
        <button class="btn btn-primary mt-3" @click="$router.push('/settings')">
          <ion-icon :icon="settingsOutline" />
          Open Settings
        </button>
      </EmptyState>

      <template v-else>
        <!-- Global blocking control bar -->
        <div class="global-controls-bar">
          <div class="flex items-center gap-2">
            <span class="section-label" style="padding: 0">GLOBAL CONTROL</span>
            <span class="badge" :class="globalStatusBadgeClass">
              {{ globalStatusLabel }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn btn-success btn-sm"
              :disabled="anyLoading"
              @click="onEnableAll"
            >
              <ion-icon :icon="shieldCheckmarkOutline" />
              Enable All
            </button>
            <button
              class="btn btn-danger btn-sm"
              @click="showDisableModal = true"
            >
              <ion-icon :icon="shieldOutline" />
              Disable All
            </button>
          </div>
        </div>

        <!-- Aggregate stats — reuses StatsOverviewCards for consistent design -->
        <div class="section-label stats-overview-label">
          AGGREGATE — ALL INSTANCES
        </div>
        <StatsOverviewCards :summary="aggregateSummary" aggregate-mode>
          <template #extra-cards>
            <StatCard
              label="Online Instances"
              :value="`${instanceStore.onlineCount} / ${instanceStore.instances.length}`"
              accent="green"
              :icon="wifiOutline"
            />
            <StatCard
              label="Unique Clients"
              :value="fmt(aggregate.uniqueClients)"
              sub="combined total"
              accent="amber"
              :icon="desktopOutline"
            />
          </template>
        </StatsOverviewCards>

        <!-- Per-instance cards -->
        <div class="instance-cards-grid">
          <InstanceCard
            v-for="inst in instanceStore.instances"
            :key="inst.id"
            :instance="inst"
            :summary="instanceStore.summaryData[inst.id] ?? null"
            :loading="instanceStore.loading[inst.id] ?? false"
            :error="instanceStore.errors[inst.id] ?? null"
            @refresh="instanceStore.refreshInstance"
            @toggle-blocking="onToggleBlocking"
          />
        </div>
      </template>
    </ion-content>

    <DisableBlockingModal
      :is-open="showDisableModal"
      :online-count="instanceStore.onlineCount"
      @close="showDisableModal = false"
      @confirm="onDisableAll"
    />
  </ion-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import {
  refreshOutline,
  addCircleOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  wifiOutline,
  desktopOutline,
} from "ionicons/icons";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import StatCard from "@/components/ui/StatCard.vue";
import StatsOverviewCards from "@/components/statistics/StatsOverviewCards.vue";
import InstanceCard from "@/components/dashboard/InstanceCard.vue";
import DisableBlockingModal from "@/components/dashboard/DisableBlockingModal.vue";

import { mapStores } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";
import { useFormatting } from "@/composables/useFormatting";
import { useBlockingControl } from "@/composables/useBlockingControl";

export default defineComponent({
  name: "DashboardView",
  components: {
    IonPage,
    IonContent,
    IonIcon,
    PageHeader,
    EmptyState,
    StatCard,
    StatsOverviewCards,
    InstanceCard,
    DisableBlockingModal,
  },

  data() {
    const { fmt } = useFormatting();
    return {
      showDisableModal: false,
      fmt,
      // Icon refs for template
      refreshOutline,
      addCircleOutline,
      settingsOutline,
      shieldCheckmarkOutline,
      shieldOutline,
      wifiOutline,
      desktopOutline,
    };
  },

  computed: {
    ...mapStores(useInstanceStore),

    anyLoading(): boolean {
      return Object.values(this.instanceStore.loading).some(Boolean);
    },

    globalStatusLabel(): string {
      const s = this.instanceStore.globalBlockingStatus;
      if (s === "enabled") return "All Blocking";
      if (s === "disabled") return "All Disabled";
      if (s === "mixed") return "Mixed";
      return "Unknown";
    },

    globalStatusBadgeClass(): string {
      const s = this.instanceStore.globalBlockingStatus;
      if (s === "enabled") return "badge-green";
      if (s === "disabled") return "badge-red";
      return "badge-amber";
    },

    aggregate(): {
      totalQueries: number;
      totalBlocked: number;
      totalDomainsBlocked: number;
      uniqueClients: number;
      avgBlockRate: string;
    } {
      let totalQueries = 0;
      let totalBlocked = 0;
      let totalDomainsBlocked = 0;
      let uniqueClients = 0;

      this.instanceStore.instances.forEach((inst) => {
        const s = this.instanceStore.summaryData[inst.id];
        if (!s) return;
        totalQueries += Number(s.dns_queries_today) || 0;
        totalBlocked += Number(s.ads_blocked_today) || 0;
        totalDomainsBlocked += Number(s.domains_being_blocked) || 0;
        uniqueClients += Number(s.unique_clients) || 0;
      });

      const avgBlockRate =
        totalQueries > 0
          ? `${((totalBlocked / totalQueries) * 100).toFixed(1)}%`
          : "0%";

      return {
        totalQueries,
        totalBlocked,
        totalDomainsBlocked,
        uniqueClients,
        avgBlockRate,
      };
    },

    /**
     * PiholeSummary-shaped object fed into StatsOverviewCards so the Dashboard
     * reuses the exact same component and design as the Statistics view.
     * The last two cards (Online Instances, Unique Clients) are overridden
     * via the #extra-cards slot.
     */
    aggregateSummary() {
      const { totalQueries, totalBlocked, totalDomainsBlocked, avgBlockRate } =
        this.aggregate;
      const blockPct = parseFloat(avgBlockRate);
      return {
        status: "enabled" as const,
        dns_queries_today: totalQueries,
        ads_blocked_today: totalBlocked,
        ads_percentage_today: isNaN(blockPct) ? 0 : blockPct,
        domains_being_blocked: totalDomainsBlocked,
        unique_clients: 0, // overridden by slot
        queries_cached: 0, // overridden by slot
      };
    },
  },

  methods: {
    refreshAll(): void {
      void this.instanceStore.refreshAll();
    },

    onToggleBlocking(id: string, enable: boolean): Promise<void> {
      return useBlockingControl().toggleBlocking(id, enable);
    },

    onEnableAll(): Promise<void> {
      return useBlockingControl().enableAll();
    },

    onDisableAll(secs: number): Promise<void> {
      this.showDisableModal = false;
      return useBlockingControl().disableAll(secs);
    },
  },
});
</script>

<style scoped>
.global-controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}
.stats-overview-label {
  padding-top: 8px !important;
}

.instance-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-6);
}
</style>
