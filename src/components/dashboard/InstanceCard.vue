<template>
  <div class="instance-card" :class="instance.status">
    <!-- Header -->
    <div class="ic-header">
      <div class="ic-header-left">
        <div class="instance-status-dot" :class="`status-${instance.status}`" />
        <span class="ic-name">{{ instance.name }}</span>
      </div>
      <div class="ic-header-right">
        <span class="badge" :class="blockingBadgeClass">{{
          blockingLabel
        }}</span>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          :disabled="loading"
          :aria-label="`Refresh ${instance.name}`"
          title="Refresh"
          @click="$emit('refresh', instance.id)"
        >
          <ion-icon :icon="refreshOutline" style="font-size: 13px" />
        </button>
      </div>
    </div>

    <!-- Offline -->
    <div v-if="instance.status === 'offline'" class="ic-offline">
      <ion-icon :icon="warningOutline" aria-hidden="true" />
      <span>{{ error || "Cannot connect" }}</span>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="loading && !summary" class="ic-skeleton">
      <div
        class="skeleton"
        style="height: 18px; width: 55%; margin-bottom: 8px"
      />
      <div class="skeleton" style="height: 18px; width: 38%" />
    </div>

    <!-- Stats -->
    <template v-else-if="summary">
      <div class="ic-stats">
        <div class="ic-stat">
          <div class="ic-stat-label">Queries</div>
          <div class="ic-stat-value">{{ fmt(summary.dns_queries_today) }}</div>
        </div>
        <div class="ic-stat">
          <div class="ic-stat-label">Blocked</div>
          <div class="ic-stat-value" style="color: var(--color-red)">
            {{ fmt(summary.ads_blocked_today) }}
          </div>
        </div>
        <div class="ic-stat">
          <div class="ic-stat-label">Block rate</div>
          <div class="ic-stat-value" style="color: var(--accent)">
            {{ fmtPct(summary.ads_percentage_today) }}
          </div>
        </div>
        <div class="ic-stat">
          <div class="ic-stat-label">Domains</div>
          <div class="ic-stat-value">
            {{ fmt(summary.domains_being_blocked) }}
          </div>
        </div>
      </div>

      <div class="ic-footer">
        <span class="ic-url text-mono text-xs text-muted truncate">{{
          instance.url
        }}</span>
        <label
          class="toggle-wrap"
          style="cursor: pointer"
          :aria-label="`Toggle blocking for ${instance.name}`"
        >
          <span class="text-xs text-muted">Blocking</span>
          <span class="toggle">
            <input
              type="checkbox"
              :checked="summary.status === 'enabled'"
              @change="
                $emit(
                  'toggle-blocking',
                  instance.id,
                  summary.status !== 'enabled',
                )
              "
            />
            <span class="toggle-track" />
          </span>
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

const { fmt, fmtPct } = useFormatting();

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

  data() {
    return { fmt, fmtPct, refreshOutline, warningOutline };
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
.instance-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition:
    border-color var(--duration-base) var(--ease-out),
    box-shadow var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}
.instance-card:hover {
  border-color: var(--border-dim);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
/* Status top-stripe */
.instance-card::before {
  content: "";
  display: block;
  height: 2px;
}
.instance-card.online::before {
  background: var(--status-online);
}
.instance-card.offline::before {
  background: var(--status-offline);
}
.instance-card.offline {
  opacity: 0.7;
}

/* Header */
.ic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px var(--space-4) 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.ic-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ic-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ic-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

/* Offline */
.ic-offline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-4);
  color: var(--color-red);
  font-size: 13px;
}

/* Skeleton */
.ic-skeleton {
  padding: var(--space-4);
}

/* Stats grid */
.ic-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.ic-stat {
  padding: 10px var(--space-4);
  border-right: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}
.ic-stat:nth-child(even) {
  border-right: none;
}
.ic-stat:nth-last-child(-n + 2) {
  border-bottom: none;
}

.ic-stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 3px;
  font-family: var(--font-mono);
}
.ic-stat-value {
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

/* Footer */
.ic-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px var(--space-4);
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
}
.ic-url {
  max-width: 160px;
}
</style>
