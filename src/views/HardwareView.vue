<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Hardware">
      <template #actions>
        <button class="btn btn-ghost btn-sm" @click="refreshAll">
          <ion-icon :icon="refreshOutline" />
          Refresh
        </button>
      </template>
    </PageHeader>

    <ion-content class="page-content">
      <EmptyState
        v-if="!instanceStore.instances.length"
        :icon="hardwareChipOutline"
        title="No instances configured"
      />
      <div v-else class="hw-instances-grid">
        <HardwareCard
          v-for="inst in instanceStore.instances"
          :key="inst.id"
          :instance="inst"
          :hw-data="hwData[inst.id] ?? null"
          :loading="loading[inst.id] ?? false"
          @refresh="fetchHardware(inst)"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import { refreshOutline, hardwareChipOutline } from "ionicons/icons";

import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import HardwareCard from "@/components/hardware/HardwareCard.vue";

import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";
import HardwareService from "@/services/hardwareService";
import type { HardwareInfo } from "@/types/hardware";

const REFRESH_INTERVAL_MS = 15_000;

export default defineComponent({
  name: "HardwareView",
  components: {
    IonPage,
    IonContent,
    IonIcon,
    PageHeader,
    EmptyState,
    HardwareCard,
  },

  data() {
    return {
      instanceStore: useInstanceStore(),
      notifications: useNotificationStore(),
      hwData: {} as Record<string, HardwareInfo>,
      loading: {} as Record<string, boolean>,
      // Track in-flight fetches per instance to prevent concurrent races
      _inFlight: {} as Record<string, boolean>,
      refreshHandle: null as ReturnType<typeof setInterval> | null,
      _started: false,
      refreshOutline,
      hardwareChipOutline,
    };
  },

  // ionViewDidEnter fires once per navigation into the view, avoiding the
  // Ionic keep-alive double-mount that caused the first-load flash-to-null.
  ionViewDidEnter() {
    this._startIfNeeded();
  },

  // Fallback for non-Ionic environments / unit tests
  mounted() {
    this._startIfNeeded();
  },

  // ionViewDidLeave fires when navigating away — stop the interval so we
  // don't accumulate multiple polling loops across navigations.
  ionViewDidLeave() {
    this._stopPolling();
  },

  beforeUnmount() {
    this._stopPolling();
  },

  methods: {
    _startIfNeeded() {
      if (this._started) return;
      this._started = true;
      void this.refreshAll();
      this.refreshHandle = setInterval(
        () => void this.refreshAll(),
        REFRESH_INTERVAL_MS,
      );
    },

    _stopPolling() {
      if (this.refreshHandle !== null) {
        clearInterval(this.refreshHandle);
        this.refreshHandle = null;
      }
      this._started = false;
    },

    async fetchHardware(
      inst: ReturnType<typeof useInstanceStore>["instances"][0],
    ) {
      // Drop concurrent fetches for the same instance — the in-flight one
      // will write the result when it lands.
      if (this._inFlight[inst.id]) return;
      this._inFlight = { ...this._inFlight, [inst.id]: true };

      // Only show the loading skeleton when we have no data yet.
      // When we already have stale data, keep it visible to avoid flicker.
      const hasExistingData = !!this.hwData[inst.id];
      if (!hasExistingData) {
        this.loading = { ...this.loading, [inst.id]: true };
      }

      try {
        const result = await HardwareService.getHardwareInfo(inst);
        this.hwData = { ...this.hwData, [inst.id]: result };
      } catch (err) {
        this.notifications.error(
          `Hardware fetch failed for ${inst.name}: ${(err as Error).message}`,
        );
        // Only write an empty placeholder when there is nothing to show yet,
        // so the card doesn't revert from real data to "Waiting for data".
        if (!this.hwData[inst.id]) {
          this.hwData = {
            ...this.hwData,
            [inst.id]: {
              cpuLoad: null,
              cpuTemp: null,
              cpuModel: null,
              cpuCores: null,
              memTotal: null,
              memUsed: null,
              memFree: null,
              memPercent: null,
              diskTotal: null,
              diskUsed: null,
              diskPercent: null,
              hostname: null,
              ipAddress: null,
              interface: null,
              uptimeSeconds: null,
              uptimeFormatted: null,
              piholeVersion: null,
              ftlVersion: null,
              webVersion: null,
              domainsBlocked: null,
              gravityLastUpdate: null,
            },
          };
        }
      } finally {
        this._inFlight = { ...this._inFlight, [inst.id]: false };
        this.loading = { ...this.loading, [inst.id]: false };
      }
    },

    async refreshAll() {
      await Promise.allSettled(
        this.instanceStore.instances.map((inst) => this.fetchHardware(inst)),
      );
    },
  },
});
</script>

<style scoped>
.hw-instances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}
@media (max-width: 600px) {
  .hw-instances-grid {
    grid-template-columns: 1fr;
  }
}
</style>
