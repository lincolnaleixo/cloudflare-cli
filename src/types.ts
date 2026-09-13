export interface CloudflareConfig {
  apiToken?: string;
  /** User-level Global API Key (used with `email`); full access incl. zone DNS. */
  globalApiKey?: string;
  /** Cloudflare account email, paired with `globalApiKey`. */
  email?: string;
  /** Account id (for account-scoped endpoints; not required for DNS/zone ops). */
  accountId?: string;
}

export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  name_servers: string[];
  created_on: string;
  modified_on: string;
}

export interface DNSRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
  proxiable: boolean;
  ttl: number;
  priority?: number;
  created_on: string;
  modified_on: string;
}

export interface CreateDNSRecord {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export type UpdateDNSRecord = Partial<CreateDNSRecord>;

export interface CloudflareResponse<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    total_pages: number;
    count: number;
    total_count: number;
  };
}
