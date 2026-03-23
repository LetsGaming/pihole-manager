/**
 * Component Tests — SettingsView (refactored)
 *
 * SettingsView now delegates add/edit logic to InstanceForm component.
 * These tests verify view-level state: instance list rendering, quick
 * test, export/import hooks, app settings, danger zone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SettingsView from "@/views/SettingsView.vue";
import { useInstanceStore } from "@/stores/instanceStore";
import { useNotificationStore } from "@/stores/notificationStore";

vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({ status: "enabled" }),
    testConnection: vi.fn().mockResolvedValue({
      ok: true,
      message: "Connection successful",
      latencyMs: 12,
    }),
    errorMessage: (e: unknown) => (e as Error)?.message ?? "Error",
  },
}));

const STUBS = {
  "ion-page": { template: '<div class="ion-page"><slot /></div>' },
  "ion-header": { template: "<div><slot /></div>" },
  "ion-toolbar": { template: "<div><slot /></div>" },
  "ion-content": { template: '<div class="ion-content"><slot /></div>' },
  "ion-buttons": { template: "<div><slot /></div>" },
  "ion-menu-button": { template: "<button />" },
  "ion-icon": { template: "<span />" },
  "ion-alert": {
    template: '<div v-if="isOpen" class="ion-alert"></div>',
    props: ["isOpen", "header", "message", "buttons"],
    emits: ["did-dismiss"],
  },
  PageHeader: { template: '<div><slot name="actions" /></div>' },
  EmptyState: {
    template: '<div class="empty-state"><slot /></div>',
    props: ["icon", "title", "subtitle"],
  },
  InstanceForm: {
    template: '<div class="instance-form" />',
    props: ["isOpen", "editing"],
    emits: ["close", "save"],
  },
};

function createWrapper() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(SettingsView, { global: { plugins: [pinia], stubs: STUBS } });
}

describe("SettingsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ─── Empty state ──────────────────────────────────────────────────────────
  it("shows empty state when no instances", async () => {
    const w = createWrapper();
    await w.vm.$nextTick();
    expect(w.find(".empty-state").exists()).toBe(true);
  });

  // ─── showForm / openAdd ───────────────────────────────────────────────────
  it("showForm starts as false", () => {
    const w = createWrapper();
    expect(w.vm.showForm).toBe(false);
  });

  it("openAdd sets showForm to true", () => {
    const w = createWrapper();
    w.vm.openAdd();
    expect(w.vm.showForm).toBe(true);
  });

  it("openAdd clears editingInstance", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Existing",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    w.vm.editingInstance = store.instances[0];
    w.vm.openAdd();
    expect(w.vm.editingInstance).toBeNull();
  });

  // ─── openEdit ─────────────────────────────────────────────────────────────
  it("openEdit sets editingInstance and opens form", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "My Pi",
      url: "http://pi.local",
      apiToken: "tok",
      apiVersion: "v6",
    });
    const inst = store.instances[0];
    w.vm.openEdit(inst);
    expect(w.vm.editingInstance).toBe(inst);
    expect(w.vm.showForm).toBe(true);
  });

  // ─── closeForm ────────────────────────────────────────────────────────────
  it("closeForm hides form and clears editingInstance", () => {
    const w = createWrapper();
    w.vm.showForm = true;
    w.vm.closeForm();
    expect(w.vm.showForm).toBe(false);
    expect(w.vm.editingInstance).toBeNull();
  });

  // ─── handleSave (add) ─────────────────────────────────────────────────────
  it("handleSave with null editingId adds a new instance", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    w.vm.handleSave(
      {
        name: "New Pi",
        url: "http://new.pi",
        apiToken: "tok",
        apiVersion: "v5",
      },
      null,
    );
    expect(store.instances).toHaveLength(1);
    expect(store.instances[0].name).toBe("New Pi");
  });

  it("handleSave with editingId updates existing instance", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Old",
      url: "http://old.pi",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const id = store.instances[0].id;
    w.vm.handleSave(
      {
        name: "Updated",
        url: "http://old.pi",
        apiToken: "tok",
        apiVersion: "v5",
      },
      id,
    );
    expect(store.instances[0].name).toBe("Updated");
  });

  it("handleSave closes the form", () => {
    const w = createWrapper();
    w.vm.showForm = true;
    w.vm.handleSave(
      { name: "Pi", url: "http://pi.hole", apiToken: "tok", apiVersion: "v5" },
      null,
    );
    expect(w.vm.showForm).toBe(false);
  });

  it("handleSave shows success notification", () => {
    const w = createWrapper();
    const notif = useNotificationStore();
    const spy = vi.spyOn(notif, "success");
    w.vm.handleSave(
      { name: "Pi X", url: "http://pi.x", apiToken: "tok", apiVersion: "v5" },
      null,
    );
    expect(spy).toHaveBeenCalled();
  });

  // ─── confirmRemove / pendingRemove ────────────────────────────────────────
  it("confirmRemove sets pendingRemove and opens alert", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "To Remove",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const inst = store.instances[0];
    w.vm.confirmRemove(inst);
    expect(w.vm.pendingRemove).toStrictEqual(inst);
    expect(w.vm.showRemoveAlert).toBe(true);
  });

  // ─── runQuickTest ─────────────────────────────────────────────────────────
  it("runQuickTest shows success notification on ok:true", async () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Pi",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    const notif = useNotificationStore();
    const spy = vi.spyOn(notif, "success");
    await w.vm.runQuickTest(store.instances[0]);
    expect(spy).toHaveBeenCalled();
  });

  // ─── App settings ─────────────────────────────────────────────────────────
  it("settings object is available from useAppSettings", () => {
    const w = createWrapper();
    expect(w.vm.settings).toBeDefined();
    expect(typeof w.vm.settings.pollInterval).toBe("number");
  });

  it("save() persists settings to localStorage", () => {
    const w = createWrapper();
    w.vm.settings.pollInterval = 60000;
    w.vm.save();
    const saved = JSON.parse(
      localStorage.getItem("orbital_app_settings") ?? "{}",
    );
    expect(saved.pollInterval).toBe(60000);
  });

  // ─── clearAll ─────────────────────────────────────────────────────────────
  it("clearAll removes all instances after confirm", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "A",
      url: "http://a.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    store.addInstance({
      name: "B",
      url: "http://b.local",
      apiToken: "tok",
      apiVersion: "v5",
    });
    // Mock confirm to return true
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    w.vm.clearAll();
    expect(store.instances).toHaveLength(0);
  });

  it("clearAll does nothing if confirm returns false", () => {
    const w = createWrapper();
    const store = useInstanceStore();
    store.addInstance({
      name: "Keep",
      url: "http://pi.hole",
      apiToken: "tok",
      apiVersion: "v5",
    });
    vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    w.vm.clearAll();
    expect(store.instances).toHaveLength(1);
  });
});
