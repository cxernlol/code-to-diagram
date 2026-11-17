# Contributing to CTD Studio (`code-to-diagram`)

Thank you for contributing. To keep the web editor, parsers, and `ctd-mcp` stable, all contributions must follow these rules.

## Pull Request Policy

- **No direct pushes to `main`.** Open a branch (`feat/...`, `fix/...`, `docs/...`, `ci/...`) and submit a Pull Request against `main`.
- **One concern per PR.** Keep changes small and focused. Do not mix unrelated UI, parser, MCP, or workflow edits in the same PR.
- **Do not touch the web app** (`src/App.tsx`, `src/HomePage.tsx`, `src/DocsPage.tsx`, `src/styles.css`, `index.html`, `public/`, `vercel.json`) in PRs scoped to docs, CI, or `mcp/`-only changes.
- **Do not touch `mcp/`** or CI/release workflows unless your PR specifically targets them and includes the matching tests.

## Non-Negotiable Architecture Rules

- **Local-first & zero tracking:** Never add analytics, tracking cookies, or server-side diagram/key storage.
- **API key isolation:** BYOK AI credentials must stay in browser IndexedDB and must **never** be serialized into share URLs (`createShareHash`) or logged.
- **Preserve user data & selectors:** Do not rename `DATABASE_NAME` (`sgs-studio`), `CHANNEL_NAME` (`sgs-studio-updates`), the `mstudio2` migration path, or `[data-sgs-node]` / `[data-sgs-edge]` DOM attributes without an explicit migration plan.
- **Keep `mcp/dist/index.js` synced and executable:** If you edit `mcp/src/`, `src/constants.ts`, `src/lib/formats.ts`, `src/lib/mermaid.ts`, or `src/lib/translate.ts`, run `npm run mcp:build` so `mcp/dist/index.js` stays updated with `100755` permissions and LF line endings (`.gitattributes`).
- **No weakened checks:** Do not disable TypeScript strictness, skip Playwright/MCP assertions, or silence lint/type errors with `any` or `@ts-ignore`.

## Required Checks Before Opening a PR

Run these from the repository root (`code-to-diagram/`):

```bash
# Always required (typecheck + web build + MCP build)
npm run build

# Required when changing mcp/ or shared src/lib/ parsers
npm run mcp:test

# Required when changing web app files (src/, index.html, public/)
npx playwright test --workers=1
```

## Opening a PR

1. Use clear commit prefixes: `feat:`, `fix:`, `docs:`, `ci:`, `chore:`.
2. Fill out the PR checklist confirming which checks ran locally.
3. Wait for GitHub Actions **CI** (`.github/workflows/ci.yml`) to pass before merging.
