## Summary

**A — What changed**  
<!-- Files/area and the behavior difference (1–2 sentences). -->

**B — Why**  
<!-- Bug fix, UX, docs, MCP, CI — link issue # if any. -->

**C — How to check**  
<!-- e.g. open /#app, run npm test, or “docs-only — preview README”. -->

**D — Security**  
<!-- “No security impact” or what trust boundary moved (share links, sidecars, MCP, room sync, AI/BYOK, new fetch). See [docs/SECURITY.md](../docs/SECURITY.md). -->

## Scope

- [ ] **One concern per PR** — web, `mcp/`, parsers, docs, or CI only (see [CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] **Right surface touched** — docs/CI PRs don’t edit `src/` / `public/` / `mcp/` unless that’s the goal; MCP-only PRs don’t edit the web shell unless that’s the goal

## Rules (must stay true)

- [ ] **Local-first** — No analytics, tracking cookies, or server-side diagram/key storage
- [ ] **Stable contracts** — No renames of `sgs-studio`, `mstudio2` migration, or `[data-sgs-node]` / `[data-sgs-edge]` without a migration plan
- [ ] **MCP dist** — If `mcp/src/` or shared `src/lib/*` / `constants.ts` changed: `npm run mcp:build` and `mcp/dist/index.js` included (`100755`, LF)

## Security

- [ ] **Secrets & sharing** — No API keys, tokens, or credentials in `#d=` / `#room=`, sidecars (`.ctd.json`), commits, or client logs ([BYOK stays IndexedDB-only](../docs/SECURITY.md#byok-ai--custom-urls))
- [ ] **Untrusted input** — Share imports, Mermaid/SVG, sidecar/room layout, and MCP inputs stay sanitized (or this PR tightens parsing/render paths — see [Contributing & security reviews](../docs/SECURITY.md#contributing--security-reviews))
- [ ] **Network & privacy** — No new analytics, tracking cookies, or server-side diagram/key storage; new outbound URLs (AI, custom endpoints, signaling) called out in **D — Security**

## Verification

- [ ] Ran the **scoped** or **full** command block from [CONTRIBUTING.md](../CONTRIBUTING.md#verify-before-you-push) (or docs-only: links checked, no build)
- [ ] Expect **CI** to match on this branch ([`ci.yml`](workflows/ci.yml): build, parsers, sidecar, mcp, render, Playwright)