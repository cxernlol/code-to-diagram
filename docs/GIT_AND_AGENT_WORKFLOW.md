# Git & Agent Workflow Guide

Keep diagrams versioned alongside your code using canonical source files (`<basename>.mmd`, `.dot`, `.puml`, `.d2`, `.sql`, `.ts`, `.xml`) paired with layout-only sidecars (`<basename>.ctd.json`).

## 1. Recommended File Layout

```text
docs/diagrams/
  architecture.mmd
  architecture.ctd.json
```

1. **Write or generate source:** Edit `architecture.mmd` in your editor, Studio, or via `ctd-mcp`.
2. **Hand-tune in Studio:** Open `architecture.mmd` in CTD Studio, drag nodes or 3-point connector handles, and click **Studio menu → Export layout (.ctd.json)** to save `architecture.ctd.json`.
3. **Commit both files:** Commit `architecture.mmd` and `architecture.ctd.json` together in git.
4. **Update safely:** When `architecture.mmd` changes later, use `ctd-mcp` (`regen_preserve_layout`, `list_orphan_layout`, `diff_ir`, `verify_diagram`, `check_drift`) or re-import `architecture.ctd.json` in Studio so surviving node/edge positions are preserved.

## 2. Persistence Precedence in Studio

When loading or editing diagrams in CTD Studio:

1. **Share link (`#d=...&l=...`):** Opening a share URL decodes the hash source and layout into a tab.
2. **IndexedDB (`sgs-studio`):** Otherwise, Studio restores your saved tabs, source, and layouts from local browser IndexedDB.
3. **File import (`.mmd` + `.ctd.json`):** Importing a diagram source file opens a new tab; importing a `.ctd.json` sidecar applies its layout to the active tab (persisted to IndexedDB).
4. **Live room (`#room=...`):** Connected guests receive host source/layout updates over WebRTC (sanitized via `parseLayoutRecord`).

## 3. Headless CI Diagram Previews

Render `*.mmd` + `*.ctd.json` pairs in CI without bundling Chromium inside `ctd-mcp`:

```bash
npm run build
node scripts/render-diagram.mjs --input tests/fixtures/git-flow/flow.mmd --out flow.svg --png flow.png
```

See [`.github/workflows/diagram-preview.yml`](../.github/workflows/diagram-preview.yml) for a pull-request workflow triggered on changed `**/*.mmd` and `**/*.ctd.json` files.

## 4. Copy-Pasteable Agent Rules (Cursor / Claude / Antigravity)

```markdown
### Diagram Rules (`ctd-mcp` + `*.ctd.json`)
- Keep diagram source (`*.mmd`) as the canonical structure; never hand-edit coordinates inside `*.ctd.json` unless fixing known node/edge IDs.
- Before modifying an existing diagram, run `parse_diagram_ir` and `list_orphan_layout` (if a `.ctd.json` sidecar exists).
- After editing diagram source, run `regen_preserve_layout` to keep surviving node and edge anchor positions (`${edgeId}::start`, `${edgeId}::end`), and `verify_diagram` to confirm valid syntax and zero unexpected orphans.
- Never embed API keys or secrets in `*.mmd` or `*.ctd.json`.
```
