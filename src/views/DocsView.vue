<template>
  <ion-page class="page-wrapper">
    <ion-header>
      <ion-toolbar class="page-header-toolbar">
        <ion-buttons slot="start"
          ><ion-menu-button></ion-menu-button
        ></ion-buttons>
        <div slot="start" class="page-title" style="margin-left: 8px">
          Documentation
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div
        style="
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 32px;
          max-width: 1100px;
        "
      >
        <!-- Nav sidebar -->
        <div class="docs-nav">
          <div class="section-label" style="padding: 0 0 8px">CONTENTS</div>
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="docs-nav-link"
          >
            {{ section.title }}
          </a>
        </div>

        <!-- Content -->
        <div class="docs-content">
          <h1>Orbital Pi-hole Manager</h1>
          <p>
            A multi-instance Pi-hole management dashboard built with Ionic Vue.
          </p>

          <!-- Getting Started -->
          <h2 id="getting-started">Getting Started</h2>
          <p>
            Orbital lets you manage one or more Pi-hole instances from a single
            interface. To begin, add your first instance in
            <strong>Settings</strong>.
          </p>

          <h3>Requirements</h3>
          <ul>
            <li>A running Pi-hole v5 or v6 instance on your local network</li>
            <li>
              Your Pi-hole's API token (found in Pi-hole Settings → API / Web
              interface)
            </li>
            <li>
              The Pi-hole admin UI must be accessible from the browser running
              Orbital
            </li>
          </ul>

          <h3>Quick Setup</h3>
          <ol>
            <li>Navigate to <strong>Settings</strong> in the sidebar</li>
            <li>Fill in <em>Name</em>, <em>URL</em>, and <em>API Token</em></li>
            <li>Click <strong>Test Connection</strong> to verify</li>
            <li>Click <strong>Add Instance</strong></li>
          </ol>

          <!-- Instances -->
          <h2 id="instances">Managing Instances</h2>
          <p>
            Orbital supports an unlimited number of Pi-hole instances. Each
            instance is stored in your browser's local storage — no server or
            account required.
          </p>

          <h3>Instance Status</h3>
          <p>Each instance displays a status dot:</p>
          <ul>
            <li>
              <span style="color: var(--accent-green)">●</span>
              <strong>Online</strong> — reachable and authenticated
            </li>
            <li>
              <span style="color: var(--accent-red)">●</span>
              <strong>Offline</strong> — connection failed
            </li>
            <li>
              <span style="color: var(--text-muted)">●</span>
              <strong>Unknown</strong> — not yet polled
            </li>
          </ul>

          <h3>Config Export / Import</h3>
          <p>
            Use Settings → Export Config to download a JSON file with all
            instance configurations. Import it on another device to restore your
            setup. API tokens are included in the export — store the file
            securely.
          </p>

          <!-- Dashboard -->
          <h2 id="dashboard">Dashboard</h2>
          <p>
            The Dashboard provides an at-a-glance overview of all configured
            instances. Cards show per-instance stats and blocking toggles.
          </p>

          <h3>Global Controls</h3>
          <p>
            The <strong>Enable All</strong> and
            <strong>Disable All</strong> buttons act on all online instances
            simultaneously. When disabling, you can choose a duration (30s to 1
            hour, or indefinitely).
          </p>

          <h3>Per-Instance Toggle</h3>
          <p>
            The toggle switch at the bottom of each instance card enables or
            disables blocking for that instance only. Changes are reflected
            immediately.
          </p>

          <!-- Query Log -->
          <h2 id="query-log">Query Log</h2>
          <p>
            The Query Log displays DNS queries in near-real-time (polling every
            5 seconds by default).
          </p>

          <h3>Filters</h3>
          <ul>
            <li>
              <strong>Instance</strong> — show logs from one or all instances
            </li>
            <li>
              <strong>Status</strong> — filter by Blocked / Allowed / Cached
            </li>
            <li>
              <strong>Search</strong> — filter by domain name or client IP
            </li>
          </ul>

          <h3>Actions per Entry</h3>
          <ul>
            <li>
              <strong>Whitelist</strong> (shield icon) — add a blocked domain to
              the whitelist
            </li>
            <li>
              <strong>Blacklist</strong> (ban icon) — add an allowed domain to
              the blacklist
            </li>
            <li><strong>Copy</strong> — copy the domain to the clipboard</li>
          </ul>

          <h3>Live / Pause</h3>
          <p>
            Click <strong>Pause</strong> to stop the automatic refresh while you
            inspect entries. Click <strong>Resume</strong> to re-enable live
            polling.
          </p>

          <!-- Block Lists -->
          <h2 id="block-lists">Block Lists</h2>
          <p>
            Manage Pi-hole's adlists, blacklist, whitelist, and regex lists.
            Each list type is accessible via the tab bar.
          </p>

          <h3>Adlists</h3>
          <p>
            Adlists are remote hosts files fetched during a
            <em>gravity update</em>. Add the URL of any standard hosts-format
            blocklist.
          </p>
          <p>
            Popular community lists are available as quick-add buttons. After
            adding or removing adlists, click <strong>Update Gravity</strong> to
            apply changes.
          </p>

          <h3>Domain Lists</h3>
          <ul>
            <li>
              <strong>Blacklist</strong> — exact domains that are always blocked
            </li>
            <li>
              <strong>Whitelist</strong> — exact domains that are always allowed
            </li>
            <li>
              <strong>Regex Block</strong> — regular expressions for blocked
              domains
            </li>
            <li>
              <strong>Regex Allow</strong> — regular expressions for allowed
              domains
            </li>
          </ul>

          <h3>Gravity Update</h3>
          <p>
            Gravity updates run asynchronously on the Pi-hole server. Orbital
            sends the trigger and the Pi-hole processes it in the background.
            Updates can take 30–120 seconds depending on the number of lists and
            network speed.
          </p>

          <!-- Statistics -->
          <h2 id="statistics">Statistics</h2>
          <p>
            The Statistics view shows charts and tables for a selected instance.
          </p>
          <ul>
            <li>
              <strong>Queries Over Time</strong> — 24-hour graph with blocked
              overlay
            </li>
            <li>
              <strong>Top Queried Domains</strong> — most frequently queried
              domains
            </li>
            <li>
              <strong>Top Blocked Domains</strong> — most frequently blocked
              domains
            </li>
            <li>
              <strong>Top Clients</strong> — devices generating the most queries
            </li>
          </ul>

          <!-- Hardware -->
          <h2 id="hardware">Hardware</h2>
          <p>
            The Hardware page shows system information for each instance. All
            data is fetched directly from the Pi-hole API — no SSH or
            third-party tools are required.
          </p>

          <h3>Available Metrics</h3>
          <ul>
            <li>CPU load percentage</li>
            <li>
              CPU temperature (hidden when unavailable, e.g. VMs or unsupported
              hardware)
            </li>
            <li>Memory usage (used / total)</li>
            <li>Disk usage (used / total)</li>
            <li>System uptime</li>
            <li>Hostname and IP address</li>
            <li>Pi-hole / FTL / Web versions</li>
            <li>Gravity last-updated timestamp</li>
          </ul>

          <p>
            Metrics that are unavailable (e.g. temperature in a VirtualBox VM)
            are silently hidden rather than displayed as errors.
          </p>

          <!-- API -->
          <h2 id="api">Pi-hole API</h2>
          <p>
            Orbital communicates with the Pi-hole HTTP API. All calls go
            directly from your browser to the Pi-hole — there is no intermediary
            server.
          </p>

          <h3>API Token</h3>
          <p>
            Find your API token at
            <code>Pi-hole Admin → Settings → API / Web interface</code>. The
            token grants full read/write access to your Pi-hole. Keep it secret.
          </p>

          <h3>CORS</h3>
          <p>
            Your browser will block requests to a different origin unless
            Pi-hole's web server returns appropriate CORS headers. If you
            encounter CORS errors:
          </p>
          <ul>
            <li>Access Orbital from the same hostname as Pi-hole, or</li>
            <li>
              Configure Pi-hole's lighttpd to return
              <code>Access-Control-Allow-Origin: *</code>
            </li>
          </ul>

          <pre><code># /etc/lighttpd/lighttpd.conf
