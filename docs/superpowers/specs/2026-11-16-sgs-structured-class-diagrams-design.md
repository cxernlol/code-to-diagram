# SGS Studio structured diagrams and node layout design

## Goal

Turn pasted source or Mermaid into a readable overview and focused detail
diagrams, and let users reposition individual class and flowchart nodes
without leaving their relationships behind. Keep the existing standalone
editor and its Mermaid workflow.

## Current state

`dot.html` contains the UI and styling; `min.js` contains state, rendering,
tabs, AI calls, and drag behavior. Mermaid is bundled locally. The app already
has tabs, Mermaid syntax validation, API-key settings, and generic SVG node
dragging. AI generation currently streams Mermaid text into the active editor
and replaces that document after validation. Dragging applies SVG transforms
to broadly selected nodes but does not reroute relationships. `vercel.json`
rewrites the homepage to `dot.html`. The Git repository tracks `main`; no test
runner is present.

## Decisions and alternatives

- **AI result:** Use one strict JSON response containing all Mermaid views,
  validate the complete result, then add tabs atomically. This reuses the
  current API call and avoids partial tabs. Separate calls per view would add
  latency and partial-failure handling; delimiter-separated text is less
  reliable to parse.
- **Node movement:** Keep Mermaid's renderer and extend the SVG routing layer
  to class diagrams and flowcharts. This avoids a new dependency and preserves
  Mermaid's existing rendering. Moving only SVG groups is insufficient
  because it leaves edges detached; replacing Mermaid rendering or adding a
  graph-layout dependency would move unrelated nodes and is out of scope.

## Generation flow

1. The user pastes source or Mermaid into the current editor and explicitly
   clicks **Generate** or presses Enter. Pasting never sends data to an API.
2. With a blank prompt, use the default request to create a structured
   overview and detail diagrams. Otherwise, include the user's prompt.
3. Keep the current document and its text unchanged while generating. Do not
   stream partial AI output into the editor.
4. Require JSON in this shape:

   ```json
   {
     "overview": { "code": "classDiagram\n..." },
     "details": [
       { "name": "Core types", "code": "classDiagram\n..." }
     ]
   }
   ```

   The app names the overview tab **Overview**. `overview.code` and every
   detail `code` must be non-empty Mermaid source; each detail needs a
   non-empty name and code. Include at least one detail.
5. Instruct the model to preserve source meaning, avoid inventing entities,
   members, or relationships, make the overview concise, and group detailed
   views by cohesive areas. Select an appropriate Mermaid diagram type for
   the source.
6. Parse the response and validate every diagram with `mermaid.parse` before
   changing document state. Retry invalid output up to three total attempts,
   feeding validation errors back to the model. If validation still fails,
   show an explicit error and leave the source document and tab list intact.
7. On success, append the Overview and named detail documents together, select
   Overview, and preserve the source document. Existing Fix syntax, Style it,
   Tidy, and Explain actions remain single-document edits.

Raw source that is not valid Mermaid remains editable in its source tab; a
Mermaid parse error must not prevent Generate from running.

## Node movement and routing

- For `classDiagram` and `flowchart`/`graph`, make each rendered node
  individually draggable. Do not make parent containers drag targets.
- On movement, keep connectors attached and recompute orthogonal routes for
  incident edges and any edge obstructed by the moved node. Route around node
  bounds, reposition edge labels onto clear route segments, and retain edge
  direction and markers. In flowcharts, preserve branch labels such as “Yes”
  and “No.”
- Prefer short routes and penalize crossings. Avoid node-box intersections;
  line crossings may remain in highly connected diagrams. Extend the SVG
  bounds when a valid detour would otherwise be clipped.
- Node text remains editable in the Mermaid source pane; inline canvas label
  editing is not included.
- Preserve the current generic drag behavior for other diagram types.
- Reset returns the current diagram to Mermaid's automatic layout.
- Movement changes rendered layout only. SVG and PNG exports include the
  moved geometry; `.mmd` continues to contain Mermaid source, which cannot
  encode these manual positions.

## Branding and visual constraints

The visible heading, description, and document title use SGS Studio. Preserve
the already implemented 60/30/10 palette, responsive editor/preview layout,
focus treatment, and dark theme.

## Errors and privacy

Use the configured API endpoint, model, and key as today. Send source only
after an explicit generation action. Show API, JSON, and Mermaid validation
errors directly; never create success-shaped fallback diagrams or partially
add tabs. Keep the original source available after either failure or success.

## Validation and acceptance

- Verify valid generated JSON creates Overview first and all named details,
  with each Mermaid block parseable and rendered.
- Verify malformed JSON, invalid Mermaid in any one view, and API failure leave
  the source text and existing tabs unchanged.
- Verify blank prompt uses the default request; non-empty prompts are passed
  through. Verify quick actions still update one diagram rather than adding
  tabs.
- In a class diagram, drag one class and confirm all affected relationships
  remain attached, labels and markers remain visible, and routed lines avoid
  class boxes. Reset and verify automatic layout returns.
- In a flowchart, move a decision diamond such as “Valid?” and confirm its
  incoming/outgoing arrows, branch labels, and markers follow it, including a
  loop edge. Verify Mermaid source remains editable and unchanged by dragging.
- Verify other diagram types retain current drag behavior and SVG/PNG exports
  reflect the visible class and flowchart layouts.
- Check the SGS Studio heading, desktop and narrow layouts, and light/dark
  themes in the local browser.

No provider-specific model defaults or new diagram-editing dependencies are
included in this change.
