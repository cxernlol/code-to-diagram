import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, FolderOpen, GitBranch, GraduationCap, Search, Terminal, X } from "lucide-react";
import { AppTooltip } from "./AppTooltip";
import { TEMPLATES } from "./constants";

interface DocsPageProps {
  onBack: () => void;
  onStart: (templateName?: string) => void;
  onOpenSample?: () => void;
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
    format: "Mermaid (v12.3.0)",
    scope: "Full Mermaid v12.3.0 runtime for rendering. IR translation (Convert to...) supports flowchart/graph, classDiagram, erDiagram, and sequenceDiagram. Draggable types: flowchart, class, state, ER, requirement, C4. Render-only auto-layout: sequence, gantt, mindmap, pie, journey, gitGraph.",
    omissions: "gantt, mindmap, pie, journey, gitGraph, C4, and requirement render natively but are not translated by Convert to....",
  },
  {
    format: "Graphviz DOT",
    scope: "(strict) (di)graph, rankdir, node label & shape (diamond, circle, doublecircle, ellipse, oval, cylinder), chained -> / -- edges with label & style=dashed|dotted.",
    omissions: "subgraph blocks, default node/edge/graph attribute statements, HTML-like labels, and record port layouts.",
  },
  {
    format: "PlantUML",
    scope: "@startuml blocks: sequence (actor/participant, ->>/-->>), state ([*] transitions), class (<|--, *--, o--, ..>, --> with hide fields/methods/members), and activity (start/stop, :action;, if/else/endif, while/endwhile, repeat/repeat while, fork/fork again/end fork).",
    omissions: "Component, deployment, and use-case diagrams; note, alt/loop fragments, package nesting, and skinparam.",
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
    summary: "Blocks, subgraphs, sequence fragments, and per-node styling in Mermaid v12.3.0.",
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
    summary: "Parses @startuml sequence, state, class (including hide rules), and activity diagrams.",
    items: [
      { syntax: "A <|-- B / A *-- B", meaning: "Class inheritance / composition (also o--, ..>)" },
      { syntax: "hide fields / hide methods", meaning: "Suppress class fields, methods, or all members" },
      { syntax: ":Step; / if (...) then / while / repeat / fork", meaning: "Activity diagram actions, branches, loops, and parallel forks" },
      { syntax: "A ->> B / [*] --> Idle", meaning: "Sequence calls and state diagram transitions" },
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
  "Loop Trace",
  "Intro OOP",
  "Student ER Lab",
  "Vending Machine",
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

export const COURSEWORK_TEMPLATES = [
  "Flowchart",
  "Loop Trace",
  "Intro OOP",
  "Student ER Lab",
  "Vending Machine",
  "SQL Schema",
] as const;

interface TutorialLesson {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  template: string;
  snippet?: string;
}

const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: "first-flow",
    title: "Lesson 1 — Your first flowchart",
    goal: "See how text on the left becomes boxes and arrows on the right.",
    steps: [
      "Click Start in the header (or Try in editor below) to open the Flowchart template.",
      "Change one label in the code, e.g. rename Process to Validate input.",
      "Wait a moment — the canvas updates automatically (debounced render).",
    ],
    template: "Flowchart",
    snippet: `flowchart TD
  Start([Start]) --> Check{Valid?}
  Check -->|Yes| Process[Process]
  Check -->|No| Fix[Fix Inputs]`,
  },
  {
    id: "drag-export",
    title: "Lesson 2 — Drag and export (for assignments)",
    goal: "Tidy the layout, then save an image, source text, or submission bundle.",
    steps: [
      "Press V (Move tool) or click the move icon in the toolbar.",
      "Drag a node; enable grid snap in the toolbar if you want alignment.",
      "Export SVG or PNG from the top bar, or use Studio menu → Submission export (PNG + .mmd + .ctd.json).",
      "Copy the editor text or use Download source if your instructor wants the .mmd file.",
    ],
    template: "Flowchart",
  },
  {
    id: "from-sql",
    title: "Lesson 3 — Code you already wrote → diagram",
    goal: "Turn SQL or TypeScript from a lab into a diagram without learning Mermaid first.",
    steps: [
      "Open the SQL Schema or TypeScript Types starter, or paste CREATE TABLE statements.",
      "Studio detects the format and compiles to Mermaid ER or class diagram.",
      "On ER and class diagrams you can drag nodes; edit the SQL/TS to add tables or fields and watch the diagram change.",
    ],
    template: "SQL Schema",
    snippet: `CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(80)
);
CREATE TABLE courses (
  id INT PRIMARY KEY,
  title VARCHAR(120)
);`,
  },
  {
    id: "lesson-4-coursework",
    title: "Lesson 4 — Coursework templates & git-flow sample",
    goal: "Starting points for loops, OOP, ER labs, state machines, and sidecar layouts.",
    steps: [
      "Try Loop Trace for while-loop logic, Intro OOP for inheritance, Student ER Lab for three tables, or Vending Machine for states.",
      "Click Open git-flow sample below to see a pre-arranged diagram loaded with its flow.ctd.json sidecar layout.",
      "Sequence and gantt diagrams render (Render-only badge) but do not support dragging — use flowchart, class, ER, or state for hand-tuned layouts.",
    ],
    template: "Loop Trace",
  },
];

