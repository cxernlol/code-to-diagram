import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
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
  { format: "Graphviz DOT", scope: "digraph / graph, rankdir, node label & shape (diamond, circle, doublecircle, ellipse, oval, cylinder), and -> / -- edges." },
  { format: "PlantUML", scope: "@startuml blocks for sequence (actor/participant), state ([*] transitions), and class (<|--, *--, o--, ..>, -->)." },
  { format: "D2", scope: "direction, nested { ... } containers, .shape, and -> / <- / <-> / -- edges with labels." },
  { format: "SQL DDL", scope: "CREATE TABLE columns, PRIMARY KEY, and FOREIGN KEY / REFERENCES into Mermaid ER." },
  { format: "TypeScript", scope: "interface, class, and object type declarations with extends / implements into Mermaid class diagrams." },
  { format: "XML", scope: "Explicit <diagram>, Draw.io mxGraphModel, BPMN sequenceFlow, and generic XML element trees." },
];

interface FormatSyntaxGuide {
  id: string;
  label: string;
  template: string;
  summary: string;
  items: { syntax: string; meaning: string }[];
  example: string;
}

const FORMAT_GUIDES: FormatSyntaxGuide[] = [
  {
    id: "mermaid",
    label: "Mermaid",
    template: "Flowchart",
    summary: "Native Mermaid v11.4.1 renderer with draggable boxes and connectors for flowchart, class, state, and ER.",
    items: [
      { syntax: "A --> B / A -.-> B", meaning: "Solid arrow / dotted arrow (async or optional)" },
      { syntax: "A ==> B / A --- B", meaning: "Thick arrow / line without arrowhead" },
      { syntax: "id[Box] / id{Check}", meaning: "Rectangle / diamond decision" },
      { syntax: "id([Pill]) / id[(DB)]", meaning: "Stadium start-end / database cylinder" },
    ],
    example: `flowchart LR
  Client([Web App]) --> API[Gateway]
  API --> Auth{Valid?}
  Auth -->|Yes| DB[(Postgres)]
  Auth -.->|Log| Audit[Audit Queue]`,
  },
  {
    id: "dot",
    label: "Graphviz DOT",
    template: "DOT Graph",
    summary: "Compiles digraph/graph blocks, rankdir, node attributes, and chained edges into Mermaid flowcharts.",
    items: [
      { syntax: "digraph G { rankdir=LR; }", meaning: "Directed graph with left-to-right layout" },
      { syntax: "A -> B -> C [label=\"ok\"]", meaning: "Chained directed edges with label" },
      { syntax: "A -> B [style=dashed]", meaning: "Dotted/dashed edge (style=dotted also works)" },
      { syntax: "N [shape=diamond, label=\"?\"]", meaning: "Shapes: diamond, circle, ellipse, cylinder" },
    ],
    example: `digraph Architecture {
  rankdir=LR;
  Web [label="Web App"];
  Check [label="Valid?", shape=diamond];
  DB [label="Postgres", shape=cylinder];
  Web -> Check -> DB [label="SQL"];
  Check -> Web [label="401", style=dashed];
}`,
  },
  {
    id: "plantuml",
    label: "PlantUML",
    template: "PlantUML Class",
    summary: "Parses @startuml sequence, state, and class diagrams with relationships and visibility.",
    items: [
      { syntax: "A <|-- B / A *-- B", meaning: "Class inheritance / composition (also o--, ..>)" },
      { syntax: "A ->> B / A -->> B", meaning: "Sequence solid call / dashed reply" },
      { syntax: "[*] --> Idle", meaning: "State diagram initial/final transitions" },
      { syntax: "class User { +id: string }", meaning: "Class, interface, enum, or abstract class block" },
    ],
    example: `@startuml
class Service {
  +handle()
}
class AuthService
Service <|-- AuthService
AuthService ..> TokenStore : verifies
@enduml`,
  },
  {
    id: "d2",
    label: "D2",
    template: "D2 Flow",
    summary: "Parses D2 nodes, arrows, labels, shapes, direction, and nested { ... } containers.",
    items: [
      { syntax: "direction: right", meaning: "Set layout direction (right, left, down, up)" },
      { syntax: "a -> b: HTTPS", meaning: "Labeled edge (also <-, <->, --)" },
      { syntax: "db.shape: cylinder", meaning: "Node shape (diamond, circle, cylinder, oval)" },
      { syntax: "vpc: VPC { api -> db }", meaning: "Nested container / subgraph block" },
    ],
    example: `direction: right
client: Web App
api: API Gateway
db.shape: cylinder
client -> api: HTTPS
api -> db: Query`,
  },
  {
    id: "sql",
    label: "SQL DDL",
    template: "SQL Schema",
    summary: "Parses CREATE TABLE statements, primary keys, and foreign key references into Mermaid ER diagrams.",
    items: [
      { syntax: "CREATE TABLE users (...)", meaning: "Creates an ER entity table" },
      { syntax: "id INT PRIMARY KEY", meaning: "Marks column as PK" },
      { syntax: "user_id INT REFERENCES users(id)", meaning: "Inline FK + ||--o{ relationship" },
      { syntax: "FOREIGN KEY (x) REFERENCES y(id)", meaning: "Table-level foreign key relationship" },
    ],
    example: `CREATE TABLE users (
  id INT PRIMARY KEY,
  email TEXT
);
CREATE TABLE diagrams (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  title TEXT
);`,
  },
  {
    id: "typescript",
    label: "TypeScript",
    template: "TypeScript Types",
    summary: "Converts TypeScript interfaces, classes, and object types into Mermaid class diagrams.",
    items: [
      { syntax: "interface A extends B", meaning: "Class box + inheritance (<|--)" },
      { syntax: "class C implements A", meaning: "Class box + interface link" },
      { syntax: "type User = { id: string }", meaning: "Object type alias as class box" },
      { syntax: "owner: User", meaning: "PascalCase property type adds association (-->)" },
    ],
    example: `interface Node {
  id: string;
}
interface User {
  id: string;
}
class Diagram implements Node {
  id: string;
  owner: User;
  render(): string;
}`,
  },
  {
    id: "xml",
    label: "XML",
    template: "XML Diagram",
    summary: "Supports explicit <diagram> XML, Draw.io mxGraphModel, BPMN 2.0 sequenceFlow, and generic XML trees.",
    items: [
      { syntax: "<diagram direction=\"LR\">", meaning: "Explicit diagram root (flowchart, class, er)" },
      { syntax: "<node id=\"A\" shape=\"diamond\"/>", meaning: "Node with optional label and shape" },
      { syntax: "<edge from=\"A\" to=\"B\" style=\"dashed\"/>", meaning: "Solid or dashed/dotted connector" },
      { syntax: "<mxGraphModel> / <sequenceFlow>", meaning: "Draw.io cells & BPMN flows auto-detected" },
    ],
    example: `<diagram kind="flowchart" direction="LR">
  <node id="Client" label="Web App" />
  <node id="API" shape="diamond" />
  <node id="DB" shape="cylinder" />
  <edge from="Client" to="API" label="HTTPS" />
  <edge from="API" to="DB" style="dashed" />
</diagram>`,
  },
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
  const reduceMotion = useReducedMotion();
  const [activeGuideId, setActiveGuideId] = useState(FORMAT_GUIDES[0]!.id);
  const activeGuide = FORMAT_GUIDES.find((g) => g.id === activeGuideId) ?? FORMAT_GUIDES[0]!;

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

        <article className="legal-card docs-format-guide" aria-label="Syntax by format">
          <div className="docs-guide-head">
            <div>
              <h2>Syntax by Format (All 7 Languages)</h2>
              <p>{activeGuide.summary}</p>
            </div>
            <button
              type="button"
              className="home-open-template"
              onClick={() => onStart(activeGuide.template)}
            >
              Try {activeGuide.label} in editor
              <ArrowRight aria-hidden="true" size={13} />
            </button>
          </div>
          <div className="home-format-tabs docs-guide-tabs" role="tablist" aria-label="Format syntax tabs">
            {FORMAT_GUIDES.map((guide, index) => {
              const active = guide.id === activeGuide.id;
              return (
                <button
                  key={guide.id}
                  id={`docs-guide-tab-${guide.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="docs-guide-panel"
                  tabIndex={active ? 0 : -1}
                  className={`home-format-tab${active ? " active" : ""}`}
                  onClick={() => setActiveGuideId(guide.id)}
                  onKeyDown={(event) => {
                    let nextIndex: number | null = null;
                    if (event.key === "ArrowRight") nextIndex = (index + 1) % FORMAT_GUIDES.length;
                    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + FORMAT_GUIDES.length) % FORMAT_GUIDES.length;
                    else if (event.key === "Home") nextIndex = 0;
                    else if (event.key === "End") nextIndex = FORMAT_GUIDES.length - 1;
                    if (nextIndex === null) return;
                    event.preventDefault();
                    const nextGuide = FORMAT_GUIDES[nextIndex]!;
                    setActiveGuideId(nextGuide.id);
                    document.getElementById(`docs-guide-tab-${nextGuide.id}`)?.focus();
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="docs-syntax-pill"
                      className="home-format-pill"
                      transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                    />
                  )}
                  <span className="home-format-label">{guide.label}</span>
                </button>
              );
            })}
          </div>
          <div
            id="docs-guide-panel"
            role="tabpanel"
            aria-labelledby={`docs-guide-tab-${activeGuide.id}`}
            className="docs-guide-split"
          >
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Syntax</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {activeGuide.items.map((item) => (
                  <tr key={item.syntax}>
                    <td><code>{item.syntax}</code></td>
                    <td>{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre className="docs-template-code docs-guide-code">{activeGuide.example}</pre>
          </div>
        </article>

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
