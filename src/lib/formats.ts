import { emitFromIR, parseMermaidToIR, parseXmlToIR } from "./translate";

export type CodeFormat =
  | "mermaid"
  | "dot"
  | "plantuml"
  | "d2"
  | "sql"
  | "typescript"
  | "xml";

export const FORMAT_LABELS: Record<CodeFormat, string> = {
  mermaid: "Mermaid",
  dot: "Graphviz DOT",
  plantuml: "PlantUML",
  d2: "D2",
  sql: "SQL DDL",
  typescript: "TypeScript",
  xml: "XML",
};

export const FORMAT_EXTENSIONS: Record<CodeFormat, string> = {
  mermaid: "mmd",
  dot: "dot",
  plantuml: "puml",
  d2: "d2",
  sql: "sql",
  typescript: "ts",
  xml: "xml",
};

const MERMAID_HEADER_RE =
  /^\s*(?:%%\{[\s\S]*?\}%%\s*)?(?:flowchart|graph|classDiagram|stateDiagram(?:-v2)?|erDiagram|sequenceDiagram|gantt|mindmap|pie|journey|gitGraph|C4Context|C4Container|C4Component|requirementDiagram)\b/i;

function sanitizeId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/[^A-Za-z0-9_]/g, "_");
  if (!cleaned) return "node";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function escapeMermaidLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/"/g, "'")
    .replace(/\r?\n/g, " ");
}

