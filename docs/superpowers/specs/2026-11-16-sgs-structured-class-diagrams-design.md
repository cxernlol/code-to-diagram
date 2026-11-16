# SGS Studio structured diagrams and class layout design

## Goal

Turn pasted source or Mermaid into a readable overview and focused detail
diagrams, and let users reposition individual classes without leaving their
relationships behind. Keep the existing standalone editor and its Mermaid
workflow.

## Current state

`dot.html` contains the UI and styling; `min.js` contains state, rendering,
tabs, AI calls, and drag behavior. Mermaid is bundled locally. The app already
has tabs, Mermaid syntax validation, API-key settings, and generic SVG node
dragging. AI generation currently streams Mermaid text into the active editor
and replaces that document after validation. Dragging applies SVG transforms
to broadly selected nodes but does not reroute relationships. The directory
does not contain a test runner or Git metadata.

## Decisions and alternatives

- **AI result:** Use one strict JSON response containing all Mermaid views,
  validate the complete result, then add tabs atomically. This reuses the
  current API call and avoids partial tabs. Separate calls per view would add
  latency and partial-failure handling; delimiter-separated text is less
  reliable to parse.
- **Class movement:** Keep Mermaid's renderer and add a class-diagram-only SVG
  routing layer. This avoids a new dependency and preserves existing diagram
  rendering. Moving only SVG groups is insufficient because it leaves edges
  detached; replacing Mermaid rendering is out of scope.

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
5. Instruct the model to preserve source meaning, avoid inventing classes,
   members, or relationships, make the overview concise, and group detailed
   views by cohesive areas. For non-class source, select an appropriate
   Mermaid diagram type.
6. Parse the response and validate every diagram with `mermaid.parse` before
   changing document state. Retry invalid output up to three total attempts,
   feeding validation errors back to the model. If validation still fails,
   show an explicit error and leave the source document and tab list intact.
7. On success, append the Overview and named detail documents together, select
   Overview, and preserve the source document. Existing Fix syntax, Style it,
   Tidy, and Explain actions remain single-document edits.

Raw source that is not valid Mermaid remains editable in its source tab; a
Mermaid parse error must not prevent Generate from running.

## Class movement and routing

- For `classDiagram`, make each individual class group draggable. Do not make
  the parent node container a drag target.
- On movement, keep relationship endpoints attached to their classes and
  recompute orthogonal routes for incident edges and any edge obstructed by
  the moved class. Route around class bounds, reposition relationship labels
  onto a clear route segment, and retain edge direction, markers, and labels.
- Prefer short routes and penalize crossings. Avoid class-box intersections;
  line crossings may remain in highly connected diagrams. Extend the SVG
  bounds when a valid detour would otherwise be clipped.
- Preserve the current generic drag behavior for other diagram types.
- Reset returns the current diagram to Mermaid's automatic layout.
- Movement changes rendered layout only. SVG and PNG exports include the
  moved geometry; `.mmd` continues to contain Mermaid source, which cannot
  encode these manual positions.

## Branding and visual constraints

Change the visible heading and description to SGS Studio, consistent with the
existing document title. Preserve the already implemented 60/30/10 palette,
responsive editor/preview layout, focus treatment, and dark theme.

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
- Verify non-class diagrams retain current drag behavior and SVG/PNG exports
  reflect the visible class layout.
- Check the SGS Studio heading, desktop and narrow layouts, and light/dark
  themes in the local browser.

No provider-specific model defaults or new diagram-editing dependencies are
included in this change.
