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
          v-model:instance-id="selectedInstanceId"
          v-model:status-filter="statusFilter"
          v-model:search-query="searchQuery"
          v-model:fetch-count="fetchCount"
          :instances="instanceStore.instances"
          :is-live="isLive"
          :entry-count="filteredEntries.length"
          @toggle-live="toggleLive"
          @clear="entries = []"
        />

        <div class="log-container">
          <div class="log-header-row">
            <span>Time</span><span>Domain</span><span>Client</span>
            <span>Type</span><span>Status</span><span>Actions</span>
          </div>

          <div v-if="isLoading && !entries.length" class="p-4">
            <div v-for="i in 8" :key="i" class="skeleton" style="height:36px;margin-bottom:4px" />
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
            v-if="!isLoading && !filteredEntries.length"
            title="No entries match your filters"
            style="padding:40px"
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
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import { listOutline } from 'ionicons/icons';

import PageHeader      from '@/components/ui/PageHeader.vue';
import EmptyState      from '@/components/ui/EmptyState.vue';
import QueryLogToolbar from '@/components/querylog/QueryLogToolbar.vue';
import QueryLogRow     from '@/components/querylog/QueryLogRow.vue';

import { useInstanceStore }    from '@/stores/instanceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useClipboard }        from '@/composables/useClipboard';
import PiholeApiService        from '@/services/piholeApi';
import type { EnrichedQueryEntry } from '@/types/api';

const PAGE_SIZE       = 50;
const LIVE_INTERVAL_MS = 5_000;

export default defineComponent({
  name: 'QueryLogView',
  components: { IonPage, IonContent, PageHeader, EmptyState, QueryLogToolbar, QueryLogRow },

  setup() {
    const instanceStore  = useInstanceStore();
    const notifications  = useNotificationStore();
    const { copyToClipboard } = useClipboard();

    const selectedInstanceId = ref('all');
    const statusFilter  = ref('all');
    const searchQuery   = ref('');
    const fetchCount    = ref(100);
    const isLive        = ref(true);
    const isLoading     = ref(false);
    const entries       = ref<EnrichedQueryEntry[]>([]);
    const page          = ref(1);
    let liveHandle: ReturnType<typeof setInterval> | null = null;

    const filteredEntries = computed(() => entries.value.filter((e) => {
      if (statusFilter.value !== 'all' && e.status !== statusFilter.value) return false;
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        if (!e.domain.toLowerCase().includes(q) && !e.client.toLowerCase().includes(q)) return false;
      }
      return true;
    }));

    const totalPages  = computed(() => Math.max(1, Math.ceil(filteredEntries.value.length / PAGE_SIZE)));
    const pagedEntries = computed(() => {
      const start = (page.value - 1) * PAGE_SIZE;
      return filteredEntries.value.slice(start, start + PAGE_SIZE);
    });

    async function fetchLog() {
      const targets = selectedInstanceId.value === 'all'
        ? instanceStore.instances.filter((i) => i.status === 'online' || i.status === 'unknown')
        : instanceStore.instances.filter((i) => i.id === selectedInstanceId.value);
      if (!targets.length) return;

      isLoading.value = true;
      try {
        const results = await Promise.allSettled(
          targets.map((inst) =>
            PiholeApiService.getQueryLog(inst, fetchCount.value).then((rows) =>
              rows.map((e) => ({
                ...e,
                _instanceId:   inst.id,
                _instanceName: inst.name,
                _key:          `${inst.id}-${e.timestamp}-${e.domain}`,
              } as EnrichedQueryEntry)),
            ),
          ),
        );
        const combined: EnrichedQueryEntry[] = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled') combined.push(...r.value);
          else notifications.error(`Query log: ${(r.reason as Error)?.message ?? 'Fetch failed'}`);
        });
        combined.sort((a, b) => b.timestamp - a.timestamp);
        entries.value = combined;
        page.value = 1;
      } catch (err) {
        notifications.error(`Failed to fetch log: ${(err as Error).message}`);
      } finally {
        isLoading.value = false;
      }
    }

    function startLive() {
      stopLive();
      if (isLive.value) liveHandle = setInterval(() => void fetchLog(), LIVE_INTERVAL_MS);
    }
    function stopLive() {
      if (liveHandle !== null) { clearInterval(liveHandle); liveHandle = null; }
    }
    function toggleLive() {
      isLive.value = !isLive.value;
      isLive.value ? startLive() : stopLive();
    }

    async function whitelistDomain(domain: string, instanceId: string) {
      const inst = instanceStore.instances.find((i) => i.id === instanceId);
      if (!inst) return;
      try {
        await PiholeApiService.addToList(inst, 'white', domain);
        notifications.success(`Whitelisted: ${domain}`);
      } catch (err) { notifications.error(`Failed to whitelist: ${(err as Error).message}`); }
    }

    async function blacklistDomain(domain: string, instanceId: string) {
      const inst = instanceStore.instances.find((i) => i.id === instanceId);
      if (!inst) return;
      try {
        await PiholeApiService.addToList(inst, 'black', domain);
        notifications.success(`Blacklisted: ${domain}`);
      } catch (err) { notifications.error(`Failed to blacklist: ${(err as Error).message}`); }
    }

    watch(selectedInstanceId, () => { entries.value = []; page.value = 1; void fetchLog(); });
    watch(fetchCount, () => void fetchLog());

    onMounted(async () => {
      instanceStore.loadFromStorage();
      // Refresh instance statuses first so we know who is online
      await instanceStore.refreshAll();
      void fetchLog();
      startLive();
    });
    onBeforeUnmount(() => stopLive());

    return {
      instanceStore, selectedInstanceId, statusFilter, searchQuery, fetchCount,
      isLive, isLoading, entries, page,
      filteredEntries, totalPages, pagedEntries,
      toggleLive, fetchLog, whitelistDomain, blacklistDomain, copyToClipboard,
      listOutline,
    };
  },
});
</script>

<style scoped>
.log-header-row {
  display: grid; grid-template-columns: 90px 1fr 140px 80px 90px 80px;
  gap: 12px; padding: 8px 16px; background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle); font-family: var(--font-mono);
  font-size: 9px; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase;
}
.pagination-row { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 12px; }
@media (max-width: 768px) {
  .log-header-row { grid-template-columns: 70px 1fr 70px 60px; }
  .log-header-row span:nth-child(3), .log-header-row span:nth-child(4) { display: none; }
}
</style>
