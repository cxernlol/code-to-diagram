# Agent sync (Cursor ↔ Antigravity)

**Live status, Watch, and session summaries live here.**  
**Product spec, FIFO queue, phased audits → [`ROADMAP.md`](./ROADMAP.md).**  
**First-time Studio users (no MCP) → [`docs/FIRST_TIME_CODE_TO_DIAGRAM.md`](./docs/FIRST_TIME_CODE_TO_DIAGRAM.md).**

---

## Ownership (no duplication)

| Content | **Only in `AGENT_SYNC.md`** | **Only in `ROADMAP.md`** |
|---------|---------------------------|-------------------------|
| Watch, claimed branch, who needs to reply | ✓ | — |
| Active focus **status** | ✓ | — |
| Queue (**open** cross-agent asks) | ✓ | — |
| **Session log summaries** (timestamp + one line) | ✓ | — |
| North star, Phase 1–3, inline `<!-- AGY -->` | — | ✓ |
| P0/P1 audit tables, acceptance criteria | — | ✓ |
| **Improvement queue (FIFO)** | — | ✓ |
| Locked decisions (compact) | — | ✓ § **Agent history** |

Logs **summarize**; details stay in code, tests, or queue acceptance columns — not copy-pasted between files.

---

## Cursor watch loop

| Step | Action |
|------|--------|
| **1. Watch** | Read **Watch**, **log summaries** below, `ROADMAP.md` § **Improvement queue**. |
| **2. Wait** | No new Antigravity summary row since last audit → don’t re-audit the same diff. |
| **3. Audit** | New log or new local diff → tests + ponytail note in `ROADMAP.md` § **Audits** (one table row). |
| **4. Delegate** | New work → append last FIFO row; done → delete + renumber; one summary line here. |
| **5. No push** | Unless user explicitly asks. |

---

## Git & remote

| Allowed | **Only when user asks** |
|---------|-------------------------|
| Local edits, branches, build, tests | `git push`, PR, `gh pr create`, force push |

**Default:** `C:\Users\User\Desktop\Fine` · branch `feat/ctd-sidecar-agy` · local-first.

---

## Watch

| Field | Value |
|-------|--------|
| **Roadmap** | `ROADMAP.md` — FIFO queue cleared (**F1–F10** done locally); audits § **Audits** |
| **First-time doc** | `docs/FIRST_TIME_CODE_TO_DIAGRAM.md` (+ in-app `/docs` tutorial when deployed) |
| **Claimed work** | *(none)* — FIFO queue empty |
| **Last Antigravity** | `2026-11-19` — F7 ack + F1–F10 on `feat/ctd-sidecar-agy` (see summary below) |
| **Last Cursor** | `2026-11-19` — roadmap bus check; queue empty vs Antigravity F1–F10 claim |
| **Needs response** | Cursor → ponytail **F1–F10** (optional); **user → push/deploy** |

---

## Active focus (status)

| Item | Status |
|------|--------|
| v1.3 spine (sidecar, Studio I/O, fixtures, CI preview) | **Done locally** |
| MCP Phase 2 tools | **Done locally** |
| Phase 3 docs / security guides | **Done locally** |
| Usage wave F1–F10 | **Done locally** |

---

## Queue (open only)

- No **push/PR** until user authorizes.
- FIFO owner: **Antigravity** unless user assigns Cursor.

---

## Delegation

**Task list:** [`ROADMAP.md`](./ROADMAP.md) § **Improvement queue** — row `#1` next.

---

## Cursor — log (summary)

*Append one row per session; keep newest at top.*

| When | Summary |
|------|---------|
| 2026-11-19 | Roadmap check: FIFO empty, Antigravity F1–F10 log vs code spot-check; synced Watch + ROADMAP history. |
| 2026-11-19 | Docs audit (live `#docs` TOC bug); local `/docs` + MCP doc table; **F7–F10** queued → `ROADMAP.md`. |
| 2026-11-19 | Tutorial tab, `FIRST_TIME_CODE_TO_DIAGRAM.md`, templates; **F1–F6** queued. |
| 2026-11-19 | B1–E5 ponytail: build + unit/MCP tests ✓; queue cleared after Waves B–E. |
| 2026-11-19 | FIFO hygiene: done rows deleted; single improvement table. |

**Template:** `| YYYY-MM-DD | One sentence. |`

---

## Antigravity — log (summary)

*Append one row per batch; keep newest at top.*

| When | Summary |
|------|---------|
| 2026-11-19 | **F7 ack + F1–F10** on `feat/ctd-sidecar-agy`: canonical `/docs` TOC/search/200 assets, onboarding lanes, `public/samples/` git-flow, first-drag + submission export, draggable badge, pedagogical errors, coachmarks; build + unit/MCP + Playwright 42/42; no push. |
| 2026-11-19 | **Waves B–E** on `feat/ctd-sidecar-agy`: v1.3.0, Studio `.ctd.json`, MCP Phase 2, docs/CI; Playwright 39/39; no push. |
| 2026-11-19 | PR A follow-up: `test:sidecar` in CI, CONTRIBUTING; Playwright 38/38. |
| 2026-11-19 | **PR A:** `sidecar.ts`, schema, `parseLayoutRecord` unify, `test:sidecar`; App untouched. |

**Template:** `| YYYY-MM-DD | One sentence (branch, scope, tests, push y/n). |`