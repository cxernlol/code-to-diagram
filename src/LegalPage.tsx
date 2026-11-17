import { ArrowLeft, GitBranch } from "lucide-react";

export type LegalTab = "privacy" | "terms";

interface LegalPageProps {
  tab: LegalTab;
  onSwitch: (tab: LegalTab) => void;
  onBack: () => void;
  onStart: () => void;
}

export function LegalPage({ tab, onSwitch, onBack, onStart }: LegalPageProps) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <button className="brand-home-button" type="button" onClick={onBack}>
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="home-brand-name">CTD Studio</span>
          </button>
          <nav className="home-nav-actions" aria-label="Legal navigation">
            <button
              className={`home-link legal-nav-btn${tab === "privacy" ? " active" : ""}`}
              type="button"
              onClick={() => onSwitch("privacy")}
            >
              Privacy &amp; Cookies
            </button>
            <button
              className={`home-link legal-nav-btn${tab === "terms" ? " active" : ""}`}
              type="button"
              onClick={() => onSwitch("terms")}
            >
              Terms
            </button>
            <button className="button primary home-nav-start" type="button" onClick={onStart}>
              Open Studio
            </button>
          </nav>
        </div>
      </header>

      <main className="legal-main">
        <button className="legal-back" type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} />
          Back to home
        </button>

        {tab === "privacy" ? (
          <article className="legal-card">
            <h1>Privacy Policy (No Cookies)</h1>
            <p className="legal-updated">Effective &amp; last updated: November 2026 · Questions: <a href="https://github.com/cxernlol/code-to-diagram/issues" target="_blank" rel="noreferrer">GitHub Issues</a></p>

            <h2>1. Local-first storage &amp; no cookies</h2>
            <p>
              CTD Studio runs in your browser and sets zero cookies. Your diagrams, source code,
              manual box and line positions, version history, and theme preferences are stored
              locally in your browser&apos;s <code>IndexedDB</code> (<code>sgs-studio</code>). We
              use <code>localStorage</code> only to remember if you dismissed the storage notice and
              to migrate legacy <code>mstudio2</code> data. We do not operate a user database or
              store your diagrams on a server.
            </p>

            <h2>2. Hosting logs, analytics &amp; bundled assets</h2>
            <p>
              The hosted site runs on Vercel, which may retain standard HTTP server logs (such as IP
              addresses and request metadata) under Vercel&apos;s privacy policy, and uses
              cookieless Vercel Web Analytics for aggregate pageview counts. Mermaid (v12.3.0) and
              application scripts are bundled locally with no external CDN script or font loads.
            </p>

            <h2>3. Optional AI requests &amp; API key storage (BYOK)</h2>
            <p>
              API keys are stored locally in your browser&apos;s <code>IndexedDB</code> only and
              are never included in share URLs. Because browser storage can be read by scripts on
              this origin, use limited, revocable keys. When you trigger an AI action, your prompt,
              diagram source, and API key go directly from your browser to the provider endpoint you
              configure (OpenAI, DeepSeek, OpenRouter, Groq, Ollama, or a custom URL) under that
              provider&apos;s privacy policy.
            </p>

            <h2>4. Live rooms (PeerJS / WebRTC)</h2>
            <p>
              Live collaboration rooms (up to 5 devices) send diagram updates peer-to-peer over
              WebRTC. Establishing a connection uses PeerJS&apos;s third-party signaling server and
              STUN servers, which process room IDs and network metadata, and WebRTC connections can
              expose your IP address to other participants in the room. Anyone with the{" "}
              <code>#room=</code> link can join while the host session is open.
            </p>

            <h2>5. Share links &amp; GitHub star count</h2>
            <p>
              Share links encode your diagram source and manual layout in the URL hash (
              <code>#d=...&amp;l=...</code>). Hash fragments stay in the browser and are not sent
              to our server, though anyone with the link can view it, links cannot be revoked, and
              pasted links remain in browser history or chat logs. On the home page, your browser
              also makes a direct read-only request to <code>api.github.com</code> to fetch the star
              count for <code>cxernlol/code-to-diagram</code>, exposing your IP address to GitHub.
            </p>

            <h2>6. Deleting your data</h2>
            <p>
              Clearing site data for this origin in your browser settings permanently deletes all
              stored diagrams, layouts, and API keys with no server recovery. Export SVG/PNG or
              source backups of important diagrams.
            </p>
          </article>
        ) : (
          <article className="legal-card">
            <h1>Terms of Use</h1>
            <p className="legal-updated">
              Effective &amp; last updated: November 2026 ·{" "}
              <button type="button" className="cookie-link" onClick={() => onSwitch("privacy")}>
                Privacy Policy
              </button>{" "}
              ·{" "}
              <a href="https://github.com/cxernlol/code-to-diagram/issues" target="_blank" rel="noreferrer">
                GitHub Issues
              </a>
            </p>

            <h2>1. Your content &amp; MIT license</h2>
            <p>
              You retain full ownership and responsibility for all diagram source code, layouts, and
              exported SVG, PNG, or source files you create with CTD Studio. CTD Studio&apos;s
              application source code is licensed separately under the{" "}
              <a href="https://github.com/cxernlol/code-to-diagram/blob/main/LICENSE" target="_blank" rel="noreferrer">
                MIT License
              </a>
              .
            </p>

            <h2>2. No warranties, liability &amp; data loss</h2>
            <p>
              CTD Studio is free browser software provided &ldquo;as is&rdquo; without warranties of
              any kind, express or implied, including fitness for a particular purpose or
              uninterrupted availability. We are not liable for any lost diagrams, cleared browser
              storage, or damages arising from using the tool; export copies of important work.
            </p>

            <h2>3. Third-party AI providers &amp; live rooms</h2>
            <p>
              Connecting an AI API key is optional. AI actions send your diagram source, prompt, and
              key directly to your chosen provider, and any usage charges, rate limits, or content
              rules are strictly between you and that provider. Live rooms rely on third-party
              PeerJS/WebRTC signaling and allow anyone with the room link to join.
            </p>

            <h2>4. Share links, acceptable use &amp; changes</h2>
            <p>
              Share links encode your diagram source and layout in the URL hash (
              <code>#d=...</code>) so they are not stored on our server; anyone with the link can
              view the diagram, long diagrams produce long URLs, and shared links cannot be
              revoked. Do not use the hosted site to abuse third-party APIs or violate applicable
              law. We may modify or discontinue the hosted service at any time.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
