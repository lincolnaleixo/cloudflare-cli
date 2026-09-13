#!/usr/bin/env bun
import * as cloudflare from "./client.ts";
import type { DNSRecord, Zone } from "./types.ts";

type FlagValue = string | boolean;

interface ParsedArgs {
  positional: string[];
  flags: Record<string, FlagValue>;
}

const BOOLEAN_FLAGS = new Set(["confirm", "dns-only", "json", "proxied"]);
const COMMANDS = new Set(["zones", "zone", "records", "get", "set", "delete", "help"]);
const ALLOWED_FLAGS: Record<string, ReadonlySet<string>> = {
  zones: new Set(["json"]),
  zone: new Set(["json"]),
  records: new Set(["json", "type"]),
  get: new Set(["json"]),
  set: new Set(["confirm", "dns-only", "json", "proxied"]),
  delete: new Set(["confirm", "json"]),
  help: new Set(),
};

export class CliError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
  }
}

export function parseArgs(input: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, FlagValue> = {};
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index]!;
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const key = item.slice(2);
    if (!key) throw new CliError("empty flag");
    if (key in flags) throw new CliError("duplicate flag: --" + key);
    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }
    const value = input[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CliError("--" + key + " requires a value");
    }
    flags[key] = value;
    index += 1;
  }
  return { positional, flags };
}

export function assertAllowedFlags(command: string, flags: Record<string, FlagValue>): void {
  const allowed = ALLOWED_FLAGS[command];
  if (!allowed) throw new CliError(`unknown command: ${command}\n\n${usage()}`);
  for (const key of Object.keys(flags)) {
    if (!allowed.has(key)) throw new CliError(`unknown flag for ${command}: --${key}`);
  }
}

function flagString(flags: Record<string, FlagValue>, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(flags: Record<string, FlagValue>, name: string): boolean {
  return flags[name] === true;
}

function required(positionals: string[], index: number, label: string): string {
  const value = positionals[index];
  if (!value) throw new CliError(`missing ${label}`);
  return value;
}

function assertArity(positionals: string[], count: number, syntax: string): void {
  if (positionals.length !== count) throw new CliError(`usage: ${syntax}`);
}

function requireConfirmation(flags: Record<string, FlagValue>, action: string): void {
  if (!hasFlag(flags, "confirm")) {
    throw new CliError(
      `${action} changes real Cloudflare DNS state; obtain explicit approval for the exact target, then add --confirm`,
    );
  }
}

export function usage(): string {
  return `Cloudflare DNS management (domain purchases are not supported here)

Usage: /home/robot/.local/bin/system-vault run cloudflare -- bun <skill-directory>/scripts/cli.ts <command> [args]

Commands:
  zones                              List all zones/domains
  zone <name-or-id>                  Show one zone (works with restricted tokens)
  records <zone> [--type TYPE]       List DNS records for a zone
  get <zone> <name> [type]            Get a specific DNS record
  set <zone> <type> <name> <content>  Create or update a DNS record
  delete <zone> <record-id>          Delete a DNS record
  help                               Show this help

Mutating commands require --confirm in addition to Lincoln's explicit approval.
Use --proxied or --dns-only with set; omit both to use Cloudflare's default.`;
}

function printZones(zones: Zone[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(zones, null, 2));
    return;
  }
  if (zones.length === 0) {
    console.log("No zones found");
    return;
  }

  console.log("\nDomain                          | Status   | Type   | Name servers");
  console.log("--------------------------------|----------|--------|-----------------------------");
  for (const zone of [...zones].sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      `${zone.name.padEnd(32)} | ${zone.status.padEnd(8)} | ${zone.type.padEnd(6)} | ${zone.name_servers.slice(0, 2).join(", ")}`,
    );
  }
  console.log(`\nTotal: ${zones.length} zone${zones.length === 1 ? "" : "s"}`);
}

function printRecords(records: DNSRecord[], zone: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }
  if (records.length === 0) {
    console.log(`No DNS records found for ${zone}`);
    return;
  }

  console.log(`\nDNS records for ${zone}\n`);
  console.log("Type   | Name                             | Content                          | TTL    | Proxied");
  console.log("-------|----------------------------------|----------------------------------|--------|--------");
  for (const record of [...records].sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type))) {
    const name = record.name.replace(new RegExp(`\\.${escapeRegExp(zone)}$`, "i"), "");
    const ttl = record.ttl === 1 ? "auto" : String(record.ttl);
    console.log(
      `${record.type.padEnd(6)} | ${name.padEnd(32).slice(0, 32)} | ${record.content.padEnd(32).slice(0, 32)} | ${ttl.padEnd(6)} | ${record.proxied ? "Yes" : "No"}`,
    );
  }
  console.log(`\nTotal: ${records.length} record${records.length === 1 ? "" : "s"}`);
}

