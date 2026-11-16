import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, GitBranch, Grid3x3, HardDrive, ImageDown, Star } from "lucide-react";

const GITHUB_URL = "https://github.com/cxernlol/sgs-chify";
const GITHUB_API_URL = "https://api.github.com/repos/cxernlol/sgs-chify";

interface HomePageProps {
  onStart: (templateName?: string) => void;
}

interface FormatDemo {
  id: string;
  label: string;
  file: string;
  template: string;
  code: string;
  diagram: ReactNode;
}

const FORMAT_DEMOS: FormatDemo[] = [
  {
    id: "mermaid",
    label: "Mermaid",
    file: "flowchart.mmd",
    template: "Flowchart",
    code: `flowchart TD
  Start([Source]) --> Check{Valid?}
  Check -->|Yes| Nodes[Drag Nodes]
  Check -->|No| Fix[Fix Syntax]`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="Mermaid flowchart preview">
        <defs>
          <marker id="home-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 140 50 L 140 76" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow)" />
        <path d="M 102 108 L 66 108 L 66 146" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow)" />
        <path d="M 178 108 L 214 108 L 214 146" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow)" />
        <rect x="94" y="18" width="92" height="32" rx="16" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="140" y="38" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="600">Source</text>
        <polygon points="140,78 178,108 140,138 102,108" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.5" />
        <text x="140" y="112" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="600">Valid?</text>
        <rect x="18" y="148" width="96" height="34" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="66" y="169" textAnchor="middle" fill="#1c3439" fontSize="11">Drag Nodes</text>
        <rect x="166" y="148" width="96" height="34" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="214" y="169" textAnchor="middle" fill="#1c3439" fontSize="11">Fix Syntax</text>
      </svg>
    ),
  },
  {
    id: "dot",
    label: "DOT",
    file: "service.dot",
    template: "DOT Graph",
    code: `digraph ServiceFlow {
  rankdir=LR;
  Client -> API [label="HTTPS"];
  API -> Auth;
  API -> DB;
}`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="Graphviz DOT service graph preview">
        <defs>
          <marker id="home-arrow-dot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 76 105 L 112 105" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-dot)" />
        <path d="M 162 92 L 180 92 L 180 56 L 198 56" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-dot)" />
        <path d="M 162 118 L 180 118 L 180 152 L 198 152" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-dot)" />
        <rect x="16" y="88" width="60" height="34" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="46" y="109" textAnchor="middle" fill="#1c3439" fontSize="11">Client</text>
        <polygon points="137,80 164,105 137,130 110,105" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.5" />
        <text x="137" y="109" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="600">API</text>
        <rect x="200" y="39" width="64" height="34" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="232" y="60" textAnchor="middle" fill="#1c3439" fontSize="11">Auth</text>
        <rect x="200" y="135" width="64" height="34" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="232" y="156" textAnchor="middle" fill="#1c3439" fontSize="11">DB</text>
      </svg>
    ),
  },
  {
    id: "sql",
    label: "SQL",
    file: "schema.sql",
    template: "SQL Schema",
    code: `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255)
);
CREATE TABLE projects (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id)
);`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="SQL schema ER diagram preview">
        <path d="M 108 105 L 172 105" stroke="#315158" strokeWidth="1.6" fill="none" />
        <line x1="116" y1="98" x2="116" y2="112" stroke="#315158" strokeWidth="1.6" />
        <path d="M 172 105 L 160 98 M 172 105 L 160 112" stroke="#315158" strokeWidth="1.5" fill="none" />
        <rect x="18" y="62" width="90" height="86" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <rect x="18" y="62" width="90" height="24" rx="4" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.4" />
        <text x="63" y="78" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">users</text>
        <text x="28" y="106" fill="#1c3439" fontSize="10">PK  id</text>
        <text x="28" y="126" fill="#5a6d6f" fontSize="10">    email</text>
        <rect x="172" y="62" width="90" height="86" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <rect x="172" y="62" width="90" height="24" rx="4" fill="#eef2ef" stroke="#315158" strokeWidth="1.4" />
        <text x="217" y="78" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">projects</text>
        <text x="182" y="106" fill="#1c3439" fontSize="10">PK  id</text>
        <text x="182" y="126" fill="#5a6d6f" fontSize="10">FK  user_id</text>
      </svg>
    ),
  },
  {
    id: "ts",
    label: "TypeScript",
    file: "models.ts",
    template: "TypeScript Types",
    code: `interface User {
  id: string;
  email: string;
}
interface Diagram {
  id: string;
  owner: User;
}`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="TypeScript class diagram preview">
        <defs>
          <marker id="home-arrow-ts" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 164 105 L 116 105" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-ts)" />
        <rect x="20" y="64" width="94" height="82" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <line x1="20" y1="88" x2="114" y2="88" stroke="#315158" strokeWidth="1.2" />
        <text x="67" y="80" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">User</text>
        <text x="30" y="108" fill="#1c3439" fontSize="10">+string id</text>
        <text x="30" y="126" fill="#5a6d6f" fontSize="10">+string email</text>
        <rect x="166" y="64" width="94" height="82" rx="4" fill="#ffffff" stroke="#ad612e" strokeWidth="1.5" />
        <line x1="166" y1="88" x2="260" y2="88" stroke="#ad612e" strokeWidth="1.2" />
        <text x="213" y="80" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">Diagram</text>
        <text x="176" y="108" fill="#1c3439" fontSize="10">+string id</text>
        <text x="176" y="126" fill="#5a6d6f" fontSize="10">+User owner</text>
      </svg>
    ),
  },
  {
    id: "puml",
    label: "PlantUML",
    file: "account.puml",
    template: "PlantUML Class",
    code: `@startuml
class Account {
  +String email
  +login()
}
Account "1" --> "*" Workspace
@enduml`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="PlantUML class diagram preview">
        <defs>
          <marker id="home-arrow-puml" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 114 105 L 164 105" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-puml)" />
        <rect x="18" y="62" width="96" height="86" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <line x1="18" y1="86" x2="114" y2="86" stroke="#315158" strokeWidth="1.2" />
        <text x="66" y="78" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">Account</text>
        <text x="28" y="106" fill="#1c3439" fontSize="10">+String email</text>
        <text x="28" y="126" fill="#5a6d6f" fontSize="10">+login()</text>
        <rect x="166" y="70" width="96" height="70" rx="4" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.5" />
        <line x1="166" y1="94" x2="262" y2="94" stroke="#ad612e" strokeWidth="1.2" />
        <text x="214" y="86" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="700">Workspace</text>
        <text x="176" y="116" fill="#1c3439" fontSize="10">+exportSvg()</text>
      </svg>
    ),
  },
  {
    id: "d2",
    label: "D2",
    file: "pipeline.d2",
    template: "D2 Flow",
    code: `direction: right
Browser -> Compiler: code
Compiler -> Canvas: AST
Canvas -> Export: SVG/PNG`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="D2 pipeline preview">
        <defs>
          <marker id="home-arrow-d2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 96 56 L 182 56" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-d2)" />
        <path d="M 222 74 L 222 134" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-d2)" />
        <path d="M 182 152 L 98 152" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-d2)" />
        <rect x="16" y="38" width="80" height="36" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="56" y="60" textAnchor="middle" fill="#1c3439" fontSize="11">Browser</text>
        <rect x="184" y="38" width="80" height="36" rx="4" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.5" />
        <text x="224" y="60" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="600">Compiler</text>
        <rect x="184" y="134" width="80" height="36" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="224" y="156" textAnchor="middle" fill="#1c3439" fontSize="11">Canvas</text>
        <rect x="16" y="134" width="80" height="36" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="56" y="156" textAnchor="middle" fill="#1c3439" fontSize="11">Export</text>
      </svg>
    ),
  },
];

