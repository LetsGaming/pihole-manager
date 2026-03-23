/**
 * useMultiSort
 *
 * Returns a plain object with a `levels` array and helper methods.
 * The caller stores the whole object in data() so Vue wraps it reactive()
 * exactly once. Methods mutate `levels` in-place (push/splice) so Vue's
 * array-mutation tracking fires immediately — no assignment needed.
 *
 * Click behaviour (no modifier key — fully discoverable):
 *   Click inactive column  → append as next priority, asc
 *   Click active col (asc) → flip to desc
 *   Click active col (desc)→ remove
 *   × on pill              → remove that level
 *   "Clear sort"           → remove all levels
 */

export type SortDir = "asc" | "desc";

export interface SortLevel {
  col: string;
  dir: SortDir;
}

export interface MultiSort {
  /** Reactive sort levels — mutated in-place so Vue tracks changes. */
  levels: SortLevel[];

  toggle(col: string): void;
  remove(col: string): void;
  clear(): void;
  levelFor(col: string): SortLevel | undefined;
  priority(col: string): number;

  /**
   * Return a sorted copy of rows.
   * accessors: map from col key → value extractor. If absent, the col key
   * is used directly as a property name on the row object.
   */
  apply<T>(
    rows: T[],
    accessors?: Partial<
      Record<string, (row: T) => string | number | boolean | null | undefined>
    >,
  ): T[];
}

export function useMultiSort(): MultiSort {
  const sort: MultiSort = {
    levels: [],

    toggle(col) {
      const idx = sort.levels.findIndex((l) => l.col === col);
      if (idx === -1) {
        sort.levels.push({ col, dir: "asc" });
      } else if (sort.levels[idx].dir === "asc") {
        sort.levels.splice(idx, 1, { col, dir: "desc" });
      } else {
        sort.levels.splice(idx, 1);
      }
    },

    remove(col) {
      const idx = sort.levels.findIndex((l) => l.col === col);
      if (idx !== -1) sort.levels.splice(idx, 1);
    },

    clear() {
      sort.levels.splice(0);
    },

    levelFor(col) {
      return sort.levels.find((l) => l.col === col);
    },

    priority(col) {
      const idx = sort.levels.findIndex((l) => l.col === col);
      return idx === -1 ? 0 : idx + 1;
    },

    apply<T>(
      rows: T[],
      accessors: Partial<
        Record<string, (row: T) => string | number | boolean | null | undefined>
      > = {},
    ): T[] {
      if (!sort.levels.length) return rows;
      return [...rows].sort((a, b) => {
        for (const { col, dir } of sort.levels) {
          const getter = accessors[col];
          const av = getter ? getter(a) : (a as Record<string, unknown>)[col];
          const bv = getter ? getter(b) : (b as Record<string, unknown>)[col];
          let cmp = 0;
          if (av == null && bv == null) cmp = 0;
          else if (av == null) cmp = 1;
          else if (bv == null) cmp = -1;
          else if (typeof av === "number" && typeof bv === "number")
            cmp = av - bv;
          else
            cmp = String(av).localeCompare(String(bv), undefined, {
              numeric: true,
              sensitivity: "base",
            });
          if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    },
  };

  return sort;
}
