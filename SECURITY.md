# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately via GitHub Security Advisories:
- https://github.com/cxernlol/code-to-diagram/security/advisories/new

Include reproduction steps, the affected input or URL/MCP payload, and impact.

## Security Model

- **Untrusted `#d=` share links:** Mermaid runs with `securityLevel: "strict"` and `htmlLabels: false`. Rendered SVGs are parsed as `image/svg+xml` and stripped of `<script>`, `<iframe>`, `<object>`, `<embed>`, inline `on*` event attributes, external `href`/`xlink:href`, and external `url(...)` / `@import` CSS rules before insertion into the DOM.
- **XML parsing (`DOMParser` / `@xmldom/xmldom`):** `parseXmlToIR` rejects `<!DOCTYPE>` and `<!ENTITY>` declarations, inputs over `512 KB`, nesting deeper than `64` levels, and documents with more than `1,500` elements.
- **BYOK API keys:** Stored only in browser `IndexedDB` (`sgs-studio`), never included in share URLs, and sent directly from your browser to the configured endpoint.
- **`ctd-mcp`:** Runs locally over stdio with no filesystem or network access (pure format detection, parsing, and conversion).
