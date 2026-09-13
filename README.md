# cloudflare-cli

`cloudflare-cli` is a small Bun/TypeScript command-line tool for inspecting
Cloudflare zones and managing their DNS records. It also exposes the API client
modules in `src/` for projects that import the source directly.

## Installation

Install [Bun](https://bun.sh), clone or download this project, and install its
development dependencies:

```bash
bun install
```

The standalone launcher is `bin/cloudflare-cli`. It finds the project root from
its own location, so it can be run from any working directory. To make it
available globally, place it in a directory on `PATH` or create a symlink there.

## Authentication and environment variables

The CLI reads credentials from environment variables. Supply them through your
organization's secret manager or the process environment; do not put secrets in
arguments, committed files, or logs.

- `CLOUDFLARE_API_TOKEN` — preferred scoped API token.
- `CLOUDFLARE_GLOBAL_API_KEY` — optional user-level Global API Key. When set,
  it is used instead of the API token.
- `CLOUDFLARE_EMAIL` — email address paired with
  `CLOUDFLARE_GLOBAL_API_KEY`; both variables must be set together.
- `CLOUDFLARE_ACCOUNT_ID` — optional account identifier reserved for
  account-scoped API operations. The current zone and DNS commands do not
  require it.

At least one authentication method is required: an API token, or a Global API
Key together with its email address.

## Usage

```text
cloudflare-cli <command> [arguments] [options]
```

Run `./bin/cloudflare-cli help` for a short summary. Read commands do not modify
Cloudflare. The `set` and `delete` commands require `--confirm` in addition to
the operator's explicit approval of the exact change.

### `zones [--json]`

Lists all zones. `--json` prints formatted JSON.

### `zone <name-or-id> [--json]`

Shows one zone selected by domain name or 32-character zone ID. `--json` prints
formatted JSON.

### `records <zone> [--type TYPE] [--json]`

Lists DNS records for a zone. `--type` filters by record type, such as `A`,
`AAAA`, `CNAME`, or `TXT`. `--json` prints formatted JSON.

### `get <zone> <name> [type] [--json]`

Returns the first matching record for a zone, name, and optional type. A name
may be relative (`www`) or fully qualified; `@` means the zone apex.
`--json` prints formatted JSON.

### `set <zone> <type> <name> <content> [--proxied | --dns-only] [--json] --confirm`

Creates a record, or updates the first existing record with the same name and
type. `--proxied` enables Cloudflare proxying; `--dns-only` disables it. These
options are mutually exclusive. If neither is supplied, the API default is
used. `--confirm` is required.

### `delete <zone> <record-id> [--json] --confirm`

Deletes a DNS record by zone and record ID. `--confirm` is required, and
`--json` prints the deleted record ID as formatted JSON.

### `help`

Prints the command summary. Running the CLI without a command also prints help.

## Check

Run typechecking and the test suite with:

```bash
bun run check
```

## License

MIT. See [LICENSE](LICENSE).
