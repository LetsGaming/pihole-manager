<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Statistics">
      <template #actions>
        <select v-model="selectedInstanceId" class="field-input" style="width:160px">
          <option v-for="inst in instanceStore.instances" :key="inst.id" :value="inst.id">
            {{ inst.name }}
          </option>
        </select>
      </template>
    </PageHeader>

    <ion-content class="page-content">
      <EmptyState v-if="!instanceStore.instances.length" title="No instances configured" />

      <template v-else>
        <div class="stat-grid mb-3">
          <StatCard label="Queries Today" :value="fmt(summary?.dns_queries_today)" />
          <StatCard label="Blocked Today" :value="fmt(summary?.ads_blocked_today)" accent="red" />
          <StatCard label="Block Rate" :value="fmtPct(summary?.ads_percentage_today)" accent="cyan" />
          <StatCard label="Domains Blocked" :value="fmt(summary?.domains_being_blocked)" accent="purple" />
          <StatCard label="Unique Clients" :value="fmt(summary?.unique_clients)" accent="green" />
          <StatCard label="Queries Cached" :value="fmt(summary?.queries_cached)" accent="amber" />
        </div>

        <div class="card mb-3">
          <div class="card-header"><span class="card-title">QUERIES OVER TIME (24H)</span></div>
          <div v-if="isLoadingCharts" class="skeleton" style="height:200px" />
          <canvas v-else ref="overTimeChart" style="max-height:200px" />
        </div>

        <div class="two-col-grid mb-3">
          <div class="card">
            <div class="card-header"><span class="card-title">TOP QUERIED DOMAINS</span></div>
            <div v-if="isLoadingTop" class="p-3">
              <div v-for="i in 5" :key="i" class="skeleton" style="height:30px;margin-bottom:6px" />
            </div>
            <template v-else>
              <TopDomainsBar
                v-for="(count, domain) in topDomains" :key="domain"
                :domain="domain" :count="count" :width="barWidth(count, maxTopDomain)"
              />
            </template>
          </div>
          <div class="card">
            <div class="card-header"><span class="card-title">TOP BLOCKED DOMAINS</span></div>
            <div v-if="isLoadingTop" class="p-3">
              <div v-for="i in 5" :key="i" class="skeleton" style="height:30px;margin-bottom:6px" />
            </div>
            <template v-else>
              <TopDomainsBar
                v-for="(count, domain) in topBlocked" :key="domain"
                :domain="domain" :count="count" :width="barWidth(count, maxTopBlocked)" variant="blocked"
              />
              <div v-if="!Object.keys(topBlocked).length" class="text-muted text-sm" style="padding:12px">
                No blocked domains yet
              </div>
            </template>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">TOP CLIENTS</span></div>
          <div v-if="isLoadingTop" class="p-3">
            <div v-for="i in 3" :key="i" class="skeleton" style="height:30px;margin-bottom:6px" />
          </div>
          <template v-else>
            <TopDomainsBar
              v-for="(count, client) in topClients" :key="client"
              :domain="client" :count="count" :width="barWidth(count, maxTopClient)" variant="green"
            />
          </template>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import { Chart, registerables } from 'chart.js';

import PageHeader    from '@/components/ui/PageHeader.vue';
import EmptyState    from '@/components/ui/EmptyState.vue';
import StatCard      from '@/components/ui/StatCard.vue';
import TopDomainsBar from '@/components/ui/TopDomainsBar.vue';

import { useInstanceStore } from '@/stores/instanceStore';
import { useFormatting }    from '@/composables/useFormatting';
import PiholeApiService     from '@/services/piholeApi';
import type { PiholeSummary, TopDomainsMap, TopClientsMap } from '@/types/api';

export default defineComponent({
  name: 'StatisticsView',
  components: { IonPage, IonContent, PageHeader, EmptyState, StatCard, TopDomainsBar },

  setup() {
    Chart.register(...registerables);
    const instanceStore = useInstanceStore();
    const { fmt, fmtPct, barWidth } = useFormatting();

    const selectedInstanceId = ref<string | null>(null);
    const summary       = ref<PiholeSummary | null>(null);
    const topDomains    = ref<TopDomainsMap>({});
    const topBlocked    = ref<TopDomainsMap>({});
    const topClients    = ref<TopClientsMap>({});
    const isLoadingCharts = ref(false);
    const isLoadingTop    = ref(false);
    const overTimeChart   = ref<HTMLCanvasElement | null>(null);
    let chartInstance: Chart | null = null;

    const currentInstance = computed(() =>
      instanceStore.instances.find((i) => i.id === selectedInstanceId.value) ?? null,
    );
    const maxTopDomain  = computed(() => Math.max(...Object.values(topDomains.value), 1));
    const maxTopBlocked = computed(() => Math.max(...Object.values(topBlocked.value), 1));
    const maxTopClient  = computed(() => Math.max(...Object.values(topClients.value), 1));

    async function loadData() {
      if (!currentInstance.value) return;
      summary.value = instanceStore.summaryData[selectedInstanceId.value!] ?? null;
      await Promise.allSettled([loadOverTime(), loadTopData()]);
    }

    async function loadOverTime() {
      if (!currentInstance.value) return;
      isLoadingCharts.value = true;
      try {
        const data = await PiholeApiService.getOverTimeData(currentInstance.value);
        renderChart(data.domains, data.ads);
      } finally { isLoadingCharts.value = false; }
    }

    async function loadTopData() {
      if (!currentInstance.value) return;
      isLoadingTop.value = true;
      try {
        const [top, clients] = await Promise.all([
          PiholeApiService.getTopDomains(currentInstance.value, 10),
          PiholeApiService.getTopClients(currentInstance.value, 10),
        ]);
        topDomains.value = top.topDomains;
        topBlocked.value = top.topBlocked;
        topClients.value = clients;
      } finally { isLoadingTop.value = false; }
    }

    function renderChart(domains: Record<string, number>, ads: Record<string, number>) {
      if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
      const canvas = overTimeChart.value;
      if (!canvas) return;
      const labels = Object.keys(domains).map((t) =>
        new Date(parseInt(t, 10) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      );
      chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Queries', data: Object.values(domains), borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.08)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 },
            { label: 'Blocked', data: Object.values(ads),    borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.06)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: true, animation: false,
          plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 } } } },
          scales: {
            x: { ticks: { color: '#475569', maxTicksLimit: 12, font: { family: 'Space Mono', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y: { beginAtZero: true, ticks: { color: '#475569', font: { family: 'Space Mono', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          },
        },
      });
    }

    watch(selectedInstanceId, (id) => { if (id) void loadData(); });

    onMounted(() => {
      instanceStore.loadFromStorage();
      selectedInstanceId.value = instanceStore.activeInstanceId ?? instanceStore.instances[0]?.id ?? null;
      if (selectedInstanceId.value) void loadData();
    });

    onBeforeUnmount(() => { if (chartInstance) { chartInstance.destroy(); chartInstance = null; } });

    return {
      instanceStore, selectedInstanceId, summary, topDomains, topBlocked, topClients,
      isLoadingCharts, isLoadingTop, overTimeChart,
      maxTopDomain, maxTopBlocked, maxTopClient,
      fmt, fmtPct, barWidth,
    };
  },
});
</script>

<style scoped>
.two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .two-col-grid { grid-template-columns: 1fr; } }
</style>
