# cloudflare-cli

Cloudflare DNS CLI and API client

## Install

## Use

## License

MIT.
# cloudflare-cli

A small TypeScript CLI and importable client for inspecting and changing Cloudflare zones and DNS records.

## Install

Requires Bun. Clone this repository, run `bun install`, then run `bun run check`.

## Use

The executable is `./bin/cloudflare-cli`. The default invocation is:

```bash
system-vault run cloudflare -- ./bin/cloudflare-cli help
```

Commands: `zones`, `zone <name-or-id>`, `records <zone> [--type TYPE]`, `get <zone> <name> [type]`, `set <zone> <type> <name> <content> [--proxied|--dns-only] --confirm`, `delete <zone> <record-id> --confirm`.

## Environment

Credentials are read only from environment variables. Inject them with your organization's secret broker; never commit a `.env` file or put secret values in arguments.

`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GLOBAL_API_KEY`, `CLOUDFLARE_EMAIL`.

## License

MIT. See [LICENSE](LICENSE).
