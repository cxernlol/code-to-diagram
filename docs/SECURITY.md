# Security, Privacy & Threat Model

CTD Studio (`code-to-diagram`) is local-first: diagram source, manual layouts, settings, and optional AI keys stay on your device unless you explicitly share a link, join a live room, or trigger an AI request.

## 1. Storage & Persistence (`sgs-studio`)

- **IndexedDB (`sgs-studio`):** Stores diagram tabs, source code, manual layouts, version snapshots, preferences, and optional BYOK AI credentials.
- **No server database & zero cookies:** CTD Studio sets no cookies and does not store diagrams or API keys on any server.
- **Clearing site data:** Clearing origin storage permanently deletes all locally stored diagrams, layouts, and API keys. Export `.mmd` + `.ctd.json` backups of important diagrams.

## 2. Sidecar Files (`*.ctd.json`)

- **Schema:** [`schema/ctd-sidecar.v1.json`](../schema/ctd-sidecar.v1.json) (`version: 1`).
- **Layout-only:** Sidecars store node positions, 3-point edge anchor keys (`${edgeId}::start`, `${edgeId}::end`), and optional provenance `meta` (`generatedFrom`, `sha256`, `updatedAt`).
- **No secrets:** Sidecars must **never** embed BYOK API keys, tokens, or credentials. Keep canonical diagram source in `<basename>.mmd` (or `.dot`, `.puml`, `.d2`, `.sql`, `.ts`, `.xml`) and layout in `<basename>.ctd.json`.
- **Untrusted input hardening:** `parseSidecar` and `parseLayoutRecord` reject non-objects, drop `__proto__`/`constructor`/`prototype`, cap entries at `5000`, cap key length at `256`, and require finite coordinates within `[-100_000, 100_000]`.

## 3. Share Links (`#d=...&l=...`)

- Diagram source (`d`) and manual layout (`l`) are encoded in the URL hash fragment, which browsers do not send to servers.
- **No API keys:** BYOK credentials are never serialized into share hashes.
- **SVG XSS & payload limits:** Imported share payloads are sanitized (Mermaid strict/sandboxed SVG rendering + DOMPurify) and layout entries pass through `parseLayoutRecord`.
- **Link exposure:** Anyone with the link can view its contents, links cannot be revoked, and links may remain in browser history or chat logs.

## 4. Live Collaboration Rooms (WebRTC / PeerJS) — Room Trust Model

- **Peer-to-peer transport:** Live rooms (up to 5 devices) sync diagram code and layout over WebRTC via PeerJS signaling and STUN servers.
- **Network metadata:** Signaling and STUN expose room IDs and IP addresses to signaling/STUN providers and room participants.
- **Untrusted peer payloads:** Incoming room layout records are sanitized with `parseLayoutRecord` (same bounds and prototype-pollution guards as sidecars), and incoming source code is sanitized before rendering.
- **Capability URL & read-only end state:** Anyone with the `#room=` link can join while the host session is open. When the host closes the room, connected guests transition to a read-only ended state.

## 5. BYOK AI Credentials & Custom URLs

- **Direct browser-to-provider requests:** Triggering an AI action sends your prompt, diagram source, and API key directly from your browser to the configured provider (OpenAI, DeepSeek, OpenRouter, Groq, Ollama, or custom URL).
- **Origin script access:** Because IndexedDB is readable by same-origin scripts, use scoped, revocable API keys.
- **Custom URL guidance:**
  - Always use **HTTPS** for remote custom endpoints.
  - Use **`http://localhost`** or **`http://127.0.0.1`** only for local runtimes (e.g., Ollama, LM Studio).
  - Avoid routing sensitive diagrams or API keys through untrusted third-party proxy URLs.
