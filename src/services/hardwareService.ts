/**
 * Hardware / System Info Service
 *
 * Aggregates system data from Pi-hole API endpoints.
 * Any unavailable field is set to null; the UI hides null fields.
 */

import PiholeApiService from './piholeApi';
import type { PiholeInstance } from '@/types/instance';
import type { HardwareInfo, SeverityLevel } from '@/types/hardware';

const HardwareService = {

  async getHardwareInfo(instance: PiholeInstance): Promise<HardwareInfo> {
    const [summary, versions, sysInfo] = await Promise.allSettled([
      PiholeApiService.getSummary(instance),
      PiholeApiService.getVersions(instance),
      PiholeApiService.getSystemInfo(instance),
    ]);

    const sumData  = summary.status  === 'fulfilled' ? summary.value  : {};
    const verData  = versions.status === 'fulfilled' ? versions.value : {};
    const sysData  = sysInfo.status  === 'fulfilled' ? sysInfo.value  : {} as Record<string, string>;

    return {
      cpuLoad:     HardwareService._parseCpuLoad(sumData as Record<string, unknown>, sysData),
      cpuTemp:     HardwareService._parseCpuTemp(sysData),
      cpuModel:    sysData.cpu_model ?? null,
      cpuCores:    sysData.cpu_cores ? parseInt(sysData.cpu_cores, 10) : null,

      memTotal:    HardwareService._parseNum(sysData.mem_total),
      memUsed:     HardwareService._parseNum(sysData.mem_used),
      memFree:     HardwareService._parseNum(sysData.mem_free),
      memPercent:  HardwareService._calcMemPercent(sysData),

      diskTotal:   HardwareService._parseNum(sysData.disk_total),
      diskUsed:    HardwareService._parseNum(sysData.disk_used),
      diskPercent: sysData.disk_percent != null ? parseFloat(sysData.disk_percent) : null,

      hostname:    sysData.hostname ?? null,
      ipAddress:   sysData.local_ip ?? null,
      interface:   sysData.interface ?? null,

      uptimeSeconds:   sysData.uptime ? parseInt(sysData.uptime, 10) : null,
      uptimeFormatted: sysData.uptime
        ? PiholeApiService.formatUptime(parseInt(sysData.uptime, 10))
        : null,

      piholeVersion: verData.core_current  ?? verData.core_version  ?? null,
      ftlVersion:    verData.FTL_current   ?? verData.FTL_version   ?? null,
      webVersion:    verData.web_current   ?? verData.web_version   ?? null,

      domainsBlocked:    (sumData as Record<string, unknown>).domains_being_blocked != null
        ? Number((sumData as Record<string, unknown>).domains_being_blocked)
        : null,
      gravityLastUpdate: (sumData as Record<string, unknown>).gravity_last_updated
        ? (() => {
            const ts = ((sumData as Record<string, unknown>).gravity_last_updated as Record<string, unknown>)?.absolute;
            return ts ? new Date(Number(ts) * 1000) : null;
          })()
        : null,
    };
  },

  // ─── Private parsers ───────────────────────────────────────────────────────

  _parseCpuLoad(sumData: Record<string, unknown>, sysData: Record<string, string>): number | null {
    if (sysData.cpu_percent != null) return parseFloat(sysData.cpu_percent);
    if (sumData.cpu_usage  != null) return parseFloat(String(sumData.cpu_usage));
    return null;
  },

  _parseCpuTemp(sysData: Record<string, string>): number | null {
    if (sysData.cpu_temp == null) return null;
    const t = parseFloat(sysData.cpu_temp);
    if (isNaN(t) || t === 0) return null; // 0 means unavailable on some builds
    return t;
  },

  _parseNum(raw: string | undefined | null): number | null {
    if (raw == null) return null;
    const v = parseFloat(raw);
    return isNaN(v) ? null : v;
  },

  _calcMemPercent(sysData: Record<string, string>): number | null {
    if (sysData.mem_percent != null) return parseFloat(sysData.mem_percent);
    const total = parseFloat(sysData.mem_total ?? '');
    const used  = parseFloat(sysData.mem_used  ?? '');
    if (!isNaN(total) && !isNaN(used) && total > 0) {
      return Math.round((used / total) * 100);
    }
    return null;
  },

  // ─── Formatters ────────────────────────────────────────────────────────────

  formatBytes(bytes: number | null): string | null {
    if (bytes == null || isNaN(bytes)) return null;
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(0)} MB`;
    if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(0)} KB`;
    return `${bytes} B`;
  },

  formatTemp(celsius: number | null): string | null {
    if (celsius == null) return null;
    return `${celsius.toFixed(1)} °C`;
  },

  severityClass(percent: number): SeverityLevel {
    if (percent >= 90) return 'crit';
    if (percent >= 70) return 'warn';
    return 'normal';
  },

  tempSeverity(celsius: number): SeverityLevel {
    if (celsius >= 75) return 'crit';
    if (celsius >= 60) return 'warn';
    return 'normal';
  },
};

export default HardwareService;
