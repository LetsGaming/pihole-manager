<template>
  <div class="hw-metric-card">
    <div class="hw-metric-label">{{ label }}</div>
    <div class="hw-metric-value" :style="{ color: valueColor }">
      {{ displayValue }}
    </div>
    <div class="hw-meter">
      <div class="hw-meter-bar-bg">
        <div
          class="hw-meter-bar-fill"
          :class="severityClass"
          :style="{ width: `${Math.min(100, barPercent)}%` }"
        />
      </div>
    </div>
    <div v-if="sub" class="text-xs text-muted mt-1">{{ sub }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "MetricGauge",
  props: {
    label: { type: String, required: true },
    displayValue: { type: String, required: true },
    /** 0–100 for the fill bar */
    barPercent: { type: Number, required: true },
    valueColor: { type: String, default: "var(--accent-cyan)" },
    /** 'normal' | 'warn' | 'crit' */
    severityClass: { type: String, default: "normal" },
    sub: { type: String, default: null },
  },
});
</script>

<style scoped>
.hw-metric-card {
  padding: var(--space-4);
  border-right: 1px solid var(--border-subtle);
}
.hw-metric-card:last-child {
  border-right: none;
}
.hw-metric-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-1);
}
.hw-metric-value {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
}
</style>
