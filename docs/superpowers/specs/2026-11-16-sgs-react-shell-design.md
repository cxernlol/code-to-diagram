# SGS Studio React shell design

## Goal

Serve SGS Studio from a React-based entry point with Framer Motion and
Lucide React, while retaining the existing editor and its customization
without adding paid tiers or artificial usage limits.

## User intent and constraints

- Use React, Framer Motion, and Lucide React.
- Keep the existing editor/core behavior unchanged except for the explicitly
  approved single-node connector-routing change.
- Keep the existing Move boxes control available.
- Keep existing theme, palette, font, templates, AI settings, and export
  controls available.
- Do not add sign-in, subscriptions, diagram limits, or feature gating.
- Push the finished change to `main`.

## Current state

The project is a standalone HTML/CSS/JavaScript app. `dot.html` contains the
entire UI; `min.js` contains DOM-bound state, generation, rendering, and
dragging logic; `mermaid.min.js` is the local Mermaid bundle. There is no
package manifest or build system. `vercel.json` currently rewrites `/` to
`/dot.html`.

## Architecture

Use Vite with React and JavaScript. The React root page renders a full-viewport
iframe pointing to `/dot.html`. Keep the legacy files at their existing source
paths so local direct access and relative script URLs continue to work. A
small build-copy script places `dot.html`, `min.js`, and `mermaid.min.js` at
the root of Vite's `dist` output.

The React shell adds only a compact accessible action to open the editor in a
separate tab. Use a Lucide React icon for that action and a restrained
Framer Motion transition when the iframe loads. Respect
`prefers-reduced-motion`. Give the iframe an accessible title and keep it
responsive. Do not duplicate the editor toolbar or hide its existing controls.

The iframe remains same-origin at `/dot.html`, so the editor's existing
`localStorage`, file controls, API calls, exports, and customization continue
to work. No message bridge is needed.

For Vercel, make the built React `index.html` serve `/`. Remove the stale root
rewrite to `/dot.html`; the copied `/dot.html` remains available for direct
access and the iframe.

## Core behavior boundary

Keep the existing editor logic, state, generation, storage format, themes,
templates, and exports as-is. The only approved core behavior change is in
`min.js`: when Move boxes is active, moving an individual `classDiagram`,
`flowchart`, or `graph` node must also reroute affected connectors
orthogonally, retain arrowheads and labels, avoid node boxes, and minimize
crossings. The existing Mermaid source remains unchanged by dragging; label
text continues to be edited in the source pane. Other diagram types retain
their current drag behavior.

Structured AI overview/detail generation remains a separate future change and
is not part of this migration.

## Free-use and customization policy

All existing features remain available without an SGS account, subscription,
diagram-count cap, or paid-feature gate. Preserve the existing editor's theme,
diagram colors, font, templates, exports, and configurable AI endpoint/model.
AI is optional and uses the user's API credentials; charges imposed by an
external AI provider are outside SGS Studio.

## Alternatives considered

- **React wrapper with iframe (selected):** keeps the legacy code and state
  intact, while adding a React/Vite entry and requested UI libraries. The
  editor itself remains HTML/JavaScript; React is its host.
- **Refactor the entire editor into React:** would make all editor UI native
  React, but requires broad changes to DOM-bound core logic and conflicts with
  the requested core freeze.
- **Duplicate the old app into a second React implementation:** creates two
  sources of truth and risks feature drift; rejected.

## Errors and privacy

The React shell makes no API requests and does not read or forward the user's
API key. Existing API calls remain inside the legacy editor and are initiated
only by existing user actions. If the iframe fails to load, show a clear
error and a link to open `/dot.html` directly; do not silently show an empty
shell.

## Validation and acceptance

- Install from the lockfile and run the production Vite build.
- Verify the React shell at `/` and the unchanged legacy entry at `/dot.html`
  in local development and the Vercel deployment.
- Verify the iframe remains full-size and keyboard-accessible, the open-in-new
  tab action works, and its load transition respects reduced motion.
- Verify existing editor tabs, theme/palette/font controls, templates, AI
  settings, file open/save, SVG/PNG export, and Move boxes remain available.
- Move one flowchart decision node and one class; verify attached connectors,
  arrowheads, and labels follow and avoid node boxes. Verify Reset layout.
- Verify the same-origin editor retains its existing `localStorage` state.
- Verify no app login, subscription, diagram cap, or gated feature is added.
