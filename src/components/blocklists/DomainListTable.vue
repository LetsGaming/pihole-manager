<template>
  <div class="card">
    <div class="card-header">
      <span class="card-title">{{ title }} ({{ totalDisplayed }})</span>
      <div class="flex gap-2">
        <input
          class="field-input"
          style="width: 200px"
          :value="searchQuery"
          placeholder="Search domains…"
          @input="onSearch(($event.target as HTMLInputElement).value)"
        />
        <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">
          <ion-icon :icon="refreshOutline" />
        </button>
      </div>
    </div>

    <!-- Sort pills -->
    <div v-if="sortKey" class="sort-pills sort-pills--in-card">
      <span class="text-xs text-muted" style="line-height: 24px">Sort:</span>
      <span v-for="(level, idx) in sort.levels" :key="level.col" class="sort-pill">
        <span class="sort-pill-priority">{{ idx + 1 }}</span>
        {{ COLUMN_LABELS[level.col] ?? level.col }}
        {{ level.dir === "asc" ? "↑" : "↓" }}
        <button class="sort-pill-remove" @click="onSortRemove(level.col)">×</button>
      </span>
      <button class="btn btn-ghost btn-sm" style="padding: 2px 8px; font-size: 11px" @click="onSortClear">
        Clear sort
      </button>
    </div>

    <div v-if="loading" class="p-3">
      <div v-for="i in 4" :key="i" class="skeleton" style="height: 40px; margin-bottom: 6px" />
    </div>

    <table v-else class="data-table">
      <thead>
        <tr>
          <SortableHeader col="domain"  label="Domain"  :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
          <SortableHeader col="comment" label="Comment" :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
          <SortableHeader col="date"    label="Added"   :sort="sort" :sort-key="sortKey" @sort-changed="onSortChanged" />
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in displayedEntries" :key="entry.id">
          <td class="mono">{{ entry.domain }}</td>
          <td style="color: var(--text-muted); font-size: 12px">{{ entry.comment || "—" }}</td>
          <td class="text-xs text-muted">
            {{ fmtDate(entry.date_added ? entry.date_added * 1000 : null) }}
          </td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm btn-icon" @click="$emit('copy', entry.domain)">
                <ion-icon :icon="copyOutline" />
              </button>
              <button class="btn btn-danger btn-sm btn-icon" @click="$emit('remove', entry.domain)">
                <ion-icon :icon="trashOutline" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="!displayedEntries.length">
          <td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted)">
            {{ searchQuery ? "No matching entries" : "List is empty" }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import type { PropType } from "vue";
import { IonIcon } from "@ionic/vue";
import { refreshOutline, copyOutline, trashOutline } from "ionicons/icons";
import type { DomainEntry } from "@/types/api";
import { useFormatting } from "@/composables/useFormatting";
import { useMultiSort } from "@/composables/useMultiSort";
import type { MultiSort } from "@/composables/useMultiSort";
import SortableHeader from "@/components/ui/SortableHeader.vue";

const COLUMN_LABELS: Record<string, string> = {
  domain:  "Domain",
  comment: "Comment",
  date:    "Added",
};

const ACCESSORS: Partial<Record<string, (e: DomainEntry) => string | number | null>> = {
  domain:  (e) => e.domain,
  comment: (e) => e.comment || "",
  date:    (e) => e.date_added ?? null,
};

export default defineComponent({
  name: "DomainListTable",
  components: { IonIcon, SortableHeader },

  props: {
    title:       { type: String,                           required: true },
    entries:     { type: Array as PropType<DomainEntry[]>, default: () => [] },
    searchQuery: { type: String,                           default: "" },
    loading:     { type: Boolean,                          default: false },
  },

  emits: ["update:searchQuery", "refresh", "remove", "copy"],

  data() {
    const { fmtDate } = useFormatting();
    return {
      sort:             markRaw(useMultiSort()) as MultiSort,
      sortKey:          "" as string,
      _rawEntries:      markRaw([] as DomainEntry[]),
      _searchQuery:     "" as string,   // internal copy, avoids prop-watch lag
      displayedEntries: [] as DomainEntry[],
      totalDisplayed:   0  as number,
      fmtDate,
      COLUMN_LABELS,
      refreshOutline,
      copyOutline,
      trashOutline,
    };
  },

  watch: {
    // Sync raw entries when the parent provides a new list
    entries: {
      immediate: true,
      handler(newEntries: DomainEntry[]) {
        // entries prop may already be markRaw from the parent; markRaw again
        // is a no-op on an already-raw value but safe to call regardless.
        this._rawEntries = markRaw(newEntries as DomainEntry[]);
        this._rebuild();
      },
    },
    // Sync search query from parent (v-model:search-query)
    searchQuery(val: string) {
      this._searchQuery = val;
      this._rebuild();
    },
    sortKey() {
      this._rebuild();
    },
  },

  methods: {
    onSearch(val: string): void {
      this._searchQuery = val;
      this.$emit("update:searchQuery", val);
      this._rebuild();
    },

    onSortChanged(): void {
      this.sortKey = this.sort.levels.map((l) => `${l.col}:${l.dir}`).join(",");
    },

    onSortRemove(col: string): void {
      this.sort.remove(col);
      this.onSortChanged();
    },

    onSortClear(): void {
      this.sort.clear();
      this.onSortChanged();
    },

    _rebuild(): void {
      const q = this._searchQuery.toLowerCase();

      // 1. Filter on raw plain objects — no Proxy overhead
      let result: DomainEntry[] = this._rawEntries as DomainEntry[];
      if (q) {
        result = result.filter((e) => e.domain.toLowerCase().includes(q));
      }

      // 2. Sort
      if (this.sort.levels.length) {
        result = this.sort.apply(result, ACCESSORS);
      }

      // 3. Write results — Vue only tracks these scalar/ref changes
      this.totalDisplayed   = result.length;
      this.displayedEntries = result;
    },
  },
});
</script>
