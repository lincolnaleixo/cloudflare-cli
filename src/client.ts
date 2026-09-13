import type {
  CloudflareConfig,
  CloudflareResponse,
  CreateDNSRecord,
  DNSRecord,
  UpdateDNSRecord,
  Zone,
} from "./types.ts";

const BASE_URL = "https://api.cloudflare.com/client/v4";
const ZONE_ID_RE = /^[a-f0-9]{32}$/i;

function loadConfig(): CloudflareConfig {
  const config: CloudflareConfig = {
    apiToken: process.env.CLOUDFLARE_API_TOKEN?.trim() || undefined,
    globalApiKey: process.env.CLOUDFLARE_GLOBAL_API_KEY?.trim() || undefined,
    email: process.env.CLOUDFLARE_EMAIL?.trim() || undefined,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
  };

  if ((config.globalApiKey && !config.email) || (!config.globalApiKey && config.email)) {
    throw new Error("Cloudflare Global API Key authentication requires both key and email.");
  }

  if (!config.apiToken && !config.globalApiKey) {
    throw new Error(
      "Cloudflare credentials not found. Run through `/home/robot/.local/bin/system-vault run cloudflare --`.",
    );
  }

  return config;
}

function getAuthHeaders(config: CloudflareConfig): Record<string, string> {
  // A user-level Global API Key is retained for accounts whose scoped token
  // cannot edit zone DNS records. Otherwise use the scoped Bearer token.
  if (config.globalApiKey && config.email) {
    return {
      "X-Auth-Email": config.email,
      "X-Auth-Key": config.globalApiKey,
      "Content-Type": "application/json",
    };
  }
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };
}

function apiError(json: Partial<CloudflareResponse<unknown>>, status: number): Error {
  const errors = Array.isArray(json.errors)
    ? json.errors
        .map((error) => (error && typeof error.message === "string" ? error.message : ""))
        .filter(Boolean)
        .join(", ")
    : "";
  const detail = errors || `HTTP ${status}`;
  return new Error(`Cloudflare API error: ${detail}`);
}

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<CloudflareResponse<T>> {
  const config = loadConfig();
  const options: RequestInit = {
    method,
    headers: getAuthHeaders(config),
  };

  if (body && ["POST", "PUT", "PATCH"].includes(method)) {
    options.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cloudflare API request failed: ${message}`);
  }

  const raw = await response.text();
  let json: Partial<CloudflareResponse<T>>;
  try {
    json = JSON.parse(raw) as Partial<CloudflareResponse<T>>;
  } catch {
    throw new Error(`Cloudflare API returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok || json.success !== true) throw apiError(json, response.status);
  return json as CloudflareResponse<T>;
}

function zoneNameForInput(zone: Zone, name: string): string {
  const requested = name.trim().replace(/\.$/, "");
  if (!requested) throw new Error("DNS record name cannot be empty.");
  if (requested === "@") return zone.name;

  const zoneName = zone.name.toLowerCase();
  const lower = requested.toLowerCase();
  if (lower === zoneName || lower.endsWith(`.${zoneName}`)) return requested;
  return `${requested}.${zone.name}`;
}

function recordPayload(zone: Zone, record: CreateDNSRecord | UpdateDNSRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (record.type !== undefined) payload.type = record.type.toUpperCase();
  if (record.name !== undefined) payload.name = zoneNameForInput(zone, record.name);
  if (record.content !== undefined) payload.content = record.content;
  if (record.ttl !== undefined) payload.ttl = record.ttl;
  if (record.proxied !== undefined) payload.proxied = record.proxied;
  if (record.priority !== undefined) payload.priority = record.priority;
  return payload;
}

async function getZoneByIdOrName(nameOrId: string): Promise<Zone> {
  if (ZONE_ID_RE.test(nameOrId)) return (await request<Zone>("GET", `/zones/${nameOrId}`)).result;

  const query = new URLSearchParams({ name: nameOrId.trim(), per_page: "50" });
  const zones = (await request<Zone[]>("GET", `/zones?${query}`)).result;
  if (zones.length === 0) throw new Error(`Zone not found: ${nameOrId}`);
  return zones[0]!;
}

async function listPage<T>(path: string): Promise<{ result: T[]; totalPages: number }> {
  const response = await request<T[]>("GET", path);
  return {
    result: response.result,
    totalPages: response.result_info?.total_pages ?? 1,
  };
}

// Zone operations
export async function listZones(): Promise<Zone[]> {
  const zones: Zone[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ per_page: "50", page: String(page) });
    const current = await listPage<Zone>(`/zones?${query}`);
    zones.push(...current.result);
    totalPages = current.totalPages;
    page += 1;
  } while (page <= totalPages);
  return zones;
}

export async function getZone(nameOrId: string): Promise<Zone> {
  return getZoneByIdOrName(nameOrId);
}

export async function getZoneId(nameOrId: string): Promise<string> {
  return (await getZoneByIdOrName(nameOrId)).id;
}

// DNS record operations
export async function listRecords(zoneNameOrId: string, type?: string): Promise<DNSRecord[]> {
  const zone = await getZoneByIdOrName(zoneNameOrId);
  const records: DNSRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ per_page: "100", page: String(page) });
    if (type) query.set("type", type.toUpperCase());
    const current = await listPage<DNSRecord>(`/zones/${zone.id}/dns_records?${query}`);
    records.push(...current.result);
    totalPages = current.totalPages;
    page += 1;
  } while (page <= totalPages);
  return records;
}

export async function getRecord(
  zoneNameOrId: string,
  name: string,
  type?: string,
): Promise<DNSRecord | null> {
  const zone = await getZoneByIdOrName(zoneNameOrId);
  const query = new URLSearchParams({
    name: zoneNameForInput(zone, name),
    per_page: "100",
  });
  if (type) query.set("type", type.toUpperCase());
  const records = (await request<DNSRecord[]>("GET", `/zones/${zone.id}/dns_records?${query}`)).result;
  return records[0] ?? null;
}

export async function createRecord(
  zoneNameOrId: string,
  record: CreateDNSRecord,
): Promise<DNSRecord> {
  const zone = await getZoneByIdOrName(zoneNameOrId);
  const payload = recordPayload(zone, {
    ...record,
    ttl: record.ttl ?? 1,
  });
  return (await request<DNSRecord>("POST", `/zones/${zone.id}/dns_records`, payload)).result;
}

export async function updateRecord(
  zoneNameOrId: string,
  recordId: string,
  record: UpdateDNSRecord,
): Promise<DNSRecord> {
  const zone = await getZoneByIdOrName(zoneNameOrId);
  const payload = recordPayload(zone, record);
  return (await request<DNSRecord>("PATCH", `/zones/${zone.id}/dns_records/${recordId}`, payload)).result;
}

export async function deleteRecord(
  zoneNameOrId: string,
  recordId: string,
): Promise<{ id: string }> {
  const zoneId = await getZoneId(zoneNameOrId);
  return (await request<{ id: string }>("DELETE", `/zones/${zoneId}/dns_records/${recordId}`)).result;
}

// Upsert: create or update the first matching record.
export async function setRecord(
  zoneNameOrId: string,
  record: CreateDNSRecord,
): Promise<DNSRecord> {
  const zone = await getZoneByIdOrName(zoneNameOrId);
  const normalized = {
    ...record,
    type: record.type.toUpperCase(),
    name: zoneNameForInput(zone, record.name),
  };
  const existing = await getRecord(zone.id, normalized.name, normalized.type);
  if (existing) return updateRecord(zone.id, existing.id, normalized);
  return createRecord(zone.id, normalized);
}
