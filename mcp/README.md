# sgs-diagram

Model Context Protocol (MCP) server (**SGS-Diagram**) — detect, parse, convert, and translate diagrams across **Mermaid (v11.4.1)**, **Graphviz DOT**, **PlantUML**, **D2**, **SQL DDL**, **TypeScript**, and **XML** (including Draw.io `mxGraphModel`, BPMN, and generic XML trees).

## Quick Start (`npx`)

Run from the repository root or via GitHub:

```bash
# From a local clone
npx .

# Or directly from GitHub
npx -y github:cxernlol/sgs-chify

# Or from npm (once published)
npx -y sgs-diagram
```

## Client Configuration

### Claude Desktop / Cursor / Windsurf

Add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, or `mcp_config.json`):

```json
{
  "mcpServers": {
    "sgs-diagram": {
      "command": "npx",
      "args": ["-y", "github:cxernlol/sgs-chify"]
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "sgs-diagram": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:cxernlol/sgs-chify"]
    }
  }
}
```

## Available Tools

| Tool | Description |
| --- | --- |
| `detect_format` | Auto-detect format (`mermaid`, `dot`, `plantuml`, `d2`, `sql`, `typescript`, `xml`) and Mermaid diagram type. |
| `to_mermaid` | Convert any supported format (including Draw.io / BPMN / generic XML) into Mermaid syntax. |
| `translate_format` | Translate between any two supported formats via SGS Studio's `DiagramIR`. |
| `parse_diagram_ir` | Parse any supported format into structured `DiagramIR` (`kind`, `direction`, `nodes`, `edges`). |
| `emit_from_ir` | Emit diagram/code in any target format from a structured `DiagramIR` object. |
| `list_templates` | List built-in SGS Studio templates or fetch one by name. |
| `get_studio_info` | Return supported formats, extensions, themes, and app metadata. |

## Resources & Prompts

- `sgs://formats` — JSON list of supported formats and extensions
- `sgs://themes` — Built-in theme presets (`default`, `dark`, `forest`, `neutral`)
- `sgs://templates/{name}` — Built-in diagram templates
- `code_to_diagram` — Prompt template for converting code/schemas into diagrams

## Development (in this repo)

```bash
npm run typecheck
npm run mcp:build
npm run mcp:test
```
