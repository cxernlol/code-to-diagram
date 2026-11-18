# ctd-mcp

Model Context Protocol (MCP) server for **CTD Studio** (`code-to-diagram`) — detect, parse, convert, and translate diagrams across **Mermaid (v12.3.0)**, **Graphviz DOT**, **PlantUML**, **D2**, **SQL DDL**, **TypeScript**, and **XML** (including Draw.io `mxGraphModel`, BPMN, and generic XML trees).

## Quick Start (`npx`)

Run from npm (recommended) or directly from GitHub:

```bash
# From npm
npx -y ctd-mcp

# Or directly from GitHub
npx -y github:cxernlol/code-to-diagram
```

## Client Configuration

### Claude Desktop / Cursor / Windsurf

Add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, or `mcp_config.json`):

```json
{
  "mcpServers": {
    "ctd-mcp": {
      "command": "npx",
      "args": ["-y", "ctd-mcp"]
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
      "args": ["-y", "ctd-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
| --- | --- |
| `detect_format` | Auto-detect format (`mermaid`, `dot`, `plantuml`, `d2`, `sql`, `typescript`, `xml`) and Mermaid diagram type. |
| `to_mermaid` | Convert any supported format (including Draw.io / BPMN / generic XML) into Mermaid syntax. |
| `translate_format` | Translate between any two supported formats via CTD Studio's `DiagramIR`. |
| `parse_diagram_ir` | Parse any supported format into structured `DiagramIR` (`kind`, `direction`, `nodes`, `edges`). |
| `emit_from_ir` | Emit diagram/code in any target format from a structured `DiagramIR` object. |
| `list_templates` | List built-in CTD Studio templates or fetch one by name. |
| `get_studio_info` | Return supported formats, extensions, themes, and app metadata. |
| `configure_mermaid_diagram` | Update layout direction (`TD`/`TB`/`BT`/`LR`/`RL`), toggle node suppression (`%% sgs-hide`), or add class/ER members. |

## Resources & Prompts

- `ctd://formats` — JSON list of supported formats and extensions
- `ctd://themes` — Built-in theme presets (`default`, `dark`, `forest`, `neutral`)
- `ctd://templates/{name}` — Built-in diagram templates
- `code_to_diagram` — Prompt template for converting code/schemas into diagrams
- `configure_diagram` — Prompt template for adjusting layout direction, node visibility, or class/ER members
- `explain_diagram` — Prompt template for parsing and summarizing a diagram's structure

## Development (in this repo)

```bash
npm run typecheck
npm run mcp:build
npm run mcp:test
```

## License

- **Individual & internal use (free forever):** [Elastic License 2.0 (ELv2)](https://github.com/cxernlol/code-to-diagram/blob/main/LICENSE)
- **Commercial SaaS, reselling, or white-labeling:** Requires a paid license under [COMMERCIAL-LICENSE-AGREEMENT.md](https://github.com/cxernlol/code-to-diagram/blob/main/COMMERCIAL-LICENSE-AGREEMENT.md) (contact `mrshimn@proton.me`).
