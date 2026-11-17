import type { CodeFormat } from "./formats";

export interface IRNode {
  id: string;
  label: string;
  shape?: string;
  fields?: string[];
}

export interface IREdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  relation?: string;
}

export interface DiagramIR {
  kind: "flowchart" | "class" | "er";
  direction: "TD" | "LR";
  nodes: IRNode[];
  edges: IREdge[];
}

function safeId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/[^A-Za-z0-9_]/g, "_");
  if (!cleaned) return "node";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MAX_XML_BYTES = 512 * 1024;
const MAX_XML_DEPTH = 64;
const MAX_XML_NODES = 1500;

export function parseXmlToIR(source: string): DiagramIR {
  if (source.length > MAX_XML_BYTES) {
    throw new Error("XML input exceeds the 512 KB limit.");
  }
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(source)) {
    throw new Error("XML DOCTYPE and ENTITY declarations are not allowed.");
  }
  const doc = new DOMParser().parseFromString(source.trim(), "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid XML syntax.");
  }
  const root = doc.documentElement;
  const nodes = new Map<string, IRNode>();
  const edges: IREdge[] = [];
  const dirAttr = (root.getAttribute("direction") ?? root.getAttribute("rankdir") ?? "").toUpperCase();
  const direction: "TD" | "LR" = dirAttr === "LR" ? "LR" : "TD";

  const addNode = (id: string, label?: string, shape?: string, fields?: string[]) => {
    const sid = safeId(id);
    const prev = nodes.get(sid);
    nodes.set(sid, {
      id: sid,
      label: label ? cleanText(label) : prev?.label ?? sid,
      shape: shape ?? prev?.shape,
      fields: fields?.length ? fields : prev?.fields,
    });
    return sid;
  };

  // 1. Draw.io / mxGraph XML (<mxCell vertex="1" | edge="1">)
  const mxCells = Array.from(doc.querySelectorAll("mxCell"));
  if (mxCells.length > 0) {
    for (const cell of mxCells) {
      const id = cell.getAttribute("id");
      if (!id || id === "0" || id === "1") continue;
      if (cell.getAttribute("vertex") === "1") {
        const style = cell.getAttribute("style") ?? "";
        const shape = /rhombus/i.test(style)
          ? "diamond"
          : /ellipse/i.test(style)
            ? "circle"
            : /cylinder/i.test(style)
              ? "cylinder"
              : undefined;
        addNode(id, cell.getAttribute("value") || id, shape);
      } else if (cell.getAttribute("edge") === "1") {
        const src = cell.getAttribute("source");
        const dst = cell.getAttribute("target");
        if (src && dst) {
          edges.push({
            from: addNode(src),
            to: addNode(dst),
            label: cleanText(cell.getAttribute("value") ?? "") || undefined,
            dashed: /dashed=1/i.test(cell.getAttribute("style") ?? ""),
          });
        }
      }
    }
    if (nodes.size > 0 || edges.length > 0) {
      return { kind: "flowchart", direction, nodes: Array.from(nodes.values()), edges };
    }
  }

  // 2. BPMN XML (sequenceFlow + tasks/events/gateways)
  const seqFlows = Array.from(doc.getElementsByTagName("*")).filter(
    (el) => el.localName === "sequenceFlow",
  );
  if (seqFlows.length > 0) {
    const bpmnTagShapes: Record<string, string> = {
      startEvent: "circle",
      endEvent: "circle",
      exclusiveGateway: "diamond",
      parallelGateway: "diamond",
      inclusiveGateway: "diamond",
    };
    for (const el of Array.from(doc.getElementsByTagName("*"))) {
      const id = el.getAttribute("id");
      if (!id) continue;
      if (el.localName in bpmnTagShapes || /Task$|task$|SubProcess$/i.test(el.localName)) {
        addNode(id, el.getAttribute("name") || id, bpmnTagShapes[el.localName]);
      }
    }
    for (const flow of seqFlows) {
      const src = flow.getAttribute("sourceRef");
      const dst = flow.getAttribute("targetRef");
      if (src && dst) {
        edges.push({
          from: addNode(src),
          to: addNode(dst),
          label: cleanText(flow.getAttribute("name") ?? "") || undefined,
        });
      }
    }
    return { kind: "flowchart", direction, nodes: Array.from(nodes.values()), edges };
  }

  // 3. Explicit <diagram> / <graph> / <schema> XML (<node>/<class>/<table> + <edge>/<relation>)
  const explicitNodes = Array.from(
    doc.querySelectorAll("node, entity, table, class, state, participant, actor"),
  );
  const explicitEdges = Array.from(
    doc.querySelectorAll("edge, link, relation, transition, flow, arrow"),
  );
  if (explicitNodes.length > 0 || explicitEdges.length > 0) {
    const isEr = explicitNodes.some((el) => el.tagName === "table" || el.tagName === "entity");
    const isClass = explicitNodes.some((el) => el.tagName === "class");
    for (const el of explicitNodes) {
      const id =
        el.getAttribute("id") ||
        el.getAttribute("name") ||
        cleanText(el.textContent ?? "") ||
        `node_${nodes.size + 1}`;
      const label =
        el.getAttribute("label") ||
        el.getAttribute("name") ||
        el.getAttribute("title") ||
        id;
      const fields = Array.from(el.querySelectorAll(":scope > field, :scope > column, :scope > member, :scope > attr"))
        .map((f) => {
          const fName = f.getAttribute("name") || cleanText(f.textContent ?? "");
          const fType = f.getAttribute("type") || "";
          const key = f.getAttribute("key") || (f.getAttribute("pk") === "true" ? "PK" : f.getAttribute("fk") === "true" ? "FK" : "");
          return [fType, fName, key].filter(Boolean).join(" ").trim();
        })
        .filter(Boolean);
      addNode(id, label, el.getAttribute("shape") ?? undefined, fields);
    }
    for (const el of explicitEdges) {
      const from = el.getAttribute("from") || el.getAttribute("source");
      const to = el.getAttribute("to") || el.getAttribute("target");
      if (from && to) {
        edges.push({
          from: addNode(from),
          to: addNode(to),
          label: cleanText(el.getAttribute("label") || el.getAttribute("name") || el.textContent || "") || undefined,
          dashed: el.getAttribute("dashed") === "true" || el.getAttribute("style") === "dashed",
          relation: el.getAttribute("type") ?? undefined,
        });
      }
    }
    return {
      kind: isEr ? "er" : isClass ? "class" : "flowchart",
      direction,
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  // 4. Generic hierarchical XML tree
  let counter = 0;
  const walk = (el: Element, parentId?: string, depth = 0) => {
    if (depth > MAX_XML_DEPTH) {
      throw new Error(`XML nesting exceeds the maximum supported depth (${MAX_XML_DEPTH}).`);
    }
    counter += 1;
    if (counter > MAX_XML_NODES) {
      throw new Error(`XML exceeds the maximum supported element count (${MAX_XML_NODES}).`);
    }
    const rawId = el.getAttribute("id") || `${el.tagName}_${counter}`;
    const textOnly = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim() ?? "")
      .join(" ")
      .trim();
    const label =
      el.getAttribute("label") ||
      el.getAttribute("name") ||
      (textOnly ? `${el.tagName}: ${textOnly}` : el.tagName);
    const id = addNode(rawId, label);
    if (parentId) {
      edges.push({ from: parentId, to: id });
    }
    Array.from(el.children).forEach((child) => walk(child, id, depth + 1));
  };
  walk(root, undefined, 0);
  return { kind: "flowchart", direction, nodes: Array.from(nodes.values()), edges };
}