const WORKBENCH_ITEMS = [
  {
    id: "wb-drag",
    title: "Drag boxes & lines",
    detail:
      "Move (V) drags nodes or connector segments in flowchart, class, state, requirement, C4, and ER diagrams; Shift+click or Shift+drag box-selects multiple nodes; Pan (H) moves the canvas.",
  },
  {
    id: "wb-menu",
    title: "Right-click canvas menu",
    detail:
      "Right-click a node or edge to edit its label, change node shape, hide class members, add a connected item, jump to code, or reset its position; right-click empty canvas to add items or auto-arrange.",
  },
  {
    id: "wb-snap",
    title: "Grid snap & arrange",
    detail: "Toggle grid snapping, nudge selected boxes with arrow keys, or click Arrange nodes in grid.",
  },
  {
    id: "wb-sidecar",
    title: "Portable sidecars (*.ctd.json) & Submission export",
    detail:
      "Export and import layout-only sidecars alongside *.mmd files via Studio menu, or use Submission export to download PNG + .mmd + .ctd.json together. Schema: /schema/ctd-sidecar.v1.json (version: 1; never embeds API keys or diagram code).",
  },
  {
    id: "wb-precedence",
    title: "Persistence precedence",
    detail:
      "Opening a #d=…&l=… share link decodes that diagram into a tab; otherwise Studio restores tabs and layouts from local browser IndexedDB (sgs-studio). Importing a .mmd file creates a new tab; importing a .ctd.json file applies its layout to the active tab.",
  },
  {
    id: "wb-byok",
    title: "BYOK AI assistant & URL guidance",
    detail:
      "Configure OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, Groq, or custom endpoints in Settings (stored in IndexedDB only, never in share URLs or sidecars). Use HTTPS for remote custom endpoints and http://localhost / 127.0.0.1 only for local runtimes (e.g., Ollama).",
  },
  {
    id: "wb-rooms",
    title: "Live rooms (PeerJS / WebRTC)",
    detail:
      "Share live connects up to 5 devices peer-to-peer. Signaling/STUN expose network metadata/IPs to peers; incoming layouts are sanitized with parseLayoutRecord, and guests become read-only when the host ends the room.",
  },
] as const;

export type DocsSectionId = "start" | "syntax" | "formats" | "workbench" | "mcp" | "templates";

const DOCS_SECTIONS: ReadonlyArray<{ id: DocsSectionId; label: string; group: string }> = [
  { id: "start", label: "First time: code → diagram", group: "Tutorial" },
  { id: "syntax", label: "Syntax & Arrows", group: "Reference" },
  { id: "formats", label: "Supported Formats", group: "Reference" },
  { id: "workbench", label: "Workbench & Keys", group: "Studio" },
  { id: "mcp", label: "MCP API (ctd-mcp)", group: "Automation" },
  { id: "templates", label: "Starter Templates", group: "Examples" },
];

