<template>
  <component
    :is="tag"
    class="sortable-th"
    :class="{ active: isActive }"
    :aria-sort="ariaSort"
    @click="onClick"
  >
    <span class="sortable-th-content">
      <span>{{ label || col }}</span>
      <span class="sortable-th-icons">
        <span
          v-if="showPriority"
          class="sort-priority-badge"
          :title="`Sort priority ${priority}`"
        >{{ priority }}</span>
        <span class="sort-arrow" :class="{ visible: isActive }">
          {{ dir === "asc" ? "↑" : "↓" }}
        </span>
      </span>
    </span>
  </component>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import type { MultiSort, SortLevel } from "@/composables/useMultiSort";

export default defineComponent({
  name: "SortableHeader",

  props: {
    col:   { type: String,                        required: true },
    label: { type: String,                        default: "" },
    sort:  { type: Object as PropType<MultiSort>, required: true },
    tag:   { type: String,                        default: "th" },
    /**
     * Reactive fingerprint of the sort state, passed down from the parent
     * so this component re-renders when the sort changes even though sort
     * is markRaw. If omitted the component falls back to reading sort.levels
     * directly (works when sort is fully reactive).
     */
    sortKey: { type: String, default: "" },
  },

  emits: ["sort-changed"],

  computed: {
    /** Current level entry for this column — derived from sort.levels. */
    level(): SortLevel | undefined {
      // Depend on sortKey so Vue re-evaluates this when the parent updates it
      void this.sortKey;
      return this.sort.levelFor(this.col);
    },
    isActive(): boolean  { return !!this.level; },
    dir(): "asc" | "desc" { return this.level?.dir ?? "asc"; },
    priority(): number   {
      void this.sortKey;
      return this.sort.priority(this.col);
    },
    showPriority(): boolean {
      void this.sortKey;
      return this.isActive && this.sort.levels.length > 1;
    },
    ariaSort(): "ascending" | "descending" | "none" {
      if (!this.isActive) return "none";
      return this.dir === "asc" ? "ascending" : "descending";
    },
  },

  methods: {
    onClick(): void {
      this.sort.toggle(this.col);
      // Emit immediately so the parent can update its sortKey reactive signal
      // in the same synchronous call — no nextTick delay.
      this.$emit("sort-changed");
    },
  },
});
</script>

<style scoped>
.sortable-th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: color 0.15s;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: normal;
  text-align: left;
  background: none;
  border: none;
  /* No display override — <th> keeps table-cell, <div> keeps block.
     Flex layout lives on the inner content span instead. */
}
.sortable-th:hover  { color: var(--text-primary); }
.sortable-th.active { color: var(--accent-cyan); }

.sortable-th-content {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  /* Inherit cursor so the whole cell feels clickable */
}
.sortable-th-icons {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.sort-arrow {
  opacity: 0.25;
  transition: opacity 0.15s;
  font-size: 13px;
  line-height: 1;
}
.sort-arrow.visible { opacity: 1; }
.sortable-th:hover .sort-arrow:not(.visible) { opacity: 0.5; }

.sort-priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--accent-cyan);
  color: var(--bg-base);
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
}
</style>
