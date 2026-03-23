import axios, { type AxiosInstance } from "axios";
import type { PiholeInstance } from "@/types/instance";
import type {
  PiholeSummary,
  BlockingStatus,
  QueryEntry,
  QueryStatus,
  Adlist,
  DomainEntry,
  DomainListType,
  TopDomainsResult,
  TopDomainsMap,
  TopClientsMap,
  OverTimeData,
  PiholeVersions,
  ConnectionTestResult,
} from "@/types/api";

// ─── v5 Status code → QueryStatus ────────────────────────────────────────────

const STATUS_MAP: Record<number, QueryStatus> = {
  1: "blocked",
  2: "allowed",
  3: "cached",
  4: "blocked",
  5: "blocked",
  6: "blocked",
  7: "allowed",
  8: "allowed",
  9: "blocked",
  10: "allowed",
  11: "allowed",
  12: "blocked",
  13: "blocked",
  14: "blocked",
  15: "blocked",
  16: "cached",
};

// ─── v6 Session cache ─────────────────────────────────────────────────────────

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const SESSION_KEY_PFX = "orbital_v6sid_";

interface CachedSession {
  sid: string;
  expires: number;
}

function loadSession(instanceId: string): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PFX + instanceId);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSession;
    if (Date.now() >= cached.expires) {
      sessionStorage.removeItem(SESSION_KEY_PFX + instanceId);
      return null;
    }
    return cached.sid;
  } catch {
    return null;
  }
}