const MCP_TOOLS = [
  { name: "detect_format", params: "source", returns: "Format + Mermaid diagram kind" },
  { name: "to_mermaid", params: "source, format?", returns: "Compiled Mermaid diagram code" },
  { name: "translate_format", params: "source, targetFormat", returns: "Converted DOT / PlantUML / D2 / SQL / TS / XML" },
  { name: "parse_diagram_ir", params: "source", returns: "Structured DiagramIR (nodes, edges, direction)" },
  { name: "emit_from_ir", params: "ir, targetFormat", returns: "Diagram source generated from DiagramIR" },
  { name: "list_templates", params: "name?", returns: "Built-in starter templates or a single template" },
  { name: "regen_preserve_layout", params: "oldSource, newSource, sidecar?", returns: "Updated sidecar + preserved/orphan/renamed keys" },
  { name: "list_orphan_layout", params: "source, sidecar", returns: "Layout keys with no matching node/edge id" },
  { name: "diff_ir", params: "sourceA, sourceB", returns: "Added, removed, changed nodes/edges between IRs" },
  { name: "verify_diagram", params: "source, sidecar?", returns: "Parse/layout validity + warnings" },
  { name: "verify_against_files", params: "source, filePath?, fileContent?, sidecar?", returns: "Diagram vs SQL/TS/diagram reference parity + missing entities" },
  { name: "preview_patch", params: "source, patch", returns: "Non-mutating unified diff + IR delta + orphan-key preview" },
  { name: "patch_source", params: "source, patch", returns: "Patched diagram source" },
  { name: "check_drift", params: "sidecar, source?", returns: "Whether meta.sha256 matches source" },
  { name: "get_studio_info", params: "—", returns: "capabilities, irVersion, formats, themes" },
] as const;

