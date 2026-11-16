import { ArrowRight, ExternalLink, GitBranch, Grid3x3, HardDrive, ImageDown } from "lucide-react";

const GITHUB_URL = "https://github.com/cxernlol/sgs-chify";

interface HomePageProps {
  onStart: () => void;
}

export function HomePage({ onStart }: HomePageProps) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="home-brand">
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="home-brand-name">SGS Studio</span>
          </div>
          <nav className="home-nav-actions" aria-label="Primary">
            <a
              className="home-link"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
              <ExternalLink aria-hidden="true" size={14} />
            </a>
            <button className="button primary home-nav-start" type="button" onClick={onStart}>
              Start
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Local-first Mermaid workbench</p>
            <h1 id="home-title">Write Mermaid diagrams. Drag boxes and lines into place.</h1>
            <p className="home-lead">
              Edit source code beside a live canvas where every node and connector can be
              repositioned by hand. Your work stays in your browser with no account required.
            </p>
            <div className="home-cta-row">
              <button className="button primary home-cta-start" type="button" onClick={onStart}>
                Start
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <a
                className="button secondary home-cta-github"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            </div>
          </div>

          <div className="home-preview-card" aria-hidden="true">
            <div className="home-preview-bar">
              <span className="home-preview-dot" />
              <span className="home-preview-dot" />
              <span className="home-preview-dot" />
              <span className="home-preview-title">flowchart.mmd</span>
            </div>
            <svg viewBox="0 0 420 260" className="home-preview-svg" role="img">
              <defs>
                <marker id="home-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
                </marker>
              </defs>
              <path d="M 210 56 L 210 92" stroke="#315158" strokeWidth="1.75" fill="none" markerEnd="url(#home-arrow)" />
              <path d="M 164 128 L 104 128 L 104 176" stroke="#315158" strokeWidth="1.75" fill="none" markerEnd="url(#home-arrow)" />
              <path d="M 256 128 L 316 128 L 316 176" stroke="#315158" strokeWidth="1.75" fill="none" markerEnd="url(#home-arrow)" />

              <rect x="148" y="20" width="124" height="36" rx="18" fill="#ffffff" stroke="#315158" strokeWidth="1.5" />
              <text x="210" y="42" textAnchor="middle" fill="#1c3439" fontSize="12" fontWeight="600">Mermaid source</text>

              <polygon points="210,94 260,128 210,162 160,128" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.6" />
              <text x="210" y="132" textAnchor="middle" fill="#1c3439" fontSize="12" fontWeight="600">Layout?</text>

              <rect x="44" y="178" width="120" height="40" rx="5" fill="#ffffff" stroke="#315158" strokeWidth="1.5" />
              <text x="104" y="202" textAnchor="middle" fill="#1c3439" fontSize="12">Drag nodes</text>

              <rect x="256" y="178" width="120" height="40" rx="5" fill="#ffffff" stroke="#315158" strokeWidth="1.5" />
              <text x="316" y="202" textAnchor="middle" fill="#1c3439" fontSize="12">Export SVG</text>
            </svg>
          </div>
        </section>

        <section className="home-features" aria-label="Capabilities">
          <article className="home-feature">
            <Grid3x3 aria-hidden="true" size={18} />
            <h2>Move boxes and lines</h2>
            <p>
              Drag nodes or connector segments in flowcharts, class, state, and ER diagrams with
              grid snapping and one-click layered arrangement.
            </p>
          </article>
          <article className="home-feature">
            <HardDrive aria-hidden="true" size={18} />
            <h2>Saved in your browser</h2>
            <p>
              Diagrams, manual positions, and theme settings live in IndexedDB. No sign-in, no
              cloud lock-in, and no subscription limits.
            </p>
          </article>
          <article className="home-feature">
            <ImageDown aria-hidden="true" size={18} />
            <h2>Clean export and BYOK AI</h2>
            <p>
              Export full-bounds SVG or PNG files, share diagrams via URL, or plug in your own AI
              provider key directly from the browser.
            </p>
          </article>
        </section>
      </main>

      <footer className="home-footer">
        <span>SGS Studio</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          github.com/cxernlol/sgs-chify
        </a>
      </footer>
    </div>
  );
}
