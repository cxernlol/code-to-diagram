import { ArrowLeft, ArrowRight, BookOpen, GitBranch } from "lucide-react";

interface NotFoundPageProps {
  path: string;
  onHome: () => void;
  onStart: () => void;
  onDocs: () => void;
}

export function NotFoundPage({ path, onHome, onStart, onDocs }: NotFoundPageProps) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <button className="home-brand home-brand-btn" type="button" onClick={onHome}>
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="home-brand-name">CTD Studio</span>
          </button>
          <nav className="home-nav-actions" aria-label="404 navigation">
            <button type="button" className="home-link" onClick={onDocs}>
              <BookOpen aria-hidden="true" size={14} />
              <span>Docs</span>
            </button>
            <button className="button primary home-nav-start" type="button" onClick={onStart}>
              Open Studio
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main className="legal-main">
        <article className="legal-card not-found-card">
          <span className="home-eyebrow">404 · Route not found</span>
          <h1>This diagram node isn&apos;t connected.</h1>
          <p>
            No page exists at <code>{path || "/"}</code>. Jump back to the landing page, open the
            interactive diagram studio, or browse syntax and template docs.
          </p>

          <div className="not-found-diagram" aria-hidden="true">
            <span className="not-found-node">Home</span>
            <span className="not-found-edge">-.-&gt;</span>
            <span className="not-found-node missing">404</span>
          </div>

          <div className="home-cta-row">
            <button className="button primary" type="button" onClick={onHome}>
              <ArrowLeft aria-hidden="true" size={15} />
              Back to home
            </button>
            <button className="button secondary" type="button" onClick={onStart}>
              Open Studio
              <ArrowRight aria-hidden="true" size={15} />
            </button>
            <button className="button secondary" type="button" onClick={onDocs}>
              <BookOpen aria-hidden="true" size={15} />
              Syntax Docs
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}
