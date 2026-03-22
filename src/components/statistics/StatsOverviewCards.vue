<template>
  <div class="stat-grid mb-3">
    <StatCard
      label="Queries Today"
      :value="fmt(summary?.dns_queries_today)"
      :icon="serverOutline"
    />
    <StatCard
      label="Blocked Today"
      :value="fmt(summary?.ads_blocked_today)"
      accent="red"
      :icon="shieldOutline"
    />
    <StatCard
      label="Block Rate"
      :value="fmtPct(summary?.ads_percentage_today)"
      accent="cyan"
      :icon="statsChartOutline"
    />
    <StatCard
      :label="aggregateMode ? 'Domains in Lists' : 'Domains Blocked'"
      :value="fmt(summary?.domains_being_blocked)"
      :sub="aggregateMode ? 'combined total' : null"
      accent="purple"
      :icon="listOutline"
    />

    <!-- Slot so callers can replace the last two cards (e.g. Dashboard) -->
    <slot name="extra-cards">
      <StatCard
        label="Unique Clients"
        :value="fmt(summary?.unique_clients)"
        :sub="aggregateMode ? 'across all instances' : null"
        accent="green"
        :icon="desktopOutline"
      />
      <StatCard
        label="Queries Cached"
        :value="fmt(summary?.queries_cached)"
        accent="amber"
        :icon="flashOutline"
      />
    </slot>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import {
  serverOutline,
  shieldOutline,
  statsChartOutline,
  listOutline,
  desktopOutline,
  flashOutline,
} from "ionicons/icons";
import StatCard from "@/components/ui/StatCard.vue";
import { useFormatting } from "@/composables/useFormatting";
import type { PiholeSummary } from "@/types/api";

export default defineComponent({
  name: "StatsOverviewCards",
  components: { StatCard },

  props: {
    summary: {
      type: Object as PropType<PiholeSummary | null>,
      default: null,
    },
    /**
     * When true, labels and sub-labels reflect aggregated-across-instances
     * semantics: clients are deduplicated from top-N data; domains_being_blocked
     * is a combined total (deduplication not possible via the API).
     */
    aggregateMode: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    const { fmt, fmtPct } = useFormatting();
    return {
      fmt,
      fmtPct,
      serverOutline,
      shieldOutline,
      statsChartOutline,
      listOutline,
      desktopOutline,
      flashOutline,
    };
  },
});
</script>
