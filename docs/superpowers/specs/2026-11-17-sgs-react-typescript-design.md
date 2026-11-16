# SGS Studio React + TypeScript design

## Goal

Replace the standalone DOM-driven editor with a fully React and TypeScript
application while preserving its useful workflows and free access. Add a
reliable graph-layout layer so users can move individual supported nodes and
keep their connectors attached. Improve editing, AI safety, and storage as
part of the migration.

## User intent and constraints

- The application itself must be React + TypeScript, not an iframe wrapper.
- Use Framer Motion and Lucide React; use motion sparingly and respect reduced
  motion.
- Keep Mermaid as the source format and first-pass renderer; retain the local
  Mermaid bundle.
- Preserve existing documents and features, including templates, history,
  appearance, AI settings, file operations, zoom/fit, and SVG/PNG export.
- Keep all application features free, without accounts, paid tiers, or
  artificial diagram limits.
- AI is optional and uses the user's configured provider. Explain that prompts
  and diagrams go directly from the browser to that provider when the user
  explicitly starts a request.
- Deliver a readable source tree and build process; do not keep editing
  minified `min.js`.

## Current state

The application is a standalone HTML/CSS/JavaScript page. `dot.html` contains
the interface; `min.js` owns DOM-bound state, Mermaid rendering, tabs, AI,
exports, and movement; `mermaid.min.js` is bundled locally. There is no package
manifest or test runner. `vercel.json` rewrites `/` to `/dot.html`. Existing
documents and settings are stored under the `mstudio2` localStorage key.

AI generation currently streams Mermaid text into the editor and validates a
single result. Explain uses the same Mermaid-only system prompt. Node movement
uses unstable index/text keys, applies a transform to the node without
rerouting edges, and does not persist positions per document. A resize refits
the viewport, asynchronous renders can complete out of order, and browser
storage writes are synchronous.

## Decisions and alternatives

### Application migration

Use a full React + TypeScript port with Vite. An iframe shell would leave the
DOM-bound editor as the real application and was rejected. Replacing Mermaid
with a different diagram engine was also rejected because it would change
source compatibility and discard supported Mermaid diagram types.

Use focused React components and TypeScript modules for document state,
storage, Mermaid rendering, graph layout, viewport gestures, AI, and export.
Avoid a second legacy runtime after parity is verified. Keep `mermaid.min.js`
as a local static asset.

### Node movement and connector routing

There are two viable movement approaches:

1. Recalculate SVG paths around changed node bounds. This is smaller initially,
   but depends on Mermaid's generated DOM and path conventions and does not
   provide a stable home for per-document positions.
2. Let Mermaid produce the initial layout, then extract stable node identities,
   positions, dimensions, and edge metadata into an SGS graph model. SGS owns
   subsequent positions and routes connectors from that model. This is more
   work, but correctly supports repeatable movement, per-document persistence,
   and undo; this is the selected approach.

Mermaid remains responsible for parsing and initial layout. The graph model
owns manual node positions and post-layout connector geometry. Node identity
must come from Mermaid/source IDs, never list position or displayed label.
When source changes, rebuild the model from the new Mermaid render and preserve
manual positions only for IDs that still exist.

### Data and storage

Use schema-versioned IndexedDB for documents, history, per-document layout,
and editor state. On first startup, migrate `mstudio2` transactionally; verify
the imported data before marking migration complete. Leave the legacy
localStorage value intact as a recovery copy. Separate provider credentials
from diagram records. Show save status and explicit quota/storage errors.
Notify other open tabs about document updates so edits are not silently
overwritten.

The first release stores manual layout locally per document. Moving nodes does
not rewrite Mermaid source, `.mmd` exports, or share links. Share-link layout
serialization is deferred.

## Editor and visual experience

- Build a responsive React interface with the existing SGS visual identity,
  themes, palette, and customization controls.
- Use CodeMirror 6 for Mermaid source editing, with line numbers, Mermaid
  syntax highlighting, bracket matching, folding, basic completions/snippets,
  and parse-error line diagnostics.
- Keep tabs, history, templates, AI settings/actions, file import/export,
  preview controls, and current export options.
- Support keyboard tab navigation, keyboard node movement, and Mermaid
  accessibility title/description metadata.
- On narrow screens, use a Code/Preview switch rather than two cramped panes.
- Use Lucide React for icons. Use Framer Motion only for useful interaction
  feedback and honor `prefers-reduced-motion`.
- Preserve Mermaid's strict security mode and use text-safe rendering for user
  labels, tab names, history, and errors.

## Graph editing and viewport

Direct manipulation replaces the previous Move boxes mode. Drag a node to
move it; drag empty canvas to pan. Space+drag and middle mouse also pan. A
focused node can be nudged with arrow keys, with Shift for a larger increment.
One completed drag is one undoable action.

Support individual movement for `flowchart`/`graph`, `classDiagram`,
`stateDiagram`, and `erDiagram`. For unsupported types such as sequence,
Gantt, pie, journey, and mindmap, disable node movement and explain why.
Selection/marquee, multi-select, alignment guides, inline label/style editing,
adding/deleting nodes or edges, and new diagram types are out of scope.

After a node moves, route incident connectors and connectors obstructed by its
new bounds. Prefer short orthogonal paths that avoid node boxes and penalize
crossings. Preserve direction, markers, and edge/branch labels. Line crossings
may remain in very dense graphs, but edges must remain attached and avoid node
boxes. Keep route geometry within the exported SVG bounds. Reset restores
Mermaid's automatic layout.

