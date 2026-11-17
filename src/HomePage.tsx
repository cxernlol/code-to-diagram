import { animate, stagger, svg as animeSvg } from "animejs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Check, Copy, GitBranch, Grid3x3, HardDrive, ImageDown, Star, Terminal } from "lucide-react";

const GITHUB_URL = "https://github.com/cxernlol/code-to-diagram";
const GITHUB_API_URL = "https://api.github.com/repos/cxernlol/code-to-diagram";
const STORAGE_NOTICE_KEY = "sgs-storage-notice";

const MCP_SNIPPETS = [
  {
    id: "clients",
    label: "Claude / Cursor / Windsurf",
    code: `{
  "mcpServers": {
    "ctd-mcp": {
      "command": "npx",
      "args": ["-y", "ctd-mcp"]
    }
  }
}`,
  },
  {
    id: "vscode",
    label: "VS Code (.vscode/mcp.json)",
    code: `{
  "servers": {
    "ctd-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ctd-mcp"]
    }
  }
}`,
  },
  {
    id: "cli",
    label: "Terminal / npx",
    code: `npx -y ctd-mcp`,
  },
] as const;

interface HomePageProps {
  onStart: (templateName?: string) => void;
  onDocs: () => void;
  onLegal: (tab: "privacy" | "terms") => void;
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
  {
    id: "xml",
    label: "XML",
    file: "arch.xml",
    template: "XML Diagram",
    code: `<diagram direction="LR">
  <node id="Client" label="Web App"/>
  <node id="API" shape="diamond"/>
  <node id="DB" shape="cylinder"/>
  <edge from="Client" to="API"/>
  <edge from="API" to="DB"/>
</diagram>`,
    diagram: (
      <svg viewBox="0 0 280 210" className="home-preview-svg" role="img" aria-label="XML diagram preview">
        <defs>
          <marker id="home-arrow-xml" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#315158" />
          </marker>
        </defs>
        <path d="M 86 105 L 112 105" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-xml)" />
        <path d="M 166 105 L 194 105" stroke="#315158" strokeWidth="1.6" fill="none" markerEnd="url(#home-arrow-xml)" />
        <rect x="14" y="87" width="72" height="36" rx="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="50" y="109" textAnchor="middle" fill="#1c3439" fontSize="11">Web App</text>
        <polygon points="140,80 168,105 140,130 112,105" fill="#f5e8dc" stroke="#ad612e" strokeWidth="1.5" />
        <text x="140" y="109" textAnchor="middle" fill="#1c3439" fontSize="11" fontWeight="600">API</text>
        <rect x="196" y="83" width="70" height="44" rx="10" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
        <text x="231" y="109" textAnchor="middle" fill="#1c3439" fontSize="11">DB</text>
      </svg>
    ),
  },
];

