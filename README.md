# SGS Studio

SGS Studio is a free, browser-based Mermaid editor. Edit Mermaid source, move
individual nodes in flowchart, class, state, and ER diagrams, and export SVG or
PNG. AI features are optional and use a provider endpoint and key you configure.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to type-check and create the production app in `dist/`.

## Saved work and AI privacy

Diagrams, layout, and settings are stored in IndexedDB in this browser. On first
launch, SGS Studio migrates the existing `mstudio2` localStorage workspace and
leaves the original value untouched as a recovery copy. Provider credentials
are stored separately from diagrams.

When you explicitly start an AI request, the prompt, current diagram, and API
key are sent directly from the browser to the configured provider. Some
providers block browser requests with CORS. Provider usage may incur charges;
SGS Studio itself has no paid features or diagram limits.
