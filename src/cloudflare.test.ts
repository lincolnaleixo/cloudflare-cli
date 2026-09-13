import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { assertAllowedFlags, CliError, parseArgs, usage } from "./cli.ts";

describe("Cloudflare CLI safety boundary", () => {
  test("parses boolean and valued flags without silently overwriting duplicates", () => {
    expect(parseArgs(["set", "example.com", "A", "www", "192.0.2.1", "--confirm", "--proxied"])).toEqual({
      positional: ["set", "example.com", "A", "www", "192.0.2.1"],
      flags: { confirm: true, proxied: true },
    });
    expect(() => parseArgs(["zones", "--json", "--json"])).toThrow("duplicate flag");
    expect(() => parseArgs(["zones", "--type"])).toThrow("requires a value");
  });

  test("rejects flags that are not part of the command contract", () => {
    expect(() => assertAllowedFlags("set", { confirm: true, registrar: true })).toThrow(
      "unknown flag for set: --registrar",
    );
    expect(() => assertAllowedFlags("purchase", {})).toThrow("unknown command");
    expect(usage()).not.toContain("registrar");
    expect(usage()).not.toContain("/private/path");
  });

  test("requires explicit CLI confirmation before a set reaches the client", () => {
    const result = Bun.spawnSync([
      "bun",
      join(import.meta.dir, "cli.ts"),
      "set",
      "example.com",
      "A",
      "www",
      "192.0.2.1",
    ], { stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("changes real Cloudflare DNS state");
    expect(result.stderr.toString()).toContain("--confirm");
  });

  test("requires explicit CLI confirmation before a delete reaches the client", () => {
    const result = Bun.spawnSync([
      "bun",
      join(import.meta.dir, "cli.ts"),
      "delete",
      "example.com",
      "record-id",
    ], { stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("changes real Cloudflare DNS state");
    expect(result.stderr.toString()).toContain("--confirm");
  });

  test("keeps the CLI module importable for parser tests", () => {
    expect(new CliError("test")).toBeInstanceOf(Error);
  });
});
