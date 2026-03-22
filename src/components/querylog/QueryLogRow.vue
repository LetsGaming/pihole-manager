<template>
  <div class="log-entry" :class="entry.status">
    <span class="log-time">{{ fmtTime(entry.timestamp) }}</span>
    <span class="log-domain" :title="entry.domain">{{ entry.domain }}</span>
    <span class="log-client">{{ entry.client }}</span>
    <span class="log-type text-xs text-muted">{{ entry.type }}</span>
    <span
      :class="
        entry.status === 'blocked'
          ? 'log-status-blocked'
          : entry.status === 'cached'
            ? 'log-status-cached'
            : 'log-status-allowed'
      "
      :title="entry.rawStatus ?? entry.status"
    >
      {{ entry.rawStatus ? entry.rawStatus.replace(/_/g, " ") : entry.status }}
    </span>
    <div class="log-actions">
      <button
        v-if="entry.status === 'blocked'"
        class="btn btn-ghost btn-sm btn-icon"
        title="Whitelist domain"
        @click="$emit('whitelist', entry.domain, entry._instanceId)"
      >
        <ion-icon
          :icon="checkmarkCircleOutline"
          style="color: var(--accent-green)"
        />
      </button>
      <button
        v-else
        class="btn btn-ghost btn-sm btn-icon"
        title="Blacklist domain"
        @click="$emit('blacklist', entry.domain, entry._instanceId)"
      >
        <ion-icon :icon="banOutline" style="color: var(--accent-red)" />
      </button>
      <button
        class="btn btn-ghost btn-sm btn-icon"
        title="Copy domain"
        @click="$emit('copy', entry.domain)"
      >
        <ion-icon :icon="copyOutline" />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";
import {
  checkmarkCircleOutline,
  banOutline,
  copyOutline,
} from "ionicons/icons";
import type { EnrichedQueryEntry } from "@/types/api";
import { useFormatting } from "@/composables/useFormatting";

export default defineComponent({
  name: "QueryLogRow",
  components: { IonIcon },

  props: {
    entry: { type: Object as PropType<EnrichedQueryEntry>, required: true },
  },

  emits: ["whitelist", "blacklist", "copy"],

  setup() {
    const { fmtTime } = useFormatting();
    return { fmtTime, checkmarkCircleOutline, banOutline, copyOutline };
  },
});
</script>
