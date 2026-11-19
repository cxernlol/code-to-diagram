# First time: code → diagram

CTD Studio turns **text** (Mermaid and six other formats) into an **interactive diagram**. You edit the code on the left; the canvas updates on the right. No account is required.

This guide is **Studio-only**. You do not need `ctd-mcp`, git, or a sidecar file to finish your first diagram.

## Casual path (<30 seconds)

**Home → Start drawing → drag → Download PNG.** Studio opens in Simple mode (extra developer tools hidden behind **Studio menu → More tools**). Reading `/docs` is optional—everything you need is on the canvas.

## 5-minute path

1. **Open the app** — [CTD Studio workbench](https://code-to-diagram.vercel.app/app) or run `npm run dev` locally and go to `/app`.
2. **Start from a template** — Click **Start**, pick **Flowchart** (or open **Docs → First time: code → diagram** and use **Try in editor** on a lesson).
3. **Edit one line** — Change a node label in the code (e.g. `Process` → `Validate input`). The diagram re-renders after you pause typing.
4. **Drag a box** — On flowcharts, class, ER, state, C4, and requirement diagrams, press **V** (Move), then drag a node. Sequence and gantt diagrams **render only** (no dragging)—see the compatibility matrix in the app docs.
5. **Export** — Click **Download PNG** for slides or assignments, or open **More export…** for SVG and layout sidecar (`.ctd.json`). Copy the `.mmd` source from the editor if your instructor wants the text file.

## Try these coursework starters

| Template | What you practice |
|----------|-------------------|
| **Loop Trace** | `while` / loop logic as a flowchart |
| **Intro OOP** | inheritance with a class diagram |
| **Student ER Lab** | tables and relationships (ER) |
| **Vending Machine** | states and transitions |
| **SQL Schema** | paste DDL → ER diagram |

Open any of these from **Docs → Starter Templates** or the in-app new-diagram template list.

## When code fails

- Check **arrow syntax**: `A --> B` (flowchart), not `A -> B` in flowcharts.
- **Decisions** use braces: `Valid{Is x > 0?}`.
- Non-Mermaid formats (SQL, TypeScript, DOT, etc.) only support **documented subsets**—see **Docs → Supported Formats**.

## Next steps (optional)

- **Save layout separately** — After dragging, open **More export…** to export **layout (.ctd.json)** next to your `.mmd` so positions survive edits. See **Workbench & Keys** in the app docs.
- **Team / git workflow** — [GIT_AND_AGENT_WORKFLOW.md](./GIT_AND_AGENT_WORKFLOW.md).
- **Agents** — `npx -y ctd-mcp` when you use Cursor or Claude with MCP.

## In the repo

| What | Where |
|------|--------|
| Interactive tutorial | App → **Docs** → *First time: code → diagram* (`/docs` when deployed) |
| Git + agents (contributors) | [`GIT_AND_AGENT_WORKFLOW.md`](./GIT_AND_AGENT_WORKFLOW.md) |
| Syntax reference | Same **Docs** page — Syntax, Formats, Templates |