server.modules += ("mod_setenv")
setenv.add-response-header = ("Access-Control-Allow-Origin" => "*")</code></pre>

          <h3>Supported Pi-hole Versions</h3>
          <ul>
            <li>
              <strong>v5</strong> — query param authentication
              (<code>?auth=TOKEN</code>)
            </li>
            <li>
              <strong>v6</strong> — Bearer token authentication (<code
                >Authorization: Bearer TOKEN</code
              >)
            </li>
          </ul>

          <!-- Troubleshooting -->
          <h2 id="troubleshooting">Troubleshooting</h2>

          <h3>Instance shows "Offline"</h3>
          <ol>
            <li>Confirm the Pi-hole URL is reachable from your browser</li>
            <li>
              Verify the API token is correct (copy from Pi-hole Settings)
            </li>
            <li>Check for CORS issues in browser DevTools → Network tab</li>
            <li>Ensure the API version setting matches your Pi-hole version</li>
          </ol>

          <h3>Blocking toggle does nothing</h3>
          <p>
            The API token requires write permissions. Ensure you're using the
            correct full-length token, not a truncated version.
          </p>

          <h3>Hardware data is all dashes</h3>
          <p>
            Orbital fetches hardware info from undocumented Pi-hole FTL
            endpoints that may not be present on all versions or configurations.
            This is expected on older Pi-hole v5 installs or Docker containers.
          </p>

          <!-- Architecture -->
          <h2 id="architecture">Architecture</h2>

          <h3>Technology Stack</h3>
          <ul>
            <li>
              <strong>Ionic Vue</strong> — UI framework with mobile-friendly
              components
            </li>
            <li>
              <strong>Pinia</strong> — state management (instance store,
              notification store)
            </li>
            <li><strong>Vue Router</strong> — client-side navigation</li>
            <li><strong>Chart.js</strong> — statistics charts</li>
            <li><strong>Axios</strong> — HTTP client for Pi-hole API calls</li>
            <li><strong>Vitest</strong> — unit and integration testing</li>
          </ul>

          <h3>Key Files</h3>
          <pre><code>src/
  services/
    piholeApi.js        ← All Pi-hole API calls
    hardwareService.js  ← Hardware info parsing
  stores/
    instanceStore.js    ← Instance list, status, polling
    notificationStore.js← Toast notifications
  views/
    DashboardView.vue   ← Overview + global controls
    QueryLogView.vue    ← Live query log
    BlockListsView.vue  ← Adlists + domain lists
    HardwareView.vue    ← System metrics
    StatisticsView.vue  ← Charts + top domains
    SettingsView.vue    ← Instance management
    DocsView.vue        ← This page
  tests/               ← Full test suite</code></pre>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script>
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonButtons,
  IonMenuButton,
} from "@ionic/vue";

export default {
  name: "DocsView",

  components: {
    IonPage,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButtons,
    IonMenuButton,
  },

  data() {
    return {
      sections: [
        { id: "getting-started", title: "Getting Started" },
        { id: "instances", title: "Instances" },
        { id: "dashboard", title: "Dashboard" },
        { id: "query-log", title: "Query Log" },
        { id: "block-lists", title: "Block Lists" },
        { id: "statistics", title: "Statistics" },
        { id: "hardware", title: "Hardware" },
        { id: "api", title: "Pi-hole API" },
        { id: "troubleshooting", title: "Troubleshooting" },
        { id: "architecture", title: "Architecture" },
      ],
    };
  },
};
</script>

<style scoped>
.docs-nav {
  position: sticky;
  top: 20px;
  align-self: start;
}

.docs-nav-link {
  display: block;
  padding: 5px 8px;
  font-size: 13px;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition:
    color 0.15s,
    background 0.15s;
  margin-bottom: 2px;
}

.docs-nav-link:hover {
  color: var(--accent-cyan);
  background: var(--accent-cyan-glow);
}

@media (max-width: 768px) {
  ion-content > div {
    grid-template-columns: 1fr !important;
  }
  .docs-nav {
    display: none;
  }
}
</style>
