#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOMParser as DOMParser$1 } from "@xmldom/xmldom";
var package_default = {
	name: "sgs-studio-mcp",
	version: "1.0.0",
	description: "MCP server for SGS Studio — convert and translate Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML diagrams via npx.",
	type: "module",
	main: "./dist/index.js",
	bin: { "sgs-studio-mcp": "./dist/index.js" },
	files: ["dist", "README.md"],
	engines: { "node": ">=18" },
	keywords: [
		"mcp",
		"model-context-protocol",
		"sgs-studio",
		"mermaid",
		"diagram",
		"graphviz",
		"plantuml",
		"d2",
		"sql",
		"typescript",
		"xml"
	],
	repository: {
		"type": "git",
		"url": "git+https://github.com/cxernlol/sgs-chify.git",
		"directory": "mcp"
	},
	homepage: "https://sgs-chify.vercel.app/",
	bugs: { "url": "https://github.com/cxernlol/sgs-chify/issues" },
	dependencies: {
		"@modelcontextprotocol/sdk": "^1.32.2",
		"@xmldom/xmldom": "^0.9.12",
		"zod": "^4.6.7"
	}
};
var THEME_PRESETS = {
	default: {
		primaryColor: "#ffffff",
		textColor: "#1c3439",
		lineColor: "#315158",
		canvasColor: "#f5f7f5"
	},
	dark: {
		primaryColor: "#1c2b30",
		textColor: "#eef4f2",
		lineColor: "#8ab4ad",
		canvasColor: "#0f171a"
	},
	forest: {
		primaryColor: "#d8edd9",
		textColor: "#163624",
		lineColor: "#2d6a4f",
		canvasColor: "#f2f7f3"
	},
	neutral: {
		primaryColor: "#eae6df",
		textColor: "#2b2927",
		lineColor: "#5c5751",
		canvasColor: "#f6f5f2"
	}
};
({ ...THEME_PRESETS.default });
var TEMPLATES = {
	Flowchart: `flowchart TD
  Start([Start]) --> Check{Valid?}
  Check -->|Yes| Process[Process]
  Check -->|No| Fix[Fix Inputs]
  Fix --> Check
  Process --> Output[/Output/]
  Output --> Done([Done])`,
	Sequence: `sequenceDiagram
  autonumber
  actor User
  participant App
  participant DB
  User->>App: Request
  App->>DB: Query
  DB-->>App: Data
  App-->>User: Response`,
	Class: `classDiagram
  class Animal {
    +String name
    +int age
    +speak() void
  }
  class Dog {
    +String breed
    +fetch() void
  }
  class Cat {
    +Boolean indoor
    +purr() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,
	State: `stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start()
  Running --> Paused : pause()
  Paused --> Running : resume()
  Running --> [*] : stop()`,
	ER: `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ITEM : contains
  USER {
    int id PK
    string name
    string email
  }
  ORDER {
    int id PK
    date created_at
  }`,
	Gantt: `gantt
  title Project Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
  Design   :done, des, 2026-01-01, 7d
  Develop  :active, dev, after des, 10d
  section Phase 2
  Testing  :test, after dev, 5d
  Release  :crit, rel, after test, 2d`,
	Mindmap: `mindmap
  root((Project))
    Planning
      Goals
      Resources
    Execution
      Development
      Testing
    Delivery
      Deployment
      Monitoring`,
	Pie: `pie showData
  title Resource Allocation
  "Development" : 45
  "Testing" : 25
  "Design" : 20
  "Docs" : 10`,
	Journey: `journey
  title User Onboarding
  section Discovery
    Visit site: 4: User
    Read docs: 3: User
  section Setup
    Create account: 5: User
    Configure: 4: User
  section Usage
    First diagram: 5: User
    Share: 5: User`,
	"Git Graph": `gitGraph
  commit id: "Initial"
  branch feature
  checkout feature
  commit id: "Feature work"
  commit id: "More work"
  checkout main
  merge feature id: "Merge feature"
  commit id: "Release" tag: "v1.0"`,
	"C4 Architecture": `C4Context
  title System Context
  Person(user, "User", "Creates diagrams.")
  System(app, "SGS Studio", "Browser diagramming app.")
  System_Ext(ai, "AI API", "Diagram generation.")
  Rel(user, app, "Uses")
  Rel(app, ai, "Requests completions")`,
	"Requirement Diagram": `requirementDiagram
  requirement req_render {
    id: REQ-01
    text: Real-time debounced render within 250ms.
    risk: low
    verifymethod: test
  }
  element renderer {
    type: module
  }
  renderer - satisfies -> req_render`,
	"DOT Graph": `digraph ServiceFlow {
  rankdir=LR;
  Client [label="Web Client"];
  API [label="API Gateway", shape=diamond];
  Auth [label="Auth Service"];
  DB [label="Database", shape=cylinder];
  Client -> API [label="HTTPS"];
  API -> Auth [label="Verify"];
  API -> DB [label="Query"];
}`,
	"PlantUML Class": `@startuml
class Account {
  +String email
  +login()
}
class Workspace {
  +String title
  +exportSvg()
}
Account "1" --> "*" Workspace : owns
@enduml`,
	"D2 Flow": `direction: right
Browser -> Compiler: source code
Compiler -> Canvas: Mermaid AST
Canvas -> Export: SVG or PNG`,
	"SQL Schema": `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255)
);
CREATE TABLE projects (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(120)
);`,
	"TypeScript Types": `interface User {
  id: string;
  email: string;
}
interface Diagram {
  id: string;
  owner: User;
  nodes: number;
}`,
	"XML Diagram": `<diagram kind="flowchart" direction="LR">
  <nodes>
    <node id="Client" label="Web App" />
    <node id="Gateway" label="API Gateway" shape="diamond" />
    <node id="Store" label="Postgres" shape="cylinder" />
  </nodes>
  <edges>
    <edge from="Client" to="Gateway" label="HTTPS" />
    <edge from="Gateway" to="Store" label="SQL" />
  </edges>
