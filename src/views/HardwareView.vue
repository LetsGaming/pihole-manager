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
import { defineComponent, reactive, onMounted, onBeforeUnmount } from "vue";
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

  setup() {
    const instanceStore = useInstanceStore();
    const notifications = useNotificationStore();

    const hwData: Record<string, HardwareInfo> = reactive({});
    const loading: Record<string, boolean> = reactive({});
    let refreshHandle: ReturnType<typeof setInterval> | null = null;

    async function fetchHardware(inst: (typeof instanceStore.instances)[0]) {
      loading[inst.id] = true;
      try {
        hwData[inst.id] = await HardwareService.getHardwareInfo(inst);
      } catch (err) {
        notifications.error(
          `Hardware fetch failed for ${inst.name}: ${(err as Error).message}`,
        );
        // Set an empty record so the card shows "limited data" rather than "waiting…"
        if (!hwData[inst.id]) {
          hwData[inst.id] = {
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
          };
        }
      } finally {
        loading[inst.id] = false;
      }
    }

    async function refreshAll() {
      await Promise.allSettled(instanceStore.instances.map(fetchHardware));
    }

    onMounted(() => {
      instanceStore.loadFromStorage();
      void refreshAll();
      refreshHandle = setInterval(() => void refreshAll(), REFRESH_INTERVAL_MS);
    });

    onBeforeUnmount(() => {
      if (refreshHandle !== null) clearInterval(refreshHandle);
    });

    return {
      instanceStore,
      hwData,
      loading,
      refreshAll,
      fetchHardware,
      refreshOutline,
      hardwareChipOutline,
    };
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
