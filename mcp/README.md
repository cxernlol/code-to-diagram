# ctd-mcp

Model Context Protocol (MCP) server for **CTD Studio** (`code-to-diagram`) — detect, parse, convert, and translate diagrams across **Mermaid (v11.4.1)**, **Graphviz DOT**, **PlantUML**, **D2**, **SQL DDL**, **TypeScript**, and **XML** (including Draw.io `mxGraphModel`, BPMN, and generic XML trees).

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

## Resources & Prompts

- `ctd://formats` — JSON list of supported formats and extensions
- `ctd://themes` — Built-in theme presets (`default`, `dark`, `forest`, `neutral`)
- `ctd://templates/{name}` — Built-in diagram templates
- `code_to_diagram` — Prompt template for converting code/schemas into diagrams

## Development (in this repo)

```bash
npm run typecheck
npm run mcp:build
npm run mcp:test
```