function resolveDocsHash(rawHash: string): { section: DocsSectionId; anchorId?: string } | null {
  const id = rawHash.replace(/^#/, "").trim();
  if (!id || id === "docs") return null;
  if (
    id === "start" ||
    id === "first-flow" ||
    id === "drag-export" ||
    id === "from-sql" ||
    id === "lesson-4-coursework" ||
    id === "coursework-starters" ||
    id === "common-errors"
  ) {
    return { section: "start", anchorId: id === "start" ? undefined : id };
  }
  if (id === "syntax" || id === "arrows-connectors" || id === "flowchart-shapes" || id === "format-guides") {
    return { section: "syntax", anchorId: id === "syntax" ? undefined : id };
  }
  if (id === "formats" || id === "compatibility-matrix") {
    return { section: "formats", anchorId: id === "formats" ? undefined : id };
  }
  if (id === "workbench" || id === "workbench-sidecar") {
    return { section: "workbench", anchorId: id === "workbench" ? undefined : id };
  }
  if (id === "mcp" || id === "mcp-tools") {
    return { section: "mcp", anchorId: id === "mcp" ? undefined : id };
  }
  if (id === "templates") {
    return { section: "templates" };
  }
  return null;
}

export function DocsPage({ onBack, onStart, onOpenSample, onLegal }: DocsPageProps) {
  const reduceMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<DocsSectionId>(() => {
    return resolveDocsHash(window.location.hash)?.section ?? "start";
  });
  const [activeGuideId, setActiveGuideId] = useState(FORMAT_GUIDES[0]!.id);
  const [query, setQuery] = useState("");
  const activeGuide = FORMAT_GUIDES.find((g) => g.id === activeGuideId) ?? FORMAT_GUIDES[0]!;
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  useEffect(() => {
    const syncFromHash = () => {
      const target = resolveDocsHash(window.location.hash);
      if (!target) return;
      setActiveSection(target.section);
      if (target.anchorId) {
        const anchorId = target.anchorId;
        requestAnimationFrame(() => {
          document.getElementById(anchorId)?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });
        });
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, [reduceMotion]);

  const filteredArrows = searching
    ? ARROW_SYNTAX.filter((i) => `${i.diagram} ${i.syntax} ${i.meaning}`.toLowerCase().includes(q))
    : ARROW_SYNTAX;
  const filteredShapes = searching
    ? SHAPE_SYNTAX.filter((i) => `${i.syntax} ${i.shape} ${i.use}`.toLowerCase().includes(q))
    : SHAPE_SYNTAX;
  const filteredFormats = searching
    ? FORMAT_SUPPORT.filter((i) => `${i.format} ${i.scope} ${i.omissions}`.toLowerCase().includes(q))
    : FORMAT_SUPPORT;
  const filteredWorkbench = searching
    ? WORKBENCH_ITEMS.filter((i) => `${i.title} ${i.detail}`.toLowerCase().includes(q))
    : WORKBENCH_ITEMS;
  const filteredMcpTools = searching
    ? MCP_TOOLS.filter((t) => `${t.name} ${t.params} ${t.returns}`.toLowerCase().includes(q))
    : MCP_TOOLS;
  const filteredTemplates = searching
    ? FEATURED_TEMPLATES.filter((n) => `${n} ${TEMPLATES[n]}`.toLowerCase().includes(q))
    : FEATURED_TEMPLATES;
  const filteredLessons = searching
    ? TUTORIAL_LESSONS.filter((lesson) => {
        const haystack = `${lesson.title} ${lesson.goal} ${lesson.steps.join(" ")} ${lesson.template} ${lesson.snippet ?? ""} coursework first-time tutorial`.toLowerCase();
        return haystack.includes(q);
      })
    : TUTORIAL_LESSONS;

  const showSection = (id: DocsSectionId) => !searching && activeSection === id;

  const scrollToDocAnchor = useCallback(
    (id: string, sectionOverride?: DocsSectionId) => {
      if (sectionOverride) {
        setActiveSection(sectionOverride);
      }
      if (window.location.pathname.replace(/\/+$/, "") !== "/docs") {
        window.history.replaceState(null, "", `/docs#${id}`);
      } else if (window.location.hash !== `#${id}`) {
        window.history.replaceState(null, "", `${window.location.pathname}#${id}`);
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    },
    [reduceMotion],
  );

  const selectSection = useCallback((id: DocsSectionId) => {
    setQuery("");
    setActiveSection(id);
    if (window.location.hash) {
      window.history.replaceState(null, "", "/docs");
    }
  }, []);

  const docsHero =
    activeSection === "start" && !searching
      ? {
          eyebrow: "Tutorial",
          title: "First time: code → diagram",
          lead:
            "Five minutes in the browser: edit text, watch the canvas update, drag nodes on supported diagrams, and export PNG or SVG. No sign-in, no MCP required.",
        }
      : {
          eyebrow: "API & Syntax Reference",
          title: "Syntax & Template Docs",
          lead:
            "Concise reference for arrows (-->), shapes, all 7 input formats, workbench shortcuts, and ctd-mcp endpoints.",
        };

  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <button type="button" className="home-brand home-brand-btn" onClick={onBack} title="Return to CTD Studio home">
            <span className="brand-mark">
              <GitBranch aria-hidden="true" size={17} />
            </span>
            <span className="home-brand-name">CTD Studio</span>
          </button>
          <nav className="home-nav-actions" aria-label="Documentation navigation">
            <button type="button" className="home-link" onClick={onBack} title="Back to home page">
              <ArrowLeft aria-hidden="true" size={14} />
              <span>Home</span>
            </button>
            <button type="button" className="button primary home-nav-start" onClick={() => onStart()} title="Open interactive diagram workbench">
              Start
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main className="docs-main">
        <header className="docs-hero docs-api-header">
          <span className="home-eyebrow">
            {activeSection === "start" && !searching ? (
              <GraduationCap aria-hidden="true" size={13} />
            ) : (
              <BookOpen aria-hidden="true" size={13} />
            )}{" "}
            {docsHero.eyebrow}
          </span>
          <h1>{docsHero.title}</h1>
          <p>{docsHero.lead}</p>
        </header>

        <div className="docs-api-layout">
          <aside className="docs-sidebar" aria-label="Documentation sections">
            <div className="docs-search-box">
              <Search aria-hidden="true" size={14} className="docs-search-icon" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter tutorial, syntax, MCP..."
                aria-label="Filter documentation"
              />
              {query && (
                <button
                  type="button"
                  className="docs-search-clear"
                  aria-label="Clear filter"
                  onClick={() => setQuery("")}
                >
                  <X aria-hidden="true" size={13} />
                </button>
              )}
            </div>

            <label className="docs-mobile-jump-wrap">
              <span className="visually-hidden">Jump to documentation section</span>
              <select
                className="docs-mobile-jump"
                aria-label="Jump to documentation section"
                value={activeSection}
                onChange={(event) => selectSection(event.target.value as DocsSectionId)}
              >
                {DOCS_SECTIONS.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.group}: {section.label}
                  </option>
                ))}
              </select>
            </label>

            <nav className="docs-nav-list" aria-label="Reference sections">
              {DOCS_SECTIONS.map((section) => {
                const isActive = !searching && activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className={`docs-nav-item${isActive ? " active" : ""}`}
                    onClick={() => selectSection(section.id)}
                  >
                    <span className="docs-nav-group">{section.group}</span>
                    <span className="docs-nav-label">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="docs-content">
            {(showSection("start") || (searching && filteredLessons.length > 0)) && (
              <section className="docs-lesson-grid" aria-label="First-time code to diagram tutorial">
                {(!searching || filteredLessons.length > 0) && (
                  <>
                    {!searching && (
                      <div className="docs-tutorial-banner">
                        <p className="docs-tutorial-intro">
                          New to diagram-as-code? Work through the lessons below, or open our pre-arranged{" "}
                          <strong>git-flow sample</strong> (<code>flow.mmd</code> + <code>flow.ctd.json</code>). Need
                          connector or shape syntax? Open{" "}
                          <button type="button" className="docs-inline-link" onClick={() => selectSection("syntax")}>
                            Syntax &amp; Arrows
                          </button>
                          .
                        </p>
                        <div className="docs-sample-bar">
                          <button
                            type="button"
                            className="home-open-template"
                            title="Open flow.mmd with flow.ctd.json layout in Studio"
                            onClick={() => (onOpenSample ? onOpenSample() : onStart("Flowchart"))}
                          >
                            <FolderOpen aria-hidden="true" size={13} />
                            Open git-flow sample (with layout)
                            <ArrowRight aria-hidden="true" size={13} />
                          </button>
                          <a className="docs-asset-link" href="/samples/git-flow/flow.mmd" target="_blank" rel="noreferrer">
                            <code>flow.mmd</code>
                          </a>
                          <a className="docs-asset-link" href="/samples/git-flow/flow.ctd.json" target="_blank" rel="noreferrer">
                            <code>flow.ctd.json</code>
                          </a>
                        </div>
                      </div>
                    )}
                    {filteredLessons.map((lesson) => (
                      <article key={lesson.id} id={lesson.id} className="legal-card docs-lesson-card">
                        <h3>{lesson.title}</h3>
                        <p className="docs-lesson-goal">{lesson.goal}</p>
                        <ol className="docs-lesson-steps">
                          {lesson.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        {lesson.snippet && <pre className="docs-lesson-code">{lesson.snippet}</pre>}
                        <div className="docs-lesson-actions">
                          <button type="button" className="home-open-template" onClick={() => onStart(lesson.template)}>
                            Try in editor
                            <ArrowRight aria-hidden="true" size={13} />
                          </button>
                        </div>
                      </article>
                    ))}
                    {!searching && (
                      <>
                        <article id="coursework-starters" className="legal-card">
                          <div className="docs-guide-head">
                            <div>
                              <h2>Coursework starters</h2>
                              <p className="docs-lesson-goal">
                                One-click templates for common CS assignments (all draggable types in{" "}
                                <button
                                  type="button"
                                  className="docs-inline-link"
                                  onClick={() => scrollToDocAnchor("compatibility-matrix", "formats")}
                                >
                                  Supported Formats → Full Studio
                                </button>
                                ).
                              </p>
                            </div>
                            <button
                              type="button"
                              className="home-open-template"
                              onClick={() => (onOpenSample ? onOpenSample() : onStart("Flowchart"))}
                            >
                              Open git-flow sample
                              <ArrowRight aria-hidden="true" size={13} />
                            </button>
                          </div>
                          <div className="docs-template-grid">
                            {COURSEWORK_TEMPLATES.map((name) => (
                              <article key={name} className="docs-template-card">
                                <div className="docs-template-head">
                                  <h3>{name}</h3>
                                  <button type="button" className="home-open-template" onClick={() => onStart(name)}>
                                    Open
                                    <ArrowRight aria-hidden="true" size={13} />
                                  </button>
                                </div>
                                <pre className="docs-template-code">{TEMPLATES[name]}</pre>
                              </article>
                            ))}
                          </div>
                        </article>
                        <article id="common-errors" className="legal-card">
                          <h2>When code fails (Common syntax fixes)</h2>
                          <ul className="docs-list">
                            <li>
                              <strong>Flowchart arrows:</strong> Use <code>A --&gt; B</code> (two dashes) or{" "}
                              <code>A -.-&gt; B</code> in flowcharts, not single-dash <code>A -&gt; B</code>.
                            </li>
                            <li>
                              <strong>Decisions &amp; brackets:</strong> Decisions use braces{" "}
                              <code>Valid&#123;Is x &gt; 0?&#125;</code>; wrap labels containing parentheses or quotes in
                              double quotes (e.g. <code>Step[&quot;Call fn(x)&quot;]</code>).
                            </li>
                            <li>
                              <strong>One diagram header on line 1:</strong> Start with{" "}
                              <code>flowchart TD</code>, <code>classDiagram</code>, <code>erDiagram</code>, or{" "}
                              <code>stateDiagram-v2</code> and place each node/edge on its own line.
                            </li>
                            <li>
                              <strong>Non-Mermaid subsets:</strong> SQL DDL supports <code>CREATE TABLE</code> +{" "}
                              <code>PRIMARY KEY</code> / <code>REFERENCES</code>; PlantUML requires{" "}
                              <code>@startuml … @enduml</code>. See{" "}
                              <button
                                type="button"
                                className="docs-inline-link"
                                onClick={() => scrollToDocAnchor("compatibility-matrix", "formats")}
                              >
                                Supported Formats
                              </button>
                              .
                            </li>
                          </ul>
                        </article>
                        <p className="docs-callout" role="note">
                          <strong>Draggable vs render-only:</strong> Flowchart, class, ER, state, requirement, and C4
                          diagrams show the <strong>Draggable</strong> badge and support node/line dragging. Sequence,
                          gantt, mindmap, pie, journey, and gitGraph show <strong>Render-only</strong> (auto-layout only).
                        </p>
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            {(showSection("syntax") || (searching && (filteredArrows.length > 0 || filteredShapes.length > 0))) && (
              <>
                <section className="docs-grid" aria-label="Arrows and shapes reference">
                  {(!searching || filteredArrows.length > 0) && (
                    <article id="arrows-connectors" className="legal-card">
                      <h2>Arrows &amp; Connectors</h2>
                      <div className="docs-table-wrap">
                        <table className="docs-table">
                          <thead>
                            <tr>
                              <th>Diagram</th>
                              <th>Syntax</th>
                              <th>Meaning</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredArrows.map((item) => (
                              <tr key={item.syntax}>
                                <td><strong>{item.diagram}</strong></td>
                                <td><code>{item.syntax}</code></td>
                                <td>{item.meaning}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}

                  {(!searching || filteredShapes.length > 0) && (
                    <article id="flowchart-shapes" className="legal-card">
                      <h2>Flowchart Shapes</h2>
                      <div className="docs-table-wrap">
                        <table className="docs-table">
                          <thead>
                            <tr>
                              <th>Syntax</th>
                              <th>Shape</th>
                              <th>Typical use</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredShapes.map((item) => (
                              <tr key={item.syntax}>
                                <td><code>{item.syntax}</code></td>
                                <td>{item.shape}</td>
                                <td>{item.use}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}
                </section>

                {!searching && (
                  <article id="format-guides" className="legal-card docs-format-guide" aria-label="Syntax by format">
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
                      tabIndex={0}
                      aria-labelledby={`docs-guide-tab-${activeGuide.id}`}
                      className="docs-guide-split"
                    >
                      <div className="docs-table-wrap">
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
                      </div>
                      <pre className="docs-template-code docs-guide-code">{activeGuide.example}</pre>
                    </div>
                  </article>
                )}
              </>
            )}

            {(showSection("formats") || (searching && filteredFormats.length > 0)) && (
              <article id="compatibility-matrix" className="legal-card">
                <h2>Supported Formats (7) &amp; Compatibility Matrix</h2>
                <p>
                  CTD Studio auto-detects the input format as you type, compiles non-Mermaid formats
                  into Mermaid, and converts between formats via <strong>Convert to…</strong> or{" "}
                  <code>ctd-mcp</code>. The preview toolbar badge indicates <strong>Draggable</strong> vs{" "}
                  <strong>Render-only</strong>.
                </p>
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Tier / Badge</th>
                        <th>Diagram Types / Formats</th>
                        <th>Capabilities</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Full Studio (Draggable)</strong></td>
                        <td>
                          <code>flowchart</code>, <code>classDiagram</code>, <code>stateDiagram-v2</code>,{" "}
                          <code>erDiagram</code>, <code>requirementDiagram</code>,{" "}
                          <code>C4Context</code> / <code>C4Container</code> / <code>C4Component</code> /{" "}
                          <code>C4Dynamic</code> / <code>C4Deployment</code>
                        </td>
                        <td>Draggable nodes, 3-point connector handles, context menu, and <code>*.ctd.json</code> sidecar persistence.</td>
                      </tr>
                      <tr>
                        <td><strong>Auto-Layout Only (Render-only)</strong></td>
                        <td>
                          <code>sequenceDiagram</code>, <code>gantt</code>, <code>mindmap</code>,{" "}
                          <code>pie</code>, <code>journey</code>, <code>gitGraph</code>
                        </td>
                        <td>Local Mermaid v12.3.0 rendering, themes, and SVG/PNG export (auto-layout; no manual box dragging).</td>
                      </tr>
                      <tr>
                        <td><strong>Client-Side Translators → Mermaid</strong></td>
                        <td>
                          Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, XML (Draw.io, BPMN, generic XML)
                        </td>
                        <td>Parsed locally in browser or <code>ctd-mcp</code> into Mermaid; supported subsets listed below.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Format</th>
                        <th>What is parsed &amp; rendered</th>
                        <th>Notable omissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFormats.map((item) => (
                        <tr key={item.format}>
                          <td><strong>{item.format}</strong></td>
                          <td>{item.scope}</td>
                          <td>{item.omissions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {(showSection("workbench") || (searching && filteredWorkbench.length > 0)) && (
              <article id="workbench-sidecar" className="legal-card">
                <h2>Workbench, Sidecar Persistence &amp; Trust Model</h2>
                <p className="docs-lesson-goal">
                  Git/agent workflow: <code>docs/GIT_AND_AGENT_WORKFLOW.md</code> · Sidecar JSON Schema:{" "}
                  <a href="/schema/ctd-sidecar.v1.json" target="_blank" rel="noreferrer">
                    <code>/schema/ctd-sidecar.v1.json</code>
                  </a>{" "}
                  · LLM context:{" "}
                  <a href="/llms.txt" target="_blank" rel="noreferrer">
                    <code>/llms.txt</code>
                  </a>{" "}
                  · First-time tutorial:{" "}
                  <button type="button" className="docs-inline-link" onClick={() => selectSection("start")}>
                    First time: code → diagram
                  </button>
                  .
                </p>
                <ul className="docs-list">
                  {filteredWorkbench.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </article>
            )}

            {(showSection("mcp") || (searching && filteredMcpTools.length > 0)) && (
              <article id="mcp-tools" className="legal-card">
                <div className="docs-guide-head">
                  <div>
                    <h2>MCP Server (<code>ctd-mcp</code> v1.3.0)</h2>
                    <p>Stdio MCP API for Claude Desktop, Cursor, Windsurf, and VS Code.</p>
                  </div>
                  <span className="home-hero-mcp-badge">
                    <Terminal aria-hidden="true" size={13} />
                    npx -y ctd-mcp
                  </span>
                </div>
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Tool</th>
                        <th>Arguments</th>
                        <th>Returns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMcpTools.map((tool) => (
                        <tr key={tool.name}>
                          <td><code>{tool.name}</code></td>
                          <td><code>{tool.params}</code></td>
                          <td>{tool.returns}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  <strong>Resources:</strong> <code>ctd://formats</code>, <code>ctd://themes</code>,{" "}
                  <code>ctd://templates/&#123;name&#125;</code> · <strong>Prompt:</strong>{" "}
                  <code>code_to_diagram</code>
                </p>
              </article>
            )}

            {(showSection("templates") || (searching && filteredTemplates.length > 0)) && (
              <section className="docs-templates" aria-label="Starter templates">
                <div className="docs-section-head">
                  <h2>Starter Templates</h2>
                  <p>Click any template to open it in the interactive workbench.</p>
                </div>
                <div className="docs-template-grid">
                  {filteredTemplates.map((name) => (
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
            )}

            {searching &&
              filteredLessons.length === 0 &&
              filteredArrows.length === 0 &&
              filteredShapes.length === 0 &&
              filteredFormats.length === 0 &&
              filteredWorkbench.length === 0 &&
              filteredMcpTools.length === 0 &&
              filteredTemplates.length === 0 && (
                <article className="legal-card">
                  <h2>No matches for &ldquo;{query}&rdquo;</h2>
                  <p>
                    Try searching for a lesson (<code>Loop Trace</code>, <code>coursework</code>), a format (
                    <code>dot</code>, <code>sql</code>, <code>bpmn</code>), an arrow (<code>-.-&gt;</code>), or an MCP
                    tool (<code>to_mermaid</code>, <code>regen_preserve_layout</code>).
                  </p>
                </article>
              )}
          </div>
          <aside className="docs-toc" aria-label="On this page">
            <span className="docs-toc-title">On this page</span>
            <nav className="docs-toc-list">
              {showSection("start") && !searching && (
                <>
                  {TUTORIAL_LESSONS.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      className="docs-toc-link"
                      onClick={() => scrollToDocAnchor(lesson.id)}
                    >
                      {lesson.title}
                    </button>
                  ))}
                  <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("coursework-starters")}>
                    Coursework starters
                  </button>
                  <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("common-errors")}>
                    When code fails
                  </button>
                </>
              )}
              {showSection("syntax") && !searching && (
                <>
                  <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("arrows-connectors")}>
                    Arrows &amp; Connectors
                  </button>
                  <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("flowchart-shapes")}>
                    Flowchart Shapes
                  </button>
                  <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("format-guides")}>
                    Syntax by Format (7 Languages)
                  </button>
                </>
              )}
              {showSection("formats") && !searching && (
                <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("compatibility-matrix")}>
                  Compatibility Matrix
                </button>
              )}
              {showSection("workbench") && !searching && (
                <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("workbench-sidecar")}>
                  Workbench &amp; Sidecars
                </button>
              )}
              {showSection("mcp") && !searching && (
                <button type="button" className="docs-toc-link" onClick={() => scrollToDocAnchor("mcp-tools")}>
                  MCP Tools (ctd-mcp)
                </button>
              )}
              <span className="docs-toc-subhead">7 Supported Formats</span>
              {FORMAT_GUIDES.map((guide) => (
                <button
                  key={guide.id}
                  type="button"
                  className={`docs-toc-link${activeSection === "syntax" && activeGuide.id === guide.id ? " active" : ""}`}
                  onClick={() => {
                    setQuery("");
                    setActiveSection("syntax");
                    setActiveGuideId(guide.id);
                    if (window.location.pathname.replace(/\/+$/, "") !== "/docs") {
                      window.history.replaceState(null, "", "/docs#format-guides");
                    } else {
                      window.history.replaceState(null, "", `${window.location.pathname}#format-guides`);
                    }
                    requestAnimationFrame(() => {
                      document.getElementById("format-guides")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
                    });
                  }}
                >
                  {guide.label}
                </button>
              ))}
            </nav>
          </aside>
        </div>
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
      <AppTooltip />
    </div>
  );
}
