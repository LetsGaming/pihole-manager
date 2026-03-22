<template>
  <ion-app>
    <ion-split-pane content-id="main-content" when="lg">
      <ion-menu content-id="main-content" type="overlay">
        <ion-header>
          <ion-toolbar>
            <div class="sidebar-brand">
              <div class="brand-icon">
                <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="var(--accent-cyan)" stroke-width="2"/>
                  <circle cx="20" cy="20" r="8" fill="var(--accent-cyan)" opacity="0.3"/>
                  <line x1="20" y1="2" x2="20" y2="38" stroke="var(--accent-cyan)" stroke-width="1" opacity="0.5"/>
                  <line x1="2" y1="20" x2="38" y2="20" stroke="var(--accent-cyan)" stroke-width="1" opacity="0.5"/>
                  <circle cx="20" cy="20" r="3" fill="var(--accent-cyan)"/>
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
              @click="instanceStore.setActiveInstance(inst.id)"
            >
              <div class="instance-status-dot" :class="`status-${inst.status}`" />
              <span class="instance-chip-name">{{ inst.name }}</span>
            </div>
            <div class="section-label mt-2">ALL INSTANCES</div>
          </div>

          <ion-list lines="none" class="nav-list">
            <ion-menu-toggle v-for="item in navItems" :key="item.path" :auto-hide="false">
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
            <div v-if="instanceStore.instances.length" class="global-status-row">
              <span class="status-label">Instances</span>
              <span class="status-counts">
                <span class="count-ok">{{ instanceStore.onlineCount }} online</span>
                <span class="count-sep">/</span>
                <span class="count-err">{{ instanceStore.offlineCount }} offline</span>
              </span>
            </div>
            <div class="app-version">v2.0.0</div>
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
import { defineComponent } from 'vue';
import {
  IonApp, IonSplitPane, IonMenu, IonHeader, IonToolbar,
  IonContent, IonList, IonItem, IonLabel, IonIcon,
  IonMenuToggle, IonRouterOutlet,
} from '@ionic/vue';
import {
  gridOutline, listOutline, shieldOutline, hardwareChipOutline,
  settingsOutline, bookOutline, statsChartOutline,
} from 'ionicons/icons';
import { useRoute } from 'vue-router';
import { useInstanceStore } from '@/stores/instanceStore';
import ToastContainer from '@/components/ToastContainer.vue';

export default defineComponent({
  name: 'App',
  components: {
    IonApp, IonSplitPane, IonMenu, IonHeader, IonToolbar,
    IonContent, IonList, IonItem, IonLabel, IonIcon,
    IonMenuToggle, IonRouterOutlet, ToastContainer,
  },

  setup() {
    return {
      instanceStore: useInstanceStore(),
      route: useRoute(),
      navItems: [
        { path: '/dashboard',  label: 'Dashboard',     icon: gridOutline },
        { path: '/query-log',  label: 'Query Log',     icon: listOutline },
        { path: '/blocklists', label: 'Block Lists',   icon: shieldOutline },
        { path: '/hardware',   label: 'Hardware',      icon: hardwareChipOutline },
        { path: '/statistics', label: 'Statistics',    icon: statsChartOutline },
        { path: '/settings',   label: 'Settings',      icon: settingsOutline },
        { path: '/docs',       label: 'Documentation', icon: bookOutline },
      ],
    };
  },
});
</script>
