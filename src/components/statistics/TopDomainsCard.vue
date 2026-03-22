<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title">{{ title }}</span>
      <span v-if="!loading && count > 0" class="badge badge-gray">{{
        count
      }}</span>
    </div>
    <div v-if="loading" class="p-3">
      <div
        v-for="i in 5"
        :key="i"
        class="skeleton"
        style="height: 30px; margin-bottom: 6px"
      />
    </div>
    <template v-else-if="count > 0">
      <TopDomainsBar
        v-for="(itemCount, domain) in domains"
        :key="domain"
        :domain="String(domain)"
        :count="itemCount"
        :width="barWidth(itemCount, maxCount)"
        :variant="variant"
      />
    </template>
    <div
      v-else
      class="text-muted text-sm"
      style="padding: 20px 16px; text-align: center"
    >
      {{ emptyMessage }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import TopDomainsBar from "@/components/ui/TopDomainsBar.vue";
import { useFormatting } from "@/composables/useFormatting";
import type { TopDomainsMap, TopClientsMap } from "@/types/api";

export default defineComponent({
  name: "TopDomainsCard",
  components: { TopDomainsBar },

  props: {
    title: { type: String, required: true },
    domains: {
      type: Object as PropType<TopDomainsMap | TopClientsMap>,
      default: () => ({}),
    },
    loading: { type: Boolean, default: false },
    /** Bar fill color variant: '' | 'blocked' | 'green' */
    variant: { type: String, default: "" },
    emptyMessage: { type: String, default: "No data yet" },
  },

  data() {
    const { barWidth } = useFormatting();
    return { barWidth };
  },

  computed: {
    count(): number {
      return Object.keys(this.domains).length;
    },
    maxCount(): number {
      const vals = Object.values(this.domains) as number[];
      return Math.max(...vals, 1);
    },
  },
});
</script>
