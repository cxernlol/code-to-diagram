import { ArrowLeft, ArrowRight, BookOpen, GitBranch } from "lucide-react";
import { TEMPLATES } from "./constants";

interface DocsPageProps {
  onBack: () => void;
  onStart: (templateName?: string) => void;
  onLegal: (tab: "privacy" | "terms") => void;
}

const ARROW_SYNTAX = [
  { syntax: "A --> B", meaning: "Solid arrow (standard flow)" },
  { syntax: "A -.-> B", meaning: "Dotted arrow (optional, async, or weak dependency)" },
  { syntax: "A ==> B", meaning: "Thick arrow (primary or emphasized path)" },
  { syntax: "A --- B", meaning: "Solid line without arrowhead" },
  { syntax: "A -->|Yes| B", meaning: "Labeled arrow (also works as A -.->|opt| B)" },
  { syntax: "A <|-- B", meaning: "Class inheritance (B extends A)" },
  { syntax: "A *-- B", meaning: "Class composition (A owns B)" },
  { syntax: "A o-- B", meaning: "Class aggregation (A groups B)" },
  { syntax: "A ..> B", meaning: "Class dependency (dotted arrow)" },
  { syntax: "A ->> B / A -->> B", meaning: "Sequence solid request / dashed reply" },
  { syntax: "A ||--o{ B", meaning: "ER one-to-many relationship" },
];

const SHAPE_SYNTAX = [
  { syntax: "id[Process]", shape: "Rectangle", use: "Standard step or service" },
  { syntax: "id([Start])", shape: "Stadium (pill)", use: "Start or end state" },
  { syntax: "id{Valid?}", shape: "Diamond", use: "Decision / branch" },
  { syntax: "id[/Output/]", shape: "Parallelogram", use: "Input or output" },
  { syntax: "id[(Database)]", shape: "Cylinder", use: "Database or store" },
  { syntax: "id((Node))", shape: "Circle", use: "Connector or event" },
];

const FORMAT_SUPPORT = [
  { format: "Mermaid (v11.4.1)", scope: "Full local runtime: flowchart, class, state, ER, sequence, gantt, mindmap, pie, journey, gitGraph, C4, requirement." },
  { format: "Graphviz DOT", scope: "digraph / graph, rankdir, node labels & shapes, and -> / -- edges." },
  { format: "PlantUML", scope: "@startuml blocks for class, sequence, and flowchart nodes/edges." },
  { format: "D2", scope: "Nodes, -> / -- / <-> edges with labels, and nested container blocks." },
  { format: "SQL DDL", scope: "CREATE TABLE columns, PRIMARY KEY, and FOREIGN KEY / REFERENCES into Mermaid ER." },
  { format: "TypeScript", scope: "interface, class, and type blocks with extends / implements into Mermaid class diagrams." },
  { format: "XML", scope: "Explicit <diagram>, Draw.io mxGraphModel, BPMN, and generic XML element trees." },
];

const FEATURED_TEMPLATES = [
  "Flowchart",
  "API Auth Flow",
  "CI/CD Pipeline",
  "Microservices Flow",
  "Checkout Sequence",
  "Class",
  "Sequence",
  "ER",
  "DOT Graph",
  "PlantUML Class",
  "D2 Flow",
  "SQL Schema",
  "TypeScript Types",
  "XML Diagram",
] as const;

export function DocsPage({ onBack, onStart, onLegal }: DocsPageProps) {
  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <button type="button" className="home-brand home-brand-btn" onClick={onBack}>
            <span className="brand-mark">
              <GitBranch aria-hidden="true" size={17} />
            </span>
            <span className="home-brand-name">CTD Studio</span>
          </button>
          <nav className="home-nav-actions" aria-label="Documentation navigation">
            <button type="button" className="home-link" onClick={onBack}>
              <ArrowLeft aria-hidden="true" size={14} />
              <span>Home</span>
            </button>
            <button type="button" className="button primary home-nav-start" onClick={() => onStart()}>
              Start
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main className="docs-main">
        <header className="docs-hero">
          <span className="home-eyebrow">
            <BookOpen aria-hidden="true" size={13} /> Reference
          </span>
          <h1>Syntax &amp; Template Docs</h1>
          <p>
            Quick guide to arrows (like <code>-.-&gt;</code> dotted links), node shapes, supported
            code formats, and starter templates you can open directly in the editor.
          </p>
        </header>

        <section className="docs-grid" aria-label="Arrows and shapes reference">
          <article className="legal-card">
            <h2>Arrows &amp; Connectors</h2>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Syntax</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ARROW_SYNTAX.map((item) => (
                  <tr key={item.syntax}>
                    <td><code>{item.syntax}</code></td>
                    <td>{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="legal-card">
            <h2>Flowchart Shapes</h2>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Syntax</th>
                  <th>Shape</th>
                  <th>Typical use</th>
                </tr>
              </thead>
              <tbody>
                {SHAPE_SYNTAX.map((item) => (
                  <tr key={item.syntax}>
                    <td><code>{item.syntax}</code></td>
                    <td>{item.shape}</td>
                    <td>{item.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </section>

        <article className="legal-card">
          <h2>Supported Formats (7)</h2>
          <p>
            CTD Studio auto-detects the input format as you type, compiles non-Mermaid formats into
            Mermaid, and lets you convert between formats via <strong>Convert to…</strong> or{" "}
            <code>ctd-mcp</code>.
          </p>
          <table className="docs-table">
            <thead>
              <tr>
                <th>Format</th>
                <th>Supported syntax</th>
              </tr>
            </thead>
            <tbody>
              {FORMAT_SUPPORT.map((item) => (
                <tr key={item.format}>
                  <td><strong>{item.format}</strong></td>
                  <td>{item.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <section className="docs-templates" aria-label="Starter templates">
          <div className="docs-section-head">
            <h2>Starter Templates</h2>
            <p>Click any template to open it in the interactive workbench.</p>
          </div>
          <div className="docs-template-grid">
            {FEATURED_TEMPLATES.map((name) => (
              <article key={name} className="docs-template-card">
                <div className="docs-template-head">
                  <h3>{name}</h3>
                  <button
                    type="button"
                    className="home-open-template"
                    onClick={() => onStart(name)}
                  >
                    Try in editor
                    <ArrowRight aria-hidden="true" size={13} />
                  </button>
                </div>
                <pre className="docs-template-code">{TEMPLATES[name]}</pre>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>CTD Studio</span>
        <div className="home-footer-links">
          <button type="button" className="home-footer-btn" onClick={() => onLegal("privacy")}>
            Privacy &amp; Cookies
          </button>
          <button type="button" className="home-footer-btn" onClick={() => onLegal("terms")}>
            Terms
          </button>
          <a href="https://github.com/cxernlol/code-to-diagram" target="_blank" rel="noreferrer">
            github.com/cxernlol/code-to-diagram
          </a>
        </div>
      </footer>
    </div>
  );
}
