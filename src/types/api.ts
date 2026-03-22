// ─── Summary / Status ─────────────────────────────────────────────────────────

export type BlockingStatus = "enabled" | "disabled";

export interface PiholeSummary {
  status: BlockingStatus;
  dns_queries_today: number;
  ads_blocked_today: number;
  ads_percentage_today: number;
  domains_being_blocked: number;
  unique_clients: number;
  queries_cached?: number;
  queries_forwarded?: number;
  gravity_last_updated?: {
    /** Unix timestamp (seconds) */
    absolute: number;
    relative: { days: number; hours: number; minutes: number };
  };
}

// ─── Query Log ────────────────────────────────────────────────────────────────

export type QueryStatus = "blocked" | "allowed" | "cached" | "unknown";

export interface QueryEntry {
  timestamp: number; // Unix ms
  type: string; // e.g. "A", "AAAA"
  domain: string;
  client: string;
  statusCode: number;
  status: QueryStatus;
  /** v6 only: raw status string from Pi-hole, e.g. "GRAVITY", "FORWARDED", "CACHE_STALE" */
  rawStatus?: string;
}

/** QueryEntry enriched with instance metadata after fetch */
export interface EnrichedQueryEntry extends QueryEntry {
  _instanceId: string;
  _instanceName: string;
  _key: string;
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export type DomainListType = "black" | "white" | "regex_black" | "regex_white";

export interface Adlist {
  id: number;
  address: string;
  enabled: number; // 0 | 1
  comment: string;
  number?: number; // domain count, may be absent
  date_added?: number;
}

export interface DomainEntry {
  id: number;
  domain: string;
  enabled: number;
  comment: string;
  date_added?: number | null;
}

// ─── Top Stats ────────────────────────────────────────────────────────────────

export type TopDomainsMap = Record<string, number>;
export type TopClientsMap = Record<string, number>;

export interface TopDomainsResult {
  topDomains: TopDomainsMap;
  topBlocked: TopDomainsMap;
}

// ─── Over-time ────────────────────────────────────────────────────────────────

export interface OverTimeData {
  domains: Record<string, number>;
  ads: Record<string, number>;
}

// ─── Versions ────────────────────────────────────────────────────────────────

export interface PiholeVersions {
  core_current?: string;
  core_version?: string;
  FTL_current?: string;
  FTL_version?: string;
  web_current?: string;
  web_version?: string;
}

// ─── Connection Test ─────────────────────────────────────────────────────────

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}