function printZone(zone: Zone, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(zone, null, 2));
    return;
  }
  console.log(`
Zone: ${zone.name}
─────────────────────────────────────
  ID:          ${zone.id}
  Status:      ${zone.status}
  Type:        ${zone.type}
  Paused:      ${zone.paused ? "Yes" : "No"}
  Name servers: ${zone.name_servers.join(", ")}
  Created:     ${zone.created_on}
  Modified:    ${zone.modified_on}
`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printRecord(record: DNSRecord | null, name: string, type: string | undefined, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  if (!record) {
    console.log(`Record not found: ${name}${type ? ` (${type})` : ""}`);
    return;
  }
  console.log(`
Record: ${record.name}
─────────────────────────────────────
  ID:       ${record.id}
  Type:     ${record.type}
  Content:  ${record.content}
  TTL:      ${record.ttl === 1 ? "auto" : record.ttl}
  Proxied:  ${record.proxied ? "Yes" : "No"}
  Created:  ${record.created_on}
  Modified: ${record.modified_on}
`);
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
    const [rawCommand, ...args] = parsed.positional;
    const command = rawCommand?.toLowerCase() || "help";
    assertAllowedFlags(command, parsed.flags);
    if (command === "help") {
      assertArity(args, 0, "help");
      console.log(usage());
      return;
    }
    if (!COMMANDS.has(command)) throw new CliError(`unknown command: ${command}\n\n${usage()}`);

    const json = hasFlag(parsed.flags, "json");
    switch (command) {
      case "zones": {
        assertArity(args, 0, "zones");
        printZones(await cloudflare.listZones(), json);
        return;
      }
      case "zone": {
        assertArity(args, 1, "zone <name-or-id>");
        printZone(await cloudflare.getZone(required(args, 0, "name-or-id")), json);
        return;
      }
      case "records": {
        assertArity(args, 1, "records <zone> [--type TYPE]");
        printRecords(await cloudflare.listRecords(required(args, 0, "zone"), flagString(parsed.flags, "type")), required(args, 0, "zone"), json);
        return;
      }
      case "get": {
        if (args.length < 2 || args.length > 3) throw new CliError("usage: get <zone> <name> [type]");
        const zone = required(args, 0, "zone");
        const name = required(args, 1, "name");
        const type = args[2]?.toUpperCase();
        printRecord(await cloudflare.getRecord(zone, name, type), name, type, json);
        return;
      }
      case "set": {
        assertArity(args, 4, "set <zone> <type> <name> <content> [--proxied|--dns-only] --confirm");
        if (hasFlag(parsed.flags, "proxied") && hasFlag(parsed.flags, "dns-only")) {
          throw new CliError("choose only one of --proxied or --dns-only");
        }
        const zone = required(args, 0, "zone");
        const type = required(args, 1, "type").toUpperCase();
        const name = required(args, 2, "name");
        const content = required(args, 3, "content");
        requireConfirmation(parsed.flags, `set ${zone} ${type} ${name}`);
        const proxied = hasFlag(parsed.flags, "proxied")
          ? true
          : hasFlag(parsed.flags, "dns-only")
            ? false
            : undefined;
        const record = await cloudflare.setRecord(zone, {
          type,
          name,
          content,
          ...(proxied === undefined ? {} : { proxied }),
        });
        if (json) console.log(JSON.stringify(record, null, 2));
        else printRecord(record, name, type, false);
        return;
      }
      case "delete": {
        assertArity(args, 2, "delete <zone> <record-id> --confirm");
        const zone = required(args, 0, "zone");
        const recordId = required(args, 1, "record-id");
        requireConfirmation(parsed.flags, `delete ${zone} ${recordId}`);
        const result = await cloudflare.deleteRecord(zone, recordId);
        if (json) console.log(JSON.stringify(result, null, 2));
        else console.log(`Deleted DNS record ${result.id}`);
        return;
      }
      default:
        throw new CliError(`unknown command: ${command}\n\n${usage()}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  }
}

if (import.meta.main) void main();
