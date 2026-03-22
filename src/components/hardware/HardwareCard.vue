<template>
  <div class="hw-instance-card card">
    <!-- Header -->
    <div class="hw-card-header">
      <div class="flex items-center gap-2">
        <div class="instance-status-dot" :class="`status-${instance.status}`" />
        <span style="font-weight: 600; font-size: 15px">{{
          instance.name
        }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted text-mono">{{ instance.url }}</span>
        <button
          class="btn btn-ghost btn-sm btn-icon"
          title="Refresh"
          @click="$emit('refresh')"
        >
          <ion-icon :icon="refreshOutline" />
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="hw-loading">
      <div
        v-for="i in 4"
        :key="i"
        class="skeleton"
        style="height: 60px; margin-bottom: 10px"
      />
    </div>

    <!-- Offline -->
    <div v-else-if="instance.status === 'offline'" class="ioc-offline">
      <ion-icon :icon="warningOutline" />
      Cannot connect to instance
    </div>

    <!-- No data yet -->
    <div
      v-else-if="!hwData"
      class="ioc-offline"
      style="color: var(--text-muted)"
    >
      <ion-icon :icon="refreshOutline" />
      Waiting for data…
    </div>

    <!-- Data -->
    <template v-else>
      <div class="hw-metrics-grid">
        <MetricGauge
          v-if="hwData.cpuLoad != null"
          label="CPU LOAD"
          :display-value="`${hwData.cpuLoad.toFixed(1)}%`"
          :bar-percent="hwData.cpuLoad"
          :value-color="loadColor(hwData.cpuLoad)"
          :severity-class="hwService.severityClass(hwData.cpuLoad)"
          :sub="
            hwData.cpuCores
              ? `${hwData.cpuCores} core${hwData.cpuCores > 1 ? 's' : ''}`
              : undefined
          "
        />
        <MetricGauge
          v-if="hwData.cpuTemp != null"
          label="CPU TEMP"
          :display-value="`${hwData.cpuTemp.toFixed(1)}°C`"
          :bar-percent="(hwData.cpuTemp / 100) * 100"
          :value-color="tempColor(hwData.cpuTemp)"
          :severity-class="hwService.tempSeverity(hwData.cpuTemp)"
        />
        <MetricGauge
          v-if="hwData.memPercent != null"
          label="MEMORY"
          :display-value="`${Number(hwData.memPercent).toFixed(1)}%`"
          :bar-percent="hwData.memPercent"
          :value-color="loadColor(hwData.memPercent)"
          :severity-class="hwService.severityClass(hwData.memPercent)"
          :sub="memSub"
        />
        <MetricGauge
          v-if="hwData.diskPercent != null"
          label="DISK USAGE"
          :display-value="`${hwData.diskPercent.toFixed(0)}%`"
          :bar-percent="hwData.diskPercent"
          :value-color="loadColor(hwData.diskPercent)"
          :severity-class="hwService.severityClass(hwData.diskPercent)"
          :sub="diskSub"
        />
      </div>

      <!-- Info rows — only rendered when non-null -->
      <div class="hw-info-table mt-3">
        <div v-if="hwData.hostname" class="hw-info-row">
          <span class="hw-info-label">Hostname</span>
          <span class="hw-info-value mono">{{ hwData.hostname }}</span>
        </div>
        <div v-if="hwData.ipAddress" class="hw-info-row">
          <span class="hw-info-label">IP Address</span>
          <span class="hw-info-value mono">{{ hwData.ipAddress }}</span>
        </div>
        <div v-if="hwData.uptimeFormatted" class="hw-info-row">
          <span class="hw-info-label">Uptime</span>
          <span class="hw-info-value">{{ hwData.uptimeFormatted }}</span>
        </div>
        <div v-if="hwData.cpuModel" class="hw-info-row">
          <span class="hw-info-label">CPU Model</span>
          <span class="hw-info-value">{{ hwData.cpuModel }}</span>
        </div>
        <div v-if="hwData.piholeVersion" class="hw-info-row">
          <span class="hw-info-label">Pi-hole</span>
          <span class="hw-info-value mono badge badge-cyan">{{
            hwData.piholeVersion
          }}</span>
        </div>
        <div v-if="hwData.ftlVersion" class="hw-info-row">
          <span class="hw-info-label">FTL</span>
          <span class="hw-info-value mono">{{ hwData.ftlVersion }}</span>
        </div>
        <div v-if="hwData.webVersion" class="hw-info-row">
          <span class="hw-info-label">Web</span>
          <span class="hw-info-value mono">{{ hwData.webVersion }}</span>
        </div>
        <div v-if="hwData.domainsBlocked" class="hw-info-row">
          <span class="hw-info-label">Domains Blocked</span>
          <span class="hw-info-value mono">{{
            Number(hwData.domainsBlocked).toLocaleString()
          }}</span>
        </div>
        <div v-if="hwData.gravityLastUpdate" class="hw-info-row">
          <span class="hw-info-label">Gravity Updated</span
          ><span class="hw-info-value">{{
            fmtDateTime(hwData.gravityLastUpdate)
          }}</span>
        </div>
      </div>

      <div
        v-if="noData"
        class="text-muted text-sm"
        style="padding: 12px; text-align: center"
      >
        Limited hardware data available — normal for VMs or restricted
        environments.
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";
import { warningOutline, refreshOutline } from "ionicons/icons";
import MetricGauge from "@/components/ui/MetricGauge.vue";
import HardwareService from "@/services/hardwareService";
import type { PiholeInstance } from "@/types/instance";
import type { HardwareInfo } from "@/types/hardware";
import { useFormatting } from "@/composables/useFormatting";

const { loadColor, tempColor, fmtDateTime } = useFormatting();

export default defineComponent({
  name: "HardwareCard",
  components: { IonIcon, MetricGauge },

  props: {
    instance: { type: Object as PropType<PiholeInstance>, required: true },
    hwData: { type: Object as PropType<HardwareInfo | null>, default: null },
    loading: { type: Boolean, default: false },
  },

  emits: ["refresh"],

  data() {
    return {
      loadColor,
      tempColor,
      fmtDateTime,
      hwService: HardwareService,
      warningOutline,
      refreshOutline,
    };
  },

  computed: {
    memSub(): string | undefined {
      if (!this.hwData?.memUsed || !this.hwData?.memTotal) return undefined;
      return `${HardwareService.formatBytes(this.hwData.memUsed)} / ${HardwareService.formatBytes(this.hwData.memTotal)}`;
    },
    diskSub(): string | undefined {
      if (!this.hwData?.diskUsed || !this.hwData?.diskTotal) return undefined;
      return `${HardwareService.formatBytes(this.hwData.diskUsed)} / ${HardwareService.formatBytes(this.hwData.diskTotal)}`;
    },
    noData(): boolean {
      const d = this.hwData;
      if (!d) return true;
      return [
        d.cpuLoad,
        d.cpuTemp,
        d.memPercent,
        d.diskPercent,
        d.hostname,
        d.uptimeFormatted,
      ].every((v) => v == null);
    },
  },
});
</script>

<style scoped>
.hw-instance-card { padding: 0; overflow: hidden; }
.hw-card-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: var(--space-2); }
.hw-loading { padding: var(--space-5); }
.hw-metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); border-bottom: 1px solid var(--border-subtle); }
.hw-info-table { border-top: 1px solid var(--border-subtle); }
.hw-info-row { display: flex; align-items: center; justify-content: space-between; padding: 8px var(--space-5); border-bottom: 1px solid var(--border-subtle); gap: var(--space-3); }
.hw-info-row:last-child { border-bottom: none; }
.hw-info-label { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
.hw-info-value { font-size: 13px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hw-info-value.mono { font-family: var(--font-mono); font-size: 12px; }
.ioc-offline { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-5); color: var(--color-red); font-size: 13px; }
</style>