export function HomePage({ onStart }: HomePageProps) {
  const [activeFormat, setActiveFormat] = useState(FORMAT_DEMOS[0]!);
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(GITHUB_API_URL, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((repo: { stargazers_count?: unknown } | null) => {
        if (typeof repo?.stargazers_count === "number") {
          setStars(repo.stargazers_count);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

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
              <Star aria-hidden="true" size={14} />
              <span>Star on GitHub</span>
              {stars !== null && <span className="home-star-pill">{stars}</span>}
            </a>
            <button className="button primary home-nav-start" type="button" onClick={() => onStart()}>
              Start
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Local-first code to diagrams</p>
            <h1 id="home-title">Write code. Drag boxes and lines into place.</h1>
            <p className="home-lead">
              Paste Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, or TypeScript interfaces and
              reposition every node and connector by hand. Your work stays in your browser with no
              account required.
            </p>
            <div className="home-cta-row">
              <button className="button primary home-cta-start" type="button" onClick={() => onStart()}>
                Start
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <a
                className="button secondary home-cta-github"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                <Star aria-hidden="true" size={15} className="home-star-icon" />
                <span>Star on GitHub</span>
                {stars !== null && <span className="home-star-count">{stars}</span>}
              </a>
            </div>
          </div>

          <div className="home-preview-card">
            <div className="home-preview-bar">
              <div className="home-format-tabs" role="tablist" aria-label="Code format examples">
                {FORMAT_DEMOS.map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    role="tab"
                    aria-selected={activeFormat.id === demo.id}
                    className={`home-format-tab${activeFormat.id === demo.id ? " active" : ""}`}
                    onClick={() => setActiveFormat(demo)}
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="home-open-template"
                onClick={() => onStart(activeFormat.template)}
              >
                Open {activeFormat.label}
                <ArrowRight aria-hidden="true" size={13} />
              </button>
            </div>
            <div className="home-preview-split">
              <div className="home-preview-code">
                <div className="home-preview-file">{activeFormat.file}</div>
                <pre>{activeFormat.code}</pre>
              </div>
              <div className="home-preview-canvas">
                {activeFormat.diagram}
              </div>
            </div>
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
