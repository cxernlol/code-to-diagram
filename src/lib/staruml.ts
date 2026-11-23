import { toMermaidSource } from "./formats";
import { parseMermaidToIR } from "./translate";
import type { Position } from "../types";

const MAX_MDJ_BYTES = 2 * 1024 * 1024;

interface StarUmlRef {
  $ref?: string;
}

interface StarUmlElement {
  _type?: string;
  _id?: string;
  name?: string;
  visibility?: string;
  type?: string | StarUmlRef;
  direction?: string;
  aggregation?: string;
  navigable?: string | boolean;
  multiplicity?: string;
  attributes?: StarUmlElement[];
  operations?: StarUmlElement[];
  parameters?: StarUmlElement[];
  ownedElements?: StarUmlElement[];
  source?: StarUmlRef;
  target?: StarUmlRef;
  reference?: StarUmlRef;
  end1?: StarUmlElement;
  end2?: StarUmlElement;
}

const VISIBILITY_SYMBOL: Record<string, string> = {
  public: "+",
  private: "-",
  protected: "#",
  package: "~",
};

function sanitizeClassId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9_]/g, "_");
  if (!cleaned) return "Class";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `C_${cleaned}`;
}

function escapeLabel(raw: string): string {
  return raw.trim().replace(/"/g, "'").replace(/\r?\n/g, " ");
}

function visibilityPrefix(visibility?: string): string {
  return VISIBILITY_SYMBOL[visibility ?? ""] ?? "+";
}

function resolveTypeName(
  typeVal: string | StarUmlRef | undefined,
  namesById: Map<string, string>,
): string {
  if (!typeVal) return "";
  if (typeof typeVal === "string") return typeVal.trim();
  if (typeof typeVal === "object" && typeVal.$ref) {
    return namesById.get(typeVal.$ref) ?? "";
  }
  return "";
}

function formatAttribute(attr: StarUmlElement, namesById: Map<string, string>): string {
  const vis = visibilityPrefix(attr.visibility);
  const rawName = (attr.name ?? "").trim();
  const typeName = resolveTypeName(attr.type, namesById);
  if (typeName && rawName) return `${vis}${typeName} ${rawName}`;
  return `${vis}${rawName || typeName || "field"}`;
}

function formatOperation(op: StarUmlElement, namesById: Map<string, string>): string {
  const vis = visibilityPrefix(op.visibility);
  const rawName = (op.name ?? "method").trim();
  const params: string[] = [];
  let returnType = "";
  for (const param of op.parameters ?? []) {
    const pType = resolveTypeName(param.type, namesById);
    if (param.direction === "return") {
      returnType = pType;
    } else {
      const pName = (param.name ?? "").trim();
      params.push([pType, pName].filter(Boolean).join(" "));
    }
  }
  const sig = `${vis}${rawName}(${params.filter(Boolean).join(", ")})`;
  return returnType ? `${sig} ${returnType}` : sig;
}

/**
 * Convert a StarUML `.mdj` JSON project file into Mermaid `classDiagram` source.
 */
export function starumlToMermaid(source: string): string {
  if (new TextEncoder().encode(source).length > MAX_MDJ_BYTES) {
    throw new Error("StarUML .mdj file is too large (max 2 MB).");
  }
  let root: StarUmlElement;
  try {
    root = JSON.parse(source) as StarUmlElement;
  } catch {
    throw new Error("The selected .mdj file is not valid JSON.");
  }
  if (!root || typeof root !== "object" || (!root._type && !Array.isArray(root.ownedElements))) {
    throw new Error("The selected file does not look like a StarUML .mdj project.");
  }

  const classElements: StarUmlElement[] = [];
  const relations: StarUmlElement[] = [];
  const namesById = new Map<string, string>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const el = node as StarUmlElement;
    if (
      el._id &&
      el.name &&
      (el._type === "UMLClass" || el._type === "UMLInterface" || el._type === "UMLEnumeration")
    ) {
      namesById.set(el._id, el.name.trim());
      classElements.push(el);
    } else if (
      el._type === "UMLGeneralization" ||
      el._type === "UMLInterfaceRealization" ||
      el._type === "UMLDependency" ||
      el._type === "UMLAssociation"
    ) {
      relations.push(el);
    }
    for (const value of Object.values(el)) {
      if (value && typeof value === "object") walk(value);
    }
  };

  walk(root);

  if (classElements.length === 0) {
    throw new Error("No UML classes or relationships were found in that .mdj file.");
  }

  const idByRef = new Map<string, string>();
  const usedIds = new Set<string>();
  for (const el of classElements) {
    const base = sanitizeClassId(el.name ?? "Class");
    let candidate = base;
    let index = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}_${index++}`;
    }
    usedIds.add(candidate);
    if (el._id) idByRef.set(el._id, candidate);
  }

  const lines: string[] = ["classDiagram"];
  for (const el of classElements) {
    const id = el._id ? idByRef.get(el._id)! : sanitizeClassId(el.name ?? "Class");
    const rawName = (el.name ?? id).trim();
    const header = rawName !== id ? `class ${id}["${escapeLabel(rawName)}"]` : `class ${id}`;
    const members: string[] = [];
    if (el._type === "UMLInterface") members.push("  <<interface>>");
    if (el._type === "UMLEnumeration") members.push("  <<enumeration>>");
    for (const attr of el.attributes ?? []) {
      if (attr._type === "UMLAttribute" || attr.name || attr.type) {
        members.push(`  ${formatAttribute(attr, namesById)}`);
      }
    }
    for (const op of el.operations ?? []) {
      if (op._type === "UMLOperation" || op.name) {
        members.push(`  ${formatOperation(op, namesById)}`);
      }
    }
    if (members.length > 0) {
      lines.push(`  ${header} {`);
      members.forEach((m) => lines.push(`  ${m}`));
      lines.push("  }");
    } else {
      lines.push(`  ${header}`);
    }
  }

  for (const rel of relations) {
    if (rel._type === "UMLGeneralization") {
      const subId = rel.source?.$ref ? idByRef.get(rel.source.$ref) : undefined;
      const supId = rel.target?.$ref ? idByRef.get(rel.target.$ref) : undefined;
      if (subId && supId) lines.push(`  ${supId} <|-- ${subId}`);
      continue;
    }
    if (rel._type === "UMLInterfaceRealization") {
      const implId = rel.source?.$ref ? idByRef.get(rel.source.$ref) : undefined;
      const ifaceId = rel.target?.$ref ? idByRef.get(rel.target.$ref) : undefined;
      if (implId && ifaceId) lines.push(`  ${ifaceId} <|.. ${implId}`);
      continue;
    }
    if (rel._type === "UMLDependency") {
      const fromId = rel.source?.$ref ? idByRef.get(rel.source.$ref) : undefined;
      const toId = rel.target?.$ref ? idByRef.get(rel.target.$ref) : undefined;
      if (fromId && toId) {
        const label = rel.name?.trim() ? ` : ${escapeLabel(rel.name)}` : "";
        lines.push(`  ${fromId} ..> ${toId}${label}`);
      }
      continue;
    }
    if (rel._type === "UMLAssociation" && rel.end1 && rel.end2) {
      const id1 = rel.end1.reference?.$ref ? idByRef.get(rel.end1.reference.$ref) : undefined;
      const id2 = rel.end2.reference?.$ref ? idByRef.get(rel.end2.reference.$ref) : undefined;
      if (!id1 || !id2) continue;
      const m1 = rel.end1.multiplicity?.trim() ? ` "${escapeLabel(rel.end1.multiplicity)}"` : "";
      const m2 = rel.end2.multiplicity?.trim() ? ` "${escapeLabel(rel.end2.multiplicity)}"` : "";
      const label = rel.name?.trim() ? ` : ${escapeLabel(rel.name)}` : "";
      const agg1 = rel.end1.aggregation;
      const agg2 = rel.end2.aggregation;
      if (agg1 === "composite") {
        lines.push(`  ${id1}${m1} *--${m2} ${id2}${label}`);
      } else if (agg2 === "composite") {
        lines.push(`  ${id2}${m2} *--${m1} ${id1}${label}`);
      } else if (agg1 === "shared") {
        lines.push(`  ${id1}${m1} o--${m2} ${id2}${label}`);
      } else if (agg2 === "shared") {
        lines.push(`  ${id2}${m2} o--${m1} ${id1}${label}`);
      } else if (rel.end2.navigable === "navigable" || rel.end2.navigable === true) {
        lines.push(`  ${id1}${m1} -->${m2} ${id2}${label}`);
      } else if (rel.end1.navigable === "navigable" || rel.end1.navigable === true) {
        lines.push(`  ${id2}${m2} -->${m1} ${id1}${label}`);
      } else {
        lines.push(`  ${id1}${m1} --${m2} ${id2}${label}`);
      }
    }
  }

  return lines.join("\n");
}

const SYMBOL_VISIBILITY: Record<string, string> = {
  "+": "public",
  "-": "private",
  "#": "protected",
  "~": "package",
};

interface ClassDraft {
  id: string;
  name: string;
  stereotype?: "interface" | "enumeration";
  attributes: Array<{ name: string; type?: string; visibility: string }>;
  operations: Array<{
    name: string;
    visibility: string;
    params: Array<{ name: string; type?: string }>;
    returnType?: string;
  }>;
}

interface RelationDraft {
  from: string;
  to: string;
  op: string;
  m1?: string;
  m2?: string;
  label?: string;
}

function parseMemberLine(rawLine: string, target: ClassDraft) {
  const line = rawLine.trim();
  if (!line) return;
  if (/^<<\s*interface\s*>>$/i.test(line)) {
    target.stereotype = "interface";
    return;
  }
  if (/^<<\s*enumeration\s*>>$/i.test(line)) {
    target.stereotype = "enumeration";
    return;
  }
  const visChar = line[0] ?? "";
  const visibility = SYMBOL_VISIBILITY[visChar] ?? "public";
  const body = (SYMBOL_VISIBILITY[visChar] ? line.slice(1) : line).trim();
  if (!body) return;

  const opMatch = body.match(/^([^(]+?)\(([^)]*)\)(?:\s*(?::\s*)?(.+))?$/);
  if (opMatch) {
    const rawParams = (opMatch[2] ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const params = rawParams.map((p) => {
      const colonIdx = p.indexOf(":");
      if (colonIdx > 0) {
        return { name: p.slice(0, colonIdx).trim(), type: p.slice(colonIdx + 1).trim() || undefined };
      }
      const parts = p.split(/\s+/);
      if (parts.length >= 2) {
        return { name: parts.slice(1).join(" "), type: parts[0] };
      }
      return { name: p };
    });
    target.operations.push({
      name: opMatch[1]!.trim(),
      visibility,
      params,
      returnType: opMatch[3]?.trim() || undefined,
    });
    return;
  }

  const colonIdx = body.indexOf(":");
  if (colonIdx > 0) {
    target.attributes.push({
      name: body.slice(0, colonIdx).trim(),
      type: body.slice(colonIdx + 1).trim() || undefined,
      visibility,
    });
    return;
  }
  const parts = body.split(/\s+/);
  if (parts.length >= 2) {
    target.attributes.push({
      type: parts.slice(0, -1).join(" "),
      name: parts[parts.length - 1]!,
      visibility,
    });
  } else {
    target.attributes.push({ name: body, visibility });
  }
}

function parseClassDiagramDrafts(mermaid: string): { classes: ClassDraft[]; relations: RelationDraft[] } {
  const lines = mermaid
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  const classes = new Map<string, ClassDraft>();
  const relations: RelationDraft[] = [];

  const ensure = (id: string, label?: string): ClassDraft => {
    const existing = classes.get(id);
    if (existing) {
      if (label && existing.name === existing.id) existing.name = label;
      return existing;
    }
    const created: ClassDraft = { id, name: label || id, attributes: [], operations: [] };
    classes.set(id, created);
    return created;
  };

  let current: ClassDraft | null = null;
  for (const line of lines.slice(1)) {
    if (current) {
      if (line === "}") {
        current = null;
      } else {
        parseMemberLine(line, current);
      }
      continue;
    }
    const blockMatch = line.match(/^(?:class\s+)?([A-Za-z_]\w*)(?:\["([^"]+)"\])?\s*\{$/);
    if (blockMatch) {
      current = ensure(blockMatch[1]!, blockMatch[2]);
      continue;
    }
    const standalone = line.match(/^class\s+([A-Za-z_]\w*)(?:\["([^"]+)"\])?$/);
    if (standalone) {
      ensure(standalone[1]!, standalone[2]);
      continue;
    }
    const rel = line.match(
      /^([A-Za-z_]\w*)(?:\s+"([^"]*)")?\s*(<\|\.\.|\.\.\|>|<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|--)\s*(?:"([^"]*)"\s+)?([A-Za-z_]\w*)(?:\s*:\s*(.+))?$/,
    );
    if (rel) {
      const [, a, m1, op, m2, b, label] = rel;
      ensure(a!);
      ensure(b!);
      relations.push({
        from: a!,
        to: b!,
        op: op!,
        m1: m1?.trim() || undefined,
        m2: m2?.trim() || undefined,
        label: label?.trim() || undefined,
      });
    }
  }
  return { classes: Array.from(classes.values()), relations };
}

/**
 * Convert diagram source (Mermaid or any supported syntax) into a StarUML `.mdj` JSON project.
 */
export function mermaidToStaruml(
  source: string,
  projectName = "Diagram",
  layout?: Record<string, Position>,
): string {
  const mermaid = toMermaidSource(source).mermaid;
  const firstLine = mermaid.replace(/^\uFEFF/, "").trimStart().split(/\r?\n/, 1)[0] ?? "";

  let classes: ClassDraft[];
  let relations: RelationDraft[];

  if (/^classDiagram\b/i.test(firstLine)) {
    ({ classes, relations } = parseClassDiagramDrafts(mermaid));
  } else {
    const ir = parseMermaidToIR(mermaid);
    classes = ir.nodes.map((node) => {
      const draft: ClassDraft = {
        id: node.id,
        name: node.label || node.id,
        attributes: [],
        operations: [],
      };
      (node.fields ?? []).forEach((field) => parseMemberLine(field, draft));
      return draft;
    });
    relations = ir.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      op: edge.dashed ? "..>" : "-->",
      label: edge.label,
    }));
  }

  let seq = 1;
  const nextId = () => `AAAAAA${String(seq++).padStart(6, "0")}`;
  const modelId = nextId();
  const diagramId = nextId();
  const classIds = new Map<string, string>();
  const ownedElements: Record<string, unknown>[] = [];
  const ownedViews: Record<string, unknown>[] = [];

  ownedElements.push({
    _type: "UMLClassDiagram",
    _id: diagramId,
    _parent: { $ref: modelId },
    name: "Main",
    ownedViews,
  });

  classes.forEach((cls, idx) => {
    const elId = nextId();
    classIds.set(cls.id, elId);
    const umlType =
      cls.stereotype === "interface"
        ? "UMLInterface"
        : cls.stereotype === "enumeration"
          ? "UMLEnumeration"
          : "UMLClass";
    const viewType =
      cls.stereotype === "interface"
        ? "UMLInterfaceView"
        : cls.stereotype === "enumeration"
          ? "UMLEnumerationView"
          : "UMLClassView";

    const attributes = cls.attributes.map((attr) => ({
      _type: "UMLAttribute",
      _id: nextId(),
      _parent: { $ref: elId },
      name: attr.name,
      visibility: attr.visibility,
      ...(attr.type ? { type: attr.type } : {}),
    }));

    const operations = cls.operations.map((op) => {
      const opId = nextId();
      const parameters: Record<string, unknown>[] = op.params.map((p) => ({
        _type: "UMLParameter",
        _id: nextId(),
        _parent: { $ref: opId },
        name: p.name,
        ...(p.type ? { type: p.type } : {}),
      }));
      if (op.returnType) {
        parameters.push({
          _type: "UMLParameter",
          _id: nextId(),
          _parent: { $ref: opId },
          direction: "return",
          type: op.returnType,
        });
      }
      return {
        _type: "UMLOperation",
        _id: opId,
        _parent: { $ref: elId },
        name: op.name,
        visibility: op.visibility,
        ...(parameters.length > 0 ? { parameters } : {}),
      };
    });

    ownedElements.push({
      _type: umlType,
      _id: elId,
      _parent: { $ref: modelId },
      name: cls.name,
      ...(attributes.length > 0 ? { attributes } : {}),
      ...(operations.length > 0 ? { operations } : {}),
    });

    const pos = layout?.[cls.id];
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    ownedViews.push({
      _type: viewType,
      _id: nextId(),
      _parent: { $ref: diagramId },
      model: { $ref: elId },
      left: Math.round(pos?.x ?? 80 + col * 240),
      top: Math.round(pos?.y ?? 80 + row * 180),
      width: 180,
      height: 80 + (attributes.length + operations.length) * 16,
    });
  });

  relations.forEach((rel) => {
    const fromId = classIds.get(rel.from);
    const toId = classIds.get(rel.to);
    if (!fromId || !toId) return;

    const relId = nextId();
    if (rel.op === "<|--" || rel.op === "--|>") {
      const [sub, sup] = rel.op === "<|--" ? [toId, fromId] : [fromId, toId];
      ownedElements.push({
        _type: "UMLGeneralization",
        _id: relId,
        _parent: { $ref: modelId },
        source: { $ref: sub },
        target: { $ref: sup },
      });
      return;
    }
    if (rel.op === "<|.." || rel.op === "..|>") {
      const [impl, iface] = rel.op === "<|.." ? [toId, fromId] : [fromId, toId];
      ownedElements.push({
        _type: "UMLInterfaceRealization",
        _id: relId,
        _parent: { $ref: modelId },
        source: { $ref: impl },
        target: { $ref: iface },
      });
      return;
    }
    if (rel.op === "..>") {
      ownedElements.push({
        _type: "UMLDependency",
        _id: relId,
        _parent: { $ref: modelId },
        ...(rel.label ? { name: rel.label } : {}),
        source: { $ref: fromId },
        target: { $ref: toId },
      });
      return;
    }

    const assoc: Record<string, unknown> = {
      _type: "UMLAssociation",
      _id: relId,
      _parent: { $ref: modelId },
      ...(rel.label ? { name: rel.label } : {}),
      end1: {
        _type: "UMLAssociationEnd",
        _id: nextId(),
        _parent: { $ref: relId },
        reference: { $ref: fromId },
        ...(rel.m1 ? { multiplicity: rel.m1 } : {}),
        ...(rel.op === "*--" ? { aggregation: "composite" } : rel.op === "o--" ? { aggregation: "shared" } : {}),
        ...(rel.op === "<--" ? { navigable: "navigable" } : {}),
      },
      end2: {
        _type: "UMLAssociationEnd",
        _id: nextId(),
        _parent: { $ref: relId },
        reference: { $ref: toId },
        ...(rel.m2 ? { multiplicity: rel.m2 } : {}),
        ...(rel.op === "--*" ? { aggregation: "composite" } : rel.op === "--o" ? { aggregation: "shared" } : {}),
        ...(rel.op === "-->" ? { navigable: "navigable" } : {}),
      },
    };
    ownedElements.push(assoc);
  });

  const projectId = nextId();
  return JSON.stringify(
    {
      _type: "Project",
      _id: projectId,
      name: projectName,
      ownedElements: [
        {
          _type: "UMLModel",
          _id: modelId,
          _parent: { $ref: projectId },
          name: "Model",
          ownedElements,
        },
      ],
    },
    null,
    2,
  );
}
