# cloudflare-cli

Cloudflare DNS CLI and API client

## Install

## Use

## License

MIT.
# cloudflare-cli

A small Bun/TypeScript CLI and importable client for inspecting and changing Cloudflare zones and DNS records.

## Install

Install [Bun](https://bun.sh), clone this repository, and install dependencies:

```bash
bun install
```

The standalone executable is `./bin/cloudflare-cli`; it resolves its own location, so it can be invoked from any directory. For a global command, link or copy that executable into a directory on your `PATH`.

## Authentication and environment variables

Credentials are read only from environment variables. Inject them with your organization's secret manager (for example, `secrets run <profile> -- ./bin/cloudflare-cli zones`) or export them in the process environment. Never commit a `.env` file or put secret values in command arguments.

- `CLOUDFLARE_API_TOKEN`: scoped API token. This is the preferred authentication method.
- `CLOUDFLARE_GLOBAL_API_KEY`: optional user-level Global API Key, used instead of the API token when broader DNS permissions are required.
- `CLOUDFLARE_EMAIL`: email for the Global API Key; it must be provided together with `CLOUDFLARE_GLOBAL_API_KEY`.
- `CLOUDFLARE_ACCOUNT_ID`: optional account identifier retained for account-scoped API use; the current zone/DNS commands do not require it.

## Commands

Run `./bin/cloudflare-cli help` for the short built-in summary. All read commands are non-mutating; `set` and `delete` require `--confirm` as an additional safety boundary.

### `zones [--json]`

List all zones. `--json` prints the API result as formatted JSON.

### `zone <name-or-id> [--json]`

Show one zone by domain name or 32-character zone ID. `--json` prints formatted JSON.

### `records <zone> [--type TYPE] [--json]`

List DNS records for a zone, optionally filtering by record type such as `A`, `AAAA`, `CNAME`, or `TXT`. `--json` prints formatted JSON.

### `get <zone> <name> [type] [--json]`

Get the first matching record by zone, record name, and optional type. Names may be relative (`www`) or fully qualified; `@` refers to the zone apex. `--json` prints formatted JSON.

### `set <zone> <type> <name> <content> [--proxied | --dns-only] [--json] --confirm`

Create a record or update the first existing record with the same name and type. `--proxied` sets Cloudflare proxying on, while `--dns-only` sets it off; omit both to leave Cloudflare's default behavior. The two flags are mutually exclusive. `--confirm` is required.

### `delete <zone> <record-id> [--json] --confirm`

Delete a DNS record by zone and record ID. `--confirm` is required. `--json` prints the deleted record ID as formatted JSON.

### `help`

Print the command summary. Running the CLI without a command is equivalent to `help`.

## Check

Run the full local verification suite:

```bash
bun run check
```

This runs TypeScript typechecking followed by the Bun tests.

## License

MIT. See [LICENSE](LICENSE).
