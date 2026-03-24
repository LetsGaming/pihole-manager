<template>
  <ion-page class="page-wrapper">
    <PageHeader title="Sync Instances" />

    <ion-content class="page-content">
      <!-- No instances -->
      <EmptyState
        v-if="instanceStore.instances.length < 2"
        :icon="syncOutline"
        title="Not enough instances"
        subtitle="Add at least two Pi-hole instances in Settings to use sync."
      />

      <template v-else>
        <!-- ── Step 1: Source ── -->
        <div class="sync-section">
          <div class="section-label">1 — SOURCE INSTANCE</div>
          <p class="section-hint">Data will be read from this Pi-hole.</p>
          <div class="instance-grid">
            <button
              v-for="inst in instanceStore.instances"
              :key="inst.id"
              class="instance-pick-btn"
              :class="{
                selected: sourceId === inst.id,
                disabled: inst.status === 'offline',
              }"
              :disabled="inst.status === 'offline'"
              @click="selectSource(inst.id)"
            >
              <div
                class="instance-status-dot"
                :class="`status-${inst.status}`"
              />
              <span class="ipb-name">{{ inst.name }}</span>
              <span class="ipb-url text-muted text-xs">{{ inst.url }}</span>
              <span class="badge badge-gray ipb-ver">{{ inst.apiVersion }}</span>
            </button>
          </div>
        </div>

        <!-- ── Step 2: Targets ── -->
        <div class="sync-section">
          <div class="section-label">2 — TARGET INSTANCES</div>
          <p class="section-hint">
            Data will be merged into these Pi-holes. Existing entries are never
            removed.
          </p>
          <div class="instance-grid">
            <button
              v-for="inst in availableTargets"
              :key="inst.id"
              class="instance-pick-btn"
              :class="{
                selected: targetIds.has(inst.id),
                disabled: inst.status === 'offline',
              }"
              :disabled="inst.status === 'offline'"
              @click="toggleTarget(inst.id)"
            >
              <div
                class="instance-status-dot"
                :class="`status-${inst.status}`"
              />
              <span class="ipb-name">{{ inst.name }}</span>
              <span class="ipb-url text-muted text-xs">{{ inst.url }}</span>
              <span class="badge badge-gray ipb-ver">{{ inst.apiVersion }}</span>
              <ion-icon
                v-if="targetIds.has(inst.id)"
                :icon="checkmarkCircleOutline"
                class="ipb-check"
              />
            </button>
          </div>
        </div>

        <!-- ── Step 3: Categories ── -->
        <div class="sync-section">
          <div class="section-label">3 — WHAT TO SYNC</div>
          <p class="section-hint">
            Select the data categories to copy from the source.
          </p>
          <div class="category-grid">
            <label
              v-for="cat in ALL_CATEGORIES"
              :key="cat.key"
              class="category-toggle"
              :class="{ checked: selectedCategories.has(cat.key) }"
            >
              <input
                type="checkbox"
                :checked="selectedCategories.has(cat.key)"
                @change="toggleCategory(cat.key)"
              />
              <div class="ct-icon">
                <ion-icon :icon="cat.icon" />
              </div>
              <div class="ct-text">
                <span class="ct-label">{{ cat.label }}</span>
                <span class="ct-desc text-xs text-muted">{{ cat.desc }}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- ── Step 4: Mode ── -->
        <div class="sync-section">
          <div class="section-label">4 — SYNC MODE</div>
          <p class="section-hint">
            Choose how the target instances should be updated.
          </p>
          <div class="mode-grid">
            <button
              class="mode-btn"
              :class="{ selected: syncMode === 'merge' }"
              @click="syncMode = 'merge'"
            >
              <div class="mode-btn-header">
                <ion-icon :icon="addCircleOutline" class="mode-icon mode-icon-safe" />
                <span class="mode-title">Merge</span>
                <span class="badge badge-green mode-badge">Safe</span>
              </div>
              <p class="mode-desc">
                Only adds entries that are missing on the target. Existing
                entries — even ones not on the source — are left untouched.
              </p>
            </button>
            <button
              class="mode-btn mode-btn-danger"
              :class="{ selected: syncMode === 'overwrite' }"
              @click="syncMode = 'overwrite'"
            >
              <div class="mode-btn-header">
                <ion-icon :icon="trashBinOutline" class="mode-icon mode-icon-danger" />
                <span class="mode-title">Overwrite</span>
                <span class="badge badge-red mode-badge">Destructive</span>
              </div>
              <p class="mode-desc">
                Makes the target an exact mirror of the source. Entries on the
                target that are <strong>not</strong> on the source will be
                <strong>permanently deleted</strong>.
              </p>
            </button>
          </div>

          <div v-if="syncMode === 'overwrite'" class="overwrite-warning">
            <ion-icon :icon="warningOutline" class="warning-icon" />
            <span>
              <strong>Destructive operation.</strong> All entries in the
              selected categories that exist on the target but not on the
              source will be permanently deleted. This cannot be undone.
            </span>
          </div>
        </div>

        <!-- ── Run button ── -->
        <div class="sync-section sync-run-row">
          <div class="sync-summary-text text-muted text-sm">
            <template v-if="canSync">
              <span :class="syncMode === 'overwrite' ? 'text-danger' : ''">
                {{ syncMode === 'overwrite' ? 'Overwrite' : 'Merge' }}
              </span>
              <strong>{{ selectedCategories.size }}</strong> categor{{
                selectedCategories.size === 1 ? "y" : "ies"
              }}
              from <strong>{{ sourceName }}</strong> →
              <strong>{{ targetIds.size }}</strong> instance{{
                targetIds.size === 1 ? "" : "s"
              }}
            </template>
            <template v-else>
              Select a source, at least one target, and at least one category.
            </template>
          </div>
          <button
            class="btn"
            :class="syncMode === 'overwrite' ? 'btn-danger' : 'btn-primary'"
            :disabled="!canSync || isSyncing"
            @click="startSync"
          >
            <ion-icon
              :icon="syncOutline"
              :class="{ spin: isSyncing }"
            />
            {{ isSyncing ? "Syncing…" : syncMode === 'overwrite' ? "Overwrite" : "Start Sync" }}
          </button>
        </div>

        <!-- ── Live results ── -->
        <div v-if="syncResults.length" class="sync-section">
          <div class="section-label">SYNC PROGRESS</div>

          <div
            v-for="result in syncResults"
            :key="result.targetId"
            class="result-card"
            :class="{ 'result-card-ok': result.ok, 'result-card-err': !result.ok }"
          >
            <div class="result-header">
              <ion-icon
                :icon="result.ok ? checkmarkCircleOutline : alertCircleOutline"
                :class="result.ok ? 'icon-ok' : 'icon-err'"
              />
              <span class="result-name">{{ result.targetName }}</span>
              <span
                class="badge"
                :class="overallBadgeClass(result)"
              >{{ overallBadgeLabel(result) }}</span>
            </div>

            <div class="step-list">
              <div
                v-for="step in result.steps"
                :key="step.id"
                class="step-row"
                :class="`step-${step.status}`"
              >
                <ion-icon :icon="stepIcon(step.status)" class="step-icon" />
                <span class="step-label">{{ step.label }}</span>
                <span class="step-detail text-xs text-muted">{{
                  stepDetail(step)
                }}</span>
                <span
                  v-if="step.status === 'done' && step.removed && step.removed > 0"
                  class="badge badge-red step-removed-badge"
                >−{{ step.removed }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { IonPage, IonContent, IonIcon } from "@ionic/vue";
import {
  syncOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  ellipseOutline,
  refreshOutline,
  shieldOutline,
  globeOutline,
  checkmarkOutline,
  serverOutline,
  filterOutline,
  readerOutline,
  addCircleOutline,
  trashBinOutline,
  warningOutline,
} from "ionicons/icons";
import { mapStores } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";
import PageHeader from "@/components/ui/PageHeader.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { runSync } from "@/services/syncService";
import type { SyncCategory, SyncResult, SyncStep } from "@/services/syncService";

interface CategoryDef {
  key: SyncCategory;
  label: string;
  desc: string;
  icon: string;
}

const ALL_CATEGORIES: CategoryDef[] = [
  {
    key: "adlists",
    label: "Adlists",
    desc: "Block-list subscription URLs",
    icon: globeOutline,
  },
  {
    key: "black",
    label: "Exact blocklist",
    desc: "Manually blocked domains",
    icon: shieldOutline,
  },
  {
    key: "white",
    label: "Exact allowlist",
    desc: "Manually allowed domains",
    icon: checkmarkOutline,
  },
  {
    key: "regex_black",
    label: "Regex blocklist",
    desc: "Regex-based block rules",
    icon: filterOutline,
  },
  {
    key: "regex_white",
    label: "Regex allowlist",
    desc: "Regex-based allow rules",
    icon: readerOutline,
  },
  {
    key: "local_dns",
    label: "Local DNS records",
    desc: "Custom A/AAAA hostname mappings",
    icon: serverOutline,
  },
];

export default defineComponent({
  name: "SyncView",
  components: { IonPage, IonContent, IonIcon, PageHeader, EmptyState },

  data() {
    return {
      syncOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      ellipseOutline,
      refreshOutline,
      addCircleOutline,
      trashBinOutline,
      warningOutline,

      ALL_CATEGORIES,

      sourceId: null as string | null,
      targetIds: new Set<string>(),
      selectedCategories: new Set<SyncCategory>([
        "adlists",
        "black",
        "white",
        "regex_black",
        "regex_white",
      ]),
      syncMode: "merge" as import("@/services/syncService").SyncMode,

      isSyncing: false,
      syncResults: [] as SyncResult[],
    };
  },

  computed: {
    ...mapStores(useInstanceStore),
    notifications() {
      return useNotificationStore();
    },

    availableTargets() {
      return this.instanceStore.instances.filter((i) => i.id !== this.sourceId);
    },

    sourceName(): string {
      return (
        this.instanceStore.instances.find((i) => i.id === this.sourceId)
          ?.name ?? ""
      );
    },

    canSync(): boolean {
      return (
        !!this.sourceId &&
        this.targetIds.size > 0 &&
        this.selectedCategories.size > 0 &&
        !this.isSyncing
      );
    },
  },

  methods: {
    selectSource(id: string): void {
      this.sourceId = id;
      // Remove from targets if it was selected there
      this.targetIds.delete(id);
      this.targetIds = new Set(this.targetIds);
    },

    toggleTarget(id: string): void {
      const next = new Set(this.targetIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      this.targetIds = next;
    },

    toggleCategory(cat: SyncCategory): void {
      const next = new Set(this.selectedCategories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      this.selectedCategories = next;
    },

    async startSync(): Promise<void> {
      if (!this.canSync) return;

      const source = this.instanceStore.instances.find(
        (i) => i.id === this.sourceId,
      )!;
      const targets = this.instanceStore.instances.filter((i) =>
        this.targetIds.has(i.id),
      );

      this.isSyncing = true;
      this.syncResults = [];

      try {
        await runSync(
          {
            source,
            targets,
            categories: [...this.selectedCategories],
            mode: this.syncMode,
          },
          (results) => {
            this.syncResults = results;
          },
        );

        const allOk = this.syncResults.every((r) => r.ok);
        if (allOk) {
          this.notifications.success(
            `Sync complete — ${targets.length} instance${targets.length > 1 ? "s" : ""} updated`,
          );
        } else {
          this.notifications.warning(
            "Sync finished with some errors — check the results below",
          );
        }
      } catch (err) {
        this.notifications.error(
          `Sync failed: ${(err as Error)?.message ?? "Unknown error"}`,
        );
      } finally {
        this.isSyncing = false;
      }
    },

    stepIcon(status: SyncStep["status"]): string {
      const map: Record<SyncStep["status"], string> = {
        pending: ellipseOutline,
        running: refreshOutline,
        done: checkmarkCircleOutline,
        error: alertCircleOutline,
        skipped: ellipseOutline,
      };
      return map[status];
    },

    stepDetail(step: SyncStep): string {
      if (step.status === "running") return "Working…";
      if (step.status === "pending") return "Waiting";
      if (step.status === "skipped") return step.detail ?? "Skipped";
      if (step.status === "error") return step.detail ?? "Error";
      return step.detail ?? "";
    },

    overallBadgeClass(result: SyncResult): string {
      const hasRunning = result.steps.some((s) => s.status === "running");
      const hasPending = result.steps.some((s) => s.status === "pending");
      if (hasRunning || hasPending) return "badge-amber";
      if (!result.ok) return "badge-red";
      return "badge-green";
    },

    overallBadgeLabel(result: SyncResult): string {
      const hasRunning = result.steps.some((s) => s.status === "running");
      const hasPending = result.steps.some((s) => s.status === "pending");
      if (hasRunning) return "Syncing";
      if (hasPending) return "Queued";
      if (!result.ok) return "Errors";
      return "Done";
    },
  },
});
</script>

<style scoped>
/* ── Layout sections ── */
.sync-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
}
.section-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0 14px;
}

/* ── Instance picker grid ── */
.instance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.instance-pick-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  position: relative;
  color: var(--text-primary);
}
.instance-pick-btn:hover:not(.disabled) {
  border-color: var(--accent);
  background: var(--bg-elevated-hover, var(--bg-elevated));
}
.instance-pick-btn.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.instance-pick-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ipb-name {
  font-size: 14px;
  font-weight: 500;
}
.ipb-url {
  font-family: var(--font-mono);
  word-break: break-all;
}
.ipb-ver {
  margin-top: 2px;
}
.ipb-check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--accent);
  font-size: 18px;
}

