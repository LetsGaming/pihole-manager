/**
 * Sync Service
 *
 * Syncs selected data categories from one Pi-hole "source" instance to one or
 * more "target" instances.  Supported categories:
 *
 *   adlists      — block-list URLs (enabled state + comment preserved)
 *   black        — exact deny-list
 *   white        — exact allow-list
 *   regex_black  — regex deny-list
 *   regex_white  — regex allow-list
 *   local_dns    — custom A/AAAA records  (v6: GET /api/config/dns/hosts,
 *                                          v5: GET ?customdns&action=get)
 *
 * Two strategies:
 *   merge     — additive only, never removes entries that exist on the target
 *               but not on the source (safe default)
 *   overwrite — makes the target an exact mirror of the source: removes
 *               entries not present on the source, then adds missing ones
 *               (destructive — user must confirm in the UI)
 *
 * Progress is reported via a callback so the UI can render live updates.
 */

import type { PiholeInstance } from "@/types/instance";
import type { Adlist, DomainEntry, DomainListType } from "@/types/api";
import PiholeApiService, {
  _v5Client,
  _v6Client,
  ensureV6Session,
} from "@/services/piholeApi";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SyncCategory =
  | "adlists"
  | "black"
  | "white"
  | "regex_black"
  | "regex_white"
  | "local_dns";

export type SyncMode = "merge" | "overwrite";

export interface SyncOptions {
  /** Instance to read data from */
  source: PiholeInstance;
  /** One or more instances to write data into */
  targets: PiholeInstance[];
  /** Which data categories to sync */
  categories: SyncCategory[];
  /**
   * merge     = only add entries missing on the target (default, safe)
   * overwrite = delete entries not on the source, then add missing ones
   */
  mode: SyncMode;
}

export type SyncStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface SyncStep {
  id: string;
  label: string;
  status: SyncStepStatus;
  detail?: string;
  added?: number;
  removed?: number;
  skipped?: number;
}

export interface SyncResult {
  targetId: string;
  targetName: string;
  steps: SyncStep[];
  ok: boolean;
}

export type SyncProgressCallback = (results: SyncResult[]) => void;

// ─── Local DNS types ──────────────────────────────────────────────────────────

export interface LocalDnsRecord {
  domain: string;
  ip: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepId(targetId: string, category: SyncCategory): string {
  return `${targetId}::${category}`;
}

function categoryLabel(cat: SyncCategory): string {
  const labels: Record<SyncCategory, string> = {
    adlists: "Adlists",
    black: "Exact blocklist",
    white: "Exact allowlist",
    regex_black: "Regex blocklist",
    regex_white: "Regex allowlist",
    local_dns: "Local DNS records",
  };
  return labels[cat];
}

// ─── Local DNS API ────────────────────────────────────────────────────────────

async function getLocalDns(instance: PiholeInstance): Promise<LocalDnsRecord[]> {
  if (instance.apiVersion === "v6") {
    await ensureV6Session(instance);
    const client = _v6Client(instance);
    try {
      const { data } = await client.get<{
        config?: { dns?: { hosts?: string[] } };
      }>("/api/config/dns/hosts");
      const hosts = data?.config?.dns?.hosts ?? [];
      return hosts.flatMap((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) return [];
        const [ip, ...domains] = parts;
        return domains.map((domain) => ({ domain, ip }));
      });
    } catch {
      return [];
    }
  }

  try {
    const { data } = await _v5Client(instance).get<{
      data?: Array<[string, string]>;
    }>("/admin/api.php", { params: { customdns: "", action: "get" } });
    return (data.data ?? []).map(([domain, ip]) => ({ domain, ip }));
  } catch {
    return [];
  }
}

async function addLocalDnsRecord(
  instance: PiholeInstance,
  record: LocalDnsRecord,
): Promise<void> {
  if (instance.apiVersion === "v6") {
    await ensureV6Session(instance);
    const client = _v6Client(instance);
    // v6 stores custom DNS hosts as plain-text lines ("ip domain").
    // The correct endpoint is PUT /api/config/dns/hosts/{entry} where the
    // entry is the URL-encoded "ip domain" line.
    const entry = encodeURIComponent(`${record.ip} ${record.domain}`);
    await client.put(`/api/config/dns/hosts/${entry}`);
    return;
  }
  await _v5Client(instance).get("/admin/api.php", {
    params: { customdns: "", action: "add", ip: record.ip, domain: record.domain },
  });
}

async function removeLocalDnsRecord(
  instance: PiholeInstance,
  record: LocalDnsRecord,
): Promise<void> {
  if (instance.apiVersion === "v6") {
    await ensureV6Session(instance);
    const client = _v6Client(instance);
    // v6: DELETE /api/config/dns/hosts/<ip>/<domain>
    await client.delete(
      `/api/config/dns/hosts/${encodeURIComponent(record.ip)}/${encodeURIComponent(record.domain)}`,
    );
    return;
  }
  await _v5Client(instance).get("/admin/api.php", {
    params: { customdns: "", action: "delete", ip: record.ip, domain: record.domain },
  });
}

// ─── Per-category fetch from source ──────────────────────────────────────────

async function fetchSourceData(
  source: PiholeInstance,
  category: SyncCategory,
): Promise<Adlist[] | DomainEntry[] | LocalDnsRecord[]> {
  switch (category) {
    case "adlists":
      return PiholeApiService.getAdlists(source);
    case "black":
    case "white":
    case "regex_black":
    case "regex_white":
      return PiholeApiService.getList(source, category as DomainListType);
    case "local_dns":
      return getLocalDns(source);
  }
}

