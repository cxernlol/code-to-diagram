## Summary
<!-- Describe what this PR changes and why. -->

## Scope & Boundaries
- [ ] **Single-purpose PR:** Changes are strictly scoped to one area (Web App, `ctd-mcp`, Parsers, Docs, or CI).
- [ ] **Web app untouched (if non-web PR):** No edits to `src/App.tsx`, `src/HomePage.tsx`, `src/DocsPage.tsx`, `src/styles.css`, `index.html`, `public/`, or `vercel.json`.
- [ ] **Local-first & privacy preserved:** No analytics/tracking, no server storage, and API keys never enter share URLs (`createShareHash`).
- [ ] **Compatibility preserved:** Did not rename IndexedDB (`sgs-studio`), `mstudio2` migration, or `[data-sgs-node]` / `[data-sgs-edge]` selectors.
- [ ] **MCP bundle synced:** If `mcp/src/`, `src/constants.ts`, or `src/lib/` changed, ran `npm run mcp:build` and committed `mcp/dist/index.js` (`100755`, LF).

## Verification
- [ ] `npm run build` (`typecheck` + web build + `mcp:build`)
- [ ] `npm run mcp:test` (if `mcp/` or `src/lib/` changed)
- [ ] `npx playwright test --workers=1` (if web app changed)

> Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting.