function saveSession(instanceId: string, sid: string, ttlMs: number): void {
  try {
    const entry: CachedSession = { sid, expires: Date.now() + ttlMs };
    sessionStorage.setItem(SESSION_KEY_PFX + instanceId, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function dropSession(instanceId: string): void {
  try {
    sessionStorage.removeItem(SESSION_KEY_PFX + instanceId);
  } catch {
    // ignore
  }
}

// ─── Dev proxy helpers ────────────────────────────────────────────────────────

function baseURL(instanceUrl: string): string {
  if (import.meta.env.DEV) {
    const b64 = btoa(instanceUrl.replace(/\/$/, ""))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `/pihole-proxy/${b64}`;
  }
  return instanceUrl.replace(/\/$/, "");
}

// ─── HTTP client factories ────────────────────────────────────────────────────

function v5Client(instance: PiholeInstance): AxiosInstance {
  const client = axios.create({
    baseURL: baseURL(instance.url),
    timeout: 10_000,
  });
  client.interceptors.request.use((cfg) => {
    cfg.params = { ...cfg.params, auth: instance.apiToken };
    return cfg;
  });
  return client;
}

function v6Client(instance: PiholeInstance): AxiosInstance {
  const client = axios.create({
    baseURL: baseURL(instance.url),
    timeout: 10_000,
  });
  client.interceptors.request.use((cfg) => {
    const sid = loadSession(instance.id);
    if (sid) cfg.headers["X-FTL-SID"] = sid;
    return cfg;
  });
  return client;
}

async function ensureV6Session(instance: PiholeInstance): Promise<string> {
  const existing = loadSession(instance.id);
  if (existing) return existing;

  const client = axios.create({
    baseURL: baseURL(instance.url),
    timeout: 10_000,
  });
  const { data } = await client.post<{
    session?: { sid?: string; valid?: boolean; validity?: number };
  }>("/api/auth", { password: instance.apiToken });

  const sid = data?.session?.sid;
  if (!sid) throw new Error("v6 auth failed — check your Pi-hole web password");

  const serverTtlMs = data.session?.validity
    ? data.session.validity * 1000
    : SESSION_TTL_MS;
  const ttl = Math.max(serverTtlMs - 5 * 60 * 1000, 60_000);

  saveSession(instance.id, sid, ttl);
  return sid;
}

function clearV6Session(instanceId: string): void {
  dropSession(instanceId);
}

// ─── Error normalisation ──────────────────────────────────────────────────────

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const nested = (e?.response as Record<string, unknown>)?.data;
    if (nested && typeof nested === "object") {
      const d = nested as Record<string, unknown>;
      if (typeof d?.error === "object" && d.error) {
        const msg = (d.error as Record<string, unknown>)?.message;
        if (typeof msg === "string") return msg;
      }
      if (typeof d?.message === "string") return d.message;
    }
    if (typeof e?.message === "string") return e.message;
  }
  return "Unknown error";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function v6Call<T>(
  instance: PiholeInstance,
  fn: (client: AxiosInstance) => Promise<T>,
): Promise<T> {
  await ensureV6Session(instance);
  try {
    return await fn(v6Client(instance));
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 401) {
      clearV6Session(instance.id);
      await ensureV6Session(instance);
      return fn(v6Client(instance));
    }
    throw err;
  }
}

function v6QueryStatus(status: string | number): QueryStatus {
  if (typeof status === "string") {
    const s = status.toUpperCase();
    if (
      s.includes("GRAVITY") ||
      s.includes("REGEX") ||
      s.includes("DENYLIST") ||
      s.includes("BLOCKED") ||
      s === "SPECIAL_DOMAIN"
    )
      return "blocked";
    if (
      s === "CACHE" ||
      s === "CACHE_STALE" ||
      s === "RETRIED" ||
      s === "RETRIED_DNSSEC"
    )
      return "cached";
    if (s === "IN_PROGRESS" || s === "DBBUSY" || s === "UNKNOWN")
      return "unknown";
    return "allowed";
  }
  if ([1, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15].includes(status as number))
    return "blocked";
  if ([3, 16].includes(status as number)) return "cached";
  if (status === 0) return "unknown";
  return "allowed";
}

// ─── Service ──────────────────────────────────────────────────────────────────

const PiholeApiService = {
  async getSummary(instance: PiholeInstance): Promise<PiholeSummary> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        // Both requests share the same authenticated session from v6Call.
        // Do NOT catch the blocking request silently — a swallowed auth error
        // would always default to "enabled" and mask the real problem.
        const [summaryRes, blockingRes] = await Promise.all([
          client.get<{
            queries: {
              total: number;
              blocked: number;
              percent_blocked: number;
              forwarded?: number;
              cached?: number;
            };
            clients: { active: number; total: number };
            gravity: { domains_being_blocked: number; last_update?: number };
          }>("/api/stats/summary"),
          client.get<{ blocking: "enabled" | "disabled" }>("/api/dns/blocking"),
        ]);
        const d = summaryRes.data;
        return {
          status:
            blockingRes.data.blocking === "enabled" ? "enabled" : "disabled",
          dns_queries_today: d.queries.total,
          ads_blocked_today: d.queries.blocked,
          ads_percentage_today: d.queries.percent_blocked,
          domains_being_blocked: d.gravity.domains_being_blocked,
          unique_clients: d.clients.active,
          queries_cached: d.queries.cached,
          queries_forwarded: d.queries.forwarded,
          ...(d.gravity.last_update != null && {
            gravity_last_updated: {
              absolute: d.gravity.last_update,
              relative: { days: 0, hours: 0, minutes: 0 },
            },
          }),
        } as PiholeSummary;
      });
    }
    // v5: ?summary does NOT include a blocking status field — fetch ?status
    // in parallel and merge so summaryData.status is always accurate.
    const client = v5Client(instance);
    const [summaryRes, statusRes] = await Promise.all([
      client.get<PiholeSummary>("/admin/api.php", { params: { summary: "" } }),
      client.get<{ status: BlockingStatus }>("/admin/api.php", {
        params: { status: "" },
      }),
    ]);
    return { ...summaryRes.data, status: statusRes.data.status };
  },

  async getStatus(
    instance: PiholeInstance,
  ): Promise<{ status: BlockingStatus }> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{ blocking: "enabled" | "disabled" }>(
          "/api/dns/blocking",
        );
        return { status: data.blocking === "enabled" ? "enabled" : "disabled" };
      });
    }
    const { data } = await v5Client(instance).get<{ status: BlockingStatus }>(
      "/admin/api.php",
      { params: { status: "" } },
    );
    return data;
  },

  async enableBlocking(
    instance: PiholeInstance,
  ): Promise<{ status: BlockingStatus }> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        // POST returns { blocking: "enabled"|"disabled", timer: null }
        const { data } = await client.post<{
          blocking: "enabled" | "disabled";
        }>("/api/dns/blocking", { blocking: true });
        return { status: data.blocking === "enabled" ? "enabled" : "disabled" };
      });
    }
    const { data } = await v5Client(instance).get<{ status: BlockingStatus }>(
      "/admin/api.php",
      { params: { enable: "" } },
    );
    return data;
  },

  async disableBlocking(
    instance: PiholeInstance,
    seconds = 0,
  ): Promise<{ status: BlockingStatus }> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const body: Record<string, unknown> = { blocking: false };
        if (seconds > 0) body.timer = seconds;
        // POST returns { blocking: "enabled"|"disabled", timer: null }
        const { data } = await client.post<{
          blocking: "enabled" | "disabled";
        }>("/api/dns/blocking", body);
        return { status: data.blocking === "enabled" ? "enabled" : "disabled" };
      });
    }
    const { data } = await v5Client(instance).get<{ status: BlockingStatus }>(
      "/admin/api.php",
      { params: { disable: seconds } },
    );
    return data;
  },

  async getQueryLog(
    instance: PiholeInstance,
    count = 100,
  ): Promise<QueryEntry[]> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          queries?: Array<{
            time: number;
            type: string;
            domain: string;
            status: string;
            client: { ip: string };
          }>;
        }>("/api/queries", { params: { max_results: count } });
        return (data.queries ?? []).map((q) => ({
          timestamp: Math.round(q.time * 1000),
          type: q.type,
          domain: q.domain,
          client: q.client?.ip ?? "",
          statusCode: 0,
          status: v6QueryStatus(q.status),
          rawStatus: q.status,
        }));
      });
    }
    const { data } = await v5Client(instance).get<{ data?: unknown[][] }>(
      "/admin/api.php",
      { params: { getAllQueries: count } },
    );
    return (data.data ?? []).map(PiholeApiService._parseQueryEntry);
  },

  _parseQueryEntry(raw: unknown[]): QueryEntry {
    const code = parseInt(String(raw[4]), 10);
    return {
      timestamp: parseInt(String(raw[0]), 10) * 1000,
      type: String(raw[1]),
      domain: String(raw[2]),
      client: String(raw[3]),
      statusCode: code,
      status: STATUS_MAP[code] ?? "unknown",
    };
  },

  async getTopDomains(
    instance: PiholeInstance,
    count = 10,
  ): Promise<TopDomainsResult> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        // Fetch allowed domains and blocked domains separately or via combined params if supported
        const [allowedRes, blockedRes] = await Promise.all([
          client.get<{ domains?: any }>("/api/stats/top_domains", {
            params: { count, blocked: false },
          }),
          client.get<{ domains?: any }>("/api/stats/top_domains", {
            params: { count, blocked: true },
          }),
        ]);

        const toMap = (arr: any): TopDomainsMap => {
          const map: TopDomainsMap = {};
          if (!arr) return map;

          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item?.domain) {
                map[item.domain] = item.count;
              }
            }
            return map;
          }

          if (typeof arr === "object") {
            return arr as TopDomainsMap;
          }

          return map;
        };

        return {
          topDomains: toMap(allowedRes.data.domains),
          topBlocked: toMap(blockedRes.data.domains),
        };
      });
    }

    // v5 Legacy API Fallback
    const { data } = await v5Client(instance).get<{
      top_queries?: TopDomainsMap;
      top_ads?: TopDomainsMap;
    }>("/admin/api.php", { params: { topItems: count } });

    return {
      topDomains: data.top_queries ?? {},
      topBlocked: data.top_ads ?? {},
    };
  },

  async getTopClients(
    instance: PiholeInstance,
    count = 10,
  ): Promise<TopClientsMap> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          clients?: Array<{ ip: string; name?: string; count: number }>;
        }>("/api/stats/top_clients", { params: { count } });
        return Object.fromEntries(
          (data.clients ?? []).map((c) => [c.name || c.ip, c.count]),
        );
      });
    }
    const { data } = await v5Client(instance).get<{
      top_sources?: TopClientsMap;
    }>("/admin/api.php", { params: { getQuerySources: count } });
    return data.top_sources ?? {};
  },

  async getOverTimeData(instance: PiholeInstance): Promise<OverTimeData> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          history?: Array<{
            timestamp: number;
            total: number;
            blocked: number;
          }>;
        }>("/api/history");
        const domains: Record<string, number> = {};
        const ads: Record<string, number> = {};
        for (const bucket of data.history ?? []) {
          domains[String(bucket.timestamp)] = bucket.total;
          ads[String(bucket.timestamp)] = bucket.blocked;
        }
        return { domains, ads };
      });
    }
    const { data } = await v5Client(instance).get<{
      domains_over_time?: Record<string, number>;
      ads_over_time?: Record<string, number>;
    }>("/admin/api.php", { params: { overTimeData10mins: "" } });
    return {
      domains: data.domains_over_time ?? {},
      ads: data.ads_over_time ?? {},
    };
  },

  async getAdlists(instance: PiholeInstance): Promise<Adlist[]> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          lists?: Array<{
            id: number;
            address: string;
            enabled: boolean;
            comment: string;
            type?: string;
            number?: number;
          }>;
        }>("/api/lists", { params: { type: "block" } });
        return (data.lists ?? []).map((l) => ({
          id: l.id,
          address: l.address,
          enabled: l.enabled ? 1 : 0,
          comment: l.comment ?? "",
          number: l.number,
        }));
      });
    }
    const { data } = await v5Client(instance).get<{ data?: Adlist[] }>(
      "/admin/api.php",
      { params: { list: "adlist" } },
    );
    return data.data ?? [];
  },

  async addAdlist(
    instance: PiholeInstance,
    url: string,
    comment = "",
  ): Promise<void> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.post<{ error?: { message?: string } }>(
          "/api/lists",
          { address: url, comment, enabled: true },
          { params: { type: "block" } },
        );
        if (data.error)
          throw new Error(data.error.message ?? "Failed to add adlist");
      });
    }
    const { data } = await v5Client(instance).post<{
      success?: boolean;
      message?: string;
    }>("/admin/api.php", null, {
      params: { list: "adlist", add: url, comment },
    });
    if (data.success === false)
      throw new Error(data.message ?? "Failed to add adlist");
  },

  async removeAdlist(instance: PiholeInstance, url: string): Promise<void> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data: list } = await client.get<{
          lists?: Array<{ id: number; address: string }>;
        }>("/api/lists", { params: { type: "block" } });
        const found = list.lists?.find((l) => l.address === url);
        if (!found) throw new Error("Adlist not found");
        await client.delete(`/api/lists/${found.id}`);
      });
    }
    const { data } = await v5Client(instance).post<{
      success?: boolean;
      message?: string;
    }>("/admin/api.php", null, { params: { list: "adlist", sub: url } });
    if (data.success === false)
      throw new Error(data.message ?? "Failed to remove adlist");
  },

  _v6ListType(listType: DomainListType): { type: string; kind: string } {
    switch (listType) {
      case "black":
        return { type: "deny", kind: "exact" };
      case "white":
        return { type: "allow", kind: "exact" };
      case "regex_black":
        return { type: "deny", kind: "regex" };
      case "regex_white":
        return { type: "allow", kind: "regex" };
    }
  },

  async getList(
    instance: PiholeInstance,
    listType: DomainListType,
  ): Promise<DomainEntry[]> {
    if (instance.apiVersion === "v6") {
      const { type, kind } = PiholeApiService._v6ListType(listType);
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          domains?: Array<{
            id: number;
            domain: string;
            enabled: boolean;
            comment: string;
            type?: string;
            kind?: string;
          }>;
        }>(`/api/domains/${type}/${kind}`);
        // Pi-hole v6 ignores ?type and ?kind query params — use path segments
        // instead. Filter client-side as a safety net in case the endpoint
        // returns mixed results (e.g. regex entries alongside exact ones).
        return (data.domains ?? [])
          .filter(
            (d) => (!d.type || d.type === type) && (!d.kind || d.kind === kind),
          )
          .map((d) => ({
            id: d.id,
            domain: d.domain,
            enabled: d.enabled ? 1 : 0,
            comment: d.comment ?? "",
          }));
      });
    }
    const { data } = await v5Client(instance).get<{ data?: DomainEntry[] }>(
      "/admin/api.php",
      { params: { list: listType } },
    );
    return data.data ?? [];
  },

  async addToList(
    instance: PiholeInstance,
    listType: DomainListType,
    domain: string,
    comment = "",
  ): Promise<void> {
    if (instance.apiVersion === "v6") {
      const { type, kind } = PiholeApiService._v6ListType(listType);
      return v6Call(instance, async (client) => {
        const { data } = await client.post<{ error?: { message?: string } }>(
          `/api/domains/${type}/${kind}`,
          { domain, comment, enabled: true },
        );
        if (data.error)
          throw new Error(data.error.message ?? "Failed to add domain");
      });
    }
    const { data } = await v5Client(instance).post<{
      success?: boolean;
      message?: string;
    }>("/admin/api.php", null, {
      params: { list: listType, add: domain, comment },
    });
    if (data.success === false)
      throw new Error(data.message ?? "Failed to add domain");
  },

  async removeFromList(
    instance: PiholeInstance,
    listType: DomainListType,
    domain: string,
  ): Promise<void> {
    if (instance.apiVersion === "v6") {
      const { type, kind } = PiholeApiService._v6ListType(listType);
      return v6Call(instance, async (client) => {
        await client.delete(
          `/api/domains/${type}/${kind}/${encodeURIComponent(domain)}`,
        );
      });
    }
    const { data } = await v5Client(instance).post<{
      success?: boolean;
      message?: string;
    }>("/admin/api.php", null, { params: { list: listType, sub: domain } });
    if (data.success === false)
      throw new Error(data.message ?? "Failed to remove domain");
  },

  async updateGravity(instance: PiholeInstance): Promise<void> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        await client.post("/api/action/gravity");
      });
    }
    await v5Client(instance).get("/admin/api.php", {
      params: { updateGravity: "" },
    });
  },

  async getVersions(instance: PiholeInstance): Promise<PiholeVersions> {
    if (instance.apiVersion === "v6") {
      return v6Call(instance, async (client) => {
        const { data } = await client.get<{
          version?: {
            core?: { local?: { version?: string }; tag?: string };
            FTL?: { local?: { version?: string }; tag?: string };
            web?: { local?: { version?: string }; tag?: string };
          };
        }>("/api/info/version");
        return {
          core_current:
            data.version?.core?.local?.version ?? data.version?.core?.tag,
          FTL_current:
            data.version?.FTL?.local?.version ?? data.version?.FTL?.tag,
          web_current:
            data.version?.web?.local?.version ?? data.version?.web?.tag,
        };
      });
    }
    const { data } = await v5Client(instance).get<PiholeVersions>(
      "/admin/api.php",
      { params: { versions: "" } },
    );
    return data;
  },

  async getSystemInfo(
    instance: PiholeInstance,
  ): Promise<Record<string, string>> {
    if (instance.apiVersion === "v6") {
      try {
        return await v6Call(instance, async (client) => {
          const { data } = await client.get<{
            system?: {
              uptime?: number;
              cpu?: {
                nprocs?: number;
                "%cpu"?: number;
                load?: { percent?: number[] };
              };
              memory?: {
                ram?: { total?: number; used?: number; "%used"?: number };
              };
              sensors?: Array<{ name: string; value: number; prefix: string }>;
              hostname?: string;
            };
          }>("/api/info/system");
          const sys = data.system;
          if (!sys) return {};
          const cpuPercent = sys.cpu?.["%cpu"] ?? sys.cpu?.load?.percent?.[0];
          const tempSensor =
            sys.sensors?.find(
              (s) => s.name.toLowerCase().includes("cpu") && s.prefix === "°C",
            ) ?? sys.sensors?.find((s) => s.prefix === "°C");
          const memPercent = sys.memory?.ram?.["%used"];

          return {
            ...(cpuPercent != null && { cpu_percent: String(cpuPercent) }),
            ...(tempSensor != null && { cpu_temp: String(tempSensor.value) }),
            ...(sys.cpu?.nprocs != null && {
              cpu_cores: String(sys.cpu.nprocs),
            }),
            ...(sys.memory?.ram?.total != null && {
              mem_total: String(sys.memory.ram.total * 1024),
            }),
            ...(sys.memory?.ram?.used != null && {
              mem_used: String(sys.memory.ram.used * 1024),
            }),
            ...(memPercent != null && {
              mem_percent: String(memPercent.toFixed(1)),
            }),
            ...(sys.uptime != null && { uptime: String(sys.uptime) }),
            ...(sys.hostname != null && { hostname: String(sys.hostname) }),
          };
        });
      } catch {
        return {};
      }
    }
    try {
      const { data } = await v5Client(instance).get<Record<string, string>>(
        "/admin/api_FTL.php",
        { params: { getSysInfo: "" } },
      );
      return data ?? {};
    } catch {
      return {};
    }
  },

  async testConnection(
    instance: PiholeInstance,
  ): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const data = await PiholeApiService.getSummary(instance);
      const latencyMs = Date.now() - start;
      if (!data || data.status === undefined)
        return {
          ok: false,
          message: "Connected but invalid response",
          latencyMs,
        };
      return { ok: true, message: "Connection successful", latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const status = (err as any)?.response?.status;
      if (instance.apiVersion === "v6" && (status === 401 || status === 403))
        clearV6Session(instance.id);
      return { ok: false, message: errorMessage(err), latencyMs };
    }
  },

  formatUptime(seconds: number | null): string | null {
    if (seconds == null || isNaN(seconds)) return null;
    const d = Math.floor(seconds / 86_400);
    const h = Math.floor((seconds % 86_400) / 3_600);
    const m = Math.floor((seconds % 3_600) / 60);
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    return parts.length ? parts.join(" ") : "<1m";
  },

  clearSession(instanceId: string): void {
    clearV6Session(instanceId);
  },
  errorMessage,
};

export default PiholeApiService;
export { v5Client as _v5Client, v6Client as _v6Client, ensureV6Session };

export function createClient(instance: PiholeInstance): AxiosInstance {
  return instance.apiVersion === "v6" ? v6Client(instance) : v5Client(instance);
}