export function HomePage({ onStart, onDocs, onLegal }: HomePageProps) {
  const reduceMotion = useReducedMotion();
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const [activeFormat, setActiveFormat] = useState(FORMAT_DEMOS[0]!);
  const [activeMcpTab, setActiveMcpTab] = useState<(typeof MCP_SNIPPETS)[number]["id"]>("clients");
  const [mcpCopied, setMcpCopied] = useState(false);
  const [heroMcpStatus, setHeroMcpStatus] = useState<"idle" | "copied" | "failed">("idle");
  const heroMcpTimerRef = useRef<number | undefined>(undefined);
  const [stars, setStars] = useState<number | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => () => window.clearTimeout(heroMcpTimerRef.current), []);

  const copyHeroMcp = async () => {
    window.clearTimeout(heroMcpTimerRef.current);
    if (!navigator.clipboard?.writeText) {
      setHeroMcpStatus("failed");
      heroMcpTimerRef.current = window.setTimeout(() => setHeroMcpStatus("idle"), 2400);
      return;
    }
    try {
      await navigator.clipboard.writeText("npx -y ctd-mcp");
      setHeroMcpStatus("copied");
    } catch {
      setHeroMcpStatus("failed");
    }
    heroMcpTimerRef.current = window.setTimeout(() => setHeroMcpStatus("idle"), 2400);
  };

  const dismissNotice = () => {
    setNoticeDismissed(true);
    try {
      localStorage.setItem(STORAGE_NOTICE_KEY, "1");
    } catch {
      // ignore storage errors
    }
  };

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

  useEffect(() => {
    const host = previewCanvasRef.current;
    if (!host || reduceMotion) return;
    const paths = host.querySelectorAll<SVGPathElement>("svg path");
    const shapes = host.querySelectorAll<SVGElement>("svg rect, svg polygon");
    const animations: Array<{ revert?: () => void; pause?: () => void }> = [];
    if (paths.length > 0) {
      animations.push(
        animate(animeSvg.createDrawable(paths), {
          draw: ["0 0", "0 1"],
          ease: "outCubic",
          duration: 520,
          delay: stagger(70),
        }),
      );
    }
    if (shapes.length > 0) {
      animations.push(
        animate(shapes, {
          opacity: [0, 1],
          scale: [0.94, 1],
          ease: "outCubic",
          duration: 360,
          delay: stagger(45),
        }),
      );
    }
    return () => {
      animations.forEach((anim) => anim.revert?.() ?? anim.pause?.());
    };
  }, [activeFormat.id, reduceMotion]);

  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <div className="home-brand">
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="home-brand-name">CTD Studio</span>
          </div>
          <nav className="home-nav-actions" aria-label="Primary">
            <button type="button" className="home-link" onClick={onDocs}>
              <BookOpen aria-hidden="true" size={14} />
              <span>Docs</span>
            </button>
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
          <motion.div
            className="home-hero-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
          >
            <p className="home-eyebrow">MCP-Ready · Modern Alternative to Draw.io &amp; Mermaid.ai</p>
            <h1 id="home-title">Code to diagram, or right-click to edit directly.</h1>
            <p className="home-lead">
              Skip clunky legacy UIs and annoying AI paywalls. Paste Mermaid, DOT, PlantUML, D2,
              SQL, TypeScript, or XML — or right-click any box, line, or canvas to edit, add nodes,
              and drag into place. Local-first with zero sign-in.
            </p>
            <div className="home-cta-row">
              <button className="button primary home-cta-start" type="button" onClick={() => onStart()}>
                Start
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button className="button secondary home-cta-github" type="button" onClick={onDocs}>
                <BookOpen aria-hidden="true" size={15} />
                <span>Syntax Docs</span>
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
            <div className="home-hero-mcp" role="group" aria-label="Install MCP server">
              <span className="home-hero-mcp-badge">
                <Terminal aria-hidden="true" size={13} />
                MCP Ready
              </span>
              <code className="home-hero-mcp-cmd">npx -y ctd-mcp</code>
              <button
                type="button"
                className="home-open-template"
                onClick={() => void copyHeroMcp()}
              >
                {heroMcpStatus === "copied" ? <Check aria-hidden="true" size={13} /> : <Copy aria-hidden="true" size={13} />}
                <span>
                  {heroMcpStatus === "copied"
                    ? "Copied"
                    : heroMcpStatus === "failed"
                      ? "Copy failed"
                      : "Copy install command"}
                </span>
              </button>
              <button
                type="button"
                className="home-hero-mcp-more"
                onClick={() =>
                  document
                    .getElementById("home-mcp-section")
                    ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })
                }
              >
                Client configs ↓
              </button>
            </div>
            <ul className="home-trust-strip" aria-label="Highlights">
              <li>Mermaid v12.3.0</li>
              <li>7 code formats</li>
              <li>Right-click edits</li>
              <li>SVG &amp; PNG export</li>
              <li>5-device live rooms</li>
            </ul>
          </motion.div>

          <motion.div
            className="home-preview-card"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.36, delay: reduceMotion ? 0 : 0.06, ease: "easeOut" }}
          >
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
                    {activeFormat.id === demo.id && (
                      <motion.span
                        layoutId="home-format-pill"
                        className="home-format-pill"
                        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                      />
                    )}
                    <span className="home-format-label">{demo.label}</span>
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
                <AnimatePresence mode="wait">
                  <motion.pre
                    key={activeFormat.id}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: 6 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16 }}
                  >
                    {activeFormat.code}
                  </motion.pre>
                </AnimatePresence>
              </div>
              <div className="home-preview-canvas" ref={previewCanvasRef}>
                {activeFormat.diagram}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="home-features" aria-label="Capabilities">
          <motion.article
            className="home-feature"
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.15 }}
          >
            <Grid3x3 aria-hidden="true" size={18} />
            <h2>Move boxes and lines</h2>
            <p>
              Drag nodes or connector segments in flowcharts, class, state, and ER diagrams with
              grid snapping and one-click layered arrangement.
            </p>
          </motion.article>
          <motion.article
            className="home-feature"
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.15 }}
          >
            <HardDrive aria-hidden="true" size={18} />
            <h2>Saved in your browser</h2>
            <p>
              Diagrams, manual positions, and theme settings live in IndexedDB. No sign-in, no
              cloud lock-in, and no subscription limits.
            </p>
          </motion.article>
          <motion.article
            className="home-feature"
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.15 }}
          >
            <ImageDown aria-hidden="true" size={18} />
            <h2>Clean export and BYOK AI</h2>
            <p>
              Export full-bounds SVG or PNG files, share diagrams via URL, or plug in your own AI
              provider key directly from the browser.
            </p>
          </motion.article>
        </section>

        <section id="home-mcp-section" className="home-mcp" aria-label="MCP integration">
          <div className="home-mcp-copy">
            <span className="home-eyebrow">
              <Terminal aria-hidden="true" size={13} /> CTD Studio MCP (ctd-mcp)
            </span>
            <h2>Use CTD Studio as an MCP server</h2>
            <p>
              Run the same 7-format detector, Mermaid v12.3.0 converter, and DiagramIR translator inside{" "}
              <strong>Claude Desktop</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>,{" "}
              <strong>VS Code</strong>, or <strong>Claude Code</strong> via <code>npx</code>.
            </p>
            <div className="home-mcp-tools" aria-label="Exposed MCP tools">
              {[
                "detect_format",
                "to_mermaid",
                "translate_format",
                "parse_diagram_ir",
                "emit_from_ir",
                "list_templates",
                "get_studio_info",
              ].map((tool) => (
                <code key={tool}>{tool}</code>
              ))}
            </div>
          </div>

          <div className="home-mcp-card">
            <div className="home-mcp-bar">
              <div className="home-format-tabs" role="tablist" aria-label="MCP client config">
                {MCP_SNIPPETS.map((snippet) => {
                  const active = activeMcpTab === snippet.id;
                  return (
                    <button
                      key={snippet.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`home-format-tab${active ? " active" : ""}`}
                      onClick={() => {
                        setActiveMcpTab(snippet.id);
                        setMcpCopied(false);
                      }}
                    >
                      {active && (
                        <motion.span
                          layoutId="home-mcp-pill"
                          className="home-format-pill"
                          transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
                        />
                      )}
                      <span className="home-format-label">{snippet.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="home-open-template"
                onClick={() => {
                  const code = MCP_SNIPPETS.find((s) => s.id === activeMcpTab)?.code ?? "";
                  void navigator.clipboard?.writeText(code).then(() => {
                    setMcpCopied(true);
                    window.setTimeout(() => setMcpCopied(false), 1800);
                  });
                }}
              >
                {mcpCopied ? <Check aria-hidden="true" size={13} /> : <Copy aria-hidden="true" size={13} />}
                {mcpCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="home-mcp-code">
              {MCP_SNIPPETS.find((s) => s.id === activeMcpTab)?.code}
            </pre>
          </div>

          <div className="home-mcp-proof" aria-label="Verified MCP output">
            <div className="home-mcp-proof-head">
              <span>
                Verified <code>to_mermaid</code> output via <code>npx -y ctd-mcp</code>
              </span>
              <div className="home-mcp-proof-actions">
                <a
                  className="home-mcp-npm-link"
                  href="https://www.npmjs.com/package/ctd-mcp"
                  target="_blank"
                  rel="noreferrer"
                >
                  npmjs.com/package/ctd-mcp
                </a>
                <button
                  type="button"
                  className="home-open-template"
                  onClick={() => onStart("SQL Schema")}
                >
                  Try SQL in editor
                  <ArrowRight aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
            <div className="home-mcp-proof-split">
              <pre className="home-mcp-proof-pre">{`CREATE TABLE users (id INT PRIMARY KEY, email TEXT);
CREATE TABLE diagrams (id INT PRIMARY KEY, user_id INT REFERENCES users(id), title TEXT);`}</pre>
              <div className="home-mcp-proof-diagram">
                <svg viewBox="0 0 360 148" className="home-preview-svg" role="img" aria-label="Rendered Mermaid ER diagram for users and diagrams">
                  <path d="M 134 74 L 222 74" stroke="#315158" strokeWidth="1.6" fill="none" />
                  <line x1="142" y1="67" x2="142" y2="81" stroke="#315158" strokeWidth="1.5" />
                  <line x1="147" y1="67" x2="147" y2="81" stroke="#315158" strokeWidth="1.5" />
                  <circle cx="204" cy="74" r="4" fill="#ffffff" stroke="#315158" strokeWidth="1.4" />
                  <path d="M 222 67 L 210 74 L 222 81" stroke="#315158" strokeWidth="1.4" fill="none" />
                  <rect x="155" y="54" width="46" height="16" rx="3" fill="#f5f7f5" />
                  <text x="178" y="65" textAnchor="middle" fill="#1c3439" fontSize="9.5" fontWeight="600">references</text>

                  <rect x="16" y="34" width="118" height="80" rx="5" fill="#eaf1f8" stroke="#2c5d8a" strokeWidth="1.4" />
                  <line x1="16" y1="58" x2="134" y2="58" stroke="#2c5d8a" strokeWidth="1.2" />
                  <text x="75" y="50" textAnchor="middle" fill="#152b40" fontSize="11" fontWeight="700">users</text>
                  <text x="26" y="76" fill="#152b40" fontSize="10" fontFamily="monospace">int id PK</text>
                  <text x="26" y="96" fill="#152b40" fontSize="10" fontFamily="monospace">text email</text>

                  <rect x="222" y="24" width="124" height="100" rx="5" fill="#e6f4ea" stroke="#2e7d5b" strokeWidth="1.4" />
                  <line x1="222" y1="48" x2="346" y2="48" stroke="#2e7d5b" strokeWidth="1.2" />
                  <text x="284" y="40" textAnchor="middle" fill="#143527" fontSize="11" fontWeight="700">diagrams</text>
                  <text x="232" y="66" fill="#143527" fontSize="10" fontFamily="monospace">int id PK</text>
                  <text x="232" y="86" fill="#143527" fontSize="10" fontFamily="monospace">int user_id FK</text>
                  <text x="232" y="106" fill="#143527" fontSize="10" fontFamily="monospace">text title</text>
                </svg>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>CTD Studio</span>
        <div className="home-footer-links">
          <button type="button" className="home-footer-btn" onClick={onDocs}>
            Docs
          </button>
          <button type="button" className="home-footer-btn" onClick={() => onLegal("privacy")}>
            Privacy &amp; Cookies
          </button>
          <button type="button" className="home-footer-btn" onClick={() => onLegal("terms")}>
            Terms
          </button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            github.com/cxernlol/code-to-diagram
          </a>
        </div>
      </footer>

      {!noticeDismissed && (
        <aside className="cookie-notice" aria-label="Storage notice">
          <span>Essential browser storage only. No tracking cookies.</span>
          <button type="button" className="cookie-link" onClick={() => onLegal("privacy")}>
            Privacy
          </button>
          <button type="button" className="cookie-dismiss" onClick={dismissNotice}>
            Got it
          </button>
        </aside>
      )}
    </div>
  );
}
