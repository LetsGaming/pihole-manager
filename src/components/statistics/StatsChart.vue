<template>
  <div class="card mb-3">
    <div class="card-header">
      <span class="card-title">QUERIES OVER TIME (24H)</span>
      <span v-if="instanceName" class="text-xs text-muted text-mono">{{
        instanceName
      }}</span>
    </div>
    <div v-if="loading" class="skeleton" style="height: 200px" />
    <div v-else-if="hasData">
      <canvas ref="chartCanvas" style="max-height: 200px" />
    </div>
    <div v-else class="text-center text-muted text-sm" style="padding: 40px 0">
      No time-series data available
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import type { PropType } from "vue";
import { Chart, registerables } from "chart.js";
import type { OverTimeData } from "@/types/api";

Chart.register(...registerables);

export default defineComponent({
  name: "StatsChart",

  props: {
    overTimeData: {
      type: Object as PropType<OverTimeData | null>,
      default: null,
    },
    loading: { type: Boolean, default: false },
    instanceName: { type: String as PropType<string | null>, default: null },
  },

  data() {
    return {
      chartInstance: null as Chart<"line", number[], string> | null,
    };
  },

  computed: {
    hasData(): boolean {
      return (
        !!this.overTimeData &&
        Object.keys(this.overTimeData.domains ?? {}).length > 0
      );
    },
  },

  watch: {
    overTimeData(newData: OverTimeData | null) {
      if (newData) {
        this.$nextTick(() => this.renderChart(newData));
      } else {
        this.destroyChart();
      }
    },
  },

  mounted() {
    if (this.overTimeData) {
      this.renderChart(this.overTimeData);
    }
  },

  beforeUnmount() {
    this.destroyChart();
  },

  methods: {
    destroyChart(): void {
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
    },

    renderChart(data: OverTimeData): void {
      this.destroyChart();
      const canvas = this.$refs.chartCanvas as HTMLCanvasElement | undefined;
      if (!canvas) return;

      // Determine chart colors from CSS variables for theme-awareness
      const style = getComputedStyle(document.documentElement);
      const gridColor =
        style.getPropertyValue("--chart-grid").trim() ||
        "rgba(255,255,255,0.04)";
      const tickColor =
        style.getPropertyValue("--chart-tick").trim() || "#475569";

      const labels = Object.keys(data.domains).map((t) =>
        new Date(parseInt(t, 10) * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );

      this.chartInstance = new Chart<"line", number[], string>(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Queries",
              data: Object.values(data.domains),
              borderColor: "#22d3ee",
              backgroundColor: "rgba(34,211,238,0.08)",
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
            },
            {
              label: "Blocked",
              data: Object.values(data.ads),
              borderColor: "#f87171",
              backgroundColor: "rgba(248,113,113,0.06)",
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          animation: false,
          plugins: {
            legend: {
              labels: {
                color: "#94a3b8",
                font: { family: "DM Sans", size: 12 },
              },
            },
            tooltip: {
              mode: "index",
              intersect: false,
            },
          },
          scales: {
            x: {
              ticks: {
                color: tickColor,
                maxTicksLimit: 12,
                font: { family: "Space Mono", size: 10 },
              },
              grid: { color: gridColor },
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: tickColor,
                font: { family: "Space Mono", size: 10 },
              },
              grid: { color: gridColor },
            },
          },
        },
      });
    },
  },
});
</script>