function stripLineComments(source: string, prefix: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf(prefix);
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      const quotes = (before.match(/"/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join("\n");
}

export function detectCodeFormat(source: string): CodeFormat {
  const trimmed = source.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return "mermaid";
  if (MERMAID_HEADER_RE.test(trimmed)) return "mermaid";
  if (/^<\?xml\b|^<!DOCTYPE\b|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?>[\s\S]*<\/[A-Za-z_][\w:-]*>\s*$|^<[A-Za-z_][\w:-]*(?:\s+[^>]*)?\/>\s*$/i.test(trimmed)) {
    return "xml";
  }
  if (/^@startuml\b/im.test(trimmed)) return "plantuml";
  if (/^(?:strict\s+)?(?:di)?graph\b[\s\S]*\{/i.test(trimmed)) return "dot";
  if (/\bCREATE\s+TABLE\b/i.test(trimmed)) return "sql";
  if (
    /^(?:export\s+)?(?:interface|type|class)\s+[A-Za-z_]\w*(?:\s+extends\s+|\s+implements\s+|\s*=\s*\{|\s*\{)/m.test(
      trimmed,
    )
  ) {
    return "typescript";
  }
  if (/^\s*[\w."'-]+\s*(?:->|<-|<->|--)\s*[\w."'-]+/m.test(trimmed)) {
    return "d2";
  }
  return "mermaid";
}

function parseDotAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([A-Za-z_]\w*)\s*=\s*("(?:\\.|[^"])*"|[^\s,\]]+)/g;
  for (const match of raw.matchAll(attrRe)) {
    const key = match[1]?.toLowerCase();
    const val = match[2];
    if (key && val !== undefined) {
      attrs[key] = val.replace(/^"|"$/g, "");
    }
  }
  return attrs;
}

function formatDotNode(id: string, label?: string, shape?: string): string {
  const safeId = sanitizeId(id);
  const text = `"${escapeMermaidLabel(label || id)}"`;
  switch (shape?.toLowerCase()) {
    case "diamond":
      return `${safeId}{${text}}`;
    case "circle":
    case "doublecircle":
      return `${safeId}((${text}))`;
    case "ellipse":
    case "oval":
      return `${safeId}([${text}])`;
    case "cylinder":
      return `${safeId}[(${text})]`;
    default:
      return `${safeId}[${text}]`;
  }
}

function convertDotToMermaid(source: string): string {
  const cleaned = stripLineComments(
    source.replace(/\/\*[\s\S]*?\*\//g, ""),
    "//",
  );
  const rankMatch = cleaned.match(/\brankdir\s*=\s*"?(TB|TD|BT|RL|LR)"?/i);
  const dir = rankMatch?.[1]?.toUpperCase() || "TD";
  const lines: string[] = [`flowchart ${dir === "TB" ? "TD" : dir}`];
  const declared = new Map<string, { label?: string; shape?: string }>();
  const edges: string[] = [];

  const bodyStart = cleaned.indexOf("{");
  const bodyEnd = cleaned.lastIndexOf("}");
  const body =
    bodyStart !== -1 && bodyEnd > bodyStart
      ? cleaned.slice(bodyStart + 1, bodyEnd)
      : cleaned;

  const statements = body
    .replace(/\r?\n/g, ";")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    if (
      /^(?:subgraph|node|edge|graph|rankdir|rank|splines|nodesep|ranksep)\b/i.test(
        stmt,
      ) ||
      stmt === "{" ||
      stmt === "}"
    ) {
      continue;
    }
    if (/^[A-Za-z_]\w*\s*=/.test(stmt)) continue;

    const attrMatch = stmt.match(/\[([^\]]*)\]\s*$/);
    const attrs = attrMatch ? parseDotAttrs(attrMatch[1] ?? "") : {};
    const expr = (attrMatch ? stmt.slice(0, attrMatch.index) : stmt).trim();

    if (/->|--/.test(expr)) {
      const parts = expr
        .split(/\s*(?:->|--)\s*/)
        .map((p) => p.replace(/:[A-Za-z_]\w*$/, "").trim())
        .filter(Boolean);
      const isUndirected = expr.includes("--") && !expr.includes("->");
      const dashed = /dashed|dotted/i.test(attrs.style ?? "");
      const op = isUndirected
        ? dashed
          ? "-.-"
          : "---"
        : dashed
          ? "-.->"
          : "-->";
      const edgeLabel = attrs.label
        ? `|${escapeMermaidLabel(attrs.label)}|`
        : "";
      for (let i = 0; i < parts.length - 1; i += 1) {
        const fromId = sanitizeId(parts[i]!);
        const toId = sanitizeId(parts[i + 1]!);
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
        shape: attrs.shape ?? prev.shape,
      });
    }
  }

  for (const [id, info] of declared) {
    lines.push(`  ${formatDotNode(id, info.label, info.shape)}`);
  }
  lines.push(...edges);
  return lines.join("\n");
}

function convertPlantUmlToMermaid(source: string): string {
  const rawLines = source
    .replace(/@startuml[^\n]*\n?/i, "")
    .replace(/@enduml[^\n]*$/i, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("'") && !l.startsWith("skinparam"));

  const isSequence = rawLines.some(
    (l) =>
      /^(?:actor|participant|boundary|control|entity|database)\b/i.test(l) ||
      /^\w+\s*-+>>?\s*\w+\s*:/i.test(l),
  );
  if (isSequence) {
    const out = ["sequenceDiagram"];
    for (const line of rawLines) {
      if (/^(?:actor|participant)\s+/i.test(line)) {
        out.push(`  ${line.replace(/\s+as\s+/i, " as ")}`);
      } else if (/^([A-Za-z_]\w*)\s*(--?>?>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/.test(line)) {
        const [, from, arrow, to, msg] = line.match(
          /^([A-Za-z_]\w*)\s*(--?>?>?)\s*([A-Za-z_]\w*)\s*:\s*(.+)$/,
        )!;
        const mArrow = arrow!.startsWith("--") ? "-->>" : "->>";
        out.push(`  ${sanitizeId(from!)} ${mArrow} ${sanitizeId(to!)}: ${msg}`);
      }
    }
    return out.join("\n");
  }

  const isState = rawLines.some((l) => /\[\*\]/.test(l) || /^state\s+/i.test(l));
  if (isState) {
    const out = ["stateDiagram-v2"];
    for (const line of rawLines) {
      const m = line.match(
        /^(\[\*\]|[A-Za-z_]\w*)\s*-+>\s*(\[\*\]|[A-Za-z_]\w*)(?:\s*:\s*(.+))?$/,
      );
      if (m) {
        out.push(`  ${m[1]} --> ${m[2]}${m[3] ? ` : ${m[3]}` : ""}`);
      }
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
    const rel = line.match(
      /^([A-Za-z_]\w*)(?:\s+"([^"]+)")?\s*(<\|--|\*--|o--|-->|<--|\.\.>|\.\.\|>|--)\s*(?:"([^"]+)"\s+)?([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/,
    );
    if (rel) {
      const fromCard = rel[2] ? ` "${rel[2]}"` : "";
      const arrow = rel[3] === "->" ? "-->" : rel[3];
      const toCard = rel[4] ? ` "${rel[4]}"` : "";
      out.push(
        `  ${sanitizeId(rel[1]!)}${fromCard} ${arrow}${toCard} ${sanitizeId(rel[5]!)}${rel[6] ? ` : ${rel[6]}` : ""}`,
      );
    }
  }
  return out.join("\n");
}

function convertD2ToMermaid(source: string): string {
  const cleaned = stripLineComments(source, "#");
  const dirMatch = cleaned.match(/^\s*direction\s*:\s*(right|left|down|up)\b/im);
  const dirMap: Record<string, string> = {
    right: "LR",
    left: "RL",
    down: "TD",
    up: "BT",
  };
  const dir = dirMap[dirMatch?.[1]?.toLowerCase() ?? "down"] ?? "TD";
  const out = [`flowchart ${dir}`];
  const nodes = new Map<string, { label: string; shape?: string }>();
  const edges: string[] = [];
  const stack: string[] = [];

  const ensureNode = (rawId: string, label?: string, shape?: string) => {
    const qualified = [...stack, rawId.trim()].join("_");
    const safeId = sanitizeId(qualified);
    const prev = nodes.get(safeId);
    nodes.set(safeId, {
      label: label ?? prev?.label ?? rawId.trim().replace(/^["']|["']$/g, ""),
      shape: shape ?? prev?.shape,
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
      const groupName = blockStart[1]!.trim();
      const groupId = sanitizeId([...stack, groupName].join("_"));
      stack.push(groupName);
      out.push(`  subgraph ${groupId}["${escapeMermaidLabel(groupName)}"]`);
      continue;
    }

    const edgeMatch = line.match(
      /^([A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)*)\s*(->|<-|<->|--)\s*([A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_.-]+)*)(?:\s*:\s*(.+))?$/,
    );
    if (edgeMatch) {
      const [, rawA, op, rawB, rawLabel] = edgeMatch;
      const a = ensureNode(rawA!);
      const b = ensureNode(rawB!);
      const mOp = op === "<->" ? "<-->" : op === "--" ? "---" : "-->";
      const label = rawLabel ? `|${escapeMermaidLabel(rawLabel)}|` : "";
      if (op === "<-") {
        edges.push(`  ${b} -->${label} ${a}`);
      } else {
        edges.push(`  ${a} ${mOp}${label} ${b}`);
      }
      continue;
    }

    const shapeMatch = line.match(/^([A-Za-z0-9_.-]+)\.shape\s*:\s*([A-Za-z]+)$/i);
    if (shapeMatch) {
      ensureNode(shapeMatch[1]!, undefined, shapeMatch[2]!);
      continue;
    }

    const labelMatch = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.+)$/);
    if (labelMatch && !line.includes("{")) {
      ensureNode(labelMatch[1]!, labelMatch[2]!);
    }
  }

  for (const [id, info] of nodes) {
    out.push(`  ${formatDotNode(id, info.label, info.shape)}`);
  }
  out.push(...edges);
  return out.join("\n");
}

function convertSqlToMermaid(source: string): string {
  const cleaned = stripLineComments(
    source.replace(/\/\*[\s\S]*?\*\//g, ""),
    "--",
  );
  const out = ["erDiagram"];
  const relations: string[] = [];
  const tableRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"[]?\w+[`"\]]?\.)?[`"[]?(\w+)[`"\]]?\s*\(([\s\S]*?)\)\s*;/gi;

  const fallbackRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"[]?\w+[`"\]]?\.)?[`"[]?(\w+)[`"\]]?\s*\(([\s\S]*?)\)(?:\s*;|\s*$)/gi;

  const matches = Array.from(cleaned.matchAll(tableRe));
  const tableMatches = matches.length > 0 ? matches : Array.from(cleaned.matchAll(fallbackRe));

  for (const match of tableMatches) {
    const tableName = sanitizeId(match[1]!);
    const body = match[2] ?? "";
    const cols: string[] = [];

    const parts = body
      .split(/,(?![^(]*\))/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      const fkMatch = part.match(
        /(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[`"[]?(\w+)[`"\]]?/i,
      );
      if (fkMatch) {
        const target = sanitizeId(fkMatch[1]!);
        relations.push(`  ${target} ||--o{ ${tableName} : references`);
        continue;
      }
      if (/^(?:PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|INDEX|KEY)\b/i.test(part)) {
        continue;
      }
      const colMatch = part.match(/^[`"[]?(\w+)[`"\]]?\s+([A-Za-z0-9_]+)/);
      if (!colMatch) continue;
      const colName = sanitizeId(colMatch[1]!);
      const colType = colMatch[2]!.toLowerCase();
      const isPk = /\bPRIMARY\s+KEY\b/i.test(part);
      const refMatch = part.match(/\bREFERENCES\s+[`"[]?(\w+)[`"\]]?/i);
      const keyTag = isPk ? " PK" : refMatch ? " FK" : "";
      cols.push(`    ${colType} ${colName}${keyTag}`);
      if (refMatch) {
        const target = sanitizeId(refMatch[1]!);
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

function convertTypeScriptToMermaid(source: string): string {
  const cleaned = stripLineComments(
    source.replace(/\/\*[\s\S]*?\*\//g, ""),
    "//",
  );
  const out = ["classDiagram"];
  const knownTypes = new Set<string>();
  const relations: string[] = [];

  const declRe =
    /(?:export\s+)?(?:interface|class|type)\s+(\w+)(?:\s+extends\s+([\w,\s]+?))?(?:\s+implements\s+([\w,\s]+?))?\s*(?:=\s*)?\{([\s\S]*?)\}/g;

  const blocks = Array.from(cleaned.matchAll(declRe));
  blocks.forEach((m) => {
    if (m[1]) knownTypes.add(sanitizeId(m[1]));
  });

  for (const match of blocks) {
    const name = sanitizeId(match[1]!);
    const parents = [
      ...(match[2]?.split(",") ?? []),
      ...(match[3]?.split(",") ?? []),
    ]
      .map((p) => p.trim())
      .filter(Boolean);

    for (const parent of parents) {
      const parentId = sanitizeId(parent);
      relations.push(`  ${parentId} <|-- ${name}`);
    }

    out.push(`  class ${name} {`);
    const body = match[4] ?? "";
    for (const rawLine of body.split(/[;\r\n]+/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const methodMatch = line.match(
        /^(?:(?:public|private|protected|readonly|static)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*([^;{]+))?/,
      );
      if (methodMatch) {
        const ret = methodMatch[3]?.trim() || "void";
        out.push(`    +${methodMatch[1]}() ${escapeMermaidLabel(ret)}`);
        continue;
      }
      const propMatch = line.match(
        /^(?:(?:public|private|protected|readonly|static)\s+)*(\w+)\??\s*:\s*(.+)$/,
      );
      if (propMatch) {
        const propName = propMatch[1]!;
        const propType = propMatch[2]!.trim().replace(/,$/, "");
        out.push(`    +${escapeMermaidLabel(propType)} ${propName}`);
        for (const token of propType.matchAll(/\b([A-Z]\w*)\b/g)) {
          const ref = sanitizeId(token[1]!);
          if (knownTypes.has(ref) && ref !== name) {
            relations.push(`  ${name} --> ${ref} : ${propName}`);
          }
        }
      }
    }
    out.push("  }");
  }

  out.push(...Array.from(new Set(relations)));
  return out.join("\n");
}

export const MAX_SOURCE_CHARS = 512 * 1024;

export function toMermaidSource(source: string): {
  format: CodeFormat;
  mermaid: string;
} {
  if (source.length > MAX_SOURCE_CHARS) {
    throw new Error("Diagram source exceeds the 512 KB limit.");
  }
  const format = detectCodeFormat(source);
  switch (format) {
    case "xml":
      return { format, mermaid: emitFromIR(parseXmlToIR(source), "mermaid") };
    case "dot":
      return { format, mermaid: convertDotToMermaid(source) };
    case "plantuml":
      return { format, mermaid: convertPlantUmlToMermaid(source) };
    case "d2":
      return { format, mermaid: convertD2ToMermaid(source) };
    case "sql":
      return { format, mermaid: convertSqlToMermaid(source) };
    case "typescript":
      return { format, mermaid: convertTypeScriptToMermaid(source) };
    default:
      return { format: "mermaid", mermaid: source };
  }
}

export function translateCodeFormat(source: string, target: CodeFormat): string {
  if (source.length > MAX_SOURCE_CHARS) {
    throw new Error("Diagram source exceeds the 512 KB limit.");
  }
  const format = detectCodeFormat(source);
  if (format === target) return source;
  const ir =
    format === "xml"
      ? parseXmlToIR(source)
      : parseMermaidToIR(toMermaidSource(source).mermaid);
  return emitFromIR(ir, target);
}
