<template>
  <div class="stat-card" :class="accent">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-number" :style="accent ? { color: `var(--accent-${accent})` } : {}">
      {{ value }}
    </div>
    <div v-if="sub" class="stat-sub">{{ sub }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'StatCard',
  props: {
    label:  { type: String,  required: true },
    value:  { type: String,  required: true },
    accent: { type: String,  default: null },   // 'red' | 'cyan' | 'green' | 'amber' | 'purple'
    sub:    { type: String,  default: null },
  },
});
</script>
