import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/',           redirect: '/dashboard' },
  { path: '/dashboard',  name: 'Dashboard',    component: () => import('@/views/DashboardView.vue'),  meta: { title: 'Dashboard' } },
  { path: '/query-log',  name: 'QueryLog',     component: () => import('@/views/QueryLogView.vue'),   meta: { title: 'Query Log' } },
  { path: '/blocklists', name: 'BlockLists',   component: () => import('@/views/BlockListsView.vue'), meta: { title: 'Block Lists' } },
  { path: '/hardware',   name: 'Hardware',     component: () => import('@/views/HardwareView.vue'),   meta: { title: 'Hardware' } },
  { path: '/statistics', name: 'Statistics',   component: () => import('@/views/StatisticsView.vue'), meta: { title: 'Statistics' } },
  { path: '/settings',   name: 'Settings',     component: () => import('@/views/SettingsView.vue'),   meta: { title: 'Settings' } },
  { path: '/docs',       name: 'Documentation',component: () => import('@/views/DocsView.vue'),       meta: { title: 'Documentation' } },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title as string} — Orbital` : 'Orbital';
});

export default router;
