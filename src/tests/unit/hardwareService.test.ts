import { describe, it, expect, vi, beforeEach } from "vitest";
import HardwareService from "@/services/hardwareService";
import type { PiholeInstance } from "@/types/instance";

vi.mock("@/services/piholeApi", () => ({
  default: {
    getSummary: vi.fn(),
    getVersions: vi.fn(),
    getSystemInfo: vi.fn(),
    formatUptime: (s: number | null) => {
      if (!s || isNaN(s)) return null;
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const parts: string[] = [];
      if (d) parts.push(`${d}d`);
      if (h) parts.push(`${h}h`);
      if (m) parts.push(`${m}m`);
      return parts.length ? parts.join(" ") : "<1m";
    },
  },
}));

import PiholeApiService from "@/services/piholeApi";

const mockInstance: PiholeInstance = {
  id: "test",
  url: "http://pi.hole",
  apiToken: "token",
  apiVersion: "v5",
  name: "Test",
  status: "online",
  addedAt: "",
};

describe("HardwareService.getHardwareInfo", () => {
  beforeEach(() => {
    vi.mocked(PiholeApiService.getSummary).mockResolvedValue({
      status: "enabled",
      dns_queries_today: 1000,
      ads_blocked_today: 200,
      ads_percentage_today: 20,
      domains_being_blocked: 99000,
      unique_clients: 5,
      gravity_last_updated: {
        absolute: 1700000000,
        relative: { days: 0, hours: 0, minutes: 0 },
      },
    });
    vi.mocked(PiholeApiService.getVersions).mockResolvedValue({
      core_current: "v5.17.1",
      FTL_current: "v5.23",
      web_current: "v5.20.1",
    });
    vi.mocked(PiholeApiService.getSystemInfo).mockResolvedValue({
      cpu_percent: "34.5",
      cpu_temp: "52.1",
      cpu_model: "ARMv8 Processor",
      cpu_cores: "4",
      mem_total: "4294967296",
      mem_used: "1073741824",
      mem_free: "3221225472",
      disk_total: "32212254720",
      disk_used: "16106127360",
      disk_percent: "50.0",
      hostname: "pihole01",
      local_ip: "192.168.1.100",
      interface: "eth0",
      uptime: "86400",
    });
  });

  it("populates CPU fields from sysInfo", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.cpuLoad).toBe(34.5);
    expect(info.cpuTemp).toBe(52.1);
    expect(info.cpuModel).toBe("ARMv8 Processor");
    expect(info.cpuCores).toBe(4);
  });

  it("populates memory fields", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.memTotal).toBe(4294967296);
    expect(info.memUsed).toBe(1073741824);
    expect(info.memPercent).toBeCloseTo(25, 0);
  });

  it("populates disk fields", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.diskTotal).toBe(32212254720);
    expect(info.diskPercent).toBe(50.0);
  });

  it("populates network and uptime fields", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.hostname).toBe("pihole01");
    expect(info.ipAddress).toBe("192.168.1.100");
    expect(info.uptimeSeconds).toBe(86400);
    expect(info.uptimeFormatted).toBe("1d");
  });

  it("populates version fields", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.piholeVersion).toBe("v5.17.1");
    expect(info.ftlVersion).toBe("v5.23");
    expect(info.webVersion).toBe("v5.20.1");
  });

  it("populates gravityLastUpdate as Date", async () => {
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.gravityLastUpdate).toBeInstanceOf(Date);
  });

  it("sets cpuTemp to null when temperature is 0 (VM)", async () => {
    vi.mocked(PiholeApiService.getSystemInfo).mockResolvedValue({
      cpu_temp: "0.0",
    });
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.cpuTemp).toBeNull();
  });

  it("sets cpuTemp to null when field is absent", async () => {
    vi.mocked(PiholeApiService.getSystemInfo).mockResolvedValue({});
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.cpuTemp).toBeNull();
  });

  it("gracefully handles all APIs failing", async () => {
    vi.mocked(PiholeApiService.getSummary).mockRejectedValue(
      new Error("offline"),
    );
    vi.mocked(PiholeApiService.getVersions).mockRejectedValue(
      new Error("offline"),
    );
    vi.mocked(PiholeApiService.getSystemInfo).mockRejectedValue(
      new Error("offline"),
    );
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.cpuLoad).toBeNull();
    expect(info.cpuTemp).toBeNull();
    expect(info.hostname).toBeNull();
    expect(info.piholeVersion).toBeNull();
  });

  it("falls back to cpu_usage from summary when sysInfo has no cpu_percent", async () => {
    vi.mocked(PiholeApiService.getSummary).mockResolvedValue({
      cpu_usage: "22.2",
    } as never);
    vi.mocked(PiholeApiService.getSystemInfo).mockResolvedValue({});
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.cpuLoad).toBe(22.2);
  });

  it("calculates memPercent from total/used when mem_percent absent", async () => {
    vi.mocked(PiholeApiService.getSystemInfo).mockResolvedValue({
      mem_total: "1000",
      mem_used: "600",
    });
    const info = await HardwareService.getHardwareInfo(mockInstance);
    expect(info.memPercent).toBe(60);
  });
});

describe("HardwareService.formatBytes", () => {
  it("formats GB", () =>
    expect(HardwareService.formatBytes(2 * 1024 ** 3)).toBe("2.0 GB"));
  it("formats MB", () =>
    expect(HardwareService.formatBytes(512 * 1024 ** 2)).toBe("512 MB"));
  it("formats KB", () =>
    expect(HardwareService.formatBytes(4096)).toBe("4 KB"));
  it("formats bytes", () =>
    expect(HardwareService.formatBytes(500)).toBe("500 B"));
  it("returns null for null", () =>
    expect(HardwareService.formatBytes(null)).toBeNull());
  it("returns null for NaN", () =>
    expect(HardwareService.formatBytes(NaN)).toBeNull());
});

describe("HardwareService.severityClass", () => {
  it("normal below 70%", () =>
    expect(HardwareService.severityClass(50)).toBe("normal"));
  it("warn between 70-89%", () =>
    expect(HardwareService.severityClass(75)).toBe("warn"));
  it("crit at 90%+", () =>
    expect(HardwareService.severityClass(90)).toBe("crit"));
});

describe("HardwareService.formatTemp", () => {
  it("formats with one decimal", () =>
    expect(HardwareService.formatTemp(52.1)).toBe("52.1 °C"));
  it("returns null for null", () =>
    expect(HardwareService.formatTemp(null)).toBeNull());
});

describe("HardwareService.tempSeverity", () => {
  it("normal below 60°C", () =>
    expect(HardwareService.tempSeverity(40)).toBe("normal"));
  it("warn 60-74°C", () =>
    expect(HardwareService.tempSeverity(65)).toBe("warn"));
  it("crit at 75°C+", () =>
    expect(HardwareService.tempSeverity(80)).toBe("crit"));
});
