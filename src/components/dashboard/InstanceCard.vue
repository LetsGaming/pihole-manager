<template>
  <div class="instance-overview-card" :class="instance.status">
    <!-- Header -->
    <div class="ioc-header">
      <div class="flex items-center gap-2">
        <div class="instance-status-dot" :class="`status-${instance.status}`" />
        <span class="ioc-name">{{ instance.name }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge" :class="blockingBadgeClass">{{
          blockingLabel
        }}</span>
        <button
          class="btn btn-ghost btn-sm btn-icon"
          :disabled="loading"
          title="Refresh"
          @click="$emit('refresh', instance.id)"
        >
          <ion-icon :icon="refreshOutline" style="font-size: 14px" />
        </button>
      </div>
    </div>

    <!-- Offline -->
    <div v-if="instance.status === 'offline'" class="ioc-offline">
      <ion-icon :icon="warningOutline" />
      <span>{{ error || "Cannot connect" }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !summary" class="ioc-skeleton">
      <div
        class="skeleton"
        style="height: 20px; width: 60%; margin-bottom: 8px"
      />
      <div class="skeleton" style="height: 20px; width: 40%" />
    </div>

    <!-- Stats -->
    <template v-else-if="summary">
      <div class="ioc-stats">
        <div class="ioc-stat">
          <div class="ioc-stat-label">QUERIES TODAY</div>
          <div class="ioc-stat-value">{{ fmt(summary.dns_queries_today) }}</div>
        </div>
        <div class="ioc-stat">
          <div class="ioc-stat-label">BLOCKED</div>
          <div class="ioc-stat-value red">
            {{ fmt(summary.ads_blocked_today) }}
          </div>
        </div>
        <div class="ioc-stat">
          <div class="ioc-stat-label">BLOCK RATE</div>
          <div class="ioc-stat-value cyan">
            {{ fmtPct(summary.ads_percentage_today) }}
          </div>
        </div>
        <div class="ioc-stat">
          <div class="ioc-stat-label">DOMAINS LIST</div>
          <div class="ioc-stat-value">
            {{ fmt(summary.domains_being_blocked) }}
          </div>
        </div>
      </div>

      <!-- Blocking toggle -->
      <div class="ioc-footer">
        <div class="ioc-url text-mono text-xs text-muted truncate">
          {{ instance.url }}
        </div>
        <label class="toggle toggle-wrap" style="gap: 8px; cursor: pointer">
          <input
            type="checkbox"
            :checked="summary.status === 'enabled'"
            @change="
              $emit(
                'toggle-blocking',
                instance.id,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span class="toggle-track" />
          <span class="text-xs" style="color: var(--text-muted)">Blocking</span>
        </label>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";
import { refreshOutline, warningOutline } from "ionicons/icons";
import type { PiholeInstance } from "@/types/instance";
import type { PiholeSummary } from "@/types/api";
import { useFormatting } from "@/composables/useFormatting";

export default defineComponent({
  name: "InstanceCard",
  components: { IonIcon },

  props: {
    instance: { type: Object as PropType<PiholeInstance>, required: true },
    summary: { type: Object as PropType<PiholeSummary | null>, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String as () => string | null, default: null },
  },

  emits: ["refresh", "toggle-blocking"],

  setup() {
    return { ...useFormatting(), refreshOutline, warningOutline };
  },

  computed: {
    blockingLabel(): string {
      if (!this.summary) return "Unknown";
      return this.summary.status === "enabled" ? "Blocking" : "Disabled";
    },
    blockingBadgeClass(): string {
      if (!this.summary) return "badge-gray";
      return this.summary.status === "enabled" ? "badge-green" : "badge-red";
    },
  },
});
</script>

<style scoped>
.instance-overview-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition:
    border-color 0.2s,
    transform 0.15s;
}
.instance-overview-card:hover {
  border-color: var(--border-dim);
  transform: translateY(-1px);
}
.instance-overview-card.online {
  border-top: 2px solid var(--status-online);
}
.instance-overview-card.offline {
  border-top: 2px solid var(--status-offline);
  opacity: 0.7;
}

.ioc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.ioc-name {
  font-weight: 600;
  font-size: 15px;
}
.ioc-offline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  color: var(--accent-red);
  font-size: 13px;
}
.ioc-skeleton {
  padding: 16px;
}
.ioc-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 8px 0;
}
.ioc-stat {
  padding: 10px 16px;
  border-right: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}
.ioc-stat:nth-child(even) {
  border-right: none;
}
.ioc-stat:nth-last-child(-n + 2) {
  border-bottom: none;
}
.ioc-stat-label {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.ioc-stat-value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
}
.ioc-stat-value.red {
  color: var(--accent-red);
}
.ioc-stat-value.cyan {
  color: var(--accent-cyan);
}
.ioc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
}
.ioc-url {
  max-width: 180px;
}
</style>
