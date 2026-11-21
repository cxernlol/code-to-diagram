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
