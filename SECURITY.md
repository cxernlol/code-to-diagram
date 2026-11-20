# Security Policy

## Supported versions

Security fixes apply to:

- Latest **CTD Studio** on `main` — [ctdstudio.dev](https://ctdstudio.dev/) / [vercel mirror](https://code-to-diagram.vercel.app/)
- Latest **`ctd-mcp`** on [npm](https://www.npmjs.com/package/ctd-mcp)

Older deployments and package versions are unsupported.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security bugs.

Report privately via [GitHub Security Advisories](https://github.com/cxernlol/code-to-diagram/security/advisories/new).

Include reproduction steps, the affected input (URL hash, file, MCP payload, etc.), and impact.

**Response:** Best effort (solo maintainer), usually within **7 days**.

## Threat model & privacy

User-facing boundaries, storage, share links, live rooms, BYOK, parser limits, and MCP behavior:

**[docs/SECURITY.md](docs/SECURITY.md)**

Contributors: use the **Security** section in [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) when opening a PR.