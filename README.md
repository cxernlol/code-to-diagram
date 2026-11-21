# CTD Studio

<p align="center">
  <a href="https://github.com/cxernlol/code-to-diagram/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/cxernlol/code-to-diagram/ci.yml?branch=main&label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/ctd-mcp"><img src="https://img.shields.io/npm/v/ctd-mcp?label=ctd-mcp" alt="ctd-mcp on npm" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Elastic%202.0-blue" alt="Elastic License 2.0" /></a>
</p>
<p align="center">
  <a href="https://code-to-diagram.vercel.app/"><img src="https://img.shields.io/badge/Open-ctdstudio.dev-6366f1?style=for-the-badge" alt="Open ctdstudio.dev" /></a>
  <a href="https://code-to-diagram.vercel.app/?mode=quick"><img src="https://img.shields.io/badge/Quick_start-22c55e?style=for-the-badge" alt="Quick start" /></a>
  <a href="https://code-to-diagram.vercel.app/docs"><img src="https://img.shields.io/badge/Docs-5_min_tutorial-0ea5e9?style=for-the-badge" alt="5-min tutorial" /></a>
</p>

**v1.3.0** — Local-first **code → diagram** in the browser. Drag layout without breaking source. **No account.**

| **For** | **What you get** |
| :--- | :--- |
| Casual | **Start drawing** → drag → **Download PNG**. Simple mode by default; **Studio menu → More tools** for AI & live rooms. |
| Developers | `*.mmd` + `*.ctd.json` sidecars in git, samples, headless `render-diagram.mjs`. |
| Agents | **ctd-mcp** — convert, patch, verify, preserve layout. See [mcp/README.md](mcp/README.md). |

![CTD Studio — code-first diagrams you can hand-tune](public/og-image.png)

### Formats

**Mermaid v12.3.0**, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, XML (Draw.io / BPMN). Auto-detect + convert between supported subsets.

**Full matrix & syntax:** [In-app `/docs`](https://code-to-diagram.vercel.app/docs) · [`docs/FIRST_TIME_CODE_TO_DIAGRAM.md`](docs/FIRST_TIME_CODE_TO_DIAGRAM.md)

### Export & git

- **PNG-first** topbar · **More export…** for SVG, source, layout, submission bundle (`PNG + source + .ctd.json`)
- **Share** via `#d=` (no API keys in URLs)
- **Sidecar workflow:** [docs/GIT_AND_AGENT_WORKFLOW.md](docs/GIT_AND_AGENT_WORKFLOW.md) · [schema v1](https://code-to-diagram.vercel.app/schema/ctd-sidecar.v1.json) · [git-flow sample](https://code-to-diagram.vercel.app/samples/git-flow/flow.mmd)

### `ctd-mcp`

```bash
npx -y ctd-mcp
```

<details>
<summary>MCP client config (Cursor / Claude / VS Code)</summary>

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

VS Code: use `"servers"` + `"type": "stdio"` — see [`mcp/README.md`](mcp/README.md).

</details>

**Tools & prompts:** listed in [`mcp/README.md`](mcp/README.md) (layout, `verify_against_files`, `preview_patch`, drift, IR). Stdio, in-memory; optional local file read only when you pass `filePath`.

### Optional (More tools)

BYOK AI (your keys stay in the browser) · peer live rooms (max 5) · see [docs/SECURITY.md](docs/SECURITY.md).

### Develop locally

```bash
git clone https://github.com/cxernlol/code-to-diagram.git
cd code-to-diagram
npm install   # Node ≥22
npm run dev
```

**Checks:** `npm run build` · `npm test` (49 E2E) · `npm run test:sidecar` · `npm run test:parsers` · `npm run test:render` · `npm run mcp:test` — details in [CONTRIBUTING.md](CONTRIBUTING.md).

**Links:** [llms.txt](public/llms.txt) · [Threat model](docs/SECURITY.md) · [Security policy](SECURITY.md) · [CI](.github/workflows/ci.yml)

### License

[Elastic License 2.0](LICENSE) for individual & internal use. Commercial SaaS / resale: [COMMERCIAL-LICENSE-AGREEMENT.md](COMMERCIAL-LICENSE-AGREEMENT.md).
