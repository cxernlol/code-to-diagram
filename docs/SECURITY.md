# Security, Privacy & Threat Model

**CTD Studio** is local-first: diagram source, manual layouts, settings, and optional AI keys stay on your device unless you share a link, join a live room, or send an AI request.

- **Live app:** [ctdstudio.dev](https://ctdstudio.dev/) (same build as the [Vercel mirror](https://code-to-diagram.vercel.app/))
- **Report a vulnerability:** [Private GitHub advisory](https://github.com/cxernlol/code-to-diagram/security/advisories/new) — not a public issue. Policy: [SECURITY.md](../SECURITY.md).

## At a glance

| What | Default | Leaves your device when… |
| :--- | :--- | :--- |
| Tabs, source, layouts, prefs | IndexedDB (`sgs-studio`) | You export files, open a share link you create, or join a live room |
| BYOK API keys | IndexedDB only | You run AI (browser → provider you configured) |
| `#d=` / `#l=` share hashes | In the URL fragment | Browsers **do not** send the hash to CTD servers; **anyone with the link** can read the payload |
| Live room (`#room=`) | WebRTC between peers | Signaling/STUN providers and other participants see room metadata and IPs |

No analytics cookies and no CTD server database for diagrams or keys.

## Storage & persistence (`sgs-studio`)

- **IndexedDB (`sgs-studio`):** Diagram tabs, source code, manual layouts, **version snapshots**, preferences, and optional BYOK AI credentials.
- **No server database & zero cookies:** CTD does not store diagrams or API keys on a CTD-operated server.
- **Clearing site data:** Permanently deletes locally stored diagrams, layouts, and API keys. Export `*.mmd` + `*.ctd.json` (or your format’s source file) before clearing storage.

## Sidecars (`*.ctd.json`)

- **Schema:** [`schema/ctd-sidecar.v1.json`](../schema/ctd-sidecar.v1.json) (`version: 1`).
- **Layout-only:** Node positions, 3-point edge anchor keys (`${edgeId}::start`, `${edgeId}::end`), optional provenance `meta` (`generatedFrom`, `sha256`, `updatedAt`). Canonical diagram source stays in `<basename>.mmd` (or `.dot`, `.puml`, `.d2`, `.sql`, `.ts`, `.xml`); layout in `<basename>.ctd.json`.
- **No secrets:** Sidecars must **never** embed API keys, tokens, or credentials.
- **Untrusted files:** `parseSidecar` and `parseLayoutRecord` reject non-objects; drop `__proto__` / `constructor` / `prototype`; cap **5000** entries and **256**-char keys; require finite coordinates in **[-100_000, 100_000]**.

## Share links (`#d=…&l=…`)

- Diagram source (`d`) and manual layout (`l`) are in the URL **hash fragment**, which browsers do not send to servers on navigation.
- **No API keys** in share hashes — BYOK credentials are never serialized into `#d=` / `#l=`.
- **Capability URLs:** Anyone with the link can view contents; links cannot be revoked and may remain in browser history or chat logs.

### Untrusted `#d=` rendering

Imports from share links are treated as hostile input:

- Mermaid runs with `securityLevel: "strict"` and `htmlLabels: false`.
- Rendered SVG is parsed as `image/svg+xml`, sanitized with DOMPurify, then post-processed before DOM insertion:
  - **Removed tags** include `<script>`, `<iframe>`, `<object>`, `<embed>`, SMIL (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`), and interactive/media markup (`<form>`, `<input>`, `<button>`, `<img>`, `<audio>`, `<video>`, `<link>`, `<meta>`, `<base>`, etc.).
  - **Stripped attributes:** non-fragment `href` / `xlink:href` (e.g. `javascript:`, `data:`), and `style` / `<style>` rules that use external `url(...)` or `@import`.
- Layout (`l`) passes through `parseLayoutRecord` (same bounds and prototype-pollution guards as sidecars).

## Live collaboration (`#room=`) — room trust model

- **Peer-to-peer:** Up to **5** devices; diagram code and layout sync over WebRTC (PeerJS signaling + STUN).
- **Network metadata:** Signaling and STUN expose room IDs and IP addresses to those services and to room participants.
- **Untrusted peer payloads:** Incoming layout uses `parseLayoutRecord`; incoming source is sanitized before render (same goals as share imports).
- **Capability URL:** Anyone with `#room=` can join while the host session is open. When the host closes the room, connected guests move to a **read-only** ended state.

## BYOK AI & custom URLs

- **Direct browser → provider:** AI actions send your prompt, diagram source, and API key from your browser to the configured provider (OpenAI, DeepSeek, OpenRouter, Groq, Ollama, or a custom URL).
- **Same-origin exposure:** IndexedDB is readable by same-origin scripts — use scoped, revocable API keys.
- **Custom URL guidance:**
  - **HTTPS** for remote endpoints.
  - **`http://localhost`** or **`http://127.0.0.1`** only for local runtimes (e.g. Ollama, LM Studio).
  - Do not route sensitive diagrams or keys through untrusted third-party proxies.

## Parser limits & hosted CSP

| Control | Limit |
| :--- | :--- |
| **Seven supported formats** | **512 KB** input cap (`toMermaidSource`, `translateCodeFormat`) — Mermaid, DOT, PlantUML, D2, SQL, TypeScript, XML |
| **XML → IR** | Rejects `<!DOCTYPE>` and `<!ENTITY>`; max nesting depth **64**; max **1_500** elements |
| **Content-Security-Policy** (hosted app) | `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` |

## `ctd-mcp`

Runs locally over **stdio**. No CTD-controlled filesystem or network APIs in the tool path — format detection, parsing, conversion, and Mermaid configuration within the same **512 KB** source limit. Supported versions: [SECURITY.md](../SECURITY.md).

## Out of scope

- Self-XSS (your own DevTools or intentionally running unsafe code in your own session).
- Billing, retention, or policy on **third-party AI endpoints** you configure.
- Peer IP visibility inherent to WebRTC / PeerJS.

## Contributing & security reviews

When a PR touches trust boundaries, note it in the PR summary (**D — Security**):

| Area | Check |
| :--- | :--- |
| **A — Secrets** | Nothing sensitive in `#d=`, `#room=`, sidecars, commits, or client logs |
| **B — Untrusted input** | Share, SVG, sidecar, room, MCP, and parser paths unchanged or tightened |
| **C — Network** | No new tracking or server-side diagram/key storage; new `fetch` / signaling URLs called out |

PR checklist: [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) · verify commands: [CONTRIBUTING.md](../CONTRIBUTING.md#verify-before-you-push).