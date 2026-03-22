// ─── Instance ─────────────────────────────────────────────────────────────────

export type InstanceStatus = "online" | "offline" | "unknown";
export type ApiVersion = "v5" | "v6";

export interface PiholeInstance {
  id: string;
  name: string;
  /** Base URL, no trailing slash. e.g. "http://192.168.1.100" */
  url: string;
  /**
   * v5: API token (long hex string from Settings → API / Web Interface)
   * v6: Web password (used to obtain a session token via POST /api/auth)
   */
  apiToken: string;
  apiVersion: ApiVersion;
  status: InstanceStatus;
  addedAt: string; // ISO date string
}

export type NewInstanceConfig = Omit<
  PiholeInstance,
  "id" | "status" | "addedAt"
>;
export type UpdateInstanceConfig = Partial<
  Pick<PiholeInstance, "name" | "url" | "apiToken" | "apiVersion">
>;
