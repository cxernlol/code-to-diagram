# SGS Studio

A local-first Mermaid diagram editor that runs in your browser. Write Mermaid code on the left, drag nodes and connector lines into place on the right, and export without creating an account.

Live app: [sgs-chify.vercel.app](https://sgs-chify.vercel.app/)

## Features

- **Multi-Format Code to Diagrams:** Auto-detects and renders **Mermaid**, **Graphviz DOT**, **PlantUML**, **D2**, **SQL DDL** (`CREATE TABLE` to ER diagram), and **TypeScript** interfaces/classes (`classDiagram`) into the same interactive canvas.
- **Move Boxes and Lines:** Drag individual nodes, nudge them with arrow keys, drag connector segments to adjust routing lanes, and snap to a configurable grid with alignment guides.
- **Layered Arrangement & Auto-Focus:** Arrange nodes cleanly in one click, center the viewport on active diagram bounds, and expand either the source or preview pane.
- **Clean Connectors & Labels:** Orthogonal edge routing with perpendicular port stubs, centered labels and diamond exits, and theme presets (`default`, `dark`, `forest`, `neutral`) with automatic contrast guards.
- **Local-First Storage:** Diagrams, manual node/edge layouts, version history, and settings are stored in IndexedDB.
- **Import, Export & Share:** Open `.mmd` or `.md` files, export full-bounds SVG or PNG images, or share a URL that preserves both source code and manual layout.
- **BYOK AI (Optional):** Connect your own OpenAI, DeepSeek, Ollama, OpenRouter, Groq, or custom OpenAI-compatible endpoint directly from the browser.

## Getting Started

```bash
git clone https://github.com/cxernlol/sgs-chify.git
cd sgs-chify
npm install
npm run dev
```

Type-check and build for production:

```bash
npm run build
```

Run the Playwright end-to-end test suite:

```bash
npm test
```

## Data & Privacy

- **Storage:** Diagrams and preferences stay in your browser's IndexedDB. Legacy `mstudio2` `localStorage` data is migrated on first load while keeping a recovery copy.
- **AI Requests:** Prompts, diagram source, and API keys are sent directly from your browser to the endpoint you configure.
- **Cost:** SGS Studio is free to run and has no accounts or paid tiers. If you connect a commercial AI API key, provider usage is billed by that provider.
