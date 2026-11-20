# Contributing to CTD Studio

**Local-first, no tracking, small PRs.** Fork → branch → run checks → open PR to `main`.

## Quick start

```bash
git clone https://github.com/cxernlol/code-to-diagram.git
cd code-to-diagram
npm install   # Node ≥22
npm run dev
```

## Pull requests

| Rule | |
| :--- | :--- |
| **Branch** | `feat/`, `fix/`, `docs/`, `ci/` — **no direct push to `main`** |
| **Scope** | **One concern per PR** — don’t mix UI, parsers, MCP, and CI in one diff |
| **Docs/CI only** | Don’t touch `src/`, `public/`, or `mcp/` unless the PR is for those |
| **MCP/CI only** | Don’t touch the web app unless the PR is for those |
| **Commits** | `feat:`, `fix:`, `docs:`, `ci:`, `chore:` |
| **Merge** | Green [CI](.github/workflows/ci.yml) on GitHub |

## Architecture (non‑negotiable)

- **Local-first** — No analytics, tracking cookies, or server-side storage of diagrams or API keys.
- **BYOK** — Keys stay in IndexedDB only; **never** in `#d=` share URLs or logs.
- **Stable IDs** — Don’t rename `sgs-studio`, `mstudio2` migration, or `[data-sgs-node]` / `[data-sgs-edge]` without a migration plan.
- **MCP bundle** — After `mcp/src/` or shared parser changes: `npm run mcp:build` (keep `mcp/dist/index.js` in sync, executable).
- **No weakened gates** — No `@ts-ignore`, skipped tests, or relaxed strictness to land a PR.

## Verify before you push

**Scoped** (parser / sidecar / `mcp/` only):

```bash
npm run build
npm run test:parsers && npm run test:sidecar && npm run mcp:test
```

**Full** (anything under `src/`, `index.html`, `public/`, or UI):

```bash
npm run build
npm run test:parsers && npm run test:sidecar && npm run test:render && npm run mcp:test
npm test   # Playwright, 49 tests — use --workers=1 locally
```

Docs-only: check links and spelling; no build unless you changed code.

## PR checklist

GitHub pre-fills **[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)** — use those boxes when you open a PR (scope, rules, security, verification tier).

**Security:** Trust boundaries and contributor checks — [`docs/SECURITY.md`](docs/SECURITY.md). Vulnerability reports (not public issues) — [`SECURITY.md`](SECURITY.md).

Questions: [GitHub issues](https://github.com/cxernlol/code-to-diagram/issues) or the PR thread.