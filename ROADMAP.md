# CTD Studio Roadmap

> **Core loop:** Write or paste code → render diagram → hand-tune layout without breaking the source → export or commit.

---

## Where to read (paths)

| Topic | File |
|-------|------|
| **Watch, claims, agent log summaries** | [`AGENT_SYNC.md`](./AGENT_SYNC.md) |
| **First-time code → diagram (users / coursework)** | [`docs/FIRST_TIME_CODE_TO_DIAGRAM.md`](./docs/FIRST_TIME_CODE_TO_DIAGRAM.md) |
| **Git + `*.ctd.json` + agent rules** | [`docs/GIT_AND_AGENT_WORKFLOW.md`](./docs/GIT_AND_AGENT_WORKFLOW.md) |
| **Security & rooms** | [`docs/SECURITY.md`](./docs/SECURITY.md) |
| **Actionable work (FIFO)** | § **Improvement queue** below |

**Hygiene:** Done queue rows → delete + renumber `1…n`. New rows → append last only. Agent chatter → summaries in `AGENT_SYNC.md`, not long prose here.

**Cursor ↔ Antigravity:** Spec and queue in **this file**; status/logs in **`AGENT_SYNC.md`**.

---

## North Star & Non-Goals

- **Primary user:** Developers and technical writers keeping diagrams in git (`.mmd`, `.sql`, `.ts`, `.dot`, `.puml`, `.d2`, `.xml`) and using **`ctd-mcp`** with agents.
- **Differentiator:** Source = structure; **layout layer** (IDs + edge anchors) survives edits via `*.ctd.json`.
- **Non-goals (now):** Stencil libraries / whiteboard modes; mandatory cloud SSO; Chromium inside `npx ctd-mcp`.

---

## Phase 1 — Portable Project Spine (`v1.3.0`)

*Status: **implemented locally** (Waves B–E); follow-on UX in FIFO **F1–F10**.*

1. **Sidecar v1** — `schema/ctd-sidecar.v1.json`, `src/lib/sidecar.ts`, Studio import/export `.ctd.json`.
2. **Golden fixtures** — e.g. `tests/fixtures/git-flow/`, Playwright round-trip.
3. **Headless CI preview** — `scripts/render-diagram.mjs`, `diagram-preview.yml`.

---

## Phase 2 — Agent-Safe MCP (`ctd-mcp`)

*Status: **Phase 2 tools shipped locally** (`regen_preserve_layout`, `list_orphan_layout`, `diff_ir`, `verify_diagram`, `patch_source`, `check_drift`, `capabilities` / `irVersion`).*

*Still aspirational:* `verify_against_files`, `preview_patch`, `load_project` / `render`.

---

## Phase 3 — Format Honesty, Trust & Docs

*Status: **matrix + workbench copy in `/docs`**, `GIT_AND_AGENT_WORKFLOW.md`, `SECURITY.md`; tutorial + coursework → **FIRST_TIME doc** + in-app `/docs` (local).*

---

## Reference — system map

```text
Browser Studio
  ├─ 7 translators → Mermaid v12.3.0
  ├─ Layout ↔ sidecar / #d= share / IndexedDB
  └─ Export SVG/PNG, optional BYOK, live rooms

Agents & CI
  ├─ ctd-mcp: convert + IR + layout/drift/verify tools (shared src/lib)
  └─ CI: build, parsers, sidecar, mcp, Playwright; diagram preview workflow
```

---

## Agent comments

Inline `<!-- AGY (…) -->` on phases below in git history = spec until superseded.

**Standing rules:** Single layout engine (`sidecar.ts` + `layoutKeys.ts`); `npm run mcp:build` after shared `src/lib` changes; one concern per PR.

### Agent history (summary)

*Decisions only — session noise → [`AGENT_SYNC.md`](./AGENT_SYNC.md).*

| When | Agent | Summary |
|------|-------|---------|
| 2026-11-19 | Antigravity | Sidecar naming: `<basename>.ctd.json` beside `<basename>.mmd`. |
| 2026-11-19 | Antigravity | PR A: `parseLayoutRecord` unified (export + room), share-hash encoding fix, `test:sidecar`. |
| 2026-11-19 | Antigravity | Waves **B1–E5**: v1.3.0, Studio sidecar UI, MCP Phase 2, docs/CI/security; tests green local; no push. |
| 2026-11-19 | Cursor | B1–E5 audit: build + unit/MCP ✓; ship locally after full Playwright on machine. |
| 2026-11-19 | Cursor | Queued **F1–F10** (onboarding, docs P0, tooltips); partial F6/F7 in tree. |
| 2026-11-19 | Antigravity | **F1–F10** cleared: lanes, samples, export/coachmarks, badge, errors, docs UX; Playwright 42/42; no push. |

---

## Improvement queue (FIFO — Antigravity)

> **Owner:** Antigravity unless user assigns Cursor.  
> **Done:** Delete row, renumber, one line in `AGENT_SYNC.md` summary.  
> **First-time UX copy:** align with [`docs/FIRST_TIME_CODE_TO_DIAGRAM.md`](./docs/FIRST_TIME_CODE_TO_DIAGRAM.md).

| # | Tag | Task | Acceptance |
|---|-----|------|------------|
| *(empty)* | — | Queue cleared (F7 ack + F1–F10 completed locally). | Append new rows starting at `#1`. |

**Next row # when appending:** 1

---

## Audits (summary)

*One row per audit; details in code/tests, not essays.*

| When | Scope | Verdict |
|------|--------|---------|
| 2026-11-19 | B1–E5 local | Ship locally; Playwright/render on user machine. |
| 2026-11-19 | Live `#docs` vs local | P0 TOC on `#docs` ejects home; schema GitHub 404 until push; production missing tutorial — fixed locally in F7–F9; ready for deploy. |
| 2026-11-19 | F1–F10 vs tree (Cursor check) | Code has lanes, `public/samples/`, coachmarks, badge, pedagogical errors, `/docs` tutorial — aligns with empty queue; **not** independently re-run Playwright 42/42 here. |

**Next:** User authorizes push to refresh [vercel `/docs`](https://code-to-diagram.vercel.app/docs).