Use `d3-zoom` for consistent pan, wheel, trackpad, and touch gestures. Provide
a compact sensitivity panel for zoom speed, pan speed, drag speed, scroll
inversion, snap-grid size, and smooth zoom. Default drag speed is 0.5; snapping
is off by default; Shift uses precision drag and Alt bypasses snap. Two-finger
scroll pans by default, while pinch/Ctrl+wheel zooms; users can switch the
scroll behavior. Keep the current pan/zoom when resizing; only an explicit
Fit action or first render resets the viewport.

An application-level undo/redo timeline covers grouped CodeMirror edits and
layout changes. Positions and preferences are stored per document in
IndexedDB. SVG/PNG exports reflect the visible manual layout; `.mmd` remains
the Mermaid source and does not encode those positions.

## AI workflows

### Structured diagrams

Generation is explicit; paste alone never sends data. Accept raw source or
Mermaid source and preserve the original document. A blank prompt uses a
default structured-diagram request. Request a JSON object with an Overview and
at least one named detail diagram. Include the input diagram type and concise
syntax guidance in the prompt.

Stream to an AI result preview, never into the source editor. Validate JSON
and every Mermaid block before allowing application. On acceptance, add all
result tabs atomically and select Overview. On API, JSON, or Mermaid failure,
show the error and leave existing documents and source unchanged. Retry invalid
model output up to three total attempts with validation feedback. Existing
quick actions remain single-diagram edits and use a separate result preview
with Apply/Discard; no before/after diff or per-tab AI chat is included.

### Explain and provider settings

Explain has a prose-specific prompt and displays its response in a side panel;
it never writes prose into the Mermaid editor. Provide a Stop action using
`AbortController`. Strip model reasoning tags such as `<think>` from generated
responses only, not from user source. Do not send a hardcoded temperature;
temperature is omitted unless explicitly configured.

Provide editable presets for OpenAI, DeepSeek, Ollama, OpenRouter, and Groq,
with their compatible endpoint and a suggested model where one is defined.
OpenAI defaults to `gpt-4o`; DeepSeek defaults to `deepseek-chat`. Preserve a
custom model when changing endpoints and leave unknown model values blank.
Provide a Test connection action that sends a small request using the chosen
model; disclose that the provider may bill for it.

Requests go directly from the browser to the configured endpoint. Do not
include a server proxy in this phase. Document that some providers may reject
browser requests due to CORS, and that an explicit AI request sends its prompt,
diagram, and key to that provider. Store credentials separately from diagram
data and never include them in exports, debug information, or logs.

Image/document-to-diagram input, AI chat history, and diff review are deferred.

## Reliability, privacy, and deployment

- Prevent stale asynchronous renders from replacing newer diagrams; skip
  renders when source/configuration have not changed.
- Preserve viewport state on resize and splitter movement.
- Ensure PNG export works when Mermaid emits HTML labels; do not silently
  produce blank or incomplete images.
- Debounce IndexedDB writes, show save state, and surface quota/migration
  errors.
- Keep API keys out of diagrams, backups, logs, and debug exports.
- Add and test a restrictive Vercel Content Security Policy and security
  headers that still permit the local app, Mermaid rendering, and explicitly
  configured API connections. Pin any CDN fallback to the bundled Mermaid
  version.
- Serve the React application at `/`; make Vercel's production build serve the
  Vite output. Do not keep a second independently editable legacy application.
- Keep all features available without sign-in, subscriptions, diagram limits,
  or paid SGS tiers. Third-party AI provider charges are not controlled by SGS.

PWA/offline installation, a backend proxy, compressed layout-bearing share
links, import/export of every setting, advanced export formats, minimap,
presentation mode, per-tab visual presets, repository-to-diagram, and new
architecture-specific diagram types are out of scope.

## Validation and acceptance

- Build the production Vite app and verify the React interface loads at `/`.
- Seed an existing `mstudio2` value; verify all documents, history, settings,
  and credentials migrate without altering the recovery copy. Verify a failed
  or interrupted migration can retry without data loss.
- Verify CodeMirror editing, line diagnostics, undo/redo, templates, tabs,
  file operations, appearance, and current exports.
- Verify structured generation preserves source, accepts raw source and
  Mermaid, adds Overview and detail tabs only after every view validates, and
  leaves all existing tabs intact on API, JSON, or Mermaid failure.
- Verify Stop cancels a request, Explain displays prose outside the editor,
  and custom models are not overwritten by presets.
- For each supported graph type, move one node at multiple zoom levels.
  Confirm stable identity, attached edge endpoints, labels/markers, orthogonal
  paths that avoid boxes, undo/redo, per-document persistence, and reset.
- Verify unsupported diagram types communicate that node movement is
  unavailable. Verify SVG/PNG reflect the manual layout while `.mmd` and share
  links preserve Mermaid source only.
- Verify pointer, keyboard, Space/middle pan, touch pinch/pan, snap, sensitivity
  settings, scroll behavior, reduced motion, narrow Code/Preview layout, and
  resize without unintended refit.
- Verify latest-render-wins, HTML-label PNG export, save/quota status, and
  cross-tab update notifications.
- Add focused Playwright tests for migration, editing, rendering, AI success /
  failure / cancellation / Explain, movement/routing/undo, mobile behavior,
  resize, and exports.
- Verify CSP/security headers and configured-provider CORS behavior in the
  browser; do not claim credentials are never sent to third parties.
- Push the verified implementation to `main`.
