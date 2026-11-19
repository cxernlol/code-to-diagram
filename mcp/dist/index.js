#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHash } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import "dompurify";
import { DOMParser as DOMParser$1 } from "@xmldom/xmldom";
var package_default = {
	name: "ctd-mcp",
	version: "1.3.0",
	description: "CTD Studio MCP server — convert and translate Mermaid (v12.3.0), Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML diagrams via npx.",
	type: "module",
	license: "Elastic-2.0",
	main: "./dist/index.js",
	bin: { "ctd-mcp": "dist/index.js" },
	files: ["dist", "README.md"],
	engines: { "node": ">=22" },
	keywords: [
		"mcp",
		"model-context-protocol",
		"ctd-studio",
		"ctd-mcp",
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
		"url": "git+https://github.com/cxernlol/code-to-diagram.git",
		"directory": "mcp"
	},
	homepage: "https://code-to-diagram.vercel.app/",
	bugs: { "url": "https://github.com/cxernlol/code-to-diagram/issues" },
	dependencies: {
		"@modelcontextprotocol/sdk": "^1.32.2",
		"@xmldom/xmldom": "^0.9.12",
		"zod": "^4.6.7"
	}
};
// src/constants.ts
var THEME_PRESETS = {
	default: {
		primaryColor: "#f3f7f5",
		textColor: "#1c3439",
		lineColor: "#315158",
		canvasColor: "#eaf0ed"
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
  System(app, "CTD Studio", "Browser diagramming app.")
  System_Ext(ai, "AI API", "Diagram generation.")
  Rel(user, app, "Uses")
  Rel(app, ai, "Requests completions")`,
	"Requirement Diagram": `requirementDiagram
  requirement req_render {
    id: "REQ-01"
    text: "Real-time debounced render within 250ms."
    risk: low
    verifymethod: test
  }
  element renderer {
    type: "module"
  }
  renderer - satisfies -> req_render`,
	"DOT Graph": `digraph ServiceFlow {
  rankdir=LR;
  Client [label="Web Client"];
  API [label="API Gateway"];
  Valid [label="Token Valid?", shape=diamond];
  DB [label="Database", shape=cylinder];
  Client -> API [label="HTTPS"];
  API -> Valid [label="Check"];
  Valid -> DB [label="Query"];
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
Compiler -> Canvas: Mermaid code
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
	"TypeScript Types": `interface Entity {
  id: string;
}
interface User extends Entity {
  email: string;
}
class Diagram implements Entity {
  id: string;
  owner: User;
  exportSvg(): string;
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
</diagram>`,
	"API Auth Flow": `flowchart TD
  Req([Client Request]) --> GW[API Gateway]
  GW --> Auth{JWT Valid?}
  Auth -->|Yes| Handler[Route Handler]
  Auth -->|No| Err([401 Unauthorized])
  Handler --> Cache[(Redis Cache)]
  Handler -.->|Async Log| Audit[Audit Queue]
  Handler ==> Resp([200 OK])`,
	"CI/CD Pipeline": `flowchart LR
  Push([Push to main]) --> Check[Typecheck & Build]
  Check --> Tests[Unit & E2E Tests]
  Tests --> Pass{All Passed?}
  Pass -->|Yes| Deploy[Deploy Production]
  Pass -.->|Failed| Alert([Notify Author])
  Deploy --> Live([Live])`,
	"Microservices Flow": `flowchart LR
  Web([Web App]) --> Gateway[API Gateway]
  Gateway --> Auth[Auth Service]
  Gateway --> Orders[Order Service]
  Orders --> DB[(Postgres)]
  Orders -.->|order.created| Bus[Event Bus]
  Bus -.-> Mail[Notification Worker]`,
	"Checkout Sequence": `sequenceDiagram
  autonumber
  actor Customer
  participant App as Web App
  participant Pay as Payment API
  Customer->>App: Submit checkout
  App->>Pay: Authorize card
  alt Approved
    Pay-->>App: 200 Paid
    App-->>Customer: Order confirmed
  else Declined
    Pay-->>App: 402 Declined
    App-->>Customer: Retry payment
  end`,
	"BPMN Flow": `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="OrderProcess">
    <startEvent id="Start" name="Order Placed" />
    <task id="Check" name="Verify Stock" />
    <exclusiveGateway id="InStock" name="In Stock?" />
    <endEvent id="Ship" name="Ship Order" />
    <sequenceFlow sourceRef="Start" targetRef="Check" />
    <sequenceFlow sourceRef="Check" targetRef="InStock" />
    <sequenceFlow sourceRef="InStock" targetRef="Ship" name="Yes" />
  </process>
</definitions>`,
	"UML Class (Suppression)": `@startuml
hide methods
hide empty members
interface Repository {
  +findById(id: string)
}
class User {
  +id: UUID
  -passwordHash: string
  #role: Role
  +authenticate()
}
class Order {
  +id: UUID
  -totalCents: number
  +markPaid()
}
Repository <|.. User
User "1" --> "*" Order : places
@enduml`,
	"UML Activity": `@startuml
start
:Receive Webhook;
if (Signature valid?) then (yes)
  :Enqueue Job;
  if (Idempotent?) then (yes)
    :Update Record;
  else (no)
    :Skip Duplicate;
  endif
else (no)
  :Return 401;
endif
stop
@enduml`,
	"System Architecture": `flowchart LR
  Client([Browser / Mobile]) --> CDN[CDN / Edge]
  CDN --> GW[API Gateway]
  GW --> Auth[Auth Service]
  GW --> Core[Core API]
  Core --> Cache[(Redis Cache)]
  Core --> DB[(Primary Postgres)]
  Core --> Queue[[Event Bus]]`,
	"Event-Driven Queue": `flowchart LR
  Producer[Order Service] -->|publish| Topic[(orders.created)]
  Topic --> WorkerA[Billing Worker]
  Topic --> WorkerB[Email Worker]
  WorkerA -->|retry > 3| DLQ[(Dead Letter Queue)]
  WorkerA --> Ledger[(Ledger DB)]`,
	"Deployment Topology": `flowchart TD
  Ingress[Load Balancer / TLS] --> App1[App Pod 1]
  Ingress --> App2[App Pod 2]
  App1 --> Primary[(Postgres Primary)]
  App2 --> Primary
  Primary -->|async replication| Replica[(Read Replica)]
  App1 --> Bucket[(Object Storage)]`,
	"Loop Trace": `flowchart TD
  Start([Start]) --> Init[i = 0]
  Init --> Cond{i < n?}
  Cond -->|Yes| Body[Process item i]
  Body --> Inc[i = i + 1]
  Inc --> Cond
  Cond -->|No| End([Done])`,
	"Intro OOP": `classDiagram
  class Shape {
    +String color
    +draw() void
  }
  class Circle {
    +int radius
  }
  class Rectangle {
    +int width
    +int height
  }
  Shape <|-- Circle
  Shape <|-- Rectangle`,
	"Student ER Lab": `erDiagram
  STUDENT ||--o{ ENROLLMENT : has
  COURSE ||--o{ ENROLLMENT : includes
  STUDENT {
    int id PK
    string name
  }
  COURSE {
    int id PK
    string title
  }
  ENROLLMENT {
    int student_id FK
    int course_id FK
    date enrolled_on
  }`,
	"Vending Machine": `stateDiagram-v2
  [*] --> Idle
  Idle --> Selecting : insert coin
  Selecting --> Dispensing : valid choice
  Selecting --> Idle : cancel
  Dispensing --> Idle : item delivered`
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
var MAX_XML_BYTES = 524288;
var MAX_XML_DEPTH = 64;
var MAX_XML_NODES = 1500;
function parseXmlToIR(source) {
	if (source.length > MAX_XML_BYTES) throw new Error("XML input exceeds the 512 KB limit.");
	if (/<!(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error("XML DOCTYPE and ENTITY declarations are not allowed.");
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
	const walk = (el, parentId, depth = 0) => {
		if (depth > MAX_XML_DEPTH) throw new Error(`XML nesting exceeds the maximum supported depth (${MAX_XML_DEPTH}).`);
		counter += 1;
		if (counter > MAX_XML_NODES) throw new Error(`XML exceeds the maximum supported element count (${MAX_XML_NODES}).`);
		const rawId = el.getAttribute("id") || `${el.tagName}_${counter}`;
		const textOnly = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim() ?? "").join(" ").trim();
		const label = el.getAttribute("label") || el.getAttribute("name") || (textOnly ? `${el.tagName}: ${textOnly}` : el.tagName);
		const id = addNode(rawId, label);
		if (parentId) edges.push({
			from: parentId,
			to: id
		});
		Array.from(el.children).forEach((child) => walk(child, id, depth + 1));
	};
	walk(root, void 0, 0);
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
			const escapeDot = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
			const out = ["digraph Diagram {", `  rankdir=${ir.direction === "LR" ? "LR" : "TB"};`];
			for (const n of ir.nodes) {
				const attrs = [`label="${escapeDot(n.label)}"`];
				if (n.shape) attrs.push(`shape=${n.shape}`);
				out.push(`  ${n.id} [${attrs.join(", ")}];`);
			}
			for (const e of ir.edges) {
				const attrs = [];
				if (e.label) attrs.push(`label="${escapeDot(e.label)}"`);
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
	if (/^<\?xml\b|^<!DOCTYPE\b|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?>[\s\S]*<\/[A-Za-z_][\w:-]*>\s*$|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?\/>\s*$/i.test(trimmed)) return "xml";
	if (/^@startuml\b/im.test(trimmed)) return "plantuml";
	if (/^(?:strict\s+)?(?:di)?graph\b[\s\S]*\{/i.test(trimmed)) return "dot";
	if (/\bCREATE\s+TABLE\b/i.test(trimmed)) return "sql";
	if (/^(?:export\s+)?(?:interface|type|class)\s+[A-Za-z_]\w*(?:\s+extends\s+|\s+implements\s+|\s*=\s*\{|\s*\{)/m.test(trimmed)) return "typescript";
	if (/^\s*[\w."'-]+\s*(?:->|<-|<->|--)\s*[\w."'-]+/m.test(trimmed)) return "d2";
	return "mermaid";
}
function parseDotAttrs(raw) {
	const attrs = {};
	for (const match of raw.matchAll(/([A-Za-z_]\w*)\s*=\s*("(?:\\[\s\S]|[^\\"])*"|[^\s,\]]+)/g)) {
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
	if (rawLines.some((l) => /^(?:start|stop|endif|endwhile|end\s+fork|endfork|end\s+merge)\b/i.test(l) || /^:[^;]+;$/.test(l) || /^(?:if|while)\s*\(.+\)/i.test(l) || /^(?:repeat|fork)(?:\s|$)/i.test(l))) {
		const out = ["flowchart TD"];
		let step = 0;
		const nextId = (prefix) => `${prefix}${++step}`;
		let prevNodes = [];
		let pendingLabel = "";
		const branchStack = [];
		const whileStack = [];
		const repeatStack = [];
		const forkStack = [];
		const markRepeatTarget = (id) => {
			for (let i = repeatStack.length - 1; i >= 0; i--) if (!repeatStack[i].targetId) repeatStack[i].targetId = id;
			else break;
		};
		const linkFromPrev = (toId, label) => {
			markRepeatTarget(toId);
			const edgeLabel = label ? `|${label}|` : "";
			for (const fromId of prevNodes) out.push(`  ${fromId} -->${edgeLabel} ${toId}`);
			prevNodes = [toId];
			pendingLabel = "";
		};
		for (const line of rawLines) {
			if (/^start$/i.test(line)) {
				const id = nextId("Start");
				out.push(`  ${id}([Start])`);
				prevNodes = [id];
				continue;
			}
			if (/^stop$|^end$/i.test(line)) {
				const id = nextId("Stop");
				out.push(`  ${id}([Stop])`);
				linkFromPrev(id, pendingLabel);
				prevNodes = [];
				continue;
			}
			const repeatMatch = line.match(/^repeat(?:\s*:([^;]+);)?$/i);
			if (repeatMatch) {
				repeatStack.push({ targetId: "" });
				if (repeatMatch[1]) {
					const id = nextId("Step");
					out.push(`  ${id}["${repeatMatch[1].trim().replace(/"/g, "'")}"]`);
					linkFromPrev(id, pendingLabel);
				}
				continue;
			}
			const repeatWhileMatch = line.match(/^repeat\s+while\s*\((.+?)\)(?:\s*is\s*\(([^)]*)\))?(?:\s*not\s*\(([^)]*)\))?/i);
			if (repeatWhileMatch && repeatStack.length > 0) {
				const top = repeatStack.pop();
				const condId = nextId("Cond");
				out.push(`  ${condId}{"${repeatWhileMatch[1].trim().replace(/"/g, "'")}"}`);
				linkFromPrev(condId, pendingLabel);
				if (top.targetId) {
					const yesLabel = repeatWhileMatch[2]?.trim() || "yes";
					out.push(`  ${condId} -->|${yesLabel}| ${top.targetId}`);
				}
				prevNodes = [condId];
				pendingLabel = repeatWhileMatch[3]?.trim() || "no";
				continue;
			}
			const whileMatch = line.match(/^while\s*\((.+?)\)(?:\s*is\s*\(([^)]*)\))?/i);
			if (whileMatch) {
				const condId = nextId("While");
				out.push(`  ${condId}{"${whileMatch[1].trim().replace(/"/g, "'")}"}`);
				linkFromPrev(condId, pendingLabel);
				whileStack.push({ condId });
				pendingLabel = whileMatch[2]?.trim() || "yes";
				continue;
			}
			const endwhileMatch = line.match(/^endwhile(?:\s*\(([^)]*)\))?/i);
			if (endwhileMatch && whileStack.length > 0) {
				const top = whileStack.pop();
				const edgeLabel = pendingLabel ? `|${pendingLabel}|` : "";
				for (const fromId of prevNodes) out.push(`  ${fromId} -->${edgeLabel} ${top.condId}`);
				prevNodes = [top.condId];
				pendingLabel = endwhileMatch[1]?.trim() || "no";
				continue;
			}
			if (/^fork$/i.test(line)) {
				const forkId = nextId("Fork");
				out.push(`  ${forkId}["Fork"]`);
				linkFromPrev(forkId, pendingLabel);
				forkStack.push({
					forkId,
					branchEnds: []
				});
				continue;
			}
			if (/^fork\s+again$/i.test(line) && forkStack.length > 0) {
				const top = forkStack[forkStack.length - 1];
				top.branchEnds.push(...prevNodes);
				prevNodes = [top.forkId];
				pendingLabel = "";
				continue;
			}
			if (/^(?:end\s+fork|endfork|end\s+merge)$/i.test(line) && forkStack.length > 0) {
				const top = forkStack.pop();
				const joinId = nextId("Join");
				out.push(`  ${joinId}["Join"]`);
				for (const endId of [...top.branchEnds, ...prevNodes]) out.push(`  ${endId} --> ${joinId}`);
				prevNodes = [joinId];
				pendingLabel = "";
				continue;
			}
			const act = line.match(/^:([^;]+);$/);
			if (act) {
				const id = nextId("Step");
				out.push(`  ${id}["${act[1].trim().replace(/"/g, "'")}"]`);
				linkFromPrev(id, pendingLabel);
				continue;
			}
			const ifMatch = line.match(/^if\s*\((.+?)\)\s*then(?:\s*\(([^)]*)\))?/i);
			if (ifMatch) {
				const condId = nextId("Cond");
				out.push(`  ${condId}{"${ifMatch[1].trim().replace(/"/g, "'")}"}`);
				linkFromPrev(condId, pendingLabel);
				branchStack.push({
					condId,
					afterThen: [],
					inElse: false
				});
				pendingLabel = ifMatch[2]?.trim() || "yes";
				continue;
			}
			const elseMatch = line.match(/^else(?:\s*\(([^)]*)\))?/i);
			if (elseMatch && branchStack.length > 0) {
				const top = branchStack[branchStack.length - 1];
				top.afterThen = prevNodes;
				top.inElse = true;
				prevNodes = [top.condId];
				pendingLabel = elseMatch[1]?.trim() || "no";
				continue;
			}
			if (/^endif$/i.test(line) && branchStack.length > 0) {
				const top = branchStack.pop();
				prevNodes = top.inElse ? [...top.afterThen, ...prevNodes] : [...prevNodes, top.condId];
				pendingLabel = "";
			}
		}
		return out.join("\n");
	}
	const hideFields = rawLines.some((l) => /^hide\s+(?:attributes|fields|members)\b/i.test(l));
	const hideMethods = rawLines.some((l) => /^hide\s+(?:methods|members)\b/i.test(l));
	const out = ["classDiagram"];
	let inBlock = false;
	for (const line of rawLines) {
		if (/^(?:hide|show|title|note|package|namespace|\})\b/i.test(line) && !inBlock) continue;
		if (!inBlock && /^(?:class|interface|enum|abstract\s+class)\s+/i.test(line)) {
			const normalized = line.replace(/^abstract\s+/i, "").replace(/^(?:interface|enum)\s+/i, "class ");
			out.push(`  ${normalized}`);
			if (line.includes("{") && !line.includes("}")) inBlock = true;
			continue;
		}
		if (inBlock) {
			if (line.includes("}")) {
				out.push(`  ${line}`);
				inBlock = false;
				continue;
			}
			const isMethod = /\([^)]*\)/.test(line);
			if (isMethod && hideMethods || !isMethod && hideFields) continue;
			out.push(`  ${line}`);
			continue;
		}
		const rel = line.match(/^([A-Za-z_]\w*)(?:\s+"([^"]+)")?\s*(<\|--|\*--|o--|-->|<--|\.\.>|\.\.\|>|--)\s*(?:"([^"]+)"\s+)?([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/);
		if (rel) {
			const fromCard = rel[2] ? ` "${rel[2]}"` : "";
			const arrow = rel[3] === "->" ? "-->" : rel[3];
			const toCard = rel[4] ? ` "${rel[4]}"` : "";
			out.push(`  ${sanitizeId(rel[1])}${fromCard} ${arrow}${toCard} ${sanitizeId(rel[5])}${rel[6] ? ` : ${rel[6]}` : ""}`);
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
		const edgeMatch = line.match(/^([A-Za-z0-9_.-]+)\s*(->|<-|<->|--)\s*([A-Za-z0-9_.-]+)(?:\s*:\s*(.+))?$/);
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
	if (source.length > 524288) throw new Error("Diagram source exceeds the 512 KB limit.");
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
	if (source.length > 524288) throw new Error("Diagram source exceeds the 512 KB limit.");
	const format = detectCodeFormat(source);
	if (format === target) return source;
	return emitFromIR(format === "xml" ? parseXmlToIR(source) : parseMermaidToIR(toMermaidSource(source).mermaid), target);
}
var EDGE_ANCHOR_START_SUFFIX = "::start";
var EDGE_ANCHOR_END_SUFFIX = "::end";
var FORBIDDEN_LAYOUT_KEYS = /* @__PURE__ */ new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
var ALLOWED_META_KEYS = /* @__PURE__ */ new Set([
	"generatedFrom",
	"sha256",
	"updatedAt"
]);
var SHA256_HEX_RE = /^[a-fA-F0-9]{64}$/;
function edgeAnchorKey(edgeId, end) {
	return `${edgeId}${end === "start" ? EDGE_ANCHOR_START_SUFFIX : EDGE_ANCHOR_END_SUFFIX}`;
}
function isValidLayoutKey(key) {
	return key.length > 0 && key.length <= 256 && !FORBIDDEN_LAYOUT_KEYS.has(key);
}
function isValidPosition(pos) {
	if (!pos || typeof pos !== "object" || Array.isArray(pos)) return false;
	const { x, y } = pos;
	return typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e5 && typeof y === "number" && Number.isFinite(y) && Math.abs(y) <= 1e5;
}
/**
* Validates and sanitizes an untrusted layout object using Studio/Room limits:
* - rejects non-objects and arrays (returns null)
* - drops prototype-polluting keys (__proto__, constructor, prototype), empty keys, and keys > 256 chars
* - caps entries at 5000
* - requires finite x/y within [-100_000, 100_000]
*/
function parseLayoutRecord(raw) {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const out = {};
	let count = 0;
	for (const [id, pos] of Object.entries(raw)) {
		if (count >= 5e3) break;
		if (!isValidLayoutKey(id)) continue;
		if (!isValidPosition(pos)) continue;
		out[id] = {
			x: pos.x,
			y: pos.y
		};
		count += 1;
	}
	return out;
}
function sanitizeMeta(raw, onWarning) {
	if (raw === void 0 || raw === null) return void 0;
	if (typeof raw !== "object" || Array.isArray(raw)) {
		onWarning?.("Sidecar meta must be an object; ignored.");
		return;
	}
	const obj = raw;
	if (onWarning) {
		for (const key of Object.keys(obj)) if (!ALLOWED_META_KEYS.has(key)) onWarning(`Unknown sidecar meta key "${key}" ignored.`);
	}
	const meta = {};
	if (obj.generatedFrom !== void 0) {
		if (typeof obj.generatedFrom === "string" && obj.generatedFrom.trim().length > 0 && obj.generatedFrom.length <= 512) meta.generatedFrom = obj.generatedFrom.trim();
		else onWarning?.("Invalid sidecar meta.generatedFrom ignored.");
	}
	if (obj.sha256 !== void 0) {
		if (typeof obj.sha256 === "string" && SHA256_HEX_RE.test(obj.sha256)) meta.sha256 = obj.sha256.toLowerCase();
		else onWarning?.("Invalid sidecar meta.sha256 ignored (expected 64-char hex).");
	}
	if (obj.updatedAt !== void 0) {
		if (typeof obj.updatedAt === "string" && obj.updatedAt.trim().length > 0) meta.updatedAt = obj.updatedAt.trim();
		else onWarning?.("Invalid sidecar meta.updatedAt ignored.");
	}
	return Object.keys(meta).length > 0 ? meta : void 0;
}
function serializeSidecar(layout, meta, options) {
	const sanitizedLayout = parseLayoutRecord(layout) ?? {};
	const sanitizedMeta = sanitizeMeta(meta);
	const doc = sanitizedMeta ? {
		version: 1,
		layout: sanitizedLayout,
		meta: sanitizedMeta
	} : {
		version: 1,
		layout: sanitizedLayout
	};
	return options?.pretty ?? true ? `${JSON.stringify(doc, null, 2)}\n` : JSON.stringify(doc);
}
function parseSidecar(raw, options) {
	let parsed = raw;
	if (typeof raw === "string") try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("Invalid CTD sidecar JSON.");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid CTD sidecar: expected a JSON object.");
	const obj = parsed;
	if (obj.version !== 1) throw new Error(`Unsupported CTD sidecar version: ${obj.version === void 0 ? "missing" : String(obj.version)}.`);
	const layout = parseLayoutRecord(obj.layout);
	if (layout === null) throw new Error("Invalid CTD sidecar: \"layout\" must be an object.");
	const meta = sanitizeMeta(obj.meta, options?.onWarning);
	return meta ? {
		version: 1,
		layout,
		meta
	} : {
		version: 1,
		layout
	};
}
// src/lib/layoutKeys.ts
function edgeLayoutId(from, to, index) {
	return `edge::${from}->${to}::${index}`;
}
function validLayoutKeySet(nodeIds, edgeIds) {
	const keys = /* @__PURE__ */ new Set();
	for (const id of nodeIds) keys.add(id);
	for (const edgeId of edgeIds) {
		keys.add(edgeId);
		keys.add(edgeAnchorKey(edgeId, "start"));
		keys.add(edgeAnchorKey(edgeId, "end"));
	}
	return keys;
}
function validLayoutKeysFromIR(ir) {
	return validLayoutKeySet(ir.nodes.map((node) => node.id), ir.edges.map((edge, index) => edgeLayoutId(edge.from, edge.to, index)));
}
function partitionLayoutKeys(layout, validKeys) {
	const preserved = {};
	const orphaned = [];
	const orphanedEntries = {};
	for (const [key, pos] of Object.entries(layout)) if (validKeys.has(key)) preserved[key] = pos;
	else {
		orphaned.push(key);
		orphanedEntries[key] = pos;
	}
	return {
		preserved,
		orphaned,
		orphanedEntries
	};
}
Promise.resolve();
function detectDiagramType(source) {
	const firstLine = toMermaidSource(source).mermaid.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]?.trim() ?? "";
	if (/^(flowchart|graph)\b/i.test(firstLine)) return "flowchart";
	if (/^classDiagram\b/i.test(firstLine)) return "class";
	if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return "state";
	if (/^erDiagram\b/i.test(firstLine)) return "er";
	if (/^requirementDiagram\b/i.test(firstLine)) return "requirement";
	if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(firstLine)) return "c4";
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
	const stack = [root];
	while (stack.length > 0) {
		const node = stack.pop();
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
		if (children) for (let i = children.length - 1; i >= 0; i -= 1) {
			const child = children[i];
			if (child) stack.push(child);
		}
	}
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
var MERMAID_DIAGRAM_HEADER_RE = /^(?:%%\{[\s\S]*?\}%%\s*)?(?:flowchart|graph|classDiagram|stateDiagram(?:-v2)?|erDiagram|sequenceDiagram|gantt|mindmap|pie|journey|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|requirementDiagram)\b/i;
function hasValidMermaidHeader(source) {
	const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0 && (!line.startsWith("%%") || line.startsWith("%%{")));
	if (lines.length === 0) return false;
	return MERMAID_DIAGRAM_HEADER_RE.test(lines.join("\n"));
}
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
		name: "ctd-mcp",
		version
	}, { instructions: ["CTD Studio MCP server (ctd-mcp) for detecting, parsing, converting, configuring, translating, and verifying diagrams + .ctd.json sidecar layouts across Mermaid (v12.3.0), Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML (Draw.io, BPMN, generic XML).", "Recommended AI workflow: (1) Call detect_format, to_mermaid, or translate_format to convert/inspect diagrams. (2) Call parse_diagram_ir or diff_ir to inspect structure and changes. (3) Call regen_preserve_layout, list_orphan_layout, check_drift, verify_diagram, and patch_source to update diagrams while preserving manual .ctd.json layouts. (4) Call get_studio_info for capabilities and irVersion."].join(" ") });
	server.registerTool("detect_format", {
		title: "Detect Diagram / Code Format",
		description: "Auto-detect the format of a diagram or code snippet (mermaid, dot, plantuml, d2, sql, typescript, xml) and its Mermaid diagram type.",
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.").describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML).") },
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
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.").describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML).") },
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
		description: "Translate diagram or code source between any two supported CTD Studio formats: mermaid, dot, plantuml, d2, sql, typescript, xml.",
		inputSchema: {
			source: z.string().trim().min(1, "Source must not be empty.").describe("Input diagram or code snippet in any supported CTD Studio format."),
			targetFormat: FormatSchema.describe("Target output format: mermaid, dot, plantuml, d2, sql, typescript, or xml.")
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
		description: "Parse any supported diagram or code format into CTD Studio's structured DiagramIR (kind, direction, nodes, edges).",
		inputSchema: { source: z.string().trim().min(1, "Source must not be empty.").describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML).") },
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
			ir: DiagramIRSchema.describe("Structured DiagramIR object (typically returned by parse_diagram_ir)."),
			targetFormat: FormatSchema.describe("Target output format: mermaid, dot, plantuml, d2, sql, typescript, or xml.")
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
		title: "List CTD Studio Diagram Templates",
		description: "List built-in CTD Studio diagram templates or retrieve a specific template by name.",
		inputSchema: { name: z.string().optional().describe("Optional template name (case-insensitive). Omit to list all built-in templates.") },
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
		title: "Get CTD Studio Capabilities",
		description: "Return CTD Studio supported formats, file extensions, theme presets, and web app URL.",
		inputSchema: {},
		annotations: { readOnlyHint: true }
	}, async () => {
		const info = {
			name: "CTD Studio",
			mcpName: "ctd-mcp",
			mermaidVersion: "12.3.0",
			irVersion: 1,
			sidecarVersion: 1,
			url: "https://code-to-diagram.vercel.app/",
			repository: "https://github.com/cxernlol/code-to-diagram",
			capabilities: [
				"detect_format",
				"to_mermaid",
				"translate_format",
				"parse_diagram_ir",
				"emit_from_ir",
				"list_templates",
				"get_studio_info",
				"configure_mermaid_diagram",
				"regen_preserve_layout",
				"list_orphan_layout",
				"diff_ir",
				"verify_diagram",
				"patch_source",
				"check_drift"
			],
			formats: CODE_FORMATS.map((id) => ({
				id,
				label: FORMAT_LABELS[id],
				extension: FORMAT_EXTENSIONS[id]
			})),
			themes: Object.keys(THEME_PRESETS),
			templates: Object.keys(TEMPLATES),
			directions: [
				"TD",
				"BT",
				"LR",
				"RL"
			],
			looks: ["classic", "handDrawn"],
			suppressionDirectives: {
				hideNode: "%% sgs-hide: <NodeId>",
				hideMember: "%% sgs-hidden-member: <memberLine>"
			},
			features: [
				"dark-mode",
				"multi-font-sizing",
				"canva-style-suppression",
				"node-member-editing",
				"multi-direction-layout",
				"live-rooms",
				"svg-png-export"
			]
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(info, null, 2)
			}],
			structuredContent: info
		};
	});
	server.registerTool("configure_mermaid_diagram", {
		title: "Configure Mermaid Diagram",
		description: "Update a Mermaid diagram's layout direction (TD/BT/LR/RL), toggle Canva-style node suppression (%% sgs-hide: <id>), or add a member/field to a class or ER entity.",
		inputSchema: {
			code: z.string().min(1).describe("Mermaid diagram source code."),
			direction: z.enum([
				"TD",
				"TB",
				"BT",
				"LR",
				"RL"
			]).optional().describe("Optional layout direction to apply."),
			hideNodes: z.array(z.string().min(1)).optional().describe("Node IDs to hide via %% sgs-hide directives."),
			showNodes: z.array(z.string().min(1)).optional().describe("Node IDs to unhide by removing %% sgs-hide directives."),
			addMember: z.object({
				nodeId: z.string().min(1),
				member: z.string().min(1)
			}).optional().describe("Optional member/field line to add inside a classDiagram class or erDiagram entity.")
		},
		annotations: {
			readOnlyHint: true,
			idempotentHint: true
		}
	}, async ({ code, direction, hideNodes, showNodes, addMember }) => {
		const maxSourceBytes = 524288;
		if (code.length > maxSourceBytes) return {
			isError: true,
			content: [{
				type: "text",
				text: `Source exceeds ${maxSourceBytes} byte limit.`
			}]
		};
		let next = code;
		if (direction) {
			const headerRe = /^(\s*(?:flowchart|graph)\s+)(TB|TD|BT|LR|RL)\b/im;
			if (headerRe.test(next)) next = next.replace(headerRe, `$1${direction}`);
			else if (/^\s*direction\s+(TB|TD|BT|LR|RL)\b/im.test(next)) next = next.replace(/^(\s*direction\s+)(TB|TD|BT|LR|RL)\b/im, `$1${direction}`);
			else {
				const lines = next.split(/\r?\n/);
				if (lines.length > 0 && /^(?:classDiagram|stateDiagram(?:-v2)?|erDiagram)\b/i.test(lines[0].trim())) {
					lines.splice(1, 0, `  direction ${direction}`);
					next = lines.join("\n");
				}
			}
		}
		if (showNodes?.length) {
			const showSet = new Set(showNodes.map((n) => n.trim()));
			next = next.split(/\r?\n/).filter((line) => {
				const m = line.match(/^\s*%%\s*sgs-hide:\s*(.+)$/);
				return !(m && showSet.has(m[1].trim()));
			}).join("\n");
		}
		if (hideNodes?.length) {
			const existing = /* @__PURE__ */ new Set();
			for (const line of next.split(/\r?\n/)) {
				const m = line.match(/^\s*%%\s*sgs-hide:\s*(.+)$/);
				if (m) existing.add(m[1].trim());
			}
			const additions = hideNodes.map((n) => n.trim()).filter((n) => n && !existing.has(n)).map((n) => `  %% sgs-hide: ${n}`);
			if (additions.length) next = `${next.trimEnd()}\n${additions.join("\n")}`;
		}
		if (addMember) {
			const escaped = addMember.nodeId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const member = addMember.member.replace(/[\r\n]+/g, " ").trim();
			const lines = next.split(/\r?\n/);
			const blockStart = lines.findIndex((line) => new RegExp(`^\\s*(?:class\\s+)?${escaped}(?:\\s*\\[[^\\]]*\\])?\\s*\\{`).test(line));
			if (blockStart !== -1) {
				let blockEnd = blockStart;
				for (let i = blockStart + 1; i < lines.length; i += 1) if (lines[i].includes("}")) {
					blockEnd = i;
					break;
				}
				if (blockEnd > blockStart) {
					lines.splice(blockEnd, 0, `    ${member}`);
					next = lines.join("\n");
				}
			} else next = /^\s*classDiagram\b/im.test(next) ? `${next.trimEnd()}\n  class ${addMember.nodeId.trim()} {\n    ${member}\n  }` : `${next.trimEnd()}\n  ${addMember.nodeId.trim()} {\n    ${member}\n  }`;
		}
		return {
			content: [{
				type: "text",
				text: next
			}],
			structuredContent: { code: next }
		};
	});
	const SidecarInputSchema = z.union([z.string().min(1), z.record(z.string(), z.unknown())]).describe("CTD sidecar v1 JSON string or parsed object.");
	const sha256Hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");
	server.registerTool("regen_preserve_layout", {
		title: "Regenerate & Preserve Sidecar Layout",
		description: "Compare old and new diagram source, preserve matching node/edge layout keys from a .ctd.json sidecar, report orphaned keys and likely renamed node IDs, and return an updated sidecar.",
		inputSchema: {
			oldSource: z.string().trim().min(1, "oldSource must not be empty."),
			newSource: z.string().trim().min(1, "newSource must not be empty."),
			sidecar: SidecarInputSchema,
			generatedFrom: z.string().optional().describe("Optional source filename for sidecar meta.generatedFrom.")
		},
		annotations: { readOnlyHint: true }
	}, async ({ oldSource, newSource, sidecar, generatedFrom }) => {
		try {
			const warnings = [];
			const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
			const { ir: oldIr } = parseSourceToIR(oldSource);
			const { ir: newIr } = parseSourceToIR(newSource);
			const validNewKeys = validLayoutKeysFromIR(newIr);
			const { preserved, orphaned } = partitionLayoutKeys(parsedSidecar.layout, validNewKeys);
			const oldNodeIds = new Set(oldIr.nodes.map((n) => n.id));
			const newNodeIds = new Set(newIr.nodes.map((n) => n.id));
			const removedNodes = oldIr.nodes.filter((n) => !newNodeIds.has(n.id));
			const addedNodes = newIr.nodes.filter((n) => !oldNodeIds.has(n.id));
			const renamed = [];
			for (const oldNode of removedNodes) {
				if (!(oldNode.id in parsedSidecar.layout)) continue;
				const match = addedNodes.find((n) => n.label.trim().toLowerCase() === oldNode.label.trim().toLowerCase());
				if (match) renamed.push({
					from: oldNode.id,
					to: match.id,
					reason: "matching-label"
				});
			}
			const result = {
				ok: true,
				irVersion: 1,
				preserved,
				orphaned,
				renamed,
				sidecar: serializeSidecar(preserved, {
					...parsedSidecar.meta,
					...generatedFrom ? { generatedFrom } : {},
					sha256: sha256Hex(newSource),
					updatedAt: (/* @__PURE__ */ new Date()).toISOString()
				}),
				warnings,
				errors: []
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
	server.registerTool("list_orphan_layout", {
		title: "List Orphaned Layout Keys",
		description: "Inspect a .ctd.json sidecar against diagram source and list layout keys whose node or edge IDs no longer exist in the diagram.",
		inputSchema: {
			source: z.string().trim().min(1, "Source must not be empty."),
			sidecar: SidecarInputSchema
		},
		annotations: { readOnlyHint: true }
	}, async ({ source, sidecar }) => {
		try {
			const warnings = [];
			const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
			const { ir } = parseSourceToIR(source);
			const validKeys = validLayoutKeysFromIR(ir);
			const { preserved, orphaned, orphanedEntries } = partitionLayoutKeys(parsedSidecar.layout, validKeys);
			const result = {
				ok: true,
				irVersion: 1,
				preservedCount: Object.keys(preserved).length,
				orphaned,
				orphanedEntries,
				warnings,
				errors: []
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
	server.registerTool("diff_ir", {
		title: "Diff Diagram IR",
		description: "Compare two diagram sources at the DiagramIR level and return added, removed, and changed nodes and edges.",
		inputSchema: {
			oldSource: z.string().trim().min(1, "oldSource must not be empty."),
			newSource: z.string().trim().min(1, "newSource must not be empty.")
		},
		annotations: { readOnlyHint: true }
	}, async ({ oldSource, newSource }) => {
		try {
			const { ir: oldIr } = parseSourceToIR(oldSource);
			const { ir: newIr } = parseSourceToIR(newSource);
			const oldNodes = new Map(oldIr.nodes.map((n) => [n.id, n]));
			const newNodes = new Map(newIr.nodes.map((n) => [n.id, n]));
			const addedNodes = newIr.nodes.filter((n) => !oldNodes.has(n.id));
			const removedNodes = oldIr.nodes.filter((n) => !newNodes.has(n.id));
			const changedNodes = newIr.nodes.filter((n) => {
				const prev = oldNodes.get(n.id);
				if (!prev) return false;
				return prev.label !== n.label || prev.shape !== n.shape || JSON.stringify(prev.fields ?? []) !== JSON.stringify(n.fields ?? []);
			}).map((n) => ({
				id: n.id,
				before: oldNodes.get(n.id),
				after: n
			}));
			const edgeKey = (e) => `${e.from}-->${e.to}|${e.label ?? ""}|${Boolean(e.dashed)}|${e.relation ?? ""}`;
			const oldEdgeKeys = new Set(oldIr.edges.map(edgeKey));
			const newEdgeKeys = new Set(newIr.edges.map(edgeKey));
			const addedEdges = newIr.edges.filter((e) => !oldEdgeKeys.has(edgeKey(e)));
			const removedEdges = oldIr.edges.filter((e) => !newEdgeKeys.has(edgeKey(e)));
			const result = {
				ok: true,
				irVersion: 1,
				kindChanged: oldIr.kind !== newIr.kind,
				directionChanged: oldIr.direction !== newIr.direction,
				addedNodes,
				removedNodes,
				changedNodes,
				addedEdges,
				removedEdges,
				summary: `+${addedNodes.length}/-${removedNodes.length}/~${changedNodes.length} nodes, +${addedEdges.length}/-${removedEdges.length} edges`,
				warnings: [],
				errors: []
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
	server.registerTool("verify_diagram", {
		title: "Verify Diagram & Sidecar",
		description: "Verify that a diagram parses cleanly, optional .ctd.json sidecar layout keys are a subset of IR node/edge IDs, and optional SQL DDL table names appear in ER entities.",
		inputSchema: {
			source: z.string().trim().min(1, "Source must not be empty."),
			sidecar: SidecarInputSchema.optional(),
			sqlSource: z.string().optional().describe("Optional SQL DDL to verify table names against diagram entities.")
		},
		annotations: { readOnlyHint: true }
	}, async ({ source, sidecar, sqlSource }) => {
		const warnings = [];
		const errors = [];
		let sourceFormat = null;
		let diagramKind = null;
		let orphanLayoutKeys = [];
		let missingSqlTables = [];
		let validSource = false;
		let ir = null;
		try {
			const parsed = parseSourceToIR(source);
			sourceFormat = parsed.sourceFormat;
			ir = parsed.ir;
			diagramKind = ir.kind;
			if (sourceFormat === "mermaid" && !hasValidMermaidHeader(source)) errors.push("Unrecognized diagram format or missing Mermaid diagram header.");
			else validSource = true;
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
		if (ir && sidecar !== void 0) try {
			const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
			const validKeys = validLayoutKeysFromIR(ir);
			orphanLayoutKeys = partitionLayoutKeys(parsedSidecar.layout, validKeys).orphaned;
			if (orphanLayoutKeys.length > 0) warnings.push(`Found ${orphanLayoutKeys.length} orphaned layout key(s).`);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
		if (ir && sqlSource && sqlSource.trim().length > 0) try {
			const { sourceFormat: sqlFormat, ir: sqlIr } = parseSourceToIR(sqlSource);
			if (sqlFormat !== "sql" || sqlIr.nodes.length === 0) errors.push("Invalid sqlSource: expected SQL DDL with at least one CREATE TABLE statement.");
			else {
				const diagramIds = new Set(ir.nodes.map((n) => n.id.toLowerCase()));
				missingSqlTables = sqlIr.nodes.map((n) => n.id).filter((table) => !diagramIds.has(table.toLowerCase()));
				if (missingSqlTables.length > 0) warnings.push(`SQL tables missing from diagram: ${missingSqlTables.join(", ")}`);
			}
		} catch (error) {
			errors.push(`Invalid sqlSource: ${error instanceof Error ? error.message : String(error)}`);
		}
		const result = {
			ok: validSource && errors.length === 0 && orphanLayoutKeys.length === 0 && missingSqlTables.length === 0,
			irVersion: 1,
			validSource,
			sourceFormat,
			diagramKind,
			orphanLayoutKeys,
			missingSqlTables,
			warnings,
			errors
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(result, null, 2)
			}],
			structuredContent: result
		};
	});
	server.registerTool("patch_source", {
		title: "Patch Diagram Source",
		description: "Apply targeted find/replace hunks to diagram source without rewriting the whole file, and validate that the patched source still parses.",
		inputSchema: {
			source: z.string().min(1, "Source must not be empty."),
			patches: z.array(z.object({
				find: z.string().min(1),
				replace: z.string(),
				all: z.boolean().optional()
			})).min(1),
			dryRun: z.boolean().optional()
		},
		annotations: { readOnlyHint: true }
	}, async ({ source, patches, dryRun }) => {
		const warnings = [];
		const errors = [];
		let patched = source;
		let appliedCount = 0;
		for (const patch of patches) {
			if (!patched.includes(patch.find)) {
				warnings.push(`Patch target not found: ${JSON.stringify(patch.find)}`);
				continue;
			}
			patched = patch.all ? patched.split(patch.find).join(patch.replace) : patched.replace(patch.find, patch.replace);
			appliedCount += 1;
		}
		try {
			const { sourceFormat } = parseSourceToIR(patched);
			if (sourceFormat === "mermaid" && !hasValidMermaidHeader(patched)) errors.push("Patched source is missing a valid Mermaid diagram header.");
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}
		const result = {
			ok: errors.length === 0,
			irVersion: 1,
			dryRun: Boolean(dryRun),
			changed: patched !== source,
			appliedCount,
			patchedSource: patched,
			warnings,
			errors
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(result, null, 2)
			}],
			structuredContent: result
		};
	});
	server.registerTool("check_drift", {
		title: "Check Diagram / Sidecar Drift",
		description: "Compare current diagram source SHA-256 against sidecar meta.sha256 and check for orphaned layout keys.",
		inputSchema: {
			source: z.string().min(1, "Source must not be empty."),
			sidecar: SidecarInputSchema
		},
		annotations: { readOnlyHint: true }
	}, async ({ source, sidecar }) => {
		try {
			const warnings = [];
			const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
			const { ir } = parseSourceToIR(source);
			const validKeys = validLayoutKeysFromIR(ir);
			const orphanLayoutKeys = partitionLayoutKeys(parsedSidecar.layout, validKeys).orphaned;
			const currentSha256 = sha256Hex(source);
			const expectedSha256 = parsedSidecar.meta?.sha256;
			const hasBaselineSha256 = Boolean(expectedSha256);
			if (!hasBaselineSha256) warnings.push("Sidecar meta.sha256 is missing; drift check fell back to orphan key check.");
			const result = {
				ok: true,
				irVersion: 1,
				hasBaselineSha256,
				drifted: hasBaselineSha256 && expectedSha256 !== currentSha256 || orphanLayoutKeys.length > 0,
				currentSha256,
				expectedSha256: expectedSha256 ?? null,
				generatedFrom: parsedSidecar.meta?.generatedFrom ?? null,
				orphanLayoutKeys,
				warnings,
				errors: []
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
	server.registerResource("formats", "ctd://formats", {
		title: "CTD Studio Supported Formats",
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
	server.registerResource("themes", "ctd://themes", {
		title: "CTD Studio Theme Presets",
		description: "Built-in color palette presets for CTD Studio diagrams.",
		mimeType: "application/json"
	}, async (uri) => ({ contents: [{
		uri: uri.href,
		mimeType: "application/json",
		text: JSON.stringify(THEME_PRESETS, null, 2)
	}] }));
	server.registerResource("template", new ResourceTemplate("ctd://templates/{name}", { list: async () => ({ resources: Object.keys(TEMPLATES).map((name) => ({
		uri: `ctd://templates/${encodeURIComponent(name)}`,
		name,
		mimeType: "text/plain"
	})) }) }), {
		title: "CTD Studio Diagram Template",
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
		description: "Convert source code, SQL schema, XML, or architecture notes into a clean diagram using CTD Studio.",
		argsSchema: {
			source: z.string().describe("Source code, schema, or diagram text to convert"),
			targetFormat: FormatSchema.optional().describe("Desired output format (defaults to mermaid)")
		}
	}, ({ source, targetFormat }) => ({ messages: [{
		role: "user",
		content: {
			type: "text",
			text: [
				`Use CTD Studio MCP tools (\`detect_format\`, \`to_mermaid\`, \`translate_format\`, \`parse_diagram_ir\`) to convert the following input into a clean ${targetFormat ?? "mermaid"} diagram:`,
				"",
				"```",
				source,
				"```"
			].join("\n")
		}
	}] }));
	server.registerPrompt("configure_diagram", {
		title: "Configure Mermaid Diagram",
		description: "Adjust layout direction, hide/show nodes with %% sgs-hide directives, or add class/ER members using configure_mermaid_diagram.",
		argsSchema: {
			code: z.string().describe("Existing Mermaid diagram source code"),
			changes: z.string().describe("Requested layout direction, node visibility, or member changes")
		}
	}, ({ code, changes }) => ({ messages: [{
		role: "user",
		content: {
			type: "text",
			text: [
				`Use the \`configure_mermaid_diagram\` MCP tool to apply these changes: ${changes}`,
				"",
				"```mermaid",
				code,
				"```"
			].join("\n")
		}
	}] }));
	server.registerPrompt("explain_diagram", {
		title: "Explain Diagram Structure",
		description: "Parse a diagram or code snippet with parse_diagram_ir and explain its nodes, edges, and flow concisely.",
		argsSchema: { source: z.string().describe("Diagram or code snippet to analyze") }
	}, ({ source }) => ({ messages: [{
		role: "user",
		content: {
			type: "text",
			text: [
				"Call `detect_format` and `parse_diagram_ir` on the input below, then summarize its structure, key components, and relationships concisely:",
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
			"CTD Studio Model Context Protocol (MCP) server over stdio.",
			"",
			"Usage:",
			"  npx ctd-mcp",
			"  ctd-mcp [--help | --version]",
			"",
			"Connect from Claude Desktop, Cursor, Windsurf, or VS Code via stdio."
		].join("\n") + "\n");
		return;
	}
	const server = createSgsStudioMcpServer(package_default.version);
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`CTD Studio MCP server (ctd-mcp) v${package_default.version} running on stdio`);
}
main().catch((error) => {
	console.error("Fatal error in CTD Studio MCP server:", error);
	process.exit(1);
});
export {};
