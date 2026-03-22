// ─── Hardware Info ────────────────────────────────────────────────────────────

export interface HardwareInfo {
  // CPU
  cpuLoad: number | null;
  cpuTemp: number | null; // null in VMs / no sensor
  cpuModel: string | null;
  cpuCores: number | null;

  // Memory (bytes)
  memTotal: number | null;
  memUsed: number | null;
  memFree: number | null;
  memPercent: number | null;

  // Disk (bytes)
  diskTotal: number | null;
  diskUsed: number | null;
  diskPercent: number | null;

  // Network
  hostname: string | null;
  ipAddress: string | null;
  interface: string | null;

  // Uptime
  uptimeSeconds: number | null;
  uptimeFormatted: string | null;

  // Pi-hole versions
  piholeVersion: string | null;
  ftlVersion: string | null;
  webVersion: string | null;

  // Pi-hole stats
  domainsBlocked: number | null;
  gravityLastUpdate: Date | null;
}

export type SeverityLevel = 'normal' | 'warn' | 'crit';
