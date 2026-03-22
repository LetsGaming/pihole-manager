<template>
  <div class="hw-metric-card">
    <div class="hw-metric-label">{{ label }}</div>
    <div class="hw-metric-value" :style="{ color: valueColor }">{{ displayValue }}</div>
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
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MetricGauge',
  props: {
    label:       { type: String,  required: true },
    displayValue:{ type: String,  required: true },
    /** 0–100 for the fill bar */
    barPercent:  { type: Number,  required: true },
    valueColor:  { type: String,  default: 'var(--accent-cyan)' },
    /** 'normal' | 'warn' | 'crit' */
    severityClass:{ type: String, default: 'normal' },
    sub:         { type: String,  default: null },
  },
});
</script>
