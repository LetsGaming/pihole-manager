<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Dashboard">
      <template #actions>
        <button class="btn btn-ghost btn-sm" :disabled="anyLoading" @click="refreshAll">
          <ion-icon :icon="refreshOutline" style="font-size:14px" />
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
        <div class="global-controls-bar">
          <div class="flex items-center gap-2">
            <span class="section-label" style="padding:0">GLOBAL CONTROL</span>
            <span class="badge" :class="globalStatusBadgeClass">{{ globalStatusLabel }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-success btn-sm" :disabled="anyLoading" @click="onEnableAll">
              <ion-icon :icon="shieldCheckmarkOutline" />
              Enable All
            </button>
            <button class="btn btn-danger btn-sm" @click="showDisableModal = true">
              <ion-icon :icon="shieldOutline" />
              Disable All
            </button>
          </div>
        </div>

        <div class="instance-cards-grid">
          <InstanceCard
            v-for="inst in instanceStore.instances"
            :key="inst.id"
            :instance="inst"
            :summary="instanceStore.summaryData[inst.id] ?? null"
            :loading="instanceStore.loading[inst.id] ?? false"
            :error="instanceStore.errors[inst.id] ?? undefined"
            @refresh="instanceStore.refreshInstance"
            @toggle-blocking="onToggleBlocking"
          />
        </div>

        <div class="section-label">AGGREGATE — ALL INSTANCES</div>
        <div class="stat-grid">
          <StatCard label="Total Queries" :value="fmt(aggregate.totalQueries)" />
          <StatCard label="Total Blocked" :value="fmt(aggregate.totalBlocked)" accent="red" />
          <StatCard label="Avg Block Rate" :value="aggregate.avgBlockRate" accent="cyan" />
          <StatCard label="Domains in Lists" :value="fmt(aggregate.totalDomainsBlocked)" accent="purple" />
          <StatCard label="Online Instances" :value="`${instanceStore.onlineCount} / ${instanceStore.instances.length}`" accent="green" />
          <StatCard label="Unique Clients" :value="fmt(aggregate.uniqueClients)" accent="amber" />
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
import { defineComponent, computed, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  refreshOutline, addCircleOutline, settingsOutline,
  shieldCheckmarkOutline, shieldOutline,
} from 'ionicons/icons';
import PageHeader           from '@/components/ui/PageHeader.vue';
import EmptyState           from '@/components/ui/EmptyState.vue';
import StatCard             from '@/components/ui/StatCard.vue';
import InstanceCard         from '@/components/dashboard/InstanceCard.vue';
import DisableBlockingModal from '@/components/dashboard/DisableBlockingModal.vue';
import { useInstanceStore }   from '@/stores/instanceStore';
import { useFormatting }      from '@/composables/useFormatting';
import { useBlockingControl } from '@/composables/useBlockingControl';

export default defineComponent({
  name: 'DashboardView',
  components: {
    IonPage, IonContent, IonIcon,
    PageHeader, EmptyState, StatCard, InstanceCard, DisableBlockingModal,
  },

  setup() {
    const instanceStore = useInstanceStore();
    const { fmt } = useFormatting();
    const { toggleBlocking, enableAll, disableAll } = useBlockingControl();
    const showDisableModal = ref(false);

    const anyLoading = computed(() => Object.values(instanceStore.loading).some(Boolean));

    const globalStatusLabel = computed(() => {
      const s = instanceStore.globalBlockingStatus;
      return s === 'enabled' ? 'All Blocking' : s === 'disabled' ? 'All Disabled' : s === 'mixed' ? 'Mixed' : 'Unknown';
    });

    const globalStatusBadgeClass = computed(() => {
      const s = instanceStore.globalBlockingStatus;
      return s === 'enabled' ? 'badge-green' : s === 'disabled' ? 'badge-red' : 'badge-amber';
    });

    const aggregate = computed(() => {
      let totalQueries = 0, totalBlocked = 0, totalDomainsBlocked = 0, uniqueClients = 0;
      instanceStore.instances.forEach((inst) => {
        const s = instanceStore.summaryData[inst.id];
        if (!s) return;
        totalQueries        += Number(s.dns_queries_today)      || 0;
        totalBlocked        += Number(s.ads_blocked_today)      || 0;
        totalDomainsBlocked += Number(s.domains_being_blocked)  || 0;
        uniqueClients       += Number(s.unique_clients)         || 0;
      });
      const avgBlockRate = totalQueries > 0
        ? `${((totalBlocked / totalQueries) * 100).toFixed(1)}%` : '0%';
      return { totalQueries, totalBlocked, totalDomainsBlocked, uniqueClients, avgBlockRate };
    });

    instanceStore.loadFromStorage();
    void instanceStore.refreshAll();
    instanceStore.startPolling();

    return {
      instanceStore, aggregate, anyLoading,
      globalStatusLabel, globalStatusBadgeClass,
      showDisableModal, fmt,
      refreshAll:          () => instanceStore.refreshAll(),
      onToggleBlocking:    (id: string, en: boolean) => toggleBlocking(id, en),
      onEnableAll:         () => enableAll(),
      onDisableAll:        (secs: number) => { showDisableModal.value = false; void disableAll(secs); },
      refreshOutline, addCircleOutline, settingsOutline, shieldCheckmarkOutline, shieldOutline,
    };
  },

  beforeUnmount() { useInstanceStore().stopPolling(); },
});
</script>

<style scoped>
.global-controls-bar {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg); padding: 12px 16px; margin-bottom: 20px;
  flex-wrap: wrap; gap: 10px;
}
.instance-cards-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px; margin-bottom: 24px;
}
</style>