// ─── Per-category sync to a single target ────────────────────────────────────

async function syncCategory(
  category: SyncCategory,
  sourceData: Adlist[] | DomainEntry[] | LocalDnsRecord[],
  target: PiholeInstance,
  mode: SyncMode,
): Promise<{ added: number; removed: number; skipped: number }> {
  let added = 0;
  let removed = 0;
  let skipped = 0;

  // ── Adlists ──────────────────────────────────────────────────────────────
  if (category === "adlists") {
    const srcLists = sourceData as Adlist[];
    const existingLists = await PiholeApiService.getAdlists(target);
    const srcUrls = new Set(srcLists.map((l) => l.address));
    const existingUrls = new Set(existingLists.map((l) => l.address));

    if (mode === "overwrite") {
      for (const existing of existingLists) {
        if (!srcUrls.has(existing.address)) {
          await PiholeApiService.removeAdlist(target, existing.address);
          removed++;
        }
      }
    }

    for (const list of srcLists) {
      if (existingUrls.has(list.address)) {
        skipped++;
        continue;
      }
      await PiholeApiService.addAdlist(target, list.address, list.comment ?? "");
      added++;
    }
    return { added, removed, skipped };
  }

  // ── Local DNS ─────────────────────────────────────────────────────────────
  if (category === "local_dns") {
    const srcRecords = sourceData as LocalDnsRecord[];
    const existingRecords = await getLocalDns(target);
    const srcKeys = new Set(srcRecords.map((r) => `${r.domain}::${r.ip}`));
    const existingKeys = new Set(existingRecords.map((r) => `${r.domain}::${r.ip}`));

    if (mode === "overwrite") {
      for (const rec of existingRecords) {
        if (!srcKeys.has(`${rec.domain}::${rec.ip}`)) {
          await removeLocalDnsRecord(target, rec);
          removed++;
        }
      }
    }

    for (const rec of srcRecords) {
      if (existingKeys.has(`${rec.domain}::${rec.ip}`)) {
        skipped++;
        continue;
      }
      await addLocalDnsRecord(target, rec);
      added++;
    }
    return { added, removed, skipped };
  }

  // ── Domain lists (black / white / regex_black / regex_white) ─────────────
  const srcDomains = sourceData as DomainEntry[];
  const existingDomains = await PiholeApiService.getList(
    target,
    category as DomainListType,
  );
  const srcDomainSet = new Set(srcDomains.map((d) => d.domain));
  const existingSet = new Set(existingDomains.map((d) => d.domain));

  if (mode === "overwrite") {
    for (const entry of existingDomains) {
      if (!srcDomainSet.has(entry.domain)) {
        await PiholeApiService.removeFromList(
          target,
          category as DomainListType,
          entry.domain,
        );
        removed++;
      }
    }
  }

  for (const entry of srcDomains) {
    if (existingSet.has(entry.domain)) {
      skipped++;
      continue;
    }
    await PiholeApiService.addToList(
      target,
      category as DomainListType,
      entry.domain,
      entry.comment ?? "",
    );
    added++;
  }
  return { added, removed, skipped };
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function runSync(
  options: SyncOptions,
  onProgress: SyncProgressCallback,
): Promise<SyncResult[]> {
  const { source, targets, categories, mode } = options;

  const results: SyncResult[] = targets.map((t) => ({
    targetId: t.id,
    targetName: t.name,
    ok: true,
    steps: categories.map((cat) => ({
      id: stepId(t.id, cat),
      label: categoryLabel(cat),
      status: "pending" as SyncStepStatus,
    })),
  }));

  onProgress(structuredClone(results));

  // Pre-fetch all source data once
  const sourceCache = new Map<SyncCategory, Adlist[] | DomainEntry[] | LocalDnsRecord[]>();

  for (const cat of categories) {
    try {
      sourceCache.set(cat, await fetchSourceData(source, cat));
    } catch (err) {
      for (const result of results) {
        const step = result.steps.find((s) => s.id === stepId(result.targetId, cat));
        if (step) {
          step.status = "error";
          step.detail = `Failed to read from source: ${errorMsg(err)}`;
        }
        result.ok = false;
      }
      onProgress(structuredClone(results));
    }
  }

  // Sync each target sequentially
  for (const target of targets) {
    const result = results.find((r) => r.targetId === target.id)!;

    for (const cat of categories) {
      const step = result.steps.find((s) => s.id === stepId(target.id, cat))!;

      if (step.status === "error") continue;

      const srcData = sourceCache.get(cat);
      if (!srcData) {
        step.status = "skipped";
        step.detail = "Source data unavailable";
        onProgress(structuredClone(results));
        continue;
      }

      step.status = "running";
      onProgress(structuredClone(results));

      try {
        const { added, removed, skipped } = await syncCategory(cat, srcData, target, mode);
        step.status = "done";
        step.added = added;
        step.removed = removed;
        step.skipped = skipped;

        const parts: string[] = [];
        if (added > 0) parts.push(`${added} added`);
        if (removed > 0) parts.push(`${removed} removed`);
        if (parts.length === 0) parts.push("Already up to date");
        else if (skipped > 0) parts.push(`${skipped} unchanged`);
        step.detail = parts.join(", ");
      } catch (err) {
        step.status = "error";
        step.detail = errorMsg(err);
        result.ok = false;
      }

      onProgress(structuredClone(results));
    }
  }

  return results;
}

function errorMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  return "Unknown error";
}