/* ── Category toggles ── */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.category-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.category-toggle input {
  display: none;
}
.category-toggle.checked {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.category-toggle:hover {
  border-color: var(--accent);
}
.ct-icon {
  font-size: 20px;
  color: var(--accent);
  flex-shrink: 0;
}
.ct-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ct-label {
  font-size: 13px;
  font-weight: 500;
}

/* ── Run row ── */
.sync-run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.sync-summary-text strong {
  color: var(--text-primary);
}

/* ── Result cards ── */
.result-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 10px;
}
.result-card-ok {
  border-left: 3px solid var(--accent-green, #4ade80);
}
.result-card-err {
  border-left: 3px solid var(--accent-red, #f87171);
}
.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.result-name {
  font-weight: 500;
  font-size: 14px;
  flex: 1;
}
.icon-ok {
  color: var(--accent-green, #4ade80);
  font-size: 18px;
}
.icon-err {
  color: var(--accent-red, #f87171);
  font-size: 18px;
}

/* ── Step list ── */
.step-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.step-running {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.step-done {
  background: color-mix(in srgb, var(--accent-green, #4ade80) 6%, transparent);
}
.step-error {
  background: color-mix(in srgb, var(--accent-red, #f87171) 8%, transparent);
}
.step-icon {
  font-size: 15px;
  flex-shrink: 0;
}
.step-running .step-icon {
  color: var(--accent);
}
.step-done .step-icon {
  color: var(--accent-green, #4ade80);
}
.step-error .step-icon {
  color: var(--accent-red, #f87171);
}
.step-label {
  min-width: 140px;
  font-weight: 500;
}
.step-detail {
  flex: 1;
  text-align: right;
}

/* ── Mode selector ── */
.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mode-btn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  color: var(--text-primary);
}
.mode-btn:hover {
  border-color: var(--accent);
}
.mode-btn.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.mode-btn-danger.selected {
  border-color: var(--accent-red, #f87171);
  background: color-mix(in srgb, var(--accent-red, #f87171) 8%, transparent);
}
.mode-btn-danger:hover {
  border-color: var(--accent-red, #f87171);
}
.mode-btn-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mode-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
}
.mode-icon {
  font-size: 18px;
}
.mode-icon-safe {
  color: var(--accent-green, #4ade80);
}
.mode-icon-danger {
  color: var(--accent-red, #f87171);
}
.mode-badge {
  font-size: 10px;
}
.mode-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}

/* ── Overwrite warning banner ── */
.overwrite-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--accent-red, #f87171) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-red, #f87171) 35%, transparent);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}
.warning-icon {
  color: var(--accent-red, #f87171);
  font-size: 18px;
  flex-shrink: 0;
  margin-top: 1px;
}

.text-danger {
  color: var(--accent-red, #f87171);
  font-weight: 500;
}

.step-removed-badge {
  font-size: 10px;
  margin-left: 4px;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 0.9s linear infinite;
  display: inline-block;
}

@media (max-width: 600px) {
  .sync-run-row {
    flex-direction: column;
    align-items: stretch;
  }
  .sync-run-row .btn {
    width: 100%;
    justify-content: center;
  }
  .step-detail {
    display: none;
  }
}
</style>