</diagram>`
};
// src/lib/translate.ts
function safeId(raw) {
	const cleaned = raw.trim().replace(/^["'`]|["'`]$/g, "").replace(/[^A-Za-z0-9_]/g, "_");
	if (!cleaned) return "node";
	return /^[A-Za-z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}
function cleanText(raw) {
	return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");
}
function escapeXml(raw) {
	return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function parseXmlToIR(source) {
	const doc = new DOMParser().parseFromString(source.trim(), "application/xml");
	if (doc.querySelector("parsererror")) throw new Error("Invalid XML syntax.");
	const root = doc.documentElement;
	const nodes = /* @__PURE__ */ new Map();
	const edges = [];
	const direction = (root.getAttribute("direction") ?? root.getAttribute("rankdir") ?? "").toUpperCase() === "LR" ? "LR" : "TD";
	const addNode = (id, label, shape, fields) => {
		const sid = safeId(id);
		const prev = nodes.get(sid);
		nodes.set(sid, {
			id: sid,
			label: label ? cleanText(label) : prev?.label ?? sid,
			shape: shape ?? prev?.shape,
			fields: fields?.length ? fields : prev?.fields
		});
		return sid;
	};
	const mxCells = Array.from(doc.querySelectorAll("mxCell"));
	if (mxCells.length > 0) {
		for (const cell of mxCells) {
			const id = cell.getAttribute("id");
			if (!id || id === "0" || id === "1") continue;
			if (cell.getAttribute("vertex") === "1") {
				const style = cell.getAttribute("style") ?? "";
				const shape = /rhombus/i.test(style) ? "diamond" : /ellipse/i.test(style) ? "circle" : /cylinder/i.test(style) ? "cylinder" : void 0;
				addNode(id, cell.getAttribute("value") || id, shape);
			} else if (cell.getAttribute("edge") === "1") {
				const src = cell.getAttribute("source");
				const dst = cell.getAttribute("target");
				if (src && dst) edges.push({
					from: addNode(src),
					to: addNode(dst),
					label: cleanText(cell.getAttribute("value") ?? "") || void 0,
					dashed: /dashed=1/i.test(cell.getAttribute("style") ?? "")
				});
			}
		}
		if (nodes.size > 0 || edges.length > 0) return {
			kind: "flowchart",
			direction,
			nodes: Array.from(nodes.values()),
			edges
		};
	}
	const seqFlows = Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === "sequenceFlow");
	if (seqFlows.length > 0) {
		const bpmnTagShapes = {
			startEvent: "circle",
			endEvent: "circle",
			exclusiveGateway: "diamond",
			parallelGateway: "diamond",
			inclusiveGateway: "diamond"
		};
		for (const el of Array.from(doc.getElementsByTagName("*"))) {
			const id = el.getAttribute("id");
			if (!id) continue;
			if (el.localName in bpmnTagShapes || /Task$|task$|SubProcess$/i.test(el.localName)) addNode(id, el.getAttribute("name") || id, bpmnTagShapes[el.localName]);
		}
		for (const flow of seqFlows) {
			const src = flow.getAttribute("sourceRef");
			const dst = flow.getAttribute("targetRef");
			if (src && dst) edges.push({
				from: addNode(src),
				to: addNode(dst),
				label: cleanText(flow.getAttribute("name") ?? "") || void 0
			});
		}
		return {
			kind: "flowchart",
			direction,
			nodes: Array.from(nodes.values()),
			edges
		};
	}
	const explicitNodes = Array.from(doc.querySelectorAll("node, entity, table, class, state, participant, actor"));
	const explicitEdges = Array.from(doc.querySelectorAll("edge, link, relation, transition, flow, arrow"));
	if (explicitNodes.length > 0 || explicitEdges.length > 0) {
		const isEr = explicitNodes.some((el) => el.tagName === "table" || el.tagName === "entity");
		const isClass = explicitNodes.some((el) => el.tagName === "class");
		for (const el of explicitNodes) {
			const id = el.getAttribute("id") || el.getAttribute("name") || cleanText(el.textContent ?? "") || `node_${nodes.size + 1}`;
			const label = el.getAttribute("label") || el.getAttribute("name") || el.getAttribute("title") || id;
			const fields = Array.from(el.querySelectorAll(":scope > field, :scope > column, :scope > member, :scope > attr")).map((f) => {
				const fName = f.getAttribute("name") || cleanText(f.textContent ?? "");
				return [
					f.getAttribute("type") || "",
					fName,
					f.getAttribute("key") || (f.getAttribute("pk") === "true" ? "PK" : f.getAttribute("fk") === "true" ? "FK" : "")
				].filter(Boolean).join(" ").trim();
			}).filter(Boolean);
			addNode(id, label, el.getAttribute("shape") ?? void 0, fields);
		}
		for (const el of explicitEdges) {
			const from = el.getAttribute("from") || el.getAttribute("source");
			const to = el.getAttribute("to") || el.getAttribute("target");
			if (from && to) edges.push({
				from: addNode(from),
				to: addNode(to),
				label: cleanText(el.getAttribute("label") || el.getAttribute("name") || el.textContent || "") || void 0,
				dashed: el.getAttribute("dashed") === "true" || el.getAttribute("style") === "dashed",
				relation: el.getAttribute("type") ?? void 0
			});
		}
		return {
			kind: isEr ? "er" : isClass ? "class" : "flowchart",
			direction,
			nodes: Array.from(nodes.values()),
			edges
		};
	}
	let counter = 0;
	const walk = (el, parentId) => {
		counter += 1;
		const rawId = el.getAttribute("id") || `${el.tagName}_${counter}`;
		const textOnly = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? "").join(" ").trim();
		const label = el.getAttribute("label") || el.getAttribute("name") || (textOnly ? `${el.tagName}: ${textOnly}` : el.tagName);
		const id = addNode(rawId, label);
		if (parentId) edges.push({
			from: parentId,
			to: id
		});
		Array.from(el.children).forEach((child) => walk(child, id));
	};
	walk(root);
	return {
		kind: "flowchart",
		direction,
		nodes: Array.from(nodes.values()),
		edges
	};
}
function parseMermaidToIR(mermaid) {
	const lines = mermaid.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("%%"));
	const header = lines[0] ?? "";
	const isClass = /^classDiagram\b/i.test(header);
	const isEr = /^erDiagram\b/i.test(header);
	const isSeq = /^sequenceDiagram\b/i.test(header);
	const direction = /\bLR\b|\bRL\b/i.test(header) ? "LR" : "TD";
	const nodes = /* @__PURE__ */ new Map();
	const edges = [];
	const ensureNode = (rawId, label, shape) => {
		const id = safeId(rawId);
		const prev = nodes.get(id);
		nodes.set(id, {
			id,
			label: label ? cleanText(label) : prev?.label ?? id,
			shape: shape ?? prev?.shape,
			fields: prev?.fields
		});
		return id;
	};
	if (isClass || isEr) {
		let currentBlock = null;
		for (const line of lines.slice(1)) {
			if (currentBlock) {
				if (line === "}") {
					currentBlock = null;
					continue;
				}
				const node = nodes.get(currentBlock);
				if (node) node.fields = [...node.fields ?? [], line];
				continue;
			}
			const blockStart = line.match(/^(?:class\s+)?([A-Za-z_]\w*)\s*\{$/);
			if (blockStart) {
				currentBlock = ensureNode(blockStart[1]);
				continue;
			}
			const rel = isEr ? line.match(/^([A-Za-z_]\w*)\s+([|}{o.-]+)\s+([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/) : line.match(/^([A-Za-z_]\w*)(?:\s+"[^"]*")?\s*(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|--)\s*(?:"[^"]*"\s+)?([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/);
			if (rel) {
				const [, a, op, b, label] = rel;
				edges.push({
					from: ensureNode(a),
					to: ensureNode(b),
					label: label ? cleanText(label) : void 0,
					dashed: op?.includes("."),
					relation: op
				});
			}
		}
		return {
			kind: isEr ? "er" : "class",
			direction,
			nodes: Array.from(nodes.values()),
			edges
		};
	}
	for (const line of lines.slice(1)) {
		if (/^(?:subgraph|end|direction|classDef|style|accTitle|accDescr|autonumber)\b/i.test(line)) continue;
		if (isSeq) {
			const actorMatch = line.match(/^(?:actor|participant)\s+([A-Za-z_]\w*)(?:\s+as\s+(.+))?$/i);
			if (actorMatch) {
				ensureNode(actorMatch[1], actorMatch[2] || actorMatch[1]);
				continue;
			}
			const msgMatch = line.match(/^([A-Za-z_]\w*)\s*(--?>>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/);
			if (msgMatch) edges.push({
				from: ensureNode(msgMatch[1]),
				to: ensureNode(msgMatch[3]),
				label: cleanText(msgMatch[4]),
				dashed: msgMatch[2].startsWith("--")
			});
			continue;
		}
		const edgeMatch = line.match(/^(.+?)\s*(-->|-\.->|==>|---|<-->)\s*(?:\|([^|]+)\|\s*)?(.+)$/);
		const parseEndpoint = (token) => {
			const m = token.trim().match(/^([A-Za-z_][\w-]*|\[\*\])(?:\(\((.+?)\)\)|\(\[(.+?)\]\)|\[\((.+?)\)\]|\[(.+?)\]|\{(.+?)\})?$/);
			if (!m) return {
				id: safeId(token),
				label: cleanText(token),
				shape: void 0
			};
			const rawId = m[1] === "[*]" ? "start_end" : m[1];
			const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? rawId;
			const shape = m[2] ? "circle" : m[4] ? "cylinder" : m[6] ? "diamond" : void 0;
			return {
				id: ensureNode(rawId, label, shape),
				label: cleanText(label),
				shape
			};
		};
		if (edgeMatch) {
			const left = parseEndpoint(edgeMatch[1]);
			const right = parseEndpoint(edgeMatch[4]);
			edges.push({
				from: left.id,
				to: right.id,
				label: edgeMatch[3] ? cleanText(edgeMatch[3]) : void 0,
				dashed: edgeMatch[2] === "-.->"
			});
		} else parseEndpoint(line);
	}
	return {
		kind: "flowchart",
		direction,
		nodes: Array.from(nodes.values()),
		edges
	};
}
function emitFromIR(ir, target) {
	switch (target) {
		case "mermaid": {
			if (ir.kind === "er") {
				const out = ["erDiagram"];
				for (const n of ir.nodes) if (n.fields?.length) {
					out.push(`  ${n.id} {`);
					n.fields.forEach((f) => out.push(`    ${f}`));
					out.push("  }");
				} else out.push(`  ${n.id} {\n    int id PK\n  }`);
				for (const e of ir.edges) out.push(`  ${e.from} ||--o{ ${e.to} : ${e.label ? cleanText(e.label) : "relates"}`);
				return out.join("\n");
			}
			if (ir.kind === "class") {
				const out = ["classDiagram"];
				for (const n of ir.nodes) if (n.fields?.length) {
					out.push(`  class ${n.id} {`);
					n.fields.forEach((f) => out.push(`    ${f}`));
					out.push("  }");
				} else out.push(`  class ${n.id}`);
				for (const e of ir.edges) {
					const op = e.dashed ? "..>" : "-->";
					out.push(`  ${e.from} ${op} ${e.to}${e.label ? ` : ${e.label}` : ""}`);
				}
				return out.join("\n");
			}
			const out = [`flowchart ${ir.direction}`];
			for (const n of ir.nodes) {
				const lbl = `"${n.label.replace(/"/g, "'")}"`;
				const shaped = n.shape === "diamond" ? `${n.id}{${lbl}}` : n.shape === "circle" ? `${n.id}((${lbl}))` : n.shape === "cylinder" ? `${n.id}[(${lbl})]` : `${n.id}[${lbl}]`;
				out.push(`  ${shaped}`);
			}
			for (const e of ir.edges) {
				const op = e.dashed ? "-.->" : "-->";
				const lbl = e.label ? `|${e.label}|` : "";
				out.push(`  ${e.from} ${op}${lbl} ${e.to}`);
			}
			return out.join("\n");
		}
		case "dot": {
			const out = ["digraph Diagram {", `  rankdir=${ir.direction === "LR" ? "LR" : "TB"};`];
			for (const n of ir.nodes) {
				const attrs = [`label="${n.label.replace(/"/g, "\\\"")}"`];
				if (n.shape) attrs.push(`shape=${n.shape}`);
				out.push(`  ${n.id} [${attrs.join(", ")}];`);
			}
			for (const e of ir.edges) {
				const attrs = [];
				if (e.label) attrs.push(`label="${e.label.replace(/"/g, "\\\"")}"`);
				if (e.dashed) attrs.push("style=dashed");
				out.push(`  ${e.from} -> ${e.to}${attrs.length ? ` [${attrs.join(", ")}]` : ""};`);
			}
			out.push("}");
			return out.join("\n");
		}
		case "plantuml": {
			const out = ["@startuml"];
			for (const n of ir.nodes) if (n.fields?.length) {
				out.push(`class ${n.id} {`);
				n.fields.forEach((f) => out.push(`  ${f}`));
				out.push("}");
			} else out.push(`class "${n.label.replace(/"/g, "'")}" as ${n.id}`);
			for (const e of ir.edges) {
				const op = e.dashed ? "..>" : "-->";
				out.push(`${e.from} ${op} ${e.to}${e.label ? ` : ${e.label}` : ""}`);
			}
			out.push("@enduml");
			return out.join("\n");
		}
		case "d2": {
			const out = [`direction: ${ir.direction === "LR" ? "right" : "down"}`];
			for (const n of ir.nodes) {
				out.push(`${n.id}: ${n.label}`);
				if (n.shape) out.push(`${n.id}.shape: ${n.shape}`);
			}
			for (const e of ir.edges) out.push(`${e.from} -> ${e.to}${e.label ? `: ${e.label}` : ""}`);
			return out.join("\n");
		}
		case "sql": {
			const incoming = /* @__PURE__ */ new Map();
			for (const e of ir.edges) {
				const list = incoming.get(e.to) ?? [];
				list.push(e.from);
				incoming.set(e.to, list);
			}
			const out = [];
			for (const n of ir.nodes) {
				const cols = [];
				if (n.fields?.length) for (const f of n.fields) {
					const parts = f.replace(/^[+-]/, "").trim().split(/\s+/);
					const isPk = /\bPK\b/i.test(f);
					const colType = (parts[0] || "VARCHAR(255)").toUpperCase();
					const colName = safeId(parts[1] || parts[0] || "col");
					cols.push(`  ${colName} ${colType}${isPk ? " PRIMARY KEY" : ""}`);
				}
				else {
					cols.push("  id INT PRIMARY KEY");
					cols.push(`  label VARCHAR(255)`);
				}
				for (const parent of incoming.get(n.id) ?? []) cols.push(`  ${parent.toLowerCase()}_id INT REFERENCES ${parent}(id)`);
				out.push(`CREATE TABLE ${n.id} (\n${cols.join(",\n")}\n);`);
			}
			return out.join("\n");
		}
		case "typescript": {
			const outgoing = /* @__PURE__ */ new Map();
			for (const e of ir.edges) {
				const list = outgoing.get(e.from) ?? [];
				list.push(e);
				outgoing.set(e.from, list);
			}
			const out = [];
			for (const n of ir.nodes) {
				const props = [];
				if (n.fields?.length) for (const f of n.fields) {
					const clean = f.replace(/^[+-]/, "").trim();
					if (clean.includes("()")) props.push(`  ${clean.replace(/\(\)\s*(.*)$/, "(): $1").replace(/:\s*$/, ": void")};`);
					else {
						const parts = clean.split(/\s+/);
						const t = parts[0] || "string";
						const k = safeId(parts[1] || "value");
						props.push(`  ${k}: ${t};`);
					}
				}
				else {
					props.push("  id: string;");
					props.push(`  label: string;`);
				}
				for (const e of outgoing.get(n.id) ?? []) {
					const propName = safeId(e.label || e.to.toLowerCase());
					props.push(`  ${propName}: ${e.to};`);
				}
				out.push(`interface ${n.id} {\n${props.join("\n")}\n}`);
			}
			return out.join("\n");
		}
		case "xml": {
			const out = [`<diagram kind="${ir.kind}" direction="${ir.direction}">`];
			out.push("  <nodes>");
			for (const n of ir.nodes) {
				const shapeAttr = n.shape ? ` shape="${escapeXml(n.shape)}"` : "";
				if (n.fields?.length) {
					out.push(`    <class id="${escapeXml(n.id)}" name="${escapeXml(n.label)}"${shapeAttr}>`);
					for (const f of n.fields) out.push(`      <field>${escapeXml(f)}</field>`);
					out.push("    </class>");
				} else out.push(`    <node id="${escapeXml(n.id)}" label="${escapeXml(n.label)}"${shapeAttr} />`);
			}
			out.push("  </nodes>");
			out.push("  <edges>");
			for (const e of ir.edges) {
				const labelAttr = e.label ? ` label="${escapeXml(e.label)}"` : "";
				const dashedAttr = e.dashed ? ` dashed="true"` : "";
				out.push(`    <edge from="${escapeXml(e.from)}" to="${escapeXml(e.to)}"${labelAttr}${dashedAttr} />`);
			}
			out.push("  </edges>");
			out.push("</diagram>");
			return out.join("\n");
		}
	}
}
// src/lib/formats.ts
var FORMAT_LABELS = {
	mermaid: "Mermaid",
	dot: "Graphviz DOT",
	plantuml: "PlantUML",
	d2: "D2",
	sql: "SQL DDL",
	typescript: "TypeScript",
	xml: "XML"
};
var FORMAT_EXTENSIONS = {
	mermaid: "mmd",
	dot: "dot",
	plantuml: "puml",
	d2: "d2",
	sql: "sql",
	typescript: "ts",
	xml: "xml"
};
var MERMAID_HEADER_RE = /^\s*(?:%%\{[\s\S]*?\}%%\s*)?(?:flowchart|graph|classDiagram|stateDiagram(?:-v2)?|erDiagram|sequenceDiagram|gantt|mindmap|pie|journey|gitGraph|C4Context|C4Container|C4Component|requirementDiagram)\b/i;
function sanitizeId(raw) {
	const cleaned = raw.trim().replace(/^["'`]|["'`]$/g, "").replace(/[^A-Za-z0-9_]/g, "_");
	if (!cleaned) return "node";
	return /^[A-Za-z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}
function escapeMermaidLabel(raw) {
	return raw.trim().replace(/^["'`]|["'`]$/g, "").replace(/"/g, "'").replace(/\r?\n/g, " ");
}
function stripLineComments(source, prefix) {
	return source.split(/\r?\n/).map((line) => {
		const idx = line.indexOf(prefix);
		if (idx === -1) return line;
		const before = line.slice(0, idx);
		return (before.match(/"/g) ?? []).length % 2 === 0 ? before : line;
	}).join("\n");
}
function detectCodeFormat(source) {
	const trimmed = source.replace(/^\uFEFF/, "").trim();
	if (!trimmed) return "mermaid";
	if (MERMAID_HEADER_RE.test(trimmed)) return "mermaid";
	if (/^<\?xml\b|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?>[\s\S]*<\/[A-Za-z_][\w:-]*>\s*$|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?\/>\s*$/i.test(trimmed)) return "xml";
	if (/^@startuml\b/im.test(trimmed)) return "plantuml";
	if (/^(?:strict\s+)?(?:di)?graph\b[\s\S]*\{/i.test(trimmed)) return "dot";
	if (/\bCREATE\s+TABLE\b/i.test(trimmed)) return "sql";
	if (/^(?:export\s+)?(?:interface|type|class)\s+[A-Za-z_]\w*(?:\s+extends\s+|\s+implements\s+|\s*=\s*\{|\s*\{)/m.test(trimmed)) return "typescript";
	if (/^\s*[\w."'-]+\s*(?:->|<-|<->|--)\s*[\w."'-]+/m.test(trimmed)) return "d2";
	return "mermaid";
}
function parseDotAttrs(raw) {
	const attrs = {};
	for (const match of raw.matchAll(/([A-Za-z_]\w*)\s*=\s*("(?:\\.|[^"])*"|[^\s,\]]+)/g)) {
		const key = match[1]?.toLowerCase();
		const val = match[2];
		if (key && val !== void 0) attrs[key] = val.replace(/^"|"$/g, "");
	}
	return attrs;
}
function formatDotNode(id, label, shape) {
	const safeId = sanitizeId(id);
	const text = `"${escapeMermaidLabel(label || id)}"`;
	switch (shape?.toLowerCase()) {
		case "diamond": return `${safeId}{${text}}`;
		case "circle":
		case "doublecircle": return `${safeId}((${text}))`;
		case "ellipse":
		case "oval": return `${safeId}([${text}])`;
		case "cylinder": return `${safeId}[(${text})]`;
		default: return `${safeId}[${text}]`;
	}
}
function convertDotToMermaid(source) {
	const cleaned = stripLineComments(source.replace(/\/\*[\s\S]*?\*\//g, ""), "//");
	const dir = cleaned.match(/\brankdir\s*=\s*"?(TB|TD|BT|RL|LR)"?/i)?.[1]?.toUpperCase() || "TD";
	const lines = [`flowchart ${dir === "TB" ? "TD" : dir}`];
	const declared = /* @__PURE__ */ new Map();
	const edges = [];
	const bodyStart = cleaned.indexOf("{");
	const bodyEnd = cleaned.lastIndexOf("}");
	const statements = (bodyStart !== -1 && bodyEnd > bodyStart ? cleaned.slice(bodyStart + 1, bodyEnd) : cleaned).replace(/\r?\n/g, ";").split(";").map((s) => s.trim()).filter(Boolean);
	for (const stmt of statements) {
		if (/^(?:subgraph|node|edge|graph|rankdir|rank|splines|nodesep|ranksep)\b/i.test(stmt) || stmt === "{" || stmt === "}") continue;
		if (/^[A-Za-z_]\w*\s*=/.test(stmt)) continue;
		const attrMatch = stmt.match(/\[([^\]]*)\]\s*$/);
		const attrs = attrMatch ? parseDotAttrs(attrMatch[1] ?? "") : {};
		const expr = (attrMatch ? stmt.slice(0, attrMatch.index) : stmt).trim();
		if (/->|--/.test(expr)) {
			const parts = expr.split(/\s*(?:->|--)\s*/).map((p) => p.replace(/:[A-Za-z_]\w*$/, "").trim()).filter(Boolean);
			const isUndirected = expr.includes("--") && !expr.includes("->");
			const dashed = /dashed|dotted/i.test(attrs.style ?? "");
			const op = isUndirected ? dashed ? "-.-" : "---" : dashed ? "-.->" : "-->";
			const edgeLabel = attrs.label ? `|${escapeMermaidLabel(attrs.label)}|` : "";
			for (let i = 0; i < parts.length - 1; i += 1) {
				const fromId = sanitizeId(parts[i]);
				const toId = sanitizeId(parts[i + 1]);
				if (!declared.has(fromId)) declared.set(fromId, {});
				if (!declared.has(toId)) declared.set(toId, {});
				edges.push(`  ${fromId} ${op}${edgeLabel} ${toId}`);
			}
			continue;
		}
		const nodeToken = expr.replace(/[:{}].*$/, "").trim();
		if (nodeToken) {
			const safeId = sanitizeId(nodeToken);
			const prev = declared.get(safeId) ?? {};
			declared.set(safeId, {
				label: attrs.label ?? prev.label ?? nodeToken.replace(/^"|"$/g, ""),
				shape: attrs.shape ?? prev.shape
			});
		}
	}
	for (const [id, info] of declared) lines.push(`  ${formatDotNode(id, info.label, info.shape)}`);
	lines.push(...edges);
	return lines.join("\n");
}
function convertPlantUmlToMermaid(source) {
	const rawLines = source.replace(/@startuml[^\n]*\n?/i, "").replace(/@enduml[^\n]*$/i, "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("'") && !l.startsWith("skinparam"));
	if (rawLines.some((l) => /^(?:actor|participant|boundary|control|entity|database)\b/i.test(l) || /^\w+\s*-+>>?\s*\w+\s*:/i.test(l))) {
		const out = ["sequenceDiagram"];
		for (const line of rawLines) if (/^(?:actor|participant)\s+/i.test(line)) out.push(`  ${line.replace(/\s+as\s+/i, " as ")}`);
		else if (/^([A-Za-z_]\w*)\s*(--?>?>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/.test(line)) {
			const [, from, arrow, to, msg] = line.match(/^([A-Za-z_]\w*)\s*(--?>?>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/);
			const mArrow = arrow.startsWith("--") ? "-->>" : "->>";
			out.push(`  ${sanitizeId(from)} ${mArrow} ${sanitizeId(to)}: ${msg}`);
		}
		return out.join("\n");
	}
	if (rawLines.some((l) => /\[\*\]/.test(l) || /^state\s+/i.test(l))) {
		const out = ["stateDiagram-v2"];
		for (const line of rawLines) {
			const m = line.match(/^(\[\*\]|[A-Za-z_]\w*)\s*-+>\s*(\[\*\]|[A-Za-z_]\w*)(?:\s*:\s*(.+))?$/);
			if (m) out.push(`  ${m[1]} --> ${m[2]}${m[3] ? ` : ${m[3]}` : ""}`);
		}
		return out.join("\n");
	}
	const out = ["classDiagram"];
	let inBlock = false;
	for (const line of rawLines) {
		if (!inBlock && /^(?:class|interface|enum|abstract\s+class)\s+/i.test(line)) {
			const normalized = line.replace(/^abstract\s+/i, "").replace(/^(?:interface|enum)\s+/i, "class ");
			out.push(`  ${normalized}`);
			if (line.includes("{") && !line.includes("}")) inBlock = true;
			continue;
		}
		if (inBlock) {
			out.push(`  ${line}`);
			if (line.includes("}")) inBlock = false;
			continue;
		}
		const rel = line.match(/^([A-Za-z_]\w*)\s*(<\|--|\*--|o--|-->|<--|\.\.>|\.\.\|>|--)\s*([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/);
		if (rel) {
			const arrow = rel[2] === "->" ? "-->" : rel[2];
			out.push(`  ${sanitizeId(rel[1])} ${arrow} ${sanitizeId(rel[3])}${rel[4] ? ` : ${rel[4]}` : ""}`);
		}
	}
	return out.join("\n");
}
function convertD2ToMermaid(source) {
	const cleaned = stripLineComments(source, "#");
	const out = [`flowchart ${{
		right: "LR",
		left: "RL",
		down: "TD",
		up: "BT"
	}[cleaned.match(/^\s*direction\s*:\s*(right|left|down|up)\b/im)?.[1]?.toLowerCase() ?? "down"] ?? "TD"}`];
	const nodes = /* @__PURE__ */ new Map();
	const edges = [];
	const stack = [];
	const ensureNode = (rawId, label, shape) => {
		const safeId = sanitizeId([...stack, rawId.trim()].join("_"));
		const prev = nodes.get(safeId);
		nodes.set(safeId, {
			label: label ?? prev?.label ?? rawId.trim().replace(/^["']|["']$/g, ""),
			shape: shape ?? prev?.shape
		});
		return safeId;
	};
	for (const rawLine of cleaned.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || /^(?:direction|style)\b/i.test(line)) continue;
		if (line === "}") {
			if (stack.length > 0) {
				stack.pop();
				out.push("  end");
			}
			continue;
		}
		const blockStart = line.match(/^([A-Za-z0-9_.\s-]+?)\s*:\s*\{$/);
		if (blockStart) {
			const groupName = blockStart[1].trim();
			const groupId = sanitizeId([...stack, groupName].join("_"));
			stack.push(groupName);
			out.push(`  subgraph ${groupId}["${escapeMermaidLabel(groupName)}"]`);
			continue;
		}
		const edgeMatch = line.match(/^([A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)*)\s*(->|<-|<->|--)\s*([A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)*)(?:\s*:\s*(.+))?$/);
		if (edgeMatch) {
			const [, rawA, op, rawB, rawLabel] = edgeMatch;
			const a = ensureNode(rawA);
			const b = ensureNode(rawB);
			const mOp = op === "<->" ? "<-->" : op === "--" ? "---" : "-->";
			const label = rawLabel ? `|${escapeMermaidLabel(rawLabel)}|` : "";
			if (op === "<-") edges.push(`  ${b} -->${label} ${a}`);
			else edges.push(`  ${a} ${mOp}${label} ${b}`);
			continue;
		}
		const shapeMatch = line.match(/^([A-Za-z0-9_.-]+)\.shape\s*:\s*([A-Za-z]+)$/i);
		if (shapeMatch) {
			ensureNode(shapeMatch[1], void 0, shapeMatch[2]);
			continue;
		}
		const labelMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.+)$/);
		if (labelMatch && !line.includes("{")) ensureNode(labelMatch[1], labelMatch[2]);
	}
	for (const [id, info] of nodes) out.push(`  ${formatDotNode(id, info.label, info.shape)}`);
	out.push(...edges);
	return out.join("\n");
}
function convertSqlToMermaid(source) {
	const cleaned = stripLineComments(source.replace(/\/\*[\s\S]*?\*\//g, ""), "--");
	const out = ["erDiagram"];
	const relations = [];
	const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"[]?\w+[`"\]]?\.)?[`"[]?(\w+)[`"\]]?\s*\(([\s\S]*?)\)\s*;/gi;
	const fallbackRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"[]?\w+[`"\]]?\.)?[`"[]?(\w+)[`"\]]?\s*\(([\s\S]*?)\)(?:\s*;|\s*$)/gi;
	const matches = Array.from(cleaned.matchAll(tableRe));
	const tableMatches = matches.length > 0 ? matches : Array.from(cleaned.matchAll(fallbackRe));
	for (const match of tableMatches) {
		const tableName = sanitizeId(match[1]);
		const body = match[2] ?? "";
		const cols = [];
		const parts = body.split(/,(?![^(]*\))/).map((p) => p.trim()).filter(Boolean);
		for (const part of parts) {
			const fkMatch = part.match(/(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[`"[]?(\w+)[`"\]]?/i);
			if (fkMatch) {
				const target = sanitizeId(fkMatch[1]);
				relations.push(`  ${target} ||--o{ ${tableName} : references`);
				continue;
			}
			if (/^(?:PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(part)) continue;
			const colMatch = part.match(/^[`"[]?(\w+)[`"\]]?\s+([A-Za-z0-9_]+)/);
			if (!colMatch) continue;
			const colName = sanitizeId(colMatch[1]);
			const colType = colMatch[2].toLowerCase();
			const isPk = /\bPRIMARY\s+KEY\b/i.test(part);
			const refMatch = part.match(/\bREFERENCES\s+[`"[]?(\w+)[`"\]]?/i);
			const keyTag = isPk ? " PK" : refMatch ? " FK" : "";
			cols.push(`    ${colType} ${colName}${keyTag}`);
			if (refMatch) {
				const target = sanitizeId(refMatch[1]);
				relations.push(`  ${target} ||--o{ ${tableName} : references`);
			}
		}
		out.push(`  ${tableName} {`);
		out.push(...cols);
		out.push("  }");
	}
	out.push(...Array.from(new Set(relations)));
	return out.join("\n");
}
function convertTypeScriptToMermaid(source) {
	const cleaned = stripLineComments(source.replace(/\/\*[\s\S]*?\*\//g, ""), "//");
	const out = ["classDiagram"];
	const knownTypes = /* @__PURE__ */ new Set();
	const relations = [];
	const blocks = Array.from(cleaned.matchAll(/(?:export\s+)?(?:interface|class|type)\s+(\w+)(?:\s+extends\s+([\w,\s]+?))?(?:\s+implements\s+([\w,\s]+?))?\s*(?:=\s*)?\{([\s\S]*?)\}/g));
	blocks.forEach((m) => {
		if (m[1]) knownTypes.add(sanitizeId(m[1]));
	});
	for (const match of blocks) {
		const name = sanitizeId(match[1]);
		const parents = [...match[2]?.split(",") ?? [], ...match[3]?.split(",") ?? []].map((p) => p.trim()).filter(Boolean);
		for (const parent of parents) {
			const parentId = sanitizeId(parent);
			relations.push(`  ${parentId} <|-- ${name}`);
		}
		out.push(`  class ${name} {`);
		const body = match[4] ?? "";
		for (const rawLine of body.split(/[;\r\n]+/)) {
			const line = rawLine.trim();
			if (!line) continue;
			const methodMatch = line.match(/^(?:(?:public|private|protected|readonly|static)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*([^;{]+))?/);
			if (methodMatch) {
				const ret = methodMatch[3]?.trim() || "void";
				out.push(`    +${methodMatch[1]}() ${escapeMermaidLabel(ret)}`);
				continue;
			}
			const propMatch = line.match(/^(?:(?:public|private|protected|readonly|static)\s+)*(\w+)\??\s*:\s*(.+)$/);
			if (propMatch) {
				const propName = propMatch[1];
				const propType = propMatch[2].trim().replace(/,$/, "");
				out.push(`    +${escapeMermaidLabel(propType)} ${propName}`);
				for (const token of propType.matchAll(/\b([A-Z]\w*)\b/g)) {
					const ref = sanitizeId(token[1]);
					if (knownTypes.has(ref) && ref !== name) relations.push(`  ${name} --> ${ref} : ${propName}`);
				}
			}
		}
		out.push("  }");
	}
	out.push(...Array.from(new Set(relations)));
	return out.join("\n");
}
function toMermaidSource(source) {
	const format = detectCodeFormat(source);
	switch (format) {
		case "xml": return {
			format,
			mermaid: emitFromIR(parseXmlToIR(source), "mermaid")
		};
		case "dot": return {
			format,
			mermaid: convertDotToMermaid(source)
		};
		case "plantuml": return {
			format,
			mermaid: convertPlantUmlToMermaid(source)
		};
		case "d2": return {
			format,
			mermaid: convertD2ToMermaid(source)
		};
		case "sql": return {
			format,
			mermaid: convertSqlToMermaid(source)
		};
		case "typescript": return {
			format,
			mermaid: convertTypeScriptToMermaid(source)
		};
		default: return {
			format: "mermaid",
			mermaid: source
		};
	}
}
function translateCodeFormat(source, target) {
	const format = detectCodeFormat(source);
	if (format === target) return source;
	return emitFromIR(format === "xml" ? parseXmlToIR(source) : parseMermaidToIR(toMermaidSource(source).mermaid), target);
}
Promise.resolve();
function detectDiagramType(source) {
	const firstLine = toMermaidSource(source).mermaid.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]?.trim() ?? "";
	if (/^(flowchart|graph)\b/i.test(firstLine)) return "flowchart";
	if (/^classDiagram\b/i.test(firstLine)) return "class";
	if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return "state";
	if (/^erDiagram\b/i.test(firstLine)) return "er";
	if (/^sequenceDiagram\b/i.test(firstLine)) return "sequence";
	if (/^gantt\b/i.test(firstLine)) return "gantt";
	if (/^mindmap\b/i.test(firstLine)) return "mindmap";
	if (/^pie\b/i.test(firstLine)) return "pie";
	if (/^journey\b/i.test(firstLine)) return "journey";
	return "other";
}
// mcp/src/dom-polyfill.ts
function attachDomHelpers(root) {
	if (!root) return;
	const walk = (node) => {
		if (node.nodeType === 1) {
			if (!("children" in node)) Object.defineProperty(node, "children", {
				configurable: true,
				get() {
					const list = [];
					const children = node.childNodes;
					if (children) for (let i = 0; i < children.length; i += 1) {
						const child = children[i];
						if (child && child.nodeType === 1) list.push(child);
					}
					return list;
				}
			});
			if (typeof node.querySelectorAll !== "function") node.querySelectorAll = (selector) => {
				return querySelectorAllOnNode(node, selector);
			};
			if (typeof node.querySelector !== "function") node.querySelector = (selector) => {
				return querySelectorAllOnNode(node, selector)[0] ?? null;
			};
		}
		const children = node.childNodes;
		if (children) for (let i = 0; i < children.length; i += 1) {
			const child = children[i];
			if (child) walk(child);
		}
	};
	walk(root);
}
function querySelectorAllOnNode(root, selector) {
	const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);
	const results = [];
	const seen = /* @__PURE__ */ new Set();
	const addMatch = (el) => {
		if (!seen.has(el)) {
			seen.add(el);
			results.push(el);
		}
	};
	for (const part of parts) if (part.startsWith(":scope >")) {
		const tag = part.slice(8).trim();
		const children = root.childNodes;
		if (children) for (let i = 0; i < children.length; i += 1) {
			const child = children[i];
			if (child && child.nodeType === 1 && (child.tagName === tag || child.localName === tag)) addMatch(child);
		}
	} else {
		const descendants = root.getElementsByTagName?.(part);
		if (descendants) for (let i = 0; i < descendants.length; i += 1) {
			const el = descendants[i];
			if (el) addMatch(el);
		}
	}
	return results;
}
function ensureNodeDomPolyfills() {
	if (typeof globalThis.Node === "undefined") globalThis.Node = {
		ELEMENT_NODE: 1,
		TEXT_NODE: 3
	};
	if (typeof globalThis.DOMParser === "undefined") {
		class NodeDOMParser {
			parseFromString(source, _mimeType) {
				let hasParseError = false;
				const parser = new DOMParser$1({ onError: () => {
					hasParseError = true;
				} });
				let doc;
				try {
					doc = parser.parseFromString(source, "text/xml");
				} catch {
					hasParseError = true;
					doc = parser.parseFromString("<parsererror />", "text/xml");
				}
				if (!doc.documentElement) hasParseError = true;
				attachDomHelpers(doc.documentElement);
				const docLike = doc;
				docLike.querySelectorAll = (selector) => {
					if (selector === "parsererror") return hasParseError ? [{ tagName: "parsererror" }] : [];
					if (!doc.documentElement) return [];
					const root = doc.documentElement;
					const matches = querySelectorAllOnNode(root, selector);
					if (selector.split(",").map((s) => s.trim()).filter(Boolean).some((p) => !p.startsWith(":scope") && (root.tagName === p || root.localName === p))) return [root, ...matches.filter((m) => m !== root)];
					return matches;
				};
				docLike.querySelector = (selector) => {
					return docLike.querySelectorAll(selector)[0] ?? null;
				};
				return doc;
			}
		}
		globalThis.DOMParser = NodeDOMParser;
	}
}
// mcp/src/server.ts
var CODE_FORMATS = [
	"mermaid",
	"dot",
	"plantuml",
	"d2",
	"sql",
	"typescript",
	"xml"
];
var FormatSchema = z.enum(CODE_FORMATS);
var IRNodeSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	shape: z.string().optional(),
	fields: z.array(z.string()).optional()
});
var IREdgeSchema = z.object({
	from: z.string().min(1),
	to: z.string().min(1),
	label: z.string().optional(),
	dashed: z.boolean().optional(),
	relation: z.string().optional()
});
var DiagramIRSchema = z.object({
	kind: z.enum([
		"flowchart",
		"class",
		"er"
	]),
	direction: z.enum(["TD", "LR"]),
	nodes: z.array(IRNodeSchema),
	edges: z.array(IREdgeSchema)
});
function parseSourceToIR(source) {
	ensureNodeDomPolyfills();
	const sourceFormat = detectCodeFormat(source);
	return {
		sourceFormat,
		ir: sourceFormat === "xml" ? parseXmlToIR(source) : parseMermaidToIR(toMermaidSource(source).mermaid)
	};
}
function formatErrorResult(error) {
	return {
		isError: true,
		content: [{
			type: "text",
			text: `Error: ${error instanceof Error ? error.message : String(error)}`
		}]
	};
}
function createSgsStudioMcpServer(version = "1.0.0") {
	ensureNodeDomPolyfills();
	const server = new McpServer({
		name: "sgs-studio",
		version
	}, { instructions: "SGS Studio MCP server for detecting, parsing, converting, and translating diagrams across Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML (Draw.io, BPMN, and generic XML)." });
	server.registerTool("detect_format", {
		title: "Detect Diagram / Code Format",
		description: "Auto-detect the format of a diagram or code snippet (mermaid, dot, plantuml, d2, sql, typescript, xml) and its Mermaid diagram type.",
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.") },
		annotations: { readOnlyHint: true }
	}, async ({ source }) => {
		try {
			const format = detectCodeFormat(source);
			const diagramType = detectDiagramType(source);
			const result = {
				format,
				formatLabel: FORMAT_LABELS[format],
				extension: FORMAT_EXTENSIONS[format],
				diagramType
			};
			return {
				content: [{
					type: "text",
					text: JSON.stringify(result, null, 2)
				}],
				structuredContent: result
			};
		} catch (error) {
			return formatErrorResult(error);
		}
	});
	server.registerTool("to_mermaid", {
		title: "Convert Code/Diagram to Mermaid",
		description: "Convert Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, or XML (Draw.io mxGraphModel, BPMN, explicit diagram XML, or generic XML) into Mermaid syntax.",
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.") },
		annotations: { readOnlyHint: true }
	}, async ({ source }) => {
		try {
			ensureNodeDomPolyfills();
			const { format, mermaid } = toMermaidSource(source);
			const diagramType = detectDiagramType(mermaid);
			return {
				content: [{
					type: "text",
					text: mermaid
				}],
				structuredContent: {
					sourceFormat: format,
					diagramType,
					mermaid
				}
			};
		} catch (error) {
			return formatErrorResult(error);
		}
	});
	server.registerTool("translate_format", {
		title: "Translate Between Diagram Formats",
		description: "Translate diagram or code source between any two supported SGS Studio formats: mermaid, dot, plantuml, d2, sql, typescript, xml.",
		inputSchema: {
			source: z.string().trim().min(1, "Source must not be empty."),
			targetFormat: FormatSchema
		},
		annotations: { readOnlyHint: true }
	}, async ({ source, targetFormat }) => {
		try {
			ensureNodeDomPolyfills();
			const sourceFormat = detectCodeFormat(source);
			const output = translateCodeFormat(source, targetFormat);
			return {
				content: [{
					type: "text",
					text: output
				}],
				structuredContent: {
					sourceFormat,
					targetFormat,
					output
				}
			};
		} catch (error) {
			return formatErrorResult(error);
		}
	});
	server.registerTool("parse_diagram_ir", {
		title: "Parse Diagram to Intermediate Representation",
		description: "Parse any supported diagram or code format into SGS Studio's structured DiagramIR (kind, direction, nodes, edges).",
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.") },
		annotations: { readOnlyHint: true }
	}, async ({ source }) => {
		try {
			const result = parseSourceToIR(source);
			return {
				content: [{
					type: "text",
					text: JSON.stringify(result, null, 2)
				}],
				structuredContent: result
			};
		} catch (error) {
			return formatErrorResult(error);
		}
	});
	server.registerTool("emit_from_ir", {
		title: "Emit Diagram from Intermediate Representation",
		description: "Generate diagram or code in any target format (mermaid, dot, plantuml, d2, sql, typescript, xml) from a structured DiagramIR object.",
		inputSchema: {
			ir: DiagramIRSchema,
			targetFormat: FormatSchema
		},
		annotations: { readOnlyHint: true }
	}, async ({ ir, targetFormat }) => {
		try {
			const output = emitFromIR(ir, targetFormat);
			return {
				content: [{
					type: "text",
					text: output
				}],
				structuredContent: {
					targetFormat,
					output
				}
			};
		} catch (error) {
			return formatErrorResult(error);
		}
	});
	server.registerTool("list_templates", {
		title: "List SGS Studio Diagram Templates",
		description: "List built-in SGS Studio diagram templates or retrieve a specific template by name.",
		inputSchema: { name: z.string().optional() },
		annotations: { readOnlyHint: true }
	}, async ({ name }) => {
		if (name) {
			const matchedKey = Object.keys(TEMPLATES).find((key) => key.toLowerCase() === name.trim().toLowerCase());
			if (!matchedKey) return formatErrorResult(`Unknown template "${name}". Available templates: ${Object.keys(TEMPLATES).join(", ")}`);
			const code = TEMPLATES[matchedKey];
			return {
				content: [{
					type: "text",
					text: code
				}],
				structuredContent: {
					name: matchedKey,
					code
				}
			};
		}
		const templates = Object.entries(TEMPLATES).map(([templateName, code]) => ({
			name: templateName,
			diagramType: detectDiagramType(code),
			code
		}));
		return {
			content: [{
				type: "text",
				text: JSON.stringify({ templates }, null, 2)
			}],
			structuredContent: { templates }
		};
	});
	server.registerTool("get_studio_info", {
		title: "Get SGS Studio Capabilities",
		description: "Return SGS Studio supported formats, file extensions, theme presets, and web app URL.",
		inputSchema: {},
		annotations: { readOnlyHint: true }
	}, async () => {
		const info = {
			name: "SGS Studio",
			url: "https://sgs-chify.vercel.app/",
			repository: "https://github.com/cxernlol/sgs-chify",
			formats: CODE_FORMATS.map((id) => ({
				id,
				label: FORMAT_LABELS[id],
				extension: FORMAT_EXTENSIONS[id]
			})),
			themes: Object.keys(THEME_PRESETS),
			templates: Object.keys(TEMPLATES)
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(info, null, 2)
			}],
			structuredContent: info
		};
	});
	server.registerResource("formats", "sgs://formats", {
		title: "SGS Studio Supported Formats",
		description: "Supported diagram and code formats with labels and file extensions.",
		mimeType: "application/json"
	}, async (uri) => ({ contents: [{
		uri: uri.href,
		mimeType: "application/json",
		text: JSON.stringify(CODE_FORMATS.map((id) => ({
			id,
			label: FORMAT_LABELS[id],
			extension: FORMAT_EXTENSIONS[id]
		})), null, 2)
	}] }));
	server.registerResource("themes", "sgs://themes", {
		title: "SGS Studio Theme Presets",
		description: "Built-in color palette presets for SGS Studio diagrams.",
		mimeType: "application/json"
	}, async (uri) => ({ contents: [{
		uri: uri.href,
		mimeType: "application/json",
		text: JSON.stringify(THEME_PRESETS, null, 2)
	}] }));
	server.registerResource("template", new ResourceTemplate("sgs://templates/{name}", { list: async () => ({ resources: Object.keys(TEMPLATES).map((name) => ({
		uri: `sgs://templates/${encodeURIComponent(name)}`,
		name,
		mimeType: "text/plain"
	})) }) }), {
		title: "SGS Studio Diagram Template",
		description: "Built-in Mermaid diagram template.",
		mimeType: "text/plain"
	}, async (uri, { name }) => {
		const requested = decodeURIComponent(String(name ?? ""));
		const matchedKey = Object.keys(TEMPLATES).find((key) => key.toLowerCase() === requested.toLowerCase());
		if (!matchedKey) throw new Error(`Template "${requested}" not found.`);
		return { contents: [{
			uri: uri.href,
			mimeType: "text/plain",
			text: TEMPLATES[matchedKey]
		}] };
	});
	server.registerPrompt("code_to_diagram", {
		title: "Code to Diagram",
		description: "Convert source code, SQL schema, XML, or architecture notes into a clean diagram using SGS Studio.",
		argsSchema: {
			source: z.string().describe("Source code, schema, or diagram text to convert"),
			targetFormat: FormatSchema.optional().describe("Desired output format (defaults to mermaid)")
		}
	}, ({ source, targetFormat }) => ({ messages: [{
		role: "user",
		content: {
			type: "text",
			text: [
				`Use SGS Studio MCP tools (\`detect_format\`, \`to_mermaid\`, \`translate_format\`, \`parse_diagram_ir\`) to convert the following input into a clean ${targetFormat ?? "mermaid"} diagram:`,
				"",
				"```",
				source,
				"```"
			].join("\n")
		}
	}] }));
	return server;
}
// mcp/src/index.ts
async function main() {
	const args = process.argv.slice(2);
	if (args.includes("--version") || args.includes("-v")) {
		process.stdout.write(`${package_default.version}\n`);
		return;
	}
	if (args.includes("--help") || args.includes("-h")) {
		process.stdout.write([
			`${package_default.name} v${package_default.version}`,
			"SGS Studio Model Context Protocol (MCP) server over stdio.",
			"",
			"Usage:",
			"  npx sgs-studio-mcp",
			"  sgs-studio-mcp [--help | --version]",
			"",
			"Connect from Claude Desktop, Cursor, Windsurf, or VS Code via stdio."
		].join("\n") + "\n");
		return;
	}
	const server = createSgsStudioMcpServer(package_default.version);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`SGS Studio MCP server v${package_default.version} running on stdio`);
}
main().catch((error) => {
	console.error("Fatal error in SGS Studio MCP server:", error);
	process.exit(1);
});
export {};
