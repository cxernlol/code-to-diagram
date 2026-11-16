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
            <span className="home-brand-name">SGS Studio</span>
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
            <h1>Privacy Policy &amp; Minimal Cookies</h1>
            <p className="legal-updated">Effective: November 2026</p>

            <h2>1. Local-first by design</h2>
            <p>
              SGS Studio runs in your browser. Your diagrams, source code, manual box and line
              positions, version history, and theme preferences are stored locally on your device
              using IndexedDB. We do not collect, upload, or store your diagrams on any server.
            </p>

            <h2>2. Minimal cookies and browser storage</h2>
            <p>
              SGS Studio sets zero advertising, analytics, or cross-site tracking cookies. We only
              use essential browser storage (<code>IndexedDB</code> and <code>localStorage</code>)
              to save your workspace, migrate legacy <code>mstudio2</code> data, and remember if
              you dismissed the storage notice.
            </p>

            <h2>3. Optional AI requests (BYOK)</h2>
            <p>
              If you configure an AI provider and trigger an AI action, your prompt, diagram
              source, and API key are sent directly from your browser to the endpoint you selected
              (such as OpenAI, DeepSeek, OpenRouter, Groq, Ollama, or a custom URL). Those
              requests are governed by that provider&apos;s privacy policy.
            </p>

            <h2>4. Public GitHub star count</h2>
            <p>
              The home page makes a single read-only request to GitHub&apos;s public repository API
              to display the current star count for <code>cxernlol/sgs-chify</code>.
            </p>

            <h2>5. Deleting your data</h2>
            <p>
              You can clear all stored diagrams and settings at any time by clearing site data for
              this origin in your browser settings.
            </p>
          </article>
        ) : (
          <article className="legal-card">
            <h1>Terms of Use</h1>
            <p className="legal-updated">Effective: November 2026</p>

            <h2>1. Your content</h2>
            <p>
              You retain full ownership and responsibility for all diagram source code, layouts, and
              exported SVG, PNG, or source files you create with SGS Studio.
            </p>

            <h2>2. Open-source software</h2>
            <p>
              SGS Studio is free browser software provided &ldquo;as is&rdquo; without warranties of
              any kind, express or implied, including fitness for a particular purpose or
              uninterrupted availability.
            </p>

            <h2>3. Third-party AI providers</h2>
            <p>
              Connecting your own AI API key is optional. Any usage charges, rate limits, or
              content terms for those requests are strictly between you and your chosen provider.
            </p>

            <h2>4. Share links</h2>
            <p>
              Share links encode your diagram source and manual layout directly in the URL hash
              (<code>#d=...</code>). Anyone with that link can view the encoded diagram.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
