# Security Policy

## Supported Versions

Only the latest deployment on `main` (`https://code-to-diagram.vercel.app/`) and the latest `ctd-mcp` release on npm are supported with security fixes.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately via GitHub Security Advisories:
- https://github.com/cxernlol/code-to-diagram/security/advisories/new

Include reproduction steps, the affected input or URL/MCP payload, and impact.

- **Response time:** Best effort by a solo maintainer, usually within 7 days.

## Security Model

- **Untrusted `#d=` share links:** Mermaid runs with `securityLevel: "strict"` and `htmlLabels: false`. Rendered SVGs are parsed as `image/svg+xml` and stripped of `<script>`, `<iframe>`, `<object>`, `<embed>`, SMIL animation elements (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`), interactive/media HTML elements (`<form>`, `<input>`, `<img>`, etc.), inline `on*` event attributes, non-`#` `href`/`xlink:href` URIs (including `javascript:` and `data:`), and external `url(...)` / `@import` CSS rules before insertion into the DOM.
- **CSP:** Vercel serves `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
- **Parser & XML limits:** All 7 formats enforce a `512 KB` input cap (`toMermaidSource`, `translateCodeFormat`). `parseXmlToIR` additionally rejects `<!DOCTYPE>` and `<!ENTITY>` declarations, nesting deeper than `64` levels, and documents with more than `1,500` elements.
- **BYOK API keys:** New keys are stored in browser `IndexedDB` (`sgs-studio`), never included in share URLs, and sent directly from your browser to the configured endpoint.
- **`ctd-mcp`:** Runs locally over stdio and does not use filesystem or network APIs (pure format detection, parsing, conversion, and Mermaid configuration within the 512 KB source limit).

## Out of Scope

- Self-XSS (running code in your own browser DevTools or intentionally pasting an unsafe script into your own local session).
- Vulnerabilities or billing/policy behavior on third-party BYOK AI endpoints you configure.
- Peer IP visibility inherent to WebRTC / PeerJS live collaboration rooms (`#room=`).
