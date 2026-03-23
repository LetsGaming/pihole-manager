<template>
  <ion-app :data-theme="theme">
    <ion-split-pane content-id="main-content" when="lg">
      <ion-menu content-id="main-content" type="overlay">
        <ion-header>
          <ion-toolbar>
            <div class="sidebar-brand">
              <div class="brand-icon">
                <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="2"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="8"
                    fill="var(--accent)"
                    opacity="0.3"
                  />
                  <line
                    x1="20"
                    y1="2"
                    x2="20"
                    y2="38"
                    stroke="var(--accent)"
                    stroke-width="1"
                    opacity="0.5"
                  />
                  <line
                    x1="2"
                    y1="20"
                    x2="38"
                    y2="20"
                    stroke="var(--accent)"
                    stroke-width="1"
                    opacity="0.5"
                  />
                  <circle cx="20" cy="20" r="3" fill="var(--accent)" />
                </svg>
              </div>
              <div class="brand-text">
                <span class="brand-name">Orbital</span>
                <span class="brand-sub">Pi-hole Manager</span>
              </div>
            </div>
          </ion-toolbar>
        </ion-header>

        <ion-content>
          <div v-if="instanceStore.instances.length" class="instance-switcher">
            <div class="section-label">INSTANCES</div>
            <div
              v-for="inst in instanceStore.instances"
              :key="inst.id"
              class="instance-chip"
              :class="{ active: instanceStore.activeInstanceId === inst.id }"
              role="button"
              :aria-label="`Switch to ${inst.name} (${inst.status})`"
              tabindex="0"
              @click="instanceStore.setActiveInstance(inst.id)"
              @keydown.enter="instanceStore.setActiveInstance(inst.id)"
            >
              <div
                class="instance-status-dot"
                :class="`status-${inst.status}`"
              />
              <span class="instance-chip-name">{{ inst.name }}</span>
            </div>
            <div class="section-label mt-2">NAVIGATE</div>
          </div>

          <ion-list lines="none" class="nav-list">
            <ion-menu-toggle
              v-for="item in navItems"
              :key="item.path"
              :auto-hide="false"
            >
              <ion-item
                :router-link="item.path"
                router-direction="root"
                class="nav-item"
                :class="{ active: route.path.startsWith(item.path) }"
              >
                <ion-icon slot="start" :icon="item.icon" class="nav-icon" />
                <ion-label>{{ item.label }}</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>

          <div class="sidebar-footer">
            <div
              v-if="instanceStore.instances.length"
              class="global-status-row"
            >
              <span class="status-label">Instances</span>
              <span class="status-counts">
                <span class="count-ok"
                  >{{ instanceStore.onlineCount }} online</span
                >
                <span class="count-sep">/</span>
                <span class="count-err"
                  >{{ instanceStore.offlineCount }} offline</span
                >
              </span>
            </div>
            <div class="sidebar-footer-actions">
              <span class="app-version">v2.0.0</span>
              <button
                class="theme-toggle-btn"
                :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`"
                :title="`Switch to ${isDark ? 'light' : 'dark'} mode`"
                @click="toggleTheme"
              >
                {{ isDark ? "☀️" : "🌙" }}
              </button>
            </div>
          </div>
        </ion-content>
      </ion-menu>

      <div id="main-content">
        <ion-router-outlet />
      </div>
    </ion-split-pane>

    <ToastContainer />
  </ion-app>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  IonApp,
  IonSplitPane,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonMenuToggle,
  IonRouterOutlet,
} from "@ionic/vue";
import {
  gridOutline,
  listOutline,
  shieldOutline,
  hardwareChipOutline,
  settingsOutline,
  bookOutline,
  statsChartOutline,
} from "ionicons/icons";
import { useRoute } from "vue-router";
import { mapStores } from "pinia";
import { useInstanceStore } from "@/stores/instanceStore";
import ToastContainer from "@/components/ToastContainer.vue";

const THEME_KEY = "orbital_theme";

export default defineComponent({
  name: "App",
  components: {
    IonApp,
    IonSplitPane,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonMenuToggle,
    IonRouterOutlet,
    ToastContainer,
  },

  data() {
    const savedTheme =
      (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark";
    return {
      theme: savedTheme as "dark" | "light",
      navItems: [
        { path: "/dashboard", label: "Dashboard", icon: gridOutline },
        { path: "/statistics", label: "Statistics", icon: statsChartOutline },
        { path: "/query-log", label: "Query Log", icon: listOutline },
        { path: "/blocklists", label: "Block Lists", icon: shieldOutline },
        { path: "/hardware", label: "Hardware", icon: hardwareChipOutline },
        { path: "/settings", label: "Settings", icon: settingsOutline },
        { path: "/docs", label: "Documentation", icon: bookOutline },
      ],
    };
  },

  computed: {
    ...mapStores(useInstanceStore),
    route() {
      return useRoute();
    },
    isDark(): boolean {
      return this.theme === "dark";
    },
  },

  mounted() {
    // Apply theme to document root for CSS variable resolution
    document.documentElement.setAttribute("data-theme", this.theme);
    // Bootstrap instance data
    this.instanceStore._boot();
  },

  beforeUnmount() {
    this.instanceStore.stopPolling();
  },

  methods: {
    toggleTheme(): void {
      this.theme = this.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", this.theme);
      localStorage.setItem(THEME_KEY, this.theme);
    },
  },
});
</script>