export function parseMermaidToIR(mermaid: string): DiagramIR {
  const lines = mermaid
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  const header = lines[0] ?? "";
  const isClass = /^classDiagram\b/i.test(header);
  const isEr = /^erDiagram\b/i.test(header);
  const isSeq = /^sequenceDiagram\b/i.test(header);
  const direction: "TD" | "LR" = /\bLR\b|\bRL\b/i.test(header) ? "LR" : "TD";
  const nodes = new Map<string, IRNode>();
  const edges: IREdge[] = [];

  const ensureNode = (rawId: string, label?: string, shape?: string) => {
    const id = safeId(rawId);
    const prev = nodes.get(id);
    nodes.set(id, {
      id,
      label: label ? cleanText(label) : prev?.label ?? id,
      shape: shape ?? prev?.shape,
      fields: prev?.fields,
    });
    return id;
  };

  if (isClass || isEr) {
    let currentBlock: string | null = null;
    for (const line of lines.slice(1)) {
      if (currentBlock) {
        if (line === "}") {
          currentBlock = null;
          continue;
        }
        const node = nodes.get(currentBlock);
        if (node) {
          node.fields = [...(node.fields ?? []), line];
        }
        continue;
      }
      const blockStart = line.match(/^(?:class\s+)?([A-Za-z_]\w*)\s*\{$/);
      if (blockStart) {
        currentBlock = ensureNode(blockStart[1]!);
        continue;
      }
      const rel = isEr
        ? line.match(/^([A-Za-z_]\w*)\s+([|}{o.-]+)\s+([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/)
        : line.match(
            /^([A-Za-z_]\w*)(?:\s+"[^"]*")?\s*(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|--)\s*(?:"[^"]*"\s+)?([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/,
          );
      if (rel) {
        const [, a, op, b, label] = rel;
        edges.push({
          from: ensureNode(a!),
          to: ensureNode(b!),
          label: label ? cleanText(label) : undefined,
          dashed: op?.includes("."),
          relation: op,
        });
      }
    }
    return {
      kind: isEr ? "er" : "class",
      direction,
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  for (const line of lines.slice(1)) {
    if (/^(?:subgraph|end|direction|classDef|style|accTitle|accDescr|autonumber)\b/i.test(line)) {
      continue;
    }
    if (isSeq) {
      const actorMatch = line.match(/^(?:actor|participant)\s+([A-Za-z_]\w*)(?:\s+as\s+(.+))?$/i);
      if (actorMatch) {
        ensureNode(actorMatch[1]!, actorMatch[2] || actorMatch[1]);
        continue;
      }
      const msgMatch = line.match(/^([A-Za-z_]\w*)\s*(--?>>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (msgMatch) {
        edges.push({
          from: ensureNode(msgMatch[1]!),
          to: ensureNode(msgMatch[3]!),
          label: cleanText(msgMatch[4]!),
          dashed: msgMatch[2]!.startsWith("--"),
        });
      }
      continue;
    }

    const edgeMatch = line.match(
      /^(.+?)\s*(-->|-\.->|==>|---|<-->)\s*(?:\|([^|]+)\|\s*)?(.+)$/,
    );
    const parseEndpoint = (token: string) => {
      const m = token.trim().match(/^([A-Za-z_][\w-]*|\[\*\])(?:\(\((.+?)\)\)|\(\[(.+?)\]\)|\[\((.+?)\)\]|\[(.+?)\]|\{(.+?)\})?$/);
      if (!m) return { id: safeId(token), label: cleanText(token), shape: undefined };
      const rawId = m[1] === "[*]" ? "start_end" : m[1]!;
      const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? rawId;
      const shape = m[2] ? "circle" : m[4] ? "cylinder" : m[6] ? "diamond" : undefined;
      return { id: ensureNode(rawId, label, shape), label: cleanText(label), shape };
    };

    if (edgeMatch) {
      const left = parseEndpoint(edgeMatch[1]!);
      const right = parseEndpoint(edgeMatch[4]!);
      edges.push({
        from: left.id,
        to: right.id,
        label: edgeMatch[3] ? cleanText(edgeMatch[3]) : undefined,
        dashed: edgeMatch[2] === "-.->",
      });
    } else {
      parseEndpoint(line);
    }
  }

  return { kind: "flowchart", direction, nodes: Array.from(nodes.values()), edges };
}

export function emitFromIR(ir: DiagramIR, target: CodeFormat): string {
  switch (target) {
    case "mermaid": {
      if (ir.kind === "er") {
        const out = ["erDiagram"];
        for (const n of ir.nodes) {
          if (n.fields?.length) {
            out.push(`  ${n.id} {`);
            n.fields.forEach((f) => out.push(`    ${f}`));
            out.push("  }");
          } else {
            out.push(`  ${n.id} {\n    int id PK\n  }`);
          }
        }
        for (const e of ir.edges) {
          out.push(`  ${e.from} ||--o{ ${e.to} : ${e.label ? cleanText(e.label) : "relates"}`);
        }
        return out.join("\n");
      }
      if (ir.kind === "class") {
        const out = ["classDiagram"];
        for (const n of ir.nodes) {
          if (n.fields?.length) {
            out.push(`  class ${n.id} {`);
            n.fields.forEach((f) => out.push(`    ${f}`));
            out.push("  }");
          } else {
            out.push(`  class ${n.id}`);
          }
        }
        for (const e of ir.edges) {
          const op = e.dashed ? "..>" : "-->";
          out.push(`  ${e.from} ${op} ${e.to}${e.label ? ` : ${e.label}` : ""}`);
        }
        return out.join("\n");
      }
      const out = [`flowchart ${ir.direction}`];
      for (const n of ir.nodes) {
        const lbl = `"${n.label.replace(/"/g, "'")}"`;
        const shaped =
          n.shape === "diamond"
            ? `${n.id}{${lbl}}`
            : n.shape === "circle"
              ? `${n.id}((${lbl}))`
              : n.shape === "cylinder"
                ? `${n.id}[(${lbl})]`
                : `${n.id}[${lbl}]`;
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
      const escapeDot = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const out = ["digraph Diagram {", `  rankdir=${ir.direction === "LR" ? "LR" : "TB"};`];
      for (const n of ir.nodes) {
        const attrs = [`label="${escapeDot(n.label)}"`];
        if (n.shape) attrs.push(`shape=${n.shape}`);
        out.push(`  ${n.id} [${attrs.join(", ")}];`);
      }
      for (const e of ir.edges) {
        const attrs: string[] = [];
        if (e.label) attrs.push(`label="${escapeDot(e.label)}"`);
        if (e.dashed) attrs.push("style=dashed");
        out.push(`  ${e.from} -> ${e.to}${attrs.length ? ` [${attrs.join(", ")}]` : ""};`);
      }
      out.push("}");
      return out.join("\n");
    }

    case "plantuml": {
      const out = ["@startuml"];
      for (const n of ir.nodes) {
        if (n.fields?.length) {
          out.push(`class ${n.id} {`);
          n.fields.forEach((f) => out.push(`  ${f}`));
          out.push("}");
        } else {
          out.push(`class "${n.label.replace(/"/g, "'")}" as ${n.id}`);
        }
      }
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
      for (const e of ir.edges) {
        out.push(`${e.from} -> ${e.to}${e.label ? `: ${e.label}` : ""}`);
      }
      return out.join("\n");
    }

    case "sql": {
      const incoming = new Map<string, string[]>();
      for (const e of ir.edges) {
        const list = incoming.get(e.to) ?? [];
        list.push(e.from);
        incoming.set(e.to, list);
      }
      const out: string[] = [];
      for (const n of ir.nodes) {
        const cols: string[] = [];
        if (n.fields?.length) {
          for (const f of n.fields) {
            const parts = f.replace(/^[+-]/, "").trim().split(/\s+/);
            const isPk = /\bPK\b/i.test(f);
            const colType = (parts[0] || "VARCHAR(255)").toUpperCase();
            const colName = safeId(parts[1] || parts[0] || "col");
            cols.push(`  ${colName} ${colType}${isPk ? " PRIMARY KEY" : ""}`);
          }
        } else {
          cols.push("  id INT PRIMARY KEY");
          cols.push(`  label VARCHAR(255)`);
        }
        for (const parent of incoming.get(n.id) ?? []) {
          cols.push(`  ${parent.toLowerCase()}_id INT REFERENCES ${parent}(id)`);
        }
        out.push(`CREATE TABLE ${n.id} (\n${cols.join(",\n")}\n);`);
      }
      return out.join("\n");
    }

    case "typescript": {
      const outgoing = new Map<string, IREdge[]>();
      for (const e of ir.edges) {
        const list = outgoing.get(e.from) ?? [];
        list.push(e);
        outgoing.set(e.from, list);
      }
      const out: string[] = [];
      for (const n of ir.nodes) {
        const props: string[] = [];
        if (n.fields?.length) {
          for (const f of n.fields) {
            const clean = f.replace(/^[+-]/, "").trim();
            if (clean.includes("()")) {
              props.push(`  ${clean.replace(/\(\)\s*(.*)$/, "(): $1").replace(/:\s*$/, ": void")};`);
            } else {
              const parts = clean.split(/\s+/);
              const t = parts[0] || "string";
              const k = safeId(parts[1] || "value");
              props.push(`  ${k}: ${t};`);
            }
          }
        } else {
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
          for (const f of n.fields) {
            out.push(`      <field>${escapeXml(f)}</field>`);
          }
          out.push("    </class>");
        } else {
          out.push(`    <node id="${escapeXml(n.id)}" label="${escapeXml(n.label)}"${shapeAttr} />`);
        }
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
