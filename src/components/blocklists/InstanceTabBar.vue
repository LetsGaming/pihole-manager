<template>
  <div class="instance-tabs mb-3">
    <button
      v-for="inst in instances"
      :key="inst.id"
      class="instance-tab"
      :class="{
        active: selectedId === inst.id,
        offline: inst.status !== 'online',
      }"
      @click="$emit('select', inst.id)"
    >
      <div class="instance-status-dot" :class="`status-${inst.status}`" />
      {{ inst.name }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import type { PiholeInstance } from "@/types/instance";

export default defineComponent({
  name: "InstanceTabBar",
  props: {
    instances: { type: Array as PropType<PiholeInstance[]>, required: true },
    selectedId: { type: String, default: null },
  },
  emits: ["select"],
});
</script>

<style scoped>
.instance-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.instance-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.instance-tab:hover {
  border-color: var(--border-dim);
}
.instance-tab.active {
  border-color: var(--accent-cyan-dim);
  color: var(--accent-cyan);
  background: var(--accent-cyan-glow);
}
.instance-tab.offline {
  opacity: 0.5;
}
</style>
