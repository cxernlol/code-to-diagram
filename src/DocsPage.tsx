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
  { diagram: "Flowchart", syntax: "A --> B", meaning: "Solid arrow (standard flow)" },
  { diagram: "Flowchart", syntax: "A -.-> B", meaning: "Dotted arrow (optional, async, or weak dependency)" },
  { diagram: "Flowchart", syntax: "A ==> B", meaning: "Thick arrow (primary or emphasized path)" },
  { diagram: "Flowchart", syntax: "A --- B", meaning: "Solid line without arrowhead" },
  { diagram: "Flowchart", syntax: "A -->|Yes| B", meaning: "Labeled arrow (also works as A -.->|opt| B)" },
  { diagram: "Class", syntax: "A <|-- B", meaning: "Inheritance (B extends A)" },
  { diagram: "Class", syntax: "A *-- B", meaning: "Composition (A owns B)" },
  { diagram: "Class", syntax: "A o-- B", meaning: "Aggregation (A groups B)" },
  { diagram: "Class", syntax: "A ..> B", meaning: "Dependency (dotted arrow)" },
  { diagram: "Sequence", syntax: "A ->> B / A -->> B", meaning: "Solid request / dashed reply" },
  { diagram: "ER", syntax: "A ||--o{ B", meaning: "One-to-many relationship" },
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
  {
    format: "Mermaid (v11.4.1)",
    scope: "Full Mermaid v11.4.1 runtime for rendering. IR translation (Convert to...) supports flowchart/graph, classDiagram, erDiagram, and sequenceDiagram.",
    omissions: "gantt, mindmap, pie, journey, gitGraph, C4, and requirement render natively but are not translated by Convert to....",
  },
  {
    format: "Graphviz DOT",
    scope: "(strict) (di)graph, rankdir, node label & shape (diamond, circle, doublecircle, ellipse, oval, cylinder), chained -> / -- edges with label & style=dashed|dotted.",
    omissions: "subgraph blocks, default node/edge/graph attribute statements, HTML-like labels, and record port layouts.",
  },
  {
    format: "PlantUML",
    scope: "@startuml blocks: sequence (actor/participant, ->>/-->>), state ([*] transitions), and class (<|--, *--, o--, ..>, --> with optional multiplicity quotes).",
    omissions: "Activity, component, deployment, and use-case diagrams; note, alt/loop fragments, package nesting, and skinparam.",
  },
  {
    format: "D2",
    scope: "direction (right/left/down/up), nested { ... } containers, id: label, id.shape, edges (->, <-, <->, --) with labels, and # comments.",
    omissions: "sql_table/class shape blocks, style rules, icon, link, near, grid-*, and vars/layers/scenarios.",
  },
  {
    format: "SQL DDL",
    scope: "CREATE TABLE [IF NOT EXISTS] into Mermaid ER: columns, PRIMARY KEY (PK), inline REFERENCES, and table-level FOREIGN KEY ... REFERENCES.",
    omissions: "ALTER TABLE, views, indexes, ENUMs, triggers/functions, and CHECK/UNIQUE details.",
  },
  {
    format: "TypeScript",
    scope: "[export] interface, class, and object type declarations; extends/implements (<|--), PascalCase property references (-->), properties, and methods.",
    omissions: "Generic type parameters (<T>), non-object union/intersection type aliases, enums, functions, and imports.",
  },
  {
    format: "XML",
    scope: "Draw.io mxGraphModel (mxCell), BPMN 2.0 (sequenceFlow, events, gateways, tasks), explicit <diagram>/<graph>/<schema>, and generic XML trees.",
    omissions: "Draw.io styling/coordinates beyond shapes & dashed edges; BPMN pools/lanes/message flows; XML namespaces/XSD validation.",
  },
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
    template: "API Auth Flow",
    summary: "Blocks, subgraphs, sequence fragments, and per-node styling in Mermaid v11.4.1.",
    items: [
      { syntax: "subgraph Edge ... end", meaning: "Group nodes inside a labeled container" },
      { syntax: "alt Ok ... else Err ... end", meaning: "Conditional branches in sequenceDiagram" },
      { syntax: "loop Retry ... end", meaning: "Repeated block in sequenceDiagram" },
      { syntax: "style ID fill:#eaf1f8,stroke:#2c5d8a", meaning: "Custom node fill/stroke (preserved on export)" },
    ],
    example: `flowchart LR
  subgraph API[Edge Layer]
    GW[Gateway] --> Auth{Valid?}
  end
  Auth -->|Yes| App[Handler]
  Auth -.->|401| Err([Unauthorized])
  style Auth fill:#fef3e6,stroke:#ad612e`,
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
  "State",
  "Class",
  "ER",
  "DOT Graph",
  "PlantUML Class",
  "D2 Flow",
  "SQL Schema",
  "TypeScript Types",
  "XML Diagram",
  "BPMN Flow",
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
                  <th>Diagram</th>
                  <th>Syntax</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ARROW_SYNTAX.map((item) => (
                  <tr key={item.syntax}>
                    <td><strong>{item.diagram}</strong></td>
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
            {FORMAT_GUIDES.map((guide) => {
              const active = guide.id === activeGuide.id;
              return (
                <button
                  key={guide.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`home-format-tab${active ? " active" : ""}`}
                  onClick={() => setActiveGuideId(guide.id)}
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
          <div className="docs-guide-split">
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
                <th>What is parsed &amp; rendered</th>
                <th>Notable omissions</th>
              </tr>
            </thead>
            <tbody>
              {FORMAT_SUPPORT.map((item) => (
                <tr key={item.format}>
                  <td><strong>{item.format}</strong></td>
                  <td>{item.scope}</td>
                  <td>{item.omissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <section className="docs-grid" aria-label="Workbench and MCP guide">
          <article className="legal-card">
            <h2>Using the Workbench</h2>
            <ul className="docs-list">
              <li><strong>Drag boxes &amp; lines:</strong> Switch to Move (<code>V</code>) to drag nodes or connector segments in flowchart, class, state, and ER diagrams, or Pan (<code>H</code>) to move the canvas.</li>
              <li><strong>Grid snap &amp; arrange:</strong> Toggle grid snapping, nudge selected boxes with arrow keys, or click <strong>Arrange nodes in grid</strong>.</li>
              <li><strong>Share &amp; collaborate:</strong> <strong>Copy share link</strong> encodes source and manual positions in the URL (never API keys). <strong>Share live</strong> starts a 5-device PeerJS room.</li>
              <li><strong>Export:</strong> Export full-bounds <strong>SVG</strong> or <strong>PNG</strong>, with an opt-in palette button to colorize boxes and classes on export.</li>
            </ul>
          </article>

          <article className="legal-card">
            <h2>MCP Server (<code>ctd-mcp</code>)</h2>
            <p>
              Run the same 7-format parser and translator inside Claude Desktop, Cursor, Windsurf,
              or VS Code over stdio:
            </p>
            <pre className="docs-template-code docs-guide-code">{`npx -y ctd-mcp`}</pre>
            <p>
              <strong>Tools:</strong> <code>detect_format</code>, <code>to_mermaid</code>,{" "}
              <code>translate_format</code>, <code>parse_diagram_ir</code>,{" "}
              <code>emit_from_ir</code>, <code>list_templates</code>,{" "}
              <code>get_studio_info</code>.
            </p>
          </article>
        </section>

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
