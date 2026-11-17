# CTD Studio

[![CI](https://github.com/cxernlol/code-to-diagram/actions/workflows/ci.yml/badge.svg)](https://github.com/cxernlol/code-to-diagram/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Write diagram code, drag it into shape, export. No account, no server.

**[Open the app ->](https://code-to-diagram.vercel.app/)**

Supports Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML (Draw.io, BPMN). Your diagrams stay in your browser.

## Features

- **7 input formats**, auto-detected, with one-click conversion between them
- **Drag nodes and edges**, arrow-key nudging, grid snap, alignment guides
- **One-click auto-arrange** and orthogonal edge routing
- **Themes:** default, dark, forest, neutral, plus opt-in colorized boxes on export
- **Local-first:** diagrams, layouts, and version history live in IndexedDB
- **5-device live rooms:** share a live PeerJS session link to collaborate in real time
- **Export** full-bounds SVG/PNG, or share a URL that keeps your manual layout
- **Optional BYOK AI:** OpenAI, DeepSeek, Ollama, OpenRouter, Groq, or any compatible endpoint

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

Run the Playwright end-to-end test suite:

```bash
npm test
```

## CTD Studio MCP Server (`ctd-mcp` via `npx`)

`ctd-mcp` is the Model Context Protocol (MCP) server ([`mcp/`](mcp/README.md)) bundled with this repo, reusing the same multi-format parsers and translators. Use it in **Claude Desktop**, **Cursor**, **Windsurf**, **VS Code**, **Claude Code**, or directly from your terminal.

Run directly from GitHub with `npx` (uses the prebuilt `mcp/dist/index.js` bundle so no build step is needed on first run):

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

## Tech Stack & CI/CD

- **Stack:** TypeScript, React 19, CodeMirror 6, D3 (`d3-selection`, `d3-zoom`), PeerJS (5-device live rooms), and **Mermaid v11.4.1** (bundled locally in `public/mermaid.min.js` for offline reliability and consistent SVG DOM selectors when dragging nodes and edges).
- **CI/CD:** GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs type-checking, web and `ctd-mcp` builds, MCP stdio tests, and Playwright E2E tests on every push and pull request to `main` (see the CI badge above). Releases publish `ctd-mcp` to npm via [`.github/workflows/publish-mcp.yml`](.github/workflows/publish-mcp.yml).

## Data & Privacy

- **Storage:** Diagrams, layouts, and preferences stay in your browser's IndexedDB. Legacy `mstudio2` `localStorage` data is migrated on first load while keeping a recovery copy.
- **AI Requests & Keys:** API keys are stored in your browser only and are never included in share URLs. Prompts, diagram source, and keys are sent directly from your browser to the endpoint you configure.
- **Cost:** CTD Studio is free to run and has no accounts or paid tiers. If you connect a commercial AI API key, provider usage is billed by that provider.
