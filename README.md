# CTD Studio

[![CI](https://github.com/cxernlol/code-to-diagram/actions/workflows/ci.yml/badge.svg)](https://github.com/cxernlol/code-to-diagram/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A local-first code-to-diagram editor that runs in your browser. Write Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, or XML on the left, drag nodes and connector lines into place on the right, and export without creating an account.

Live app: [code-to-diagram.vercel.app](https://code-to-diagram.vercel.app/) · Bundled renderer: **Mermaid v11.4.1** (`public/mermaid.min.js`)

## Features

- **Multi-Format Code to Diagrams & Translation:** Auto-detects and renders **Mermaid**, **Graphviz DOT**, **PlantUML**, **D2**, **SQL DDL**, **TypeScript**, and **XML** (including Draw.io `mxGraphModel`, BPMN, and generic XML trees) into the interactive canvas, with one-click cross-format translation via **Convert to…**.
- **Move Boxes and Lines:** Drag individual nodes, nudge them with arrow keys, drag connector segments to adjust routing lanes, and snap to a configurable grid with alignment guides.
- **Layered Arrangement & Auto-Focus:** Arrange nodes cleanly in one click, center the viewport on active diagram bounds, and expand either the source or preview pane.
- **Clean Connectors & Labels:** Orthogonal edge routing with perpendicular port stubs, centered labels and diamond exits, and theme presets (`default`, `dark`, `forest`, `neutral`) with automatic contrast guards.
- **Local-First Storage:** Diagrams, manual node/edge layouts, version history, and settings are stored in IndexedDB.
- **Import, Export & Share:** Open `.mmd` or `.md` files, export full-bounds SVG or PNG images, or share a URL that preserves both source code and manual layout.
- **BYOK AI (Optional):** Connect your own OpenAI, DeepSeek, Ollama, OpenRouter, Groq, or custom OpenAI-compatible endpoint directly from the browser.

## Getting Started

```bash
git clone https://github.com/cxernlol/code-to-diagram.git
cd code-to-diagram
npm install
npm run dev
```

Type-check and build for production:

```bash
npm run build
```

Run the Playwright end-to-end test suite (17 Chromium E2E tests):

```bash
npm test
```

## CI/CD & Test Coverage

- **CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):** Runs on every push and pull request to `main`: TypeScript type-checking (`tsc -b` + `mcp/tsconfig.json`), Vite production builds for web and `ctd-mcp`, **8** MCP stdio tests (`npm run mcp:test`), `npx --no-install ctd-mcp --version`, and **17** Playwright Chromium E2E tests (`npx playwright test --workers=1`).
- **CD ([`.github/workflows/publish-mcp.yml`](.github/workflows/publish-mcp.yml)):** Publishes `ctd-mcp` from `mcp/` to npm with provenance on GitHub Releases or manual `workflow_dispatch`.

## Tech Stack & Languages

- **Languages:** TypeScript, TSX (React 19), CSS, HTML, JavaScript (ESM)
- **Supported Input/Export Formats (7):** Mermaid (`v11.4.1`), Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, XML (Draw.io `mxGraphModel`, BPMN, generic XML)
- **Libraries & Runtimes:** Vite, CodeMirror 6, D3 (`d3-selection`, `d3-zoom`), Framer Motion, Anime.js, PeerJS, IndexedDB (`idb`), `@modelcontextprotocol/sdk`, `@xmldom/xmldom`, Playwright

## CTD Studio MCP Server (`ctd-mcp` via `npx`)

`ctd-mcp` is the Model Context Protocol (MCP) server ([`mcp/`](mcp/README.md)) bundled with this repo, reusing the same multi-format parsers and translators (targeting Mermaid v11.4.1). Use it anywhere that supports stdio MCP servers: **Claude Desktop**, **Cursor**, **Windsurf**, **VS Code**, **Claude Code**, or directly from your terminal.

Run directly with `npx`:

```bash
npx -y github:cxernlol/code-to-diagram
```

### Claude Desktop / Cursor / Windsurf

Add to `claude_desktop_config.json`, `.cursor/mcp.json`, or `mcp_config.json`:

```json
{
  "mcpServers": {
    "ctd-mcp": {
      "command": "npx",
      "args": ["-y", "github:cxernlol/code-to-diagram"]
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "ctd-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:cxernlol/code-to-diagram"]
    }
  }
}
```

### Available MCP Tools & Resources

- **Tools:** `detect_format`, `to_mermaid`, `translate_format`, `parse_diagram_ir`, `emit_from_ir`, `list_templates`, `get_studio_info`
- **Resources & Prompt:** `ctd://formats`, `ctd://themes`, `ctd://templates/{name}`, `code_to_diagram`

Build and test the MCP server locally:

```bash
npm run mcp:build
npm run mcp:test
```

## Data & Privacy

- **Storage:** Diagrams and preferences stay in your browser's IndexedDB. Legacy `mstudio2` `localStorage` data is migrated on first load while keeping a recovery copy.
- **AI Requests:** Prompts, diagram source, and API keys are sent directly from your browser to the endpoint you configure.
- **Cost:** CTD Studio is free to run and has no accounts or paid tiers. If you connect a commercial AI API key, provider usage is billed by that provider.
