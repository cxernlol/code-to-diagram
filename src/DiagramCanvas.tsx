import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Code2, Eye, EyeOff, Pencil, Plus, RotateCcw, Scan, Shapes, Trash2 } from "lucide-react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { DiagramDocument, Position, StudioSettings } from "./types";
import { GRID_SIZE } from "./constants";
import { colorizeExportedNodes } from "./export";
import { trimLayoutToValidKeys, validLayoutKeySet } from "./lib/layoutKeys";
import {
  detectDiagramType,
  formatMermaidError,
  MOVABLE_DIAGRAM_TYPES,
  getMermaidErrorLine,
  parseMermaidSvg,
  renderMermaid,
  resolveDiagramPalette,
  type DiagramType,
} from "./lib/mermaid";

export interface DiagramCanvasHandle {
  zoomBy: (factor: number) => void;
  fit: () => void;
  reset: () => void;
  arrangeGrid: () => void;
  setTool: (mode: "move" | "hand") => void;
}

interface DiagramCanvasProps {
  document: DiagramDocument;
  settings: StudioSettings;
  readOnly?: boolean;
  onLayoutChange: (layout: Record<string, Position>) => void;
  onCodeChange?: (code: string) => void;
  onNodeMoved: (id: string) => void;
  onNodeSelect?: (id: string) => void;
  onToolChange?: (mode: "move" | "hand") => void;
  onRenderError: (error?: { message: string; line?: number }) => void;
  onTypeChange: (type: DiagramType) => void;
}

type CanvasContextMenu =
  | { kind: "node"; x: number; y: number; id: string; label: string; member?: string }
  | { kind: "edge"; x: number; y: number; id: string; label: string }
  | { kind: "canvas"; x: number; y: number };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FLOWCHART_SHAPES = [
  { label: "Rectangle", open: "[", close: "]" },
  { label: "Rounded", open: "(", close: ")" },
  { label: "Stadium", open: "([", close: "])" },
  { label: "Diamond", open: "{", close: "}" },
  { label: "Circle", open: "((", close: "))" },
  { label: "Subroutine", open: "[[", close: "]]" },
  { label: "Cylinder", open: "[(", close: ")]" },
  { label: "Hexagon", open: "{{", close: "}}" },
] as const;

function updateNodeShapeInCode(
  code: string,
  nodeId: string,
  open: string,
  close: string,
  fallbackLabel: string,
): string | null {
  if (detectDiagramType(code) !== "flowchart") return null;
  const escapedId = escapeRegex(nodeId);
  const shapeRe = new RegExp(
    `(\\b${escapedId})(\\[\\[|\\[\\(|\\(\\(|\\(\\[|\\{\\{|\\[|\\(|\\{)([^\\]\\)\\}]*)(\\]\\]|\\)\\]|\\)\\)|\\]\\)|\\}\\}|\\]|\\)|\\})`,
    "m",
  );
  if (shapeRe.test(code)) {
    return code.replace(shapeRe, `$1${open}$3${close}`);
  }
  if (new RegExp(`\\b${escapedId}\\b`).test(code)) {
    const safe = (fallbackLabel.trim() || nodeId).replace(/"/g, "'");
    return `${code.trimEnd()}\n  ${nodeId}${open}"${safe}"${close}`;
  }
  return null;
}

function readNodeTitle(nodeEl: SVGGElement, id: string): string {
  const titleEl = nodeEl.querySelector<HTMLElement | SVGElement>(
    ".classTitleText, .label-group .nodeLabel, .entityLabel, .nodeLabel",
  );
  const text = titleEl?.textContent?.trim();
  if (text) return text;
  if (nodeEl.querySelector(".divider, .outer-path")) return id;
  return nodeEl.textContent?.trim() || id;
}

function getHiddenNodeIds(code: string): Set<string> {
  const ids = new Set<string>();
  for (const line of code.split(/\r?\n/)) {
    const m = line.match(/^\s*%%\s*sgs-hide:\s*(.+?)\s*$/);
    if (m?.[1]) ids.add(m[1]);
  }
  return ids;
}

function hideNodeInCode(code: string, nodeId: string): string | null {
  const hidden = getHiddenNodeIds(code);
  if (hidden.has(nodeId)) return null;
  return `${code.trimEnd()}\n%% sgs-hide: ${nodeId}`;
}

function normalizeMemberText(text: string): string {
  return text.replace(/\s*:\s*/g, " ").replace(/\s+/g, " ").trim();
}

interface NodeMemberEntry {
  lineIndex: number;
  text: string;
  hidden: boolean;
}

function findNodeBlockRange(lines: string[], code: string, nodeId: string): { start: number; end: number } | null {
  const kind = detectDiagramType(code);
  if (kind !== "class" && kind !== "er") return null;
  const escapedId = escapeRegex(nodeId);
  const startRe =
    kind === "class"
      ? new RegExp(`^\\s*class\\s+${escapedId}(?:\\s*\\[[^\\]]*\\])?\\s*\\{`)
      : new RegExp(`^\\s*${escapedId}(?:\\s*\\[[^\\]]*\\])?\\s*\\{`);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!startRe.test(line) || line.includes("}")) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j]!.includes("}")) return { start: i, end: j };
    }
    return null;
  }
  return null;
}

function listNodeMembersInCode(code: string, nodeId: string): NodeMemberEntry[] {
  const lines = code.split(/\r?\n/);
  const range = findNodeBlockRange(lines, code, nodeId);
  if (!range) return [];
  const members: NodeMemberEntry[] = [];
  for (let i = range.start + 1; i < range.end; i += 1) {
    const line = lines[i]!;
    const hiddenMatch = line.match(/^\s*%%\s*sgs-hidden-member:\s*(.+)$/);
    if (hiddenMatch) {
      members.push({ lineIndex: i, text: hiddenMatch[1]!.trim(), hidden: true });
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;
    members.push({ lineIndex: i, text: trimmed, hidden: false });
  }
  return members;
}

function toggleNodeMemberInCode(code: string, nodeId: string, lineIndex: number): string | null {
  const lines = code.split(/\r?\n/);
  const range = findNodeBlockRange(lines, code, nodeId);
  if (!range || lineIndex <= range.start || lineIndex >= range.end) return null;
  const line = lines[lineIndex];
  if (line === undefined) return null;
  const hiddenMatch = line.match(/^(\s*)%%\s*sgs-hidden-member:\s*(.+)$/);
  if (hiddenMatch) {
    lines[lineIndex] = `${hiddenMatch[1]}${hiddenMatch[2]}`;
    return lines.join("\n");
  }
  const indent = line.match(/^\s*/)?.[0] ?? "  ";
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("%%")) return null;
  lines[lineIndex] = `${indent}%% sgs-hidden-member: ${trimmed}`;
  return lines.join("\n");
}

function setAllNodeMembersHiddenInCode(code: string, nodeId: string, hide: boolean): string | null {
  const lines = code.split(/\r?\n/);
  const range = findNodeBlockRange(lines, code, nodeId);
  if (!range) return null;
  let changed = false;
  for (let i = range.start + 1; i < range.end; i += 1) {
    const line = lines[i]!;
    const hiddenMatch = line.match(/^(\s*)%%\s*sgs-hidden-member:\s*(.+)$/);
    if (hide && !hiddenMatch) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("%%")) {
        const indent = line.match(/^\s*/)?.[0] ?? "  ";
        lines[i] = `${indent}%% sgs-hidden-member: ${trimmed}`;
        changed = true;
      }
    } else if (!hide && hiddenMatch) {
      lines[i] = `${hiddenMatch[1]}${hiddenMatch[2]}`;
      changed = true;
    }
  }
  return changed ? lines.join("\n") : null;
}

function addNodeMemberInCode(code: string, nodeId: string, memberLine: string): string | null {
  const kind = detectDiagramType(code);
  if (kind !== "class" && kind !== "er") return null;
  const trimmedMember = memberLine.replace(/[\r\n]+/g, " ").trim();
  if (!trimmedMember) return null;
  const lines = code.split(/\r?\n/);
  const range = findNodeBlockRange(lines, code, nodeId);
  if (range) {
    const sampleIndent = lines[range.start + 1]?.match(/^\s*/)?.[0] ?? `${lines[range.start]?.match(/^\s*/)?.[0] ?? "  "}  `;
    lines.splice(range.end, 0, `${sampleIndent}${trimmedMember}`);
    return lines.join("\n");
  }
  const escapedId = escapeRegex(nodeId);
  if (kind === "class") {
    const bareIdx = lines.findIndex((line) => new RegExp(`^\\s*class\\s+${escapedId}(?:\\s*\\[[^\\]]*\\])?\\s*$`).test(line));
    if (bareIdx !== -1) {
      const baseLine = lines[bareIdx]!;
      const indent = baseLine.match(/^\s*/)?.[0] ?? "  ";
      lines.splice(bareIdx, 1, `${baseLine} {`, `${indent}  ${trimmedMember}`, `${indent}}`);
      return lines.join("\n");
    }
    return `${code.trimEnd()}\n  class ${nodeId} {\n    ${trimmedMember}\n  }`;
  }
  return `${code.trimEnd()}\n  ${nodeId} {\n    ${trimmedMember}\n  }`;
}

function hideClassMemberInCode(code: string, nodeId: string, memberText: string): string | null {
  if (detectDiagramType(code) !== "class") return null;
  const targetNorm = normalizeMemberText(memberText);
  if (!targetNorm) return null;
  const lines = code.split(/\r?\n/);
  const escapedId = escapeRegex(nodeId);
  const startRe = new RegExp(`^\\s*class\\s+${escapedId}(?:\\s*\\[[^\\]]*\\])?\\s*\\{`);
  let inBlock = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!inBlock) {
      if (startRe.test(line) && !line.includes("}")) inBlock = true;
      continue;
    }
    if (line.includes("}")) break;
    if (/^\s*%%/.test(line)) continue;
    if (normalizeMemberText(line) === targetNorm) {
      const indent = line.match(/^\s*/)?.[0] ?? "  ";
      lines[i] = `${indent}%% sgs-hidden-member: ${line.trim()}`;
      return lines.join("\n");
    }
  }
  return null;
}

function showHiddenNodesInCode(code: string): string | null {
  const next = code
    .split(/\r?\n/)
    .filter((line) => !/^\s*%%\s*sgs-hide:\s*.+$/.test(line))
    .map((line) => line.replace(/^(\s*)%%\s*sgs-hidden-member:\s*(.+)$/, "$1$2"))
    .join("\n");
  return next !== code ? next : null;
}

function deleteNodesInCode(code: string, nodeIds: string[]): string | null {
  const targets = Array.from(new Set(nodeIds.map((id) => id.trim()).filter(Boolean)));
  if (!targets.length) return null;
  let lines = code.split(/\r?\n/);
  const kind = detectDiagramType(code);

  for (const nodeId of targets) {
    const range = findNodeBlockRange(lines, lines.join("\n"), nodeId);
    if (range) {
      lines.splice(range.start, range.end - range.start + 1);
    }
    const escaped = escapeRegex(nodeId);
    const idTokenRe = new RegExp(`(?:^|[\\s|>])${escaped}(?:$|[\\s\\[\\(\\{<:\\-.=])`);
    const declRe =
      kind === "class"
        ? new RegExp(`^\\s*class\\s+${escaped}(?:\\s*\\[[^\\]]*\\])?\\s*$`)
        : kind === "state"
          ? new RegExp(`^\\s*state\\s+(?:"[^"]*"\\s+as\\s+)?${escaped}\\s*$`)
          : new RegExp(`^\\s*${escaped}\\s*(?:\\[|\\(|\\{|$)`);

    lines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("%%")) return true;
      if (declRe.test(line)) return false;
      const isEdgeLine = /(?:-->|---|==>|-\.->|--x|--o|<\|--|--\|>|\*--|o--|\.\.|--)/.test(trimmed);
      if (isEdgeLine && idTokenRe.test(trimmed)) return false;
      return true;
    });
  }

  const next = lines.join("\n");
  return next !== code ? next : null;
}

function updateNodeLabelInCode(code: string, nodeId: string, nextLabel: string): string | null {
  const trimmed = nextLabel.trim();
  if (!trimmed) return null;
  const escapedId = escapeRegex(nodeId);
  const safe = trimmed.replace(/"/g, "'");
  const type = detectDiagramType(code);

  if (type === "flowchart") {
    const shapeRe = new RegExp(
      `(\\b${escapedId})(\\[\\[|\\[\\(|\\(\\(|\\(\\[|\\{\\{|\\[|\\(|\\{)([^\\]\\)\\}]*)(\\]\\]|\\)\\]|\\)\\)|\\]\\)|\\}\\}|\\]|\\)|\\})`,
      "m",
    );
    if (shapeRe.test(code)) {
      return code.replace(shapeRe, `$1$2"${safe}"$4`);
    }
    if (new RegExp(`\\b${escapedId}\\b`).test(code)) {
      return `${code.trimEnd()}\n  ${nodeId}["${safe}"]`;
    }
    return null;
  }

  if (type === "class") {
    const aliasedRe = new RegExp(`(^\\s*class\\s+${escapedId})\\s*\\[[^\\]]*\\]`, "m");
    if (aliasedRe.test(code)) {
      return code.replace(aliasedRe, `$1["${safe}"]`);
    }
    const declRe = new RegExp(`(^\\s*class\\s+${escapedId})(\\s*(?:\\{|$))`, "m");
    if (declRe.test(code)) {
      return code.replace(declRe, `$1["${safe}"]$2`);
    }
    if (new RegExp(`\\b${escapedId}\\b`).test(code)) {
      return `${code.trimEnd()}\n  class ${nodeId}["${safe}"]`;
    }
    return null;
  }

  if (type === "state") {
    const stateAsRe = new RegExp(`(^\\s*state\\s+)"[^"]*"(\\s+as\\s+${escapedId}\\b)`, "m");
    if (stateAsRe.test(code)) {
      return code.replace(stateAsRe, `$1"${safe}"$2`);
    }
    const stateDescRe = new RegExp(`(^\\s*${escapedId}\\s*:\\s*)(.+)$`, "m");
    if (stateDescRe.test(code)) {
      return code.replace(stateDescRe, `$1${safe}`);
    }
    if (new RegExp(`\\b${escapedId}\\b`).test(code)) {
      return `${code.trimEnd()}\n  state "${safe}" as ${nodeId}`;
    }
    return null;
  }

  if (type === "er") {
    const erAliasedRe = new RegExp(`(^\\s*${escapedId})\\[[^\\]]*\\]`, "m");
    if (erAliasedRe.test(code)) {
      return code.replace(erAliasedRe, `$1["${safe}"]`);
    }
    const erBlockRe = new RegExp(`(^\\s*${escapedId})(\\s*\\{)`, "m");
    if (erBlockRe.test(code)) {
      return code.replace(erBlockRe, `$1["${safe}"]$2`);
    }
    if (new RegExp(`\\b${escapedId}\\b`).test(code)) {
      return `${code.trimEnd()}\n  ${nodeId}["${safe}"]`;
    }
  }

  return null;
}

function updateEdgeLabelInCode(code: string, edgeId: string, nextLabel: string): string | null {
  const match = edgeId.match(/^edge::(.+?)->(.+?)::(\d+)$/);
  if (!match) return null;
  const safe = nextLabel.trim().replace(/"/g, "'");
  if (!safe) return null;
  const src = escapeRegex(match[1]!);
  const tgt = escapeRegex(match[2]!);
  const targetIndex = Number(match[3]!);
  const type = detectDiagramType(code);
  const lines = code.split(/\r?\n/);
  let seen = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (type === "flowchart") {
      const pipeRe = new RegExp(
        `^(\\s*${src}\\b(?:\\[[^\\]]*\\]|\\([^)]*\\)|\\{[^}]*\\})*\\s*(?:--+>?|==+>?|-\\.+->?|<-->))\\s*(?:\\|[^|]*\\|\\s*)?(${tgt}\\b.*)$`,
      );
      const textArrowRe = new RegExp(
        `^(\\s*${src}\\b(?:\\[[^\\]]*\\]|\\([^)]*\\)|\\{[^}]*\\})*\\s*)(?:--\\s+[^\\n]+?\\s+-->|-\\.\\s+[^\\n]+?\\s+\\.->|==\\s+[^\\n]+?\\s+==>)(\\s*${tgt}\\b.*)$`,
      );
      if (pipeRe.test(line)) {
        if (seen === targetIndex) {
          lines[i] = line.replace(pipeRe, `$1|${safe}| $2`);
          return lines.join("\n");
        }
        seen += 1;
      } else if (textArrowRe.test(line)) {
        if (seen === targetIndex) {
          lines[i] = line.replace(textArrowRe, `$1-->|${safe}|$2`);
          return lines.join("\n");
        }
        seen += 1;
      }
    } else if (type === "state") {
      const stateEdgeRe = new RegExp(`^(\\s*${src}\\b\\s*-+>\\s*${tgt}\\b)(?:\\s*:\\s*.*)?$`);
      if (stateEdgeRe.test(line)) {
        if (seen === targetIndex) {
          lines[i] = line.replace(stateEdgeRe, `$1 : ${safe}`);
          return lines.join("\n");
        }
        seen += 1;
      }
    } else if (type === "class") {
      const classEdgeRe = new RegExp(
        `^(\\s*${src}\\b\\s*(?:<\\|--|\\*--|o--|-->|\\.\\.>|\\.\\.|--|<\\.\\.|<\\|\\.\\.|--\\|>|--\\*|--o|<--|<-->)\\s*${tgt}\\b)(?:\\s*:\\s*.*)?$`,
      );
      if (classEdgeRe.test(line)) {
        if (seen === targetIndex) {
          lines[i] = line.replace(classEdgeRe, `$1 : ${safe}`);
          return lines.join("\n");
        }
        seen += 1;
      }
    } else if (type === "er") {
      const erEdgeRe = new RegExp(`^(\\s*${src}\\b\\s*[|}o|][|o{}.-]+[|o{]\\s*${tgt}\\b)(?:\\s*:\\s*.*)?$`);
      if (erEdgeRe.test(line)) {
        if (seen === targetIndex) {
          lines[i] = line.replace(erEdgeRe, `$1 : ${safe}`);
          return lines.join("\n");
        }
        seen += 1;
      }
    }
  }
  return null;
}

function addManualItemInCode(code: string, anchorNodeId?: string): { code: string; label: string } | null {
  const type = detectDiagramType(code);
  const nextId = (prefix: string) => {
    let n = 1;
    while (new RegExp(`\\b${prefix}${n}\\b`).test(code)) n += 1;
    return `${prefix}${n}`;
  };
  const base = code.trimEnd();
  if (anchorNodeId) {
    if (type === "flowchart") {
      const id = nextId("Node");
      return { code: `${base}\n  ${anchorNodeId} --> ${id}["New node"]`, label: "Add connected node" };
    }
    if (type === "class") {
      const id = nextId("Class");
      return { code: `${base}\n  class ${id}\n  ${anchorNodeId} --> ${id}`, label: "Add connected class" };
    }
    if (type === "state") {
      const id = nextId("State");
      return { code: `${base}\n  ${anchorNodeId} --> ${id}`, label: "Add connected state" };
    }
    if (type === "er") {
      const id = nextId("ENTITY");
      return { code: `${base}\n  ${anchorNodeId} ||--o{ ${id} : relates`, label: "Add connected entity" };
    }
    return null;
  }
  if (type === "flowchart") {
    const id = nextId("Node");
    return { code: `${base}\n  ${id}["New node"]`, label: "Add node" };
  }
  if (type === "class") {
    const id = nextId("Class");
    return { code: `${base}\n  class ${id} {\n    +id: string\n  }`, label: "Add class" };
  }
  if (type === "state") {
    const id = nextId("State");
    return { code: `${base}\n  state "New state" as ${id}`, label: "Add state" };
  }
  if (type === "er") {
    const id = nextId("ENTITY");
    return { code: `${base}\n  ${id} {\n    string id PK\n  }`, label: "Add entity" };
  }
  return null;
}

function readTranslation(transform: string | null): Position {
  const match = transform?.match(/translate\(\s*(-?[\d.]+)(?:[,\s]+(-?[\d.]+))?/);
  return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
}

function cssTransform(transform: ZoomTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
}

function interpolateView(start: ZoomTransform, target: ZoomTransform, eased: number): ZoomTransform {
  if (Math.abs(target.k - start.k) < 1e-4) {
    return zoomIdentity
      .translate(start.x + (target.x - start.x) * eased, start.y + (target.y - start.y) * eased)
      .scale(start.k);
  }
  const k = Math.exp(Math.log(start.k) + (Math.log(target.k) - Math.log(start.k)) * eased);
  const endRatio = target.k / start.k;
  const denom = 1 - endRatio;
  const anchorX = (target.x - start.x * endRatio) / denom;
  const anchorY = (target.y - start.y * endRatio) / denom;
  const ratio = k / start.k;
  return zoomIdentity
    .translate(anchorX - (anchorX - start.x) * ratio, anchorY - (anchorY - start.y) * ratio)
    .scale(k);
}

function viewAtScale(current: ZoomTransform, scale: number, point: [number, number]): ZoomTransform {
  const next = Math.min(5, Math.max(0.1, scale));
  const from = Math.max(current.k, 0.1);
  const ratio = next / from;
  return zoomIdentity
    .translate(point[0] - (point[0] - current.x) * ratio, point[1] - (point[1] - current.y) * ratio)
    .scale(next);
}

function isTrackpadScroll(event: WheelEvent): boolean {
  return event.deltaMode === WheelEvent.DOM_DELTA_PIXEL && (event.deltaX !== 0 || Math.abs(event.deltaY) < 40);
}

export function stableNodeId(id: string): string {
  return (
    id.match(/^sgs-\d+-(?:flowchart|classId|state|entity|node)-(.+)-\d+$/)?.[1] ??
    id.match(/^sgs-\d+-(.+)-\d+$/)?.[1] ??
    id
  );
}

function pointInRoot(svg: SVGSVGElement, element: SVGGraphicsElement, x: number, y: number) {
  const matrix = element.getCTM();
  if (!matrix) return { x, y };
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  const rootPoint = point.matrixTransform(matrix);
  return { x: rootPoint.x, y: rootPoint.y };
}

function boundsInRoot(svg: SVGSVGElement, element: SVGGraphicsElement) {
  const shape =
    element.matches?.("g.node, [data-sgs-node]")
      ? element.querySelector<SVGGraphicsElement>(
        ":scope > .basic.label-container, :scope > polygon, :scope > circle, :scope > ellipse, :scope > rect, :scope > g.node > .basic.label-container, :scope > g.node > polygon, :scope > g.node > circle, :scope > g.node > ellipse, :scope > g.node > rect",
      )
      : null;
  const target = shape ?? element;
  const box = target.getBBox();
  const corners = [
    pointInRoot(svg, target, box.x, box.y),
    pointInRoot(svg, target, box.x + box.width, box.y),
    pointInRoot(svg, target, box.x, box.y + box.height),
    pointInRoot(svg, target, box.x + box.width, box.y + box.height),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

export function getDiagramBounds(svg: SVGSVGElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const nodeWrappers = Array.from(svg.querySelectorAll<SVGGElement>("[data-sgs-node]"));
  if (nodeWrappers.length > 0) {
    const boxes = nodeWrappers
      .map((wrapper) => boundsInRoot(svg, wrapper))
      .filter((box) => box.width > 0 && box.height > 0);
    const edgePaths = Array.from(
      svg.querySelectorAll<SVGPathElement>(
        "g.edgePath path.path, g.edgePath path, g.relation path, g.edge path, path.flowchart-link, path.relation, path.transition, path.relationshipLine, path[marker-end]",
      ),
    ).filter((path) => !path.closest(".node, .c4-shape, marker, defs") && path.getTotalLength() > 0);
    edgePaths.forEach((path) => {
      const box = boundsInRoot(svg, path);
      if (box.width > 0 || box.height > 0) boxes.push(box);
    });
    svg.querySelectorAll<SVGGElement>("g.cluster, g.edgeLabel, g.edgeTerminals").forEach((group) => {
      if (
        (group.classList.contains("edgeLabel") || group.classList.contains("edgeTerminals")) &&
        !group.textContent?.trim()
      ) {
        return;
      }
      const box = boundsInRoot(svg, group);
      if (box.width > 0 && box.height > 0) boxes.push(box);
    });
    if (boxes.length > 0) {
      const left = Math.min(...boxes.map((b) => b.x));
      const top = Math.min(...boxes.map((b) => b.y));
      const right = Math.max(...boxes.map((b) => b.x + b.width));
      const bottom = Math.max(...boxes.map((b) => b.y + b.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    }
  }
  return boundsInRoot(svg, svg);
}

function distanceToBounds(point: Position, bounds: ReturnType<typeof boundsInRoot>) {
  const dx = Math.max(bounds.x - point.x, 0, point.x - bounds.x - bounds.width);
  const dy = Math.max(bounds.y - point.y, 0, point.y - bounds.y - bounds.height);
  return Math.hypot(dx, dy);
}

type Face = "top" | "bottom" | "left" | "right";

function isDiamondNode(element: Element): boolean {
  return Boolean(
    element.matches?.("g.node, [data-sgs-node]") &&
    element.querySelector(":scope > polygon, :scope > g.node > polygon"),
  );
}

function chooseFace(
  bounds: ReturnType<typeof boundsInRoot>,
  targetBounds: ReturnType<typeof boundsInRoot>,
  obstacles: ReturnType<typeof boundsInRoot>[] = [],
): Face {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const target = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2,
  };
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfW = Math.max(bounds.width / 2, 0.001);
  const halfH = Math.max(bounds.height / 2, 0.001);
  const scaleX = halfW / Math.max(Math.abs(dx), 0.001);
  const scaleY = halfH / Math.max(Math.abs(dy), 0.001);
  const vFace: Face = dy < 0 ? "top" : "bottom";
  const hFace: Face = dx < 0 ? "left" : "right";
  const vGap = Math.max(
    0,
    targetBounds.y - (bounds.y + bounds.height),
    bounds.y - (targetBounds.y + targetBounds.height),
  );
  const hGap = Math.max(
    0,
    targetBounds.x - (bounds.x + bounds.width),
    bounds.x - (targetBounds.x + targetBounds.width),
  );
  const preferVertical =
    vGap >= 16 && hGap <= vGap * 5.5
      ? true
      : hGap >= 16 && vGap < 16
        ? false
        : scaleY <= scaleX;
  const primary = preferVertical ? vFace : hFace;
  const secondary = preferVertical ? hFace : vFace;
  if (obstacles.length > 0 && Math.abs(dx) > 24 && Math.abs(dy) > 24) {
    const faceBlocked = (face: Face) => {
      const { point, normal } = portOnFace(bounds, face, 0);
      return [28, 56].some((dist) => {
        const probe = { x: point.x + normal.x * dist, y: point.y + normal.y * dist };
        return obstacles.some(
          (box) =>
            probe.x >= box.x - 6 &&
            probe.x <= box.x + box.width + 6 &&
            probe.y >= box.y - 6 &&
            probe.y <= box.y + box.height + 6,
        );
      });
    };
    if (faceBlocked(primary) && !faceBlocked(secondary)) {
      return secondary;
    }
  }
  return primary;
}

function portOnFace(
  bounds: ReturnType<typeof boundsInRoot>,
  face: Face,
  offset = 0,
): { point: Position; normal: Position } {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const halfW = Math.max(bounds.width / 2, 0.001);
  const halfH = Math.max(bounds.height / 2, 0.001);
  if (face === "top" || face === "bottom") {
    const sign = face === "top" ? -1 : 1;
    const margin = Math.min(12, halfW * 0.5);
    const clampedX = Math.max(
      bounds.x + margin,
      Math.min(bounds.x + bounds.width - margin, center.x + offset),
    );
    return {
      point: { x: clampedX, y: center.y + sign * halfH },
      normal: { x: 0, y: sign },
    };
  }
  const sign = face === "left" ? -1 : 1;
  const margin = Math.min(12, halfH * 0.5);
  const clampedY = Math.max(
    bounds.y + margin,
    Math.min(bounds.y + bounds.height - margin, center.y + offset),
  );
  return {
    point: { x: center.x + sign * halfW, y: clampedY },
    normal: { x: sign, y: 0 },
  };
}

function longestSegmentMidpoint(points: Position[]): Position {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0]!;
  let bestMid = {
    x: (points[0]!.x + points[points.length - 1]!.x) / 2,
    y: (points[0]!.y + points[points.length - 1]!.y) / 2,
  };
  let bestScore = -1;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const interiorBonus = i > 1 && i < points.length - 1 ? 1.15 : 1;
    const segScore = len * interiorBonus;
    if (segScore > bestScore) {
      bestScore = segScore;
      bestMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestMid;
}

function normalizeMarkers(svg: SVGSVGElement, canvasColor: string) {
  svg
    .querySelectorAll<SVGMarkerElement>(
      'marker[id$="-extensionStart"], marker[id$="-compositionStart"], marker[id$="-aggregationStart"], marker[id$="-dependencyStart"], marker[id$="-lollipopStart"]',
    )
    .forEach((marker) => marker.setAttribute("refX", "1"));
  svg
    .querySelectorAll<SVGMarkerElement>(
      'marker[id$="-extensionEnd"], marker[id$="-compositionEnd"], marker[id$="-aggregationEnd"], marker[id$="-dependencyEnd"]',
    )
    .forEach((marker) => marker.setAttribute("refX", "18"));
  svg
    .querySelectorAll<SVGMarkerElement>('marker[id$="-lollipopEnd"]')
    .forEach((marker) => marker.setAttribute("refX", "13"));
  svg
    .querySelectorAll<SVGMarkerElement>('marker[id$="-pointEnd"]')
    .forEach((marker) => marker.setAttribute("refX", "9"));
  svg
    .querySelectorAll<SVGMarkerElement>('marker[id$="-pointStart"]')
    .forEach((marker) => marker.setAttribute("refX", "1"));
  svg
    .querySelectorAll<SVGElement>(
      "marker.extension path, marker.aggregation path, marker.lollipop circle",
    )
    .forEach((shape) => {
      shape.setAttribute("fill", canvasColor);
      shape.style.fill = canvasColor;
    });
  svg.querySelectorAll<SVGGElement>("g.edgeLabel").forEach((edgeLabel) => {
    if (!edgeLabel.textContent?.trim()) return;
    const textEl = edgeLabel.querySelector<SVGTextElement>("text");
    const innerLabel = edgeLabel.querySelector<SVGGElement>("g.label");
    if (textEl && innerLabel) {
      innerLabel.removeAttribute("transform");
      if (textEl.parentElement instanceof SVGGElement && textEl.parentElement !== innerLabel) {
        textEl.parentElement.removeAttribute("transform");
      }
      textEl.setAttribute("text-anchor", "middle");
      textEl.querySelectorAll(":scope > tspan").forEach((tspan) => tspan.setAttribute("x", "0"));
      textEl.querySelectorAll("tspan tspan").forEach((tspan) => tspan.removeAttribute("x"));
      const tBox = textEl.getBBox();
      if (!tBox.width || !tBox.height) return;
      const padX = 5;
      const padY = 3;
      const bgRect =
        edgeLabel.querySelector<SVGRectElement>("rect.background") ??
        innerLabel.querySelector<SVGRectElement>("rect");
      edgeLabel.querySelectorAll<SVGRectElement>("rect").forEach((rect) => {
        if (rect !== bgRect) {
          rect.setAttribute("width", "0");
          rect.setAttribute("height", "0");
          rect.style.display = "none";
        }
      });
      if (bgRect) {
        bgRect.setAttribute("x", String(tBox.x - padX));
        bgRect.setAttribute("y", String(tBox.y - padY));
        bgRect.setAttribute("width", String(tBox.width + padX * 2));
        bgRect.setAttribute("height", String(tBox.height + padY * 2));
        bgRect.setAttribute("rx", "3");
        bgRect.setAttribute("ry", "3");
        bgRect.style.fill = canvasColor;
        bgRect.style.opacity = "0.95";
      }
      const cx = tBox.x + tBox.width / 2;
      const cy = tBox.y + tBox.height / 2;
      innerLabel.setAttribute("transform", `translate(${-cx},${-cy})`);
      return;
    }
    const fo = edgeLabel.querySelector<SVGForeignObjectElement>("foreignObject");
    if (fo && innerLabel) {
      fo.style.overflow = "visible";
      const htmlChild = fo.firstElementChild as HTMLElement | null;
      if (htmlChild) {
        htmlChild.style.display = "inline-block";
        htmlChild.style.whiteSpace = "nowrap";
        htmlChild.style.padding = "2px 5px";
        htmlChild.style.borderRadius = "3px";
        htmlChild.style.backgroundColor = canvasColor;
        htmlChild.style.textAlign = "center";
        const w = Math.max(fo.width.baseVal.value, htmlChild.scrollWidth, htmlChild.offsetWidth);
        const h = Math.max(fo.height.baseVal.value, htmlChild.scrollHeight, htmlChild.offsetHeight);
        if (w > 0 && h > 0) {
          fo.setAttribute("width", String(w));
          fo.setAttribute("height", String(h));
          innerLabel.setAttribute("transform", `translate(${-w / 2},${-h / 2})`);
        }
      }
    }
  });
  svg.querySelectorAll<SVGGElement>("g.edgeTerminals").forEach((term) => {
    if (!term.textContent?.trim()) return;
    let inner =
      term.querySelector<SVGGElement>("g.inner") ??
      (term.firstElementChild instanceof SVGGElement ? term.firstElementChild : null);
    const textEl = term.querySelector<SVGTextElement>("text");
    if (textEl) {
      if (!inner) {
        inner = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
        inner.setAttribute("class", "inner");
        term.insertBefore(inner, textEl);
      }
      if (textEl.parentNode !== inner) {
        inner.appendChild(textEl);
      }
      inner.removeAttribute("transform");
      textEl.setAttribute("text-anchor", "middle");
      textEl.querySelectorAll(":scope > tspan").forEach((tspan) => tspan.setAttribute("x", "0"));
      textEl.querySelectorAll("tspan tspan").forEach((tspan) => tspan.removeAttribute("x"));
      const tBox = textEl.getBBox();
      if (tBox.width && tBox.height) {
        let bg = inner.querySelector<SVGRectElement>("rect.sgs-term-bg");
        if (!bg) {
          bg = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
          bg.setAttribute("class", "sgs-term-bg");
          inner.insertBefore(bg, textEl);
        }
        bg.setAttribute("x", String(tBox.x - 2));
        bg.setAttribute("y", String(tBox.y - 1));
        bg.setAttribute("width", String(tBox.width + 4));
        bg.setAttribute("height", String(tBox.height + 2));
        bg.setAttribute("rx", "2");
        bg.setAttribute("ry", "2");
        bg.style.fill = canvasColor;
        bg.style.opacity = "0.9";
        inner.setAttribute(
          "transform",
          `translate(${-(tBox.x + tBox.width / 2)},${-(tBox.y + tBox.height / 2)})`,
        );
      }
    }
  });
}

function simplifyOrthogonal(points: Position[]): Position[] {
  const deduped = points.filter((point, index) => {
    const prev = points[index - 1];
    return !prev || Math.abs(prev.x - point.x) > 0.01 || Math.abs(prev.y - point.y) > 0.01;
  });
  const result: Position[] = [];
  for (const point of deduped) {
    while (result.length >= 2) {
      const a = result[result.length - 2]!;
      const b = result[result.length - 1]!;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = point.x - b.x;
      const bcy = point.y - b.y;
      const collinear =
        (Math.abs(abx) < 0.01 && Math.abs(bcx) < 0.01) ||
        (Math.abs(aby) < 0.01 && Math.abs(bcy) < 0.01);
      const sameDirection = abx * bcx + aby * bcy >= 0;
      if (collinear && sameDirection) {
        result.pop();
      } else {
        break;
      }
    }
    result.push(point);
  }
  return result;
}

function toLocalPoint(
  svg: SVGSVGElement,
  element: SVGGraphicsElement,
  point: Position,
): Position {
  const matrix = element.getCTM();
  if (!matrix) return point;
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const local = svgPoint.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

function toRootPoint(svg: SVGSVGElement, clientX: number, clientY: number): Position {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const root = pt.matrixTransform(ctm.inverse());
  return { x: root.x, y: root.y };
}

function projectToBoxAnchor(
  point: Position,
  box: { x: number; y: number; width: number; height: number },
): Position {
  const w = Math.max(1, box.width);
  const h = Math.max(1, box.height);
  const rx = Math.min(0.92, Math.max(0.08, (point.x - box.x) / w));
  const ry = Math.min(0.92, Math.max(0.08, (point.y - box.y) / h));
  const dTop = Math.abs(point.y - box.y);
  const dBottom = Math.abs(point.y - (box.y + h));
  const dLeft = Math.abs(point.x - box.x);
  const dRight = Math.abs(point.x - (box.x + w));
  const best = Math.min(dTop, dBottom, dLeft, dRight);
  if (best === dTop) return { x: rx, y: 0 };
  if (best === dBottom) return { x: rx, y: 1 };
  if (best === dLeft) return { x: 0, y: ry };
  return { x: 1, y: ry };
}

function resolveAnchorOnBox(
  box: { x: number; y: number; width: number; height: number },
  anchor: Position,
): { point: Position; normal: Position } {
  const rx = Math.min(0.92, Math.max(0.08, anchor.x));
  const ry = Math.min(0.92, Math.max(0.08, anchor.y));
  if (anchor.y <= 0.001) return { point: { x: box.x + box.width * rx, y: box.y }, normal: { x: 0, y: -1 } };
  if (anchor.y >= 0.999) return { point: { x: box.x + box.width * rx, y: box.y + box.height }, normal: { x: 0, y: 1 } };
  if (anchor.x <= 0.001) return { point: { x: box.x, y: box.y + box.height * ry }, normal: { x: -1, y: 0 } };
  return { point: { x: box.x + box.width, y: box.y + box.height * ry }, normal: { x: 1, y: 0 } };
}

function routeEdge(
  svg: SVGSVGElement,
  path: SVGPathElement,
  source: SVGGElement,
  target: SVGGElement,
  allNodes: { wrapper: SVGGElement; id: string }[],
  sourceFace: Face,
  sourceOffset: number,
  targetFace: Face,
  targetOffset: number,
  channelOffset = 0,
  manualOffset: Position = { x: 0, y: 0 },
  usedSegments: { a: Position; b: Position }[] = [],
  endOverride?: { point: Position; normal: Position },
  startOverride?: { point: Position; normal: Position },
): {
  points: Position[];
  mid: Position;
  start: Position;
  startNormal: Position;
  end: Position;
  endNormal: Position;
} {
  const sourceBounds = boundsInRoot(svg, source);
  const targetBounds = boundsInRoot(svg, target);
  const sourceDiamond = isDiamondNode(source);
  const targetDiamond = isDiamondNode(target);
  const { point: start, normal: startNormal } = startOverride
    ? { point: { ...startOverride.point }, normal: { ...startOverride.normal } }
    : portOnFace(
        sourceBounds,
        sourceFace,
        sourceDiamond ? 0 : sourceOffset,
      );

  const { point: rawEnd, normal: endNormal } = endOverride
    ? { point: { ...endOverride.point }, normal: { ...endOverride.normal } }
    : portOnFace(
        targetBounds,
        targetFace,
        targetDiamond ? 0 : targetOffset,
      );
  const end = {
    x: rawEnd.x + endNormal.x * 1.5,
    y: rawEnd.y + endNormal.y * 1.5,
  };

  if (!startOverride && !endOverride) {
    if (
      startNormal.y !== 0 &&
      endNormal.y !== 0 &&
      Math.abs(sourceOffset) < 0.1 &&
      Math.abs(targetOffset) < 0.1 &&
      Math.abs(start.x - end.x) <= 16
    ) {
      if (sourceDiamond && !targetDiamond) end.x = start.x;
      else if (targetDiamond && !sourceDiamond) start.x = end.x;
      else end.x = start.x;
    } else if (
      startNormal.x !== 0 &&
      endNormal.x !== 0 &&
      Math.abs(sourceOffset) < 0.1 &&
      Math.abs(targetOffset) < 0.1 &&
      Math.abs(start.y - end.y) <= 16
    ) {
      if (sourceDiamond && !targetDiamond) end.y = start.y;
      else if (targetDiamond && !sourceDiamond) start.y = end.y;
      else end.y = start.y;
    }
  }

  const rawGap =
    startNormal.x !== 0 && endNormal.x !== 0
      ? Math.abs(end.x - start.x)
      : startNormal.y !== 0 && endNormal.y !== 0
        ? Math.abs(end.y - start.y)
        : Math.hypot(end.x - start.x, end.y - start.y);
  const stub = Math.max(12, Math.min(24, rawGap * 0.35));
  const startStub = {
    x: start.x + startNormal.x * stub,
    y: start.y + startNormal.y * stub,
  };

  const endStub = {
    x: end.x + endNormal.x * stub,
    y: end.y + endNormal.y * stub,
  };

  const obstacles = allNodes
    .filter((node) => node.id !== source.dataset.sgsNode && node.id !== target.dataset.sgsNode)
    .map((node) => boundsInRoot(svg, node.wrapper));
  const endpointBoxes = [sourceBounds, targetBounds];
  const midX = (startStub.x + endStub.x) / 2 + channelOffset;
  const midY = (startStub.y + endStub.y) / 2 + channelOffset;
  const xCandidates = new Set([
    midX,
    midX - 18,
    midX + 18,
    midX - 36,
    midX + 36,
    midX - 54,
    midX + 54,
    startStub.x,
    endStub.x,
    ...obstacles.flatMap((box) => [box.x - 24, box.x - 40, box.x + box.width + 24, box.x + box.width + 40]),
    ...endpointBoxes.flatMap((box) => [box.x - 24, box.x - 40, box.x + box.width + 24, box.x + box.width + 40]),
  ]);

  const yCandidates = new Set([
    midY,
    midY - 18,
    midY + 18,
    midY - 36,
    midY + 36,
    midY - 54,
    midY + 54,
    startStub.y,
    endStub.y,
    ...obstacles.flatMap((box) => [box.y - 24, box.y - 40, box.y + box.height + 24, box.y + box.height + 40]),
    ...endpointBoxes.flatMap((box) => [box.y - 24, box.y - 40, box.y + box.height + 24, box.y + box.height + 40]),
  ]);

  const candidates = [
    ...Array.from(yCandidates, (y) => [
      start,
      startStub,
      { x: startStub.x, y },
      { x: endStub.x, y },
      endStub,
      end,
    ]),
    ...Array.from(xCandidates, (x) => [
      start,
      startStub,
      { x, y: startStub.y },
      { x, y: endStub.y },
      endStub,
      end,
    ]),

    [start, startStub, { x: endStub.x, y: startStub.y }, endStub, end],
    [start, startStub, { x: startStub.x, y: endStub.y }, endStub, end],
  ].map(simplifyOrthogonal);
  const blocked = (a: Position, b: Position, box: ReturnType<typeof boundsInRoot>, pad = 8) => {
    if (Math.abs(a.y - b.y) < 0.01) {
      return (
        a.y > box.y - pad &&
        a.y < box.y + box.height + pad &&
        Math.max(Math.min(a.x, b.x), box.x - pad) <
        Math.min(Math.max(a.x, b.x), box.x + box.width + pad)
      );

    }
    return (
      a.x > box.x - pad &&
      a.x < box.x + box.width + pad &&
      Math.max(Math.min(a.y, b.y), box.y - pad) <
      Math.min(Math.max(a.y, b.y), box.y + box.height + pad)
    );
  };

  const score = (points: Position[]) => {
    let length = 0;
    let collisions = 0;
    let overlapPenalty = 0;
    const first = points[1];
    const lastPrev = points[points.length - 2];
    if (first) {
      const dotStart = (first.x - start.x) * startNormal.x + (first.y - start.y) * startNormal.y;
      if (dotStart < 4) collisions += 50;
    }

    if (lastPrev) {
      const dotEnd = (lastPrev.x - end.x) * endNormal.x + (lastPrev.y - end.y) * endNormal.y;
      if (dotEnd < 4) collisions += 50;
    }

    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      if (!a || !b) continue;
      length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      collisions += obstacles.filter((box) => blocked(a, b, box, 8)).length;
      if (index > 1) {
        const prev = points[index - 2]!;
        const dot = (a.x - prev.x) * (b.x - a.x) + (a.y - prev.y) * (b.y - a.y);
        if (dot < -0.01) collisions += 100;
        collisions += blocked(a, b, sourceBounds, -1) ? 1 : 0;
      }

      if (index < points.length - 1) {
        collisions += blocked(a, b, targetBounds, -1) ? 1 : 0;
      }

      if (index > 1 && index < points.length - 1) {
        const isHoriz = Math.abs(a.y - b.y) < 0.01;
        if (isHoriz) {
          overlapPenalty += Math.min(20, Math.abs(a.y - midY) * 0.08);
          if (blocked(a, b, sourceBounds, 26)) overlapPenalty += 35;
          if (blocked(a, b, targetBounds, 26)) overlapPenalty += 35;
        } else {
          overlapPenalty += Math.min(20, Math.abs(a.x - midX) * 0.08);
          if (blocked(a, b, sourceBounds, 26)) overlapPenalty += 35;
          if (blocked(a, b, targetBounds, 26)) overlapPenalty += 35;
        }
      }

      const isHoriz = Math.abs(a.y - b.y) < 0.01;
      for (const used of usedSegments) {
        const usedHoriz = Math.abs(used.a.y - used.b.y) < 0.01;
        if (isHoriz && usedHoriz) {
          if (Math.abs(a.y - used.a.y) < 10) {
            const overlap =
              Math.min(Math.max(a.x, b.x), Math.max(used.a.x, used.b.x)) -
              Math.max(Math.min(a.x, b.x), Math.min(used.a.x, used.b.x));
            if (overlap > 4) overlapPenalty += 2500 + overlap * 2;
          }
        } else if (!isHoriz && !usedHoriz) {
          if (Math.abs(a.x - used.a.x) < 10) {
            const overlap =
              Math.min(Math.max(a.y, b.y), Math.max(used.a.y, used.b.y)) -
              Math.max(Math.min(a.y, b.y), Math.min(used.a.y, used.b.y));
            if (overlap > 4) overlapPenalty += 2500 + overlap * 2;
          }
        } else {
          const h = isHoriz ? { a, b } : used;
          const v = isHoriz ? used : { a, b };
          const hx1 = Math.min(h.a.x, h.b.x);
          const hx2 = Math.max(h.a.x, h.b.x);
          const vy1 = Math.min(v.a.y, v.b.y);
          const vy2 = Math.max(v.a.y, v.b.y);
          if (v.a.x > hx1 + 2 && v.a.x < hx2 - 2 && h.a.y > vy1 + 2 && h.a.y < vy2 - 2) {
            overlapPenalty += 300;
          }
        }
      }
    }
    return length + (points.length - 2) * 18 + overlapPenalty + collisions * 100000;
  };
  const autoBest = candidates.sort((a, b) => score(a) - score(b))[0] ?? [start, end];
  let best = autoBest;
  if (Math.hypot(manualOffset.x, manualOffset.y) > 0.5) {
    const autoMid = longestSegmentMidpoint(autoBest);
    const via = { x: autoMid.x + manualOffset.x, y: autoMid.y + manualOffset.y };
    const sStubV =
      startNormal.x !== 0 && (via.x - start.x) * startNormal.x > 2
        ? { x: via.x, y: start.y }
        : startStub;
    const eStubV =
      endNormal.x !== 0 && (via.x - end.x) * endNormal.x > 2
        ? { x: via.x, y: end.y }
        : endStub;
    const sStubH =
      startNormal.y !== 0 && (via.y - start.y) * startNormal.y > 2
        ? { x: start.x, y: via.y }
        : startStub;
    const eStubH =
      endNormal.y !== 0 && (via.y - end.y) * endNormal.y > 2
        ? { x: end.x, y: via.y }
        : endStub;
    const viaV = simplifyOrthogonal([
      start,
      sStubV,
      { x: via.x, y: sStubV.y },
      { x: via.x, y: eStubV.y },
      eStubV,
      end,
    ]);
    const viaH = simplifyOrthogonal([
      start,
      sStubH,
      { x: sStubH.x, y: via.y },
      { x: eStubH.x, y: via.y },
      eStubH,
      end,
    ]);
    if (autoBest.length <= 2) {
      const isVert = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
      best = isVert
        ? Math.abs(manualOffset.x) > 3
          ? viaV
          : autoBest
        : Math.abs(manualOffset.y) > 3
          ? viaH
          : autoBest;
    } else {
      let bestSegHoriz = Math.abs(manualOffset.y) >= Math.abs(manualOffset.x);
      let maxSegLen = -1;
      for (let i = 1; i < autoBest.length; i += 1) {
        const a = autoBest[i - 1]!;
        const b = autoBest[i]!;
        const len = Math.hypot(b.x - a.x, b.y - a.y) * (i > 1 && i < autoBest.length - 1 ? 1.15 : 1);
        if (len > maxSegLen) {
          maxSegLen = len;
          bestSegHoriz = Math.abs(a.y - b.y) < 0.5;
        }
      }
      if (bestSegHoriz && Math.abs(manualOffset.y) > 2) best = viaH;
      else if (!bestSegHoriz && Math.abs(manualOffset.x) > 2) best = viaV;
      else best = Math.abs(manualOffset.x) > Math.abs(manualOffset.y) ? viaV : viaH;
    }
  }
  const localPoints = best.map((point) => toLocalPoint(svg, path, point));
  path.setAttribute(
    "d",
    localPoints
      .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
      .join(" "),
  );
  return { points: best, mid: longestSegmentMidpoint(best), start, startNormal, end, endNormal };
}

export const DiagramCanvas = forwardRef<DiagramCanvasHandle, DiagramCanvasProps>(function DiagramCanvas(
  { document, settings, readOnly = false, onLayoutChange, onCodeChange, onNodeMoved, onNodeSelect, onToolChange, onRenderError, onTypeChange },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const graphicRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomFrameRef = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  const readOnlyRef = useRef(readOnly);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const onNodeMovedRef = useRef(onNodeMoved);
  const onNodeSelectRef = useRef(onNodeSelect);
  const documentRef = useRef(document);
  const onCodeChangeRef = useRef(onCodeChange);
  documentRef.current = document;
  onCodeChangeRef.current = onCodeChange;
  const spaceDown = useRef(false);
  const toolModeRef = useRef<"move" | "hand">("move");
  const pendingFitRef = useRef(false);
  const lastValidByDocRef = useRef(new Map<string, { svg: string; type: DiagramType }>());
  const zoomReadoutRef = useRef<HTMLButtonElement>(null);
  const [rendered, setRendered] = useState<{ id: string; svg: string }>({ id: "", svg: "" });
  const [rendering, setRendering] = useState(true);
  const [toolMode, setToolMode] = useState<"move" | "hand">("move");
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [pickingShape, setPickingShape] = useState(false);
  const [pickingMembers, setPickingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [memberDraft, setMemberDraft] = useState("");

  settingsRef.current = settings;
  readOnlyRef.current = readOnly;
  onLayoutChangeRef.current = onLayoutChange;
  onNodeMovedRef.current = onNodeMoved;
  onNodeSelectRef.current = onNodeSelect;
  const paintView = useCallback((transform: ZoomTransform) => {
    transformRef.current = transform;
    if (graphicRef.current) graphicRef.current.style.transform = cssTransform(transform);
    if (zoomReadoutRef.current) zoomReadoutRef.current.textContent = `${Math.round(transform.k * 100)}%`;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const gridSize = GRID_SIZE * transform.k;
    if (gridSize > 0) {
      const x = ((transform.x % gridSize) + gridSize) % gridSize;
      const y = ((transform.y % gridSize) + gridSize) % gridSize;
      viewport.style.backgroundImage = "";
      viewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      viewport.style.backgroundPosition = `${x}px ${y}px`;
    } else {
      viewport.style.backgroundImage = "none";
      viewport.style.backgroundSize = "";
      viewport.style.backgroundPosition = "";
    }
  }, []);
  useLayoutEffect(() => {
    paintView(transformRef.current);
  }, [paintView]);
  const applyTransform = useCallback((transform: ZoomTransform) => {
    paintView(transform);
  }, [paintView]);
  const activateTool = useCallback((mode: "move" | "hand") => {
    toolModeRef.current = mode;
    setToolMode(mode);
    onToolChange?.(mode);
  }, [onToolChange]);

  const animateTransform = useCallback((target: ZoomTransform) => {
    const viewport = viewportRef.current;
    const behavior = zoomRef.current;
    if (!viewport || !behavior) return;
    if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
    if (!settingsRef.current.smoothZoom) {
      select(viewport).call(behavior.transform, target);
      return;
    }
    const start = transformRef.current;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 180);
      const eased = 1 - (1 - progress) ** 3;
      select(viewport).call(behavior.transform, interpolateView(start, target, eased));
      if (progress < 1) zoomFrameRef.current = requestAnimationFrame(step);
      else zoomFrameRef.current = undefined;
    };
    zoomFrameRef.current = requestAnimationFrame(step);
  }, []);

  const commitTransform = useCallback((transform: ZoomTransform, animate: boolean) => {
    const viewport = viewportRef.current;
    const behavior = zoomRef.current;
    if (!viewport || !behavior) {
      paintView(transform);
      return;
    }
    if (animate && settingsRef.current.smoothZoom) animateTransform(transform);
    else {
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = undefined;
      select(viewport).call(behavior.transform, transform);
    }
  }, [animateTransform, paintView]);

  const fit = useCallback((animate = false) => {
    const viewport = viewportRef.current;
    const graphic = graphicRef.current;
    const svg = graphic?.querySelector("svg");
    if (!viewport || !svg) return;
    const box = getDiagramBounds(svg);
    if (!box.width || !box.height) return;
    const vw = viewport.clientWidth || 640;
    const vh = viewport.clientHeight || 480;
    const padding = Math.min(48, Math.floor(Math.min(vw, vh) * 0.12));
    const scale = Math.min(
      Math.max(0.15, (vw - padding * 2) / box.width),
      Math.max(0.15, (vh - padding * 2) / box.height),
      2.2,
    );
    const x = (vw - box.width * scale) / 2 - box.x * scale;
    const y = (vh - box.height * scale) / 2 - box.y * scale;
    commitTransform(zoomIdentity.translate(x, y).scale(scale), animate);
  }, [commitTransform]);

  const reset = useCallback((animate = false) => {
    const viewport = viewportRef.current;
    const svg = graphicRef.current?.querySelector("svg");
    if (!viewport || !zoomRef.current) return;
    if (!svg) {
      commitTransform(zoomIdentity, animate);
      return;
    }
    const box = getDiagramBounds(svg);
    if (!box.width || !box.height) {
      commitTransform(zoomIdentity, animate);
      return;
    }
    const vw = viewport.clientWidth || 640;
    const vh = viewport.clientHeight || 480;
    const x = (vw - box.width) / 2 - box.x;
    const y = (vh - box.height) / 2 - box.y;
    commitTransform(zoomIdentity.translate(x, y).scale(1), animate);
  }, [commitTransform]);

  const zoomBy = useCallback((factor: number, center?: [number, number]) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = transformRef.current;
    const point = center ?? [viewport.clientWidth / 2, viewport.clientHeight / 2];
    commitTransform(viewAtScale(current, current.k * factor, point), true);
  }, [commitTransform]);

  const arrangeGrid = useCallback(() => {
    const svg = graphicRef.current?.querySelector("svg");
    if (!svg) return;
    const wrappers = Array.from(svg.querySelectorAll<SVGGElement>("[data-sgs-node]"));
    if (!wrappers.length) return;
    const size = Math.max(4, GRID_SIZE);
    const snapVal = (v: number) => Math.round(v / size) * size;
    const items = wrappers.map((wrapper) => {
      const id = wrapper.dataset.sgsNode ?? "";
      const element = wrapper.firstElementChild as SVGGElement | null;
      const base = readTranslation(element?.getAttribute("transform") ?? null);
      const box = element ? boundsInRoot(svg, element) : { x: 0, y: 0, width: 120, height: 60 };
      return { id, base, width: box.width, height: box.height };
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    const directedEdges: { from: string; to: string }[] = [];
    svg.querySelectorAll<SVGPathElement>("[data-sgs-source][data-sgs-target]").forEach((path) => {
      const from = path.dataset.sgsSource ?? "";
      const to = path.dataset.sgsTarget ?? "";
      if (byId.has(from) && byId.has(to) && from !== to) {
        directedEdges.push({ from, to });
      }
    });
    const inDeg = new Map(items.map((item) => [item.id, 0]));
    const outDeg = new Map(items.map((item) => [item.id, 0]));
    const parentsOf = new Map<string, Set<string>>(items.map((item) => [item.id, new Set()]));
    const childrenOf = new Map<string, Set<string>>(items.map((item) => [item.id, new Set()]));
    const neighbors = new Map<string, Set<string>>(items.map((item) => [item.id, new Set()]));
    directedEdges.forEach(({ from, to }) => {
      outDeg.set(from, (outDeg.get(from) ?? 0) + 1);
      inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
      childrenOf.get(from)?.add(to);
      parentsOf.get(to)?.add(from);
      neighbors.get(from)?.add(to);
      neighbors.get(to)?.add(from);
    });
    items.sort((a, b) => {
      const scoreA = (inDeg.get(a.id) ?? 0) - (outDeg.get(a.id) ?? 0);
      const scoreB = (inDeg.get(b.id) ?? 0) - (outDeg.get(b.id) ?? 0);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return Math.abs(a.base.y - b.base.y) > 40 ? a.base.y - b.base.y : a.base.x - b.base.x;
    });
    const ranks = new Map(items.map((item) => [item.id, 0]));
    if (directedEdges.length > 0) {
      const maxRank = Math.max(1, items.length - 1);
      for (let pass = 0; pass < items.length; pass += 1) {
        let changed = false;
        for (const { from, to } of directedEdges) {
          const rFrom = ranks.get(from) ?? 0;
          const rTo = ranks.get(to) ?? 0;
          if (rTo <= rFrom && rFrom + 1 <= maxRank) {
            ranks.set(to, rFrom + 1);
            changed = true;
          }
        }
        if (!changed) break;
      }
      const byDescRank = [...items].sort((a, b) => (ranks.get(b.id) ?? 0) - (ranks.get(a.id) ?? 0));
      for (const item of byDescRank) {
        if ((inDeg.get(item.id) ?? 0) > 0 && (outDeg.get(item.id) ?? 0) > 0) {
          const kids = Array.from(childrenOf.get(item.id) ?? []);
          const minChildRank = Math.min(...kids.map((c) => ranks.get(c) ?? 0));
          if (minChildRank - 1 > (ranks.get(item.id) ?? 0)) {
            ranks.set(item.id, minChildRank - 1);
          }
        }
      }
    }
    const maxCols = Math.max(4, Math.ceil(Math.sqrt(items.length * 1.8)));
    const rankBuckets = new Map<number, typeof items>();
    items.forEach((item) => {
      const r = ranks.get(item.id) ?? 0;
      const list = rankBuckets.get(r) ?? [];
      list.push(item);
      rankBuckets.set(r, list);
    });
    const rows: (typeof items)[] = [];
    if (rankBuckets.size <= 1) {
      const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
      for (let i = 0; i < items.length; i += cols) {
        rows.push(items.slice(i, i + cols));
      }
    } else {
      Array.from(rankBuckets.keys())
        .sort((a, b) => a - b)
        .forEach((r) => {
          const bucket = rankBuckets.get(r)!;
          for (let i = 0; i < bucket.length; i += maxCols) {
            rows.push(bucket.slice(i, i + maxCols));
          }
        });
    }
    const colIndex = new Map<string, number>();
    const rowOf = new Map<string, number>();
    const updateColIndices = () => {
      rows.forEach((row, rIdx) => {
        row.forEach((item, idx) => {
          colIndex.set(item.id, idx - (row.length - 1) / 2);
          rowOf.set(item.id, rIdx);
        });
      });
    };
    updateColIndices();
    const baryScore = (id: string, rIdx: number, downward: boolean) => {
      const adj = Array.from(neighbors.get(id) ?? []);
      if (!adj.length) return colIndex.get(id) ?? 0;
      let weightedSum = 0;
      let totalWeight = 0;
      for (const otherId of adj) {
        const otherRow = rowOf.get(otherId) ?? rIdx;
        if (otherRow === rIdx) continue;
        const isPrimary = downward ? otherRow < rIdx : otherRow > rIdx;
        const w = isPrimary ? 1.0 : 0.35;
        weightedSum += (colIndex.get(otherId) ?? 0) * w;
        totalWeight += w;
      }
      return totalWeight > 0 ? weightedSum / totalWeight : colIndex.get(id) ?? 0;
    };
    const sortRow = (row: typeof items, rIdx: number, downward: boolean) => {
      row.sort((a, b) => {
        const baryA = baryScore(a.id, rIdx, downward);
        const baryB = baryScore(b.id, rIdx, downward);
        if (Math.abs(baryA - baryB) > 0.08) return baryA - baryB;
        const kidsA = outDeg.get(a.id) ?? 0;
        const kidsB = outDeg.get(b.id) ?? 0;
        if ((kidsA > 0) !== (kidsB > 0)) {
          return kidsA > 0 ? -1 : 1;
        }
        return (colIndex.get(a.id) ?? 0) - (colIndex.get(b.id) ?? 0);
      });
      updateColIndices();
    };
    for (let iter = 0; iter < 4; iter += 1) {
      const downward = iter % 2 === 0;
      if (downward) {
        for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
          sortRow(rows[rIdx]!, rIdx, true);
        }
      } else {
        for (let rIdx = rows.length - 1; rIdx >= 0; rIdx -= 1) {
          sortRow(rows[rIdx]!, rIdx, false);
        }
      }
    }
    for (let rIdx = 1; rIdx < rows.length; rIdx += 1) {
      sortRow(rows[rIdx]!, rIdx, true);
    }
    const gapX = 120;
    const gapY = 108;
    const dirHeader = document.code.match(/^\s*(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/im)?.[1]?.toUpperCase();
    const dirDirective = document.code.match(/^\s*direction\s+(TB|TD|BT|LR|RL)\b/im)?.[1]?.toUpperCase();
    const layoutDir = dirDirective || dirHeader || "TD";
    const isHorizontal = layoutDir === "LR" || layoutDir === "RL";
    const orderedRows = layoutDir === "BT" || layoutDir === "RL" ? [...rows].reverse() : rows;
    const next: Record<string, Position> = {};
    if (isHorizontal) {
      const maxH = Math.max(...items.map((item) => item.height), 72);
      const stepY = snapVal(maxH + gapY);
      const totalRows = Math.max(...orderedRows.map((r) => r.length), 1);
      const totalSpanH = (totalRows - 1) * stepY + maxH;
      let cursorX = 0;
      orderedRows.forEach((colBucket) => {
        const colW = Math.max(...colBucket.map((item) => item.width), 140);
        const centerX = snapVal(cursorX + colW / 2);
        const colSpanH = (colBucket.length - 1) * stepY + maxH;
        const startY = (totalSpanH - colSpanH) / 2 + maxH / 2;
        colBucket.forEach((item, rowIdx) => {
          next[item.id] = {
            x: centerX,
            y: snapVal(startY + rowIdx * stepY),
          };
        });
        cursorX += snapVal(colW + gapX);
      });
    } else {
      const maxW = Math.max(...items.map((item) => item.width), 140);
      const stepX = snapVal(maxW + gapX);
      const totalCols = Math.max(...orderedRows.map((r) => r.length), 1);
      const totalSpanW = (totalCols - 1) * stepX + maxW;
      let cursorY = 0;
      orderedRows.forEach((row) => {
        const rowH = Math.max(...row.map((item) => item.height), 72);
        const centerY = snapVal(cursorY + rowH / 2);
        const rowSpanW = (row.length - 1) * stepX + maxW;
        const startX = (totalSpanW - rowSpanW) / 2 + maxW / 2;
        row.forEach((item, col) => {
          next[item.id] = {
            x: snapVal(startX + col * stepX),
            y: centerY,
          };
        });
        cursorY += snapVal(rowH + gapY);
      });
    }
    pendingFitRef.current = true;
    onLayoutChange(next);
    requestAnimationFrame(() => fit(true));
  }, [document.code, fit, onLayoutChange]);

  useImperativeHandle(
    ref,
    () => ({
      zoomBy,
      fit: () => fit(true),
      reset: () => reset(true),
      arrangeGrid,
      setTool: activateTool,
    }),
    [activateTool, arrangeGrid, fit, reset, zoomBy],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        if (event.type === "wheel") return false;
        if (event.type === "mousedown") {
          const button = (event as MouseEvent).button;
          return button === 1 || spaceDown.current || toolModeRef.current === "hand";
        }
        if (event.type === "touchstart") {
          return (event as TouchEvent).touches.length > 1 || toolModeRef.current === "hand";
        }
        return false;
      })
      .on("start", (event) => {
        const source = event.sourceEvent as Event | null;
        if (source && (source.type === "mousedown" || source.type === "touchstart")) {
          viewport.dataset.panning = "true";
        }
      })
      .on("zoom", (event) => applyTransform(event.transform))
      .on("end", () => {
        if (!spaceDown.current) delete viewport.dataset.panning;
      });
    zoomRef.current = behavior;
    select(viewport).call(behavior).on("dblclick.zoom", null);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = undefined;
      const currentSettings = settingsRef.current;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? viewport.clientHeight
          : 1;
      const direction = currentSettings.invertScroll ? -1 : 1;
      const pinch = event.ctrlKey || event.metaKey;
      const panGesture = !pinch && (currentSettings.scrollMode === "pan" || isTrackpadScroll(event));
      if (!panGesture) {
        const deltaY = event.deltaY * unit;
        const factor = Math.exp(-deltaY * 0.0022 * currentSettings.zoomSpeed * direction);
        const bounds = viewport.getBoundingClientRect();
        const target = viewAtScale(
          transformRef.current,
          transformRef.current.k * factor,
          [event.clientX - bounds.left, event.clientY - bounds.top],
        );
        select(viewport).call(behavior.transform, target);
        return;
      }
      const deltaX = event.deltaX * unit * currentSettings.panSpeed;
      const deltaY = event.deltaY * unit * currentSettings.panSpeed;
      const scale = Math.max(transformRef.current.k, 0.1);
      select(viewport).call(behavior.translateBy, (-deltaX * direction) / scale, (-deltaY * direction) / scale);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const element = event.target instanceof Element ? event.target : undefined;
      const editing =
        (element instanceof HTMLElement && element.isContentEditable) ||
        Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
      if (event.code === "Space") {
        if (!editing && !element?.closest("button, a, summary")) {
          event.preventDefault();
          spaceDown.current = true;
          viewport.dataset.panning = "true";
        }
        return;
      }
      if (editing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        activateTool("hand");
      } else if (key === "v" || event.key === "Escape") {
        event.preventDefault();
        activateTool("move");
        if (event.key === "Escape" && selectedIdsRef.current.size > 0) {
          selectedIdsRef.current.clear();
          graphicRef.current?.querySelectorAll<SVGGElement>("[data-sgs-node]").forEach((el) => {
            delete el.dataset.selected;
          });
        }
      } else if (event.shiftKey && event.code === "Digit1") {
        event.preventDefault();
        fit(true);
      } else if (event.key === "+" || event.code === "NumpadAdd") {
        event.preventDefault();
        zoomBy(1.15);
      } else if (event.key === "-" || event.code === "NumpadSubtract") {
        event.preventDefault();
        zoomBy(1 / 1.15);
      } else if ((event.key === "Delete" || event.key === "Backspace") && !readOnlyRef.current && onCodeChangeRef.current) {
        const focusedNodeId = element?.closest<SVGGElement>("[data-sgs-node]")?.dataset.sgsNode;
        const targets = selectedIdsRef.current.size > 0
          ? Array.from(selectedIdsRef.current)
          : focusedNodeId
            ? [focusedNodeId]
            : [];
        if (!targets.length) return;
        const updated = deleteNodesInCode(documentRef.current.code, targets);
        if (!updated) return;
        event.preventDefault();
        selectedIdsRef.current.clear();
        const nextLayout = { ...documentRef.current.layout };
        for (const id of targets) delete nextLayout[id];
        onLayoutChangeRef.current(nextLayout);
        onCodeChangeRef.current(updated);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceDown.current = false;
      delete viewport.dataset.panning;
    };
    const onWindowBlur = () => {
      spaceDown.current = false;
      delete viewport.dataset.panning;
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
      select(viewport).on(".zoom", null);
      zoomRef.current = null;
    };
  }, [activateTool, applyTransform, fit, zoomBy]);

  useEffect(() => {
    let active = true;
    const detectedType = detectDiagramType(document.code);
    onTypeChange(detectedType);
    setRendering(true);
    const timeout = window.setTimeout(() => {
      void renderMermaid(document.code, settings)
        .then((result) => {
          if (!active) return;
          lastValidByDocRef.current.set(document.id, { svg: result.svg, type: result.type });
          setRendered({ id: document.id, svg: result.svg });
          onTypeChange(result.type);
          onRenderError(undefined);
          setRendering(false);
        })
        .catch((error: unknown) => {
          if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
          const cached = lastValidByDocRef.current.get(document.id);
          if (cached) {
            setRendered({ id: document.id, svg: cached.svg });
            onTypeChange(cached.type);
          } else {
            setRendered({ id: document.id, svg: "" });
            onTypeChange(detectedType);
          }
          onRenderError({
            message: formatMermaidError(error),
            line: getMermaidErrorLine(error),
          });
          setRendering(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    document.id,
    document.code,
    settings.theme,
    settings.look,
    settings.primaryColor,
    settings.textColor,
    settings.lineColor,
    settings.canvasColor,
    settings.font,
    onRenderError,
    onTypeChange,
  ]);

  useEffect(() => {
    const graphic = graphicRef.current;
    if (!graphic) return;
    if (!rendered.svg) {
      graphic.replaceChildren();
      return;
    }
    try {
      const svgEl = parseMermaidSvg(rendered.svg);
      if (settings.colorizeBoxes) {
        colorizeExportedNodes(svgEl, settingsRef.current);
      }
      graphic.replaceChildren(svgEl);
    } catch (error) {
      onRenderError({
        message: formatMermaidError(error),
      });
    }
  }, [rendered, onRenderError, settings.colorizeBoxes, settings.theme, settings.canvasColor, settings.primaryColor, settings.textColor, settings.lineColor]);

  useEffect(() => {
    const graphic = graphicRef.current;
    const svg = graphic?.querySelector("svg");
    const viewport = viewportRef.current;
    if (!graphic || !svg || !viewport || rendered.id !== document.id) return;
    const previousStructureKey = graphic.dataset.structureKey;
    const readCachedPoint = (element: SVGElement, key: string, fallback: () => Position): Position => {
      const cached = element.dataset[key];
      if (cached) {
        const [x, y] = cached.split(",").map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) return { x: x!, y: y! };
      }
      const point = fallback();
      element.dataset[key] = `${point.x},${point.y}`;
      return point;
    };
    const labels = Array.from(svg.querySelectorAll<SVGGElement>("g.edgeLabel")).filter((label) =>
      Boolean(label.textContent?.trim()),
    );
    const terminals = Array.from(svg.querySelectorAll<SVGGElement>("g.edgeTerminals")).filter(
      (term) => Boolean(term.textContent?.trim()),
    );
    labels.forEach((label) => {
      readCachedPoint(label, "sgsCenter", () => {
        const box = boundsInRoot(svg, label);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
    });
    terminals.forEach((term) => {
      readCachedPoint(term, "sgsTermCenter", () => {
        const box = boundsInRoot(svg, term);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
    });
    const palette = resolveDiagramPalette(settingsRef.current);
    normalizeMarkers(svg, palette.canvasColor);
    const kind = detectDiagramType(document.code);
    const isHandDrawn = settingsRef.current.look === "handDrawn";
    if (kind === "class") {
      svg.querySelectorAll<SVGGElement>("g.node, g.rough-node, g.classGroup").forEach((nodeEl) => {
        if (nodeEl.dataset.sgsCompacted === "true") return;
        nodeEl.dataset.sgsCompacted = "true";
        const membersGroup = nodeEl.querySelector<SVGGElement>(".members-group");
        const methodsGroup = nodeEl.querySelector<SVGGElement>(".methods-group");
        const labelGroup = nodeEl.querySelector<SVGGElement>(".label-group");
        const dividers = Array.from(nodeEl.querySelectorAll<SVGGElement>("g.divider"));
        const hasMembers = Boolean(membersGroup?.textContent?.trim());
        const hasMethods = Boolean(methodsGroup?.textContent?.trim());
        if (hasMembers && hasMethods) return;
        const boxShapes = Array.from(
          nodeEl.querySelectorAll<SVGGeometryElement>("g.basic.label-container > path, g.basic.label-container > rect, :scope > rect"),
        );
        if (!hasMembers && hasMethods) {
          if (membersGroup) membersGroup.style.display = "none";
          if (dividers.length >= 2) dividers[1]!.style.display = "none";
          if (methodsGroup && dividers.length >= 2) {
            try {
              const d0 = dividers[0]!.getBBox();
              const d1 = dividers[1]!.getBBox();
              const d0Y = readTranslation(dividers[0]!.getAttribute("transform")).y + d0.y;
              const d1Y = readTranslation(dividers[1]!.getAttribute("transform")).y + d1.y;
              const shift = Math.max(0, d1Y - d0Y);
              if (shift > 4) {
                const mBase = readTranslation(methodsGroup.getAttribute("transform"));
                methodsGroup.setAttribute("transform", `translate(${mBase.x} ${mBase.y - shift})`);
                boxShapes.forEach((boxShape) => {
                  if (boxShape instanceof SVGRectElement) {
                    const curH = boxShape.height.baseVal.value;
                    if (curH - shift > 24) boxShape.setAttribute("height", String(Number((curH - shift).toFixed(2))));
                  } else if (boxShape instanceof SVGPathElement) {
                    const curBox = boxShape.getBBox();
                    const nextBottom = curBox.y + curBox.height - shift;
                    if (nextBottom > curBox.y + 24) {
                      if (isHandDrawn) {
                        const scaleY = (nextBottom - curBox.y) / curBox.height;
                        boxShape.setAttribute(
                          "transform",
                          `translate(0 ${(curBox.y * (1 - scaleY)).toFixed(2)}) scale(1 ${scaleY.toFixed(4)})`,
                        );
                      } else {
                        boxShape.setAttribute(
                          "d",
                          `M${curBox.x.toFixed(2)} ${curBox.y.toFixed(2)} L${(curBox.x + curBox.width).toFixed(2)} ${curBox.y.toFixed(2)} L${(curBox.x + curBox.width).toFixed(2)} ${nextBottom.toFixed(2)} L${curBox.x.toFixed(2)} ${nextBottom.toFixed(2)} Z`,
                        );
                      }
                    }
                  }
                });
              }
            } catch {
              // Ignore unmeasurable geometry.
            }
          }
          return;
        }
        if (methodsGroup) methodsGroup.style.display = "none";
        if (dividers.length >= 2) dividers[1]!.style.display = "none";
        if (!hasMembers) {
          if (membersGroup) membersGroup.style.display = "none";
          if (dividers.length >= 1) dividers[0]!.style.display = "none";
        }
        const lastVisible = hasMembers ? membersGroup : labelGroup;
        if (!lastVisible) return;
        if (!boxShapes.length) return;
        try {
          const lastBox = lastVisible.getBBox();
          const offsetY = readTranslation(lastVisible.getAttribute("transform")).y;
          const desiredBottom = offsetY + lastBox.y + lastBox.height + 12;
          boxShapes.forEach((boxShape) => {
            if (boxShape instanceof SVGRectElement) {
              const y = boxShape.y.baseVal.value;
              const curH = boxShape.height.baseVal.value;
              const nextH = desiredBottom - y;
              if (nextH > 20 && nextH < curH - 4) {
                boxShape.setAttribute("height", String(Number(nextH.toFixed(2))));
              }
            } else if (boxShape instanceof SVGPathElement) {
              const curBox = boxShape.getBBox();
              const minX = curBox.x;
              const maxX = curBox.x + curBox.width;
              const minY = curBox.y;
              const curMaxY = curBox.y + curBox.height;
              if (desiredBottom > minY + 20 && desiredBottom < curMaxY - 4) {
                if (isHandDrawn) {
                  const scaleY = (desiredBottom - minY) / curBox.height;
                  boxShape.setAttribute(
                    "transform",
                    `translate(0 ${(minY * (1 - scaleY)).toFixed(2)}) scale(1 ${scaleY.toFixed(4)})`,
                  );
                } else {
                  boxShape.setAttribute(
                    "d",
                    `M${minX.toFixed(2)} ${minY.toFixed(2)} L${maxX.toFixed(2)} ${minY.toFixed(2)} L${maxX.toFixed(2)} ${desiredBottom.toFixed(2)} L${minX.toFixed(2)} ${desiredBottom.toFixed(2)} Z`,
                  );
                }
              }
            }
          });
        } catch {
          // Ignore nodes without measurable geometry.
        }
      });
    }
    if (!MOVABLE_DIAGRAM_TYPES.has(kind)) {
      const nonMovableKey = `${rendered.id}::${kind}`;
      if (previousStructureKey !== nonMovableKey || pendingFitRef.current) {
        graphic.dataset.structureKey = nonMovableKey;
        pendingFitRef.current = false;
        fit();
      }
      return;
    }
    const candidates = Array.from(
      svg.querySelectorAll<SVGGElement>(
        "g.node, g.rough-node, g.statediagram-state, g.entityBox, g.classGroup",
      ),
    ).filter((element) => {
      const hasNodeAncestor = element.parentElement?.closest(
        "g.node, g.rough-node, g.statediagram-state, g.entityBox, g.classGroup",
      );
      return !hasNodeAncestor && Boolean(element.id || element.dataset.id);
    });
    const hiddenNodeIds = getHiddenNodeIds(document.code);
    const nodes = candidates.map((element) => {
      const id = element.dataset.id || stableNodeId(element.id);
      const base = readTranslation(element.getAttribute("transform"));
      const initialBounds = boundsInRoot(svg, element);
      const position = document.layout[id] ?? base;
      const wrapper = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
      wrapper.dataset.sgsNode = id;
      if (hiddenNodeIds.has(id)) wrapper.style.display = "none";
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", `Diagram node ${id}. Use arrow keys to move.`);
      wrapper.setAttribute("aria-describedby", "node-movement-help");
      element.parentNode?.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      wrapper.setAttribute(
        "transform",
        `translate(${position.x - base.x},${position.y - base.y})`,
      );
      return { id, base, initialBounds, position, wrapper, element };
    });
    const edgePaths = Array.from(
      svg.querySelectorAll<SVGPathElement>(
        "g.edgePath path.path, g.edgePath path, g.relation path, g.edge path, path.flowchart-link, path.relation, path.transition, path.relationshipLine, path[marker-end]",
      ),
    ).filter((path) => !path.closest(".node, .c4-shape, marker, defs") && path.getTotalLength() > 0);
    const selfLoops: { wrapper: SVGGElement; node: (typeof nodes)[number] }[] = [];
    const rawEdges = edgePaths.flatMap((path) => {
      const length = path.getTotalLength();
      const start = readCachedPoint(path, "sgsStart", () =>
        pointInRoot(svg, path, path.getPointAtLength(0).x, path.getPointAtLength(0).y),
      );
      const end = readCachedPoint(path, "sgsEnd", () =>
        pointInRoot(svg, path, path.getPointAtLength(length).x, path.getPointAtLength(length).y),
      );
      const mid = readCachedPoint(path, "sgsMid", () =>
        pointInRoot(svg, path, path.getPointAtLength(length / 2).x, path.getPointAtLength(length / 2).y),
      );
      const samples = [0.25, 0.5, 0.75].map((t, idx) =>
        readCachedPoint(path, `sgsSample${idx}`, () => {
          const pt = path.getPointAtLength(length * t);
          return pointInRoot(svg, path, pt.x, pt.y);
        }),
      );
      const nearest = (point: Position) =>
        nodes.reduce<(typeof nodes)[number] | undefined>((best, node) => {
          if (!best || distanceToBounds(point, node.initialBounds) < distanceToBounds(point, best.initialBounds)) {
            return node;
          }
          return best;
        }, undefined);
      const source = nearest(start);
      const target = nearest(end);
      if (source && target && source.id === target.id) {
        const wrapper = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
        path.parentNode?.insertBefore(wrapper, path);
        wrapper.appendChild(path);
        selfLoops.push({ wrapper, node: source });
        return [];
      }
      if (source && target && source.id !== target.id) {
        path.dataset.sgsSource = source.id;
        path.dataset.sgsTarget = target.id;
        if (hiddenNodeIds.has(source.id) || hiddenNodeIds.has(target.id)) {
          path.style.display = "none";
        }
        return [{ path, source, target, start, end, mid, samples }];
      }
      return [];
    });
    const pairCounts = new Map<string, number>();
    const pairIndices = new Map<SVGPathElement, number>();
    rawEdges.forEach(({ path, source, target }) => {
      const key = [source.id, target.id].sort().join("::");
      const count = pairCounts.get(key) ?? 0;
      pairIndices.set(path, count);
      pairCounts.set(key, count + 1);
    });
    const edgeControlsGroup = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
    edgeControlsGroup.setAttribute("class", "sgs-edge-controls");
    const firstNodeParent = nodes[0]?.wrapper.parentNode;
    if (firstNodeParent) {
      firstNodeParent.appendChild(edgeControlsGroup);
    } else {
      svg.appendChild(edgeControlsGroup);
    }
    const edges = rawEdges.map((edge) => {
      const key = [edge.source.id, edge.target.id].sort().join("::");
      const count = pairCounts.get(key) ?? 1;
      const index = pairIndices.get(edge.path) ?? 0;
      const id = `edge::${edge.source.id}->${edge.target.id}::${index}`;
      const manualOffset: Position = { ...(document.layout[id] ?? { x: 0, y: 0 }) };
      const savedStart = document.layout[`${id}::start`];
      const startAnchor: Position | undefined = savedStart ? { ...savedStart } : undefined;
      const savedEnd = document.layout[`${id}::end`];
      const endAnchor: Position | undefined = savedEnd ? { ...savedEnd } : undefined;
      const control = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
      control.dataset.sgsEdge = id;
      if (Math.hypot(manualOffset.x, manualOffset.y) > 0.5 || startAnchor || endAnchor) control.dataset.moved = "true";
      control.setAttribute("tabindex", "0");
      control.setAttribute("role", "group");
      control.setAttribute(
        "aria-label",
        `Connector ${edge.source.id} to ${edge.target.id}. Drag or use arrow keys to adjust.`,
      );
      const hitPath = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("class", "sgs-edge-hit");
      hitPath.setAttribute("fill", "none");
      hitPath.setAttribute("stroke", "transparent");
      hitPath.setAttribute("stroke-width", "14");
      const startHandle = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "circle");
      startHandle.setAttribute("class", "sgs-edge-handle sgs-edge-start-handle");
      startHandle.setAttribute("r", "5");
      const handle = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "circle");
      handle.setAttribute("class", "sgs-edge-handle");
      handle.setAttribute("r", "4.5");
      const endHandle = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "circle");
      endHandle.setAttribute("class", "sgs-edge-handle sgs-edge-end-handle");
      endHandle.setAttribute("r", "5");
      control.appendChild(hitPath);
      control.appendChild(startHandle);
      control.appendChild(handle);
      control.appendChild(endHandle);
      edgeControlsGroup.appendChild(control);
      return {
        ...edge,
        id,
        parallelOffset: (index - (count - 1) / 2) * 16,
        manualOffset,
        startAnchor,
        endAnchor,
        control,
        hitPath,
        startHandle,
        handle,
        endHandle,
      };
    });
    const usedEdgesForLabels = new Set<(typeof edges)[number]>();
    const labelEntries = labels.flatMap((label) => {
      const center = readCachedPoint(label, "sgsCenter", () => {
        const box = boundsInRoot(svg, label);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
      const distToEdge = (candidate: (typeof edges)[number]) =>
        Math.min(
          ...candidate.samples.map((pt) => Math.hypot(pt.x - center.x, pt.y - center.y)),
          Math.hypot(candidate.mid.x - center.x, candidate.mid.y - center.y),
        );
      const available = edges.filter((e) => !usedEdgesForLabels.has(e));
      const pool = available.length > 0 ? available : edges;
      const edge = pool.reduce<(typeof edges)[number] | undefined>((best, candidate) => {
        if (!best || distToEdge(candidate) < distToEdge(best)) return candidate;
        return best;
      }, undefined);
      if (!edge) return [];
      usedEdgesForLabels.add(edge);
      const labelText = label.textContent?.trim() ?? "";
      label.dataset.sgsEdgeId = edge.id;
      label.dataset.sgsEdgeLabel = labelText;
      edge.control.dataset.sgsEdgeLabel = labelText;
      const origTransform = label.getAttribute("transform");
      return [{ label, origTransform, edge }];
    });
    const terminalEntries = terminals.flatMap((term) => {
      const center = readCachedPoint(term, "sgsTermCenter", () => {
        const box = boundsInRoot(svg, term);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      });
      let bestEdge: (typeof edges)[number] | undefined;
      let bestEnd: "start" | "end" = "start";
      let bestDist = Infinity;
      edges.forEach((candidate) => {
        const dStart = Math.hypot(candidate.start.x - center.x, candidate.start.y - center.y);
        const dEnd = Math.hypot(candidate.end.x - center.x, candidate.end.y - center.y);
        if (dStart < bestDist) {
          bestDist = dStart;
          bestEdge = candidate;
          bestEnd = "start";
        }
        if (dEnd < bestDist) {
          bestDist = dEnd;
          bestEdge = candidate;
          bestEnd = "end";
        }
      });
      if (!bestEdge) return [];
      const origTransform = term.getAttribute("transform");
      return [{ term, origTransform, edge: bestEdge, which: bestEnd }];
    });

    const routeEdges = () => {
      const nodeBounds = new Map(nodes.map((n) => [n.id, boundsInRoot(svg, n.wrapper)]));
      const edgeFaces = edges.map((edge) => {
        const sBox = nodeBounds.get(edge.source.id)!;
        const tBox = nodeBounds.get(edge.target.id)!;
        const otherBoxes = nodes
          .filter((n) => n.id !== edge.source.id && n.id !== edge.target.id)
          .map((n) => nodeBounds.get(n.id)!);
        const sourceFace = chooseFace(sBox, tBox, otherBoxes);
        const targetFace = chooseFace(tBox, sBox, otherBoxes);
        return { sourceFace, targetFace, sourceOffset: 0, targetOffset: 0 };
      });
      nodes.forEach((node) => {
        if (!isDiamondNode(node.wrapper)) return;
        const nBox = nodeBounds.get(node.id)!;
        const nCenter = { x: nBox.x + nBox.width / 2, y: nBox.y + nBox.height / 2 };
        const usedFaces = new Set<Face>();
        edges.forEach((edge, idx) => {
          if (edge.source.id === node.id) usedFaces.add(edgeFaces[idx]!.sourceFace);
          if (edge.target.id === node.id) usedFaces.add(edgeFaces[idx]!.targetFace);
        });
        (["bottom", "top"] as Face[]).forEach((vFace) => {
          const attached: { idx: number; end: "source" | "target"; dx: number }[] = [];
          edges.forEach((edge, idx) => {
            if (edge.source.id === node.id && edgeFaces[idx]!.sourceFace === vFace) {
              const oBox = nodeBounds.get(edge.target.id)!;
              attached.push({ idx, end: "source", dx: oBox.x + oBox.width / 2 - nCenter.x });
            }
            if (edge.target.id === node.id && edgeFaces[idx]!.targetFace === vFace) {
              const oBox = nodeBounds.get(edge.source.id)!;
              attached.push({ idx, end: "target", dx: oBox.x + oBox.width / 2 - nCenter.x });
            }
          });
          if (attached.length <= 1) return;
          let remaining = attached.length;
          attached
            .sort(
              (a, b) =>
                (a.end === "target" ? -1 : 1) - (b.end === "target" ? -1 : 1) ||
                b.idx - a.idx,
            )
            .forEach((item) => {
              if (remaining <= 1 || Math.abs(item.dx) <= 20) return;
              const latFace: Face = item.dx > 0 ? "right" : "left";
              if (!usedFaces.has(latFace) || item.end === "target" || item.end === "source") {
                if (item.end === "source") edgeFaces[item.idx]!.sourceFace = latFace;
                else edgeFaces[item.idx]!.targetFace = latFace;
                usedFaces.add(latFace);
                remaining -= 1;
              }
            });
        });
      });
      const faceGroups = new Map<
        string,
        { edgeIndex: number; end: "source" | "target"; face: Face; otherCoord: number }[]
      >();
      edges.forEach((edge, edgeIndex) => {
        const sBox = nodeBounds.get(edge.source.id)!;
        const tBox = nodeBounds.get(edge.target.id)!;
        const sCenter = { x: sBox.x + sBox.width / 2, y: sBox.y + sBox.height / 2 };
        const tCenter = { x: tBox.x + tBox.width / 2, y: tBox.y + tBox.height / 2 };
        const { sourceFace, targetFace } = edgeFaces[edgeIndex]!;
        const sKey = `${edge.source.id}::${sourceFace}`;
        const tKey = `${edge.target.id}::${targetFace}`;
        const sOther =
          (sourceFace === "top" || sourceFace === "bottom" ? tCenter.x : tCenter.y) +
          edge.parallelOffset * 0.1;
        const tOther =
          (targetFace === "top" || targetFace === "bottom" ? sCenter.x : sCenter.y) +
          edge.parallelOffset * 0.1;
        const sList = faceGroups.get(sKey) ?? [];
        sList.push({ edgeIndex, end: "source", face: sourceFace, otherCoord: sOther });
        faceGroups.set(sKey, sList);
        const tList = faceGroups.get(tKey) ?? [];
        tList.push({ edgeIndex, end: "target", face: targetFace, otherCoord: tOther });
        faceGroups.set(tKey, tList);
      });
      faceGroups.forEach((list, key) => {
        if (list.length <= 1) return;
        const [nodeId, face] = key.split("::") as [string, Face];
        const box = nodeBounds.get(nodeId);
        if (!box) return;
        list.sort((a, b) => a.otherCoord - b.otherCoord || a.edgeIndex - b.edgeIndex);
        const span = face === "top" || face === "bottom" ? box.width : box.height;
        const step = Math.min(26, Math.max(10, (span - 24) / list.length));
        list.forEach((item, idx) => {
          const offset = (idx - (list.length - 1) / 2) * step;
          if (item.end === "source") edgeFaces[item.edgeIndex]!.sourceOffset = offset;
          else edgeFaces[item.edgeIndex]!.targetOffset = offset;
        });
      });

      const routedByEdge = new Map<
        (typeof edges)[number],
        ReturnType<typeof routeEdge>
      >();
      const usedSegments: { a: Position; b: Position }[] = [];
      edges.forEach((edge, idx) => {
        const { sourceFace, targetFace, sourceOffset, targetOffset } = edgeFaces[idx]!;
        const sBox = nodeBounds.get(edge.source.id);
        const tBox = nodeBounds.get(edge.target.id);
        const startOverride = edge.startAnchor && sBox ? resolveAnchorOnBox(sBox, edge.startAnchor) : undefined;
        const endOverride = edge.endAnchor && tBox ? resolveAnchorOnBox(tBox, edge.endAnchor) : undefined;
        const routed = routeEdge(
          svg,
          edge.path,
          edge.source.wrapper,
          edge.target.wrapper,
          nodes,
          sourceFace,
          sourceOffset,
          targetFace,
          targetOffset,
          edge.parallelOffset,
          edge.manualOffset,
          usedSegments,
          endOverride,
          startOverride,
        );
        routedByEdge.set(edge, routed);
        for (let i = 1; i < routed.points.length; i += 1) {
          usedSegments.push({ a: routed.points[i - 1]!, b: routed.points[i]! });
        }
        const ctrlPoints = routed.points.map((pt) => toLocalPoint(svg, edge.control, pt));
        edge.hitPath.setAttribute(
          "d",
          ctrlPoints.map((pt, i) => `${i ? "L" : "M"}${pt.x},${pt.y}`).join(" "),
        );
        const ctrlStart = toLocalPoint(svg, edge.control, routed.start);
        edge.startHandle.setAttribute("cx", String(ctrlStart.x));
        edge.startHandle.setAttribute("cy", String(ctrlStart.y));
        const ctrlMid = toLocalPoint(svg, edge.control, routed.mid);
        edge.handle.setAttribute("cx", String(ctrlMid.x));
        edge.handle.setAttribute("cy", String(ctrlMid.y));
        const ctrlEnd = toLocalPoint(svg, edge.control, routed.end);
        edge.endHandle.setAttribute("cx", String(ctrlEnd.x));
        edge.endHandle.setAttribute("cy", String(ctrlEnd.y));
        if (Math.hypot(edge.manualOffset.x, edge.manualOffset.y) > 0.5 || edge.startAnchor || edge.endAnchor) {
          edge.control.dataset.moved = "true";
        } else {
          delete edge.control.dataset.moved;
        }
      });
      selfLoops.forEach(({ wrapper, node }) => {
        wrapper.setAttribute(
          "transform",
          `translate(${node.position.x - node.base.x},${node.position.y - node.base.y})`,
        );
      });
      const placedBoxes: { x: number; y: number; width: number; height: number }[] = [];
      terminalEntries.forEach(({ term, edge, which }) => {
        const routed = routedByEdge.get(edge);
        if (!routed) return;
        const basePt = which === "start" ? routed.start : routed.end;
        const normal = which === "start" ? routed.startNormal : routed.endNormal;
        const perp = { x: -normal.y, y: normal.x };
        const defaultSign = which === "start" ? 1 : -1;
        const candA = {
          x: basePt.x + normal.x * 18 + perp.x * 16 * defaultSign,
          y: basePt.y + normal.y * 18 + perp.y * 16 * defaultSign,
        };
        const candB = {
          x: basePt.x + normal.x * 18 - perp.x * 16 * defaultSign,
          y: basePt.y + normal.y * 18 - perp.y * 16 * defaultSign,
        };
        const collides = (pt: Position) =>
          placedBoxes.some(
            (b) => Math.abs(b.x + b.width / 2 - pt.x) < 22 && Math.abs(b.y + b.height / 2 - pt.y) < 16,
          );
        const anchor = collides(candA) && !collides(candB) ? candB : candA;
        placedBoxes.push({ x: anchor.x - 12, y: anchor.y - 8, width: 24, height: 16 });
        const parent =
          term.parentElement instanceof SVGGraphicsElement ? term.parentElement : svg;
        const local = toLocalPoint(svg, parent, anchor);
        term.setAttribute("transform", `translate(${local.x},${local.y})`);
      });
      labelEntries.forEach(({ label, edge }) => {
        const routed = routedByEdge.get(edge);
        if (!routed) return;
        const rect = label.querySelector<SVGRectElement>("rect");
        const lBox = rect ? rect.getBBox() : label.getBBox();
        const lw = Math.max(28, lBox.width || 36);
        const lh = Math.max(18, lBox.height || 22);
        const pts = routed.points;
        const candidates: { pt: Position; score: number }[] = [];
        for (let i = 1; i < pts.length; i += 1) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 16 && pts.length > 2) continue;
          const interiorBonus = i > 1 && i < pts.length - 1 ? 1.18 : 1;
          const ts = len >= 64 ? [0.5, 0.36, 0.64] : [0.5];
          for (const t of ts) {
            const pt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            const box = { x: pt.x - lw / 2, y: pt.y - lh / 2, width: lw, height: lh };
            let penalty = Math.abs(t - 0.5) * 40;
            nodeBounds.forEach((nb) => {
              if (
                box.x < nb.x + nb.width + 4 &&
                box.x + box.width > nb.x - 4 &&
                box.y < nb.y + nb.height + 4 &&
                box.y + box.height > nb.y - 4
              ) {
                penalty += 8000;
              }
            });
            for (const pb of placedBoxes) {
              if (
                box.x < pb.x + pb.width + 6 &&
                box.x + box.width > pb.x - 6 &&
                box.y < pb.y + pb.height + 4 &&
                box.y + box.height > pb.y - 4
              ) {
                penalty += 5000;
              }
            }
            for (let c = 1; c < pts.length - 1; c += 1) {
              const corner = pts[c]!;
              if (Math.abs(corner.x - pt.x) < lw * 0.45 && Math.abs(corner.y - pt.y) < lh * 0.45) {
                penalty += 900;
              }
            }
            candidates.push({ pt, score: len * interiorBonus - penalty });
          }
        }
        const bestPt =
          candidates.sort((a, b) => b.score - a.score)[0]?.pt ?? { ...routed.mid };
        const labelBox = { x: bestPt.x - lw / 2, y: bestPt.y - lh / 2, width: lw, height: lh };
        placedBoxes.push(labelBox);
        const parent =
          label.parentElement instanceof SVGGraphicsElement ? label.parentElement : svg;
        const local = toLocalPoint(svg, parent, bestPt);
        label.setAttribute("transform", `translate(${local.x},${local.y})`);

        const mid = routed.mid;
        const overlapsLabel = (pt: Position) =>
          pt.x >= labelBox.x - 8 &&
          pt.x <= labelBox.x + labelBox.width + 8 &&
          pt.y >= labelBox.y - 8 &&
          pt.y <= labelBox.y + labelBox.height + 8;
        if (overlapsLabel(mid)) {
          const handleCandidates: Position[] = [];
          for (let i = 1; i < pts.length; i += 1) {
            const a = pts[i - 1]!;
            const b = pts[i]!;
            if (Math.hypot(b.x - a.x, b.y - a.y) < 12) continue;
            for (const t of [0.15, 0.25, 0.75, 0.85]) {
              const pt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
              if (!overlapsLabel(pt)) handleCandidates.push(pt);
            }
          }
          const clearPt = handleCandidates.sort(
            (p, q) => Math.hypot(p.x - mid.x, p.y - mid.y) - Math.hypot(q.x - mid.x, q.y - mid.y),
          )[0];
          if (clearPt) {
            const ctrlClear = toLocalPoint(svg, edge.control, clearPt);
            edge.handle.setAttribute("cx", String(ctrlClear.x));
            edge.handle.setAttribute("cy", String(ctrlClear.y));
          }
        }
      });
    };
    routeEdges();

    const validLayoutKeys = validLayoutKeySet(
      nodes.map((node) => node.id),
      edges.map((edge) => edge.id),
    );
    const trimmedLayout = trimLayoutToValidKeys(document.layout, validLayoutKeys);
    if (Object.keys(trimmedLayout).length !== Object.keys(document.layout).length) {
      onLayoutChangeRef.current(trimmedLayout);
    }
    let moved = false;
    const finishDrag = (id: string) => {
      if (!moved) return;
      const next: Record<string, Position> = {};
      nodes.forEach(({ id: nodeId, position, base }) => {
        if (Math.abs(position.x - base.x) > 0.01 || Math.abs(position.y - base.y) > 0.01) {
          next[nodeId] = position;
        }
      });
      edges.forEach(({ id: edgeId, manualOffset, startAnchor, endAnchor }) => {
        if (Math.abs(manualOffset.x) > 0.5 || Math.abs(manualOffset.y) > 0.5) {
          next[edgeId] = { ...manualOffset };
        }
        if (startAnchor) {
          next[`${edgeId}::start`] = { ...startAnchor };
        }
        if (endAnchor) {
          next[`${edgeId}::end`] = { ...endAnchor };
        }
      });
      onLayoutChangeRef.current(next);
      onNodeMovedRef.current(id);
      moved = false;
    };
    const guideGroup = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
    guideGroup.setAttribute("class", "sgs-alignment-guides");
    guideGroup.setAttribute("pointer-events", "none");
    svg.appendChild(guideGroup);

    const drawGuides = (activeNode: (typeof nodes)[number], x: number, y: number) => {
      guideGroup.replaceChildren();
      nodes.forEach((other) => {
        if (other.id === activeNode.id) return;
        if (Math.abs(other.position.x - x) < 1) {
          const line = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(x));
          line.setAttribute("x2", String(x));
          line.setAttribute("y1", String(Math.min(y, other.position.y) - 40));
          line.setAttribute("y2", String(Math.max(y, other.position.y) + 40));
          line.setAttribute("class", "sgs-guide-line");
          guideGroup.appendChild(line);
        }
        if (Math.abs(other.position.y - y) < 1) {
          const line = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("y1", String(y));
          line.setAttribute("y2", String(y));
          line.setAttribute("x1", String(Math.min(x, other.position.x) - 40));
          line.setAttribute("x2", String(Math.max(x, other.position.x) + 40));
          line.setAttribute("class", "sgs-guide-line");
          guideGroup.appendChild(line);
        }
      });
    };

    const clearEdgeSelection = () => {
      svg.querySelectorAll<SVGElement>("[data-sgs-edge][data-selected], path[data-selected]").forEach((el) => {
        delete el.dataset.selected;
      });
    };

    edges.forEach((edge) => {
      let pointerStart: { id: number; x: number; y: number; offset: Position } | undefined;
      const onPointerDown = (event: PointerEvent) => {
        if (readOnlyRef.current || event.button !== 0 || spaceDown.current || toolModeRef.current === "hand") return;
        event.preventDefault();
        event.stopPropagation();
        selectedIdsRef.current.clear();
        syncSelectionAttrs();
        clearEdgeSelection();
        edge.control.dataset.selected = "true";
        edge.path.dataset.selected = "true";
        pointerStart = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          offset: { ...edge.manualOffset },
        };
        edge.control.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        const zoomScale = Math.max(transformRef.current.k, 0.1);
        const precision = event.shiftKey ? 0.25 : 1;
        const speed = settingsRef.current.dragSpeed * precision;
        let dx = ((event.clientX - pointerStart.x) / zoomScale) * speed;
        let dy = ((event.clientY - pointerStart.y) / zoomScale) * speed;
        if (settingsRef.current.snapEnabled && !event.altKey) {
          const step = Math.max(4, GRID_SIZE / 2);
          dx = Math.round(dx / step) * step;
          dy = Math.round(dy / step) * step;
        }
        if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 3) {
          edge.manualOffset = {
            x: pointerStart.offset.x + dx,
            y: pointerStart.offset.y + dy,
          };
          moved = true;
          routeEdges();
        }
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        pointerStart = undefined;
        if (edge.control.hasPointerCapture(event.pointerId)) {
          edge.control.releasePointerCapture(event.pointerId);
        }
        finishDrag(edge.id);
      };
      const onDoubleClick = (event: MouseEvent) => {
        event.stopPropagation();
        edge.manualOffset = { x: 0, y: 0 };
        moved = true;
        routeEdges();
        finishDrag(edge.id);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (readOnlyRef.current || toolModeRef.current === "hand") return;
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const step = settingsRef.current.snapEnabled && !event.altKey
          ? Math.max(4, GRID_SIZE / 2)
          : 4;
        const distance = event.shiftKey ? step * 4 : step;
        const next = { ...edge.manualOffset };
        if (event.key === "ArrowUp") next.y -= distance;
        if (event.key === "ArrowDown") next.y += distance;
        if (event.key === "ArrowLeft") next.x -= distance;
        if (event.key === "ArrowRight") next.x += distance;
        edge.manualOffset = next;
        moved = true;
        routeEdges();
        finishDrag(edge.id);
      };
      edge.control.addEventListener("pointerdown", onPointerDown);
      edge.control.addEventListener("pointermove", onPointerMove);
      edge.control.addEventListener("pointerup", onPointerUp);
      edge.control.addEventListener("pointercancel", onPointerUp);
      edge.control.addEventListener("dblclick", onDoubleClick);
      edge.control.addEventListener("keydown", onKeyDown);

      const attachEndpointDrag = (
        handleEl: SVGCircleElement,
        getBoxWrapper: () => SVGGElement,
        onSetAnchor: (anchor: Position | undefined) => void,
      ) => {
        let dragId: number | undefined;
        const onEndpointDown = (event: PointerEvent) => {
          if (readOnlyRef.current || event.button !== 0 || spaceDown.current || toolModeRef.current === "hand") return;
          event.preventDefault();
          event.stopPropagation();
          dragId = event.pointerId;
          handleEl.setPointerCapture(event.pointerId);
        };
        const onEndpointMove = (event: PointerEvent) => {
          if (dragId !== event.pointerId) return;
          event.stopPropagation();
          const box = boundsInRoot(svg, getBoxWrapper());
          const rootPt = toRootPoint(svg, event.clientX, event.clientY);
          onSetAnchor(projectToBoxAnchor(rootPt, box));
          moved = true;
          routeEdges();
        };
        const onEndpointUp = (event: PointerEvent) => {
          if (dragId !== event.pointerId) return;
          dragId = undefined;
          if (handleEl.hasPointerCapture(event.pointerId)) {
            handleEl.releasePointerCapture(event.pointerId);
          }
          finishDrag(edge.id);
        };
        const onEndpointDblClick = (event: MouseEvent) => {
          event.stopPropagation();
          onSetAnchor(undefined);
          moved = true;
          routeEdges();
          finishDrag(edge.id);
        };
        handleEl.addEventListener("pointerdown", onEndpointDown);
        handleEl.addEventListener("pointermove", onEndpointMove);
        handleEl.addEventListener("pointerup", onEndpointUp);
        handleEl.addEventListener("pointercancel", onEndpointUp);
        handleEl.addEventListener("dblclick", onEndpointDblClick);
      };
      attachEndpointDrag(edge.startHandle, () => edge.source.wrapper, (anchor) => {
        edge.startAnchor = anchor;
      });
      attachEndpointDrag(edge.endHandle, () => edge.target.wrapper, (anchor) => {
        edge.endAnchor = anchor;
      });
    });

    const syncSelectionAttrs = () => {
      nodes.forEach((n) => {
        if (selectedIdsRef.current.has(n.id)) n.wrapper.dataset.selected = "true";
        else delete n.wrapper.dataset.selected;
      });
    };
    syncSelectionAttrs();

    nodes.forEach((node) => {
      let pointerStart:
        | {
            id: number;
            x: number;
            y: number;
            position: Position;
            group: Array<{ node: (typeof nodes)[number]; position: Position }>;
          }
        | undefined;
      const onPointerDown = (event: PointerEvent) => {
        if (
          readOnlyRef.current ||
          event.button !== 0 ||
          spaceDown.current ||
          toolModeRef.current === "hand"
        ) return;
        event.preventDefault();
        event.stopPropagation();
        clearEdgeSelection();
        if (event.shiftKey) {
          if (selectedIdsRef.current.has(node.id)) selectedIdsRef.current.delete(node.id);
          else selectedIdsRef.current.add(node.id);
          syncSelectionAttrs();
        } else if (!selectedIdsRef.current.has(node.id)) {
          selectedIdsRef.current.clear();
          selectedIdsRef.current.add(node.id);
          syncSelectionAttrs();
        }
        const activeGroup = selectedIdsRef.current.has(node.id) && selectedIdsRef.current.size > 1
          ? nodes.filter((n) => selectedIdsRef.current.has(n.id))
          : [node];
        pointerStart = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          position: { ...node.position },
          group: activeGroup.map((n) => ({ node: n, position: { ...n.position } })),
        };
        node.wrapper.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        const zoomScale = Math.max(transformRef.current.k, 0.1);
        const precision = event.shiftKey ? 0.25 : 1;
        const speed = settingsRef.current.dragSpeed * precision;
        let x = pointerStart.position.x + ((event.clientX - pointerStart.x) / zoomScale) * speed;
        let y = pointerStart.position.y + ((event.clientY - pointerStart.y) / zoomScale) * speed;
        if (settingsRef.current.snapEnabled && !event.altKey) {
          const size = Math.max(4, GRID_SIZE);
          x = Math.round(x / size) * size;
          y = Math.round(y / size) * size;
        } else if (!event.altKey) {
          for (const other of nodes) {
            if (other.id === node.id) continue;
            if (Math.abs(other.position.x - x) < 6) x = other.position.x;
            if (Math.abs(other.position.y - y) < 6) y = other.position.y;
          }
        }
        const dx = x - pointerStart.position.x;
        const dy = y - pointerStart.position.y;
        if (
          Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4 &&
          Math.abs(dx) + Math.abs(dy) > 0.5
        ) {
          pointerStart.group.forEach(({ node: item, position: startPos }) => {
            item.position = { x: startPos.x + dx, y: startPos.y + dy };
            item.wrapper.setAttribute(
              "transform",
              `translate(${item.position.x - item.base.x},${item.position.y - item.base.y})`,
            );
          });
          moved = true;
          routeEdges();
          drawGuides(node, x, y);
        }
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        pointerStart = undefined;
        guideGroup.replaceChildren();
        if (node.wrapper.hasPointerCapture(event.pointerId)) {
          node.wrapper.releasePointerCapture(event.pointerId);
        }
        finishDrag(node.id);
      };
      const onDoubleClick = (event: MouseEvent) => {
        event.stopPropagation();
        onNodeSelectRef.current?.(node.id);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (readOnlyRef.current || toolModeRef.current === "hand") return;
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const snap = settingsRef.current.snapEnabled && !event.altKey;
        const size = Math.max(4, GRID_SIZE);
        const step = snap ? size : 4;
        const distance = event.shiftKey ? step * 5 : step;
        const next = { ...node.position };
        if (event.key === "ArrowUp") next.y -= distance;
        if (event.key === "ArrowDown") next.y += distance;
        if (event.key === "ArrowLeft") next.x -= distance;
        if (event.key === "ArrowRight") next.x += distance;
        if (snap) {
          next.x = Math.round(next.x / size) * size;
          next.y = Math.round(next.y / size) * size;
        }
        const dx = next.x - node.position.x;
        const dy = next.y - node.position.y;
        const targets = selectedIdsRef.current.has(node.id) && selectedIdsRef.current.size > 1
          ? nodes.filter((n) => selectedIdsRef.current.has(n.id))
          : [node];
        targets.forEach((item) => {
          item.position = { x: item.position.x + dx, y: item.position.y + dy };
          item.wrapper.setAttribute(
            "transform",
            `translate(${item.position.x - item.base.x},${item.position.y - item.base.y})`,
          );
        });
        moved = true;
        routeEdges();
        finishDrag(node.id);
      };
      node.wrapper.addEventListener("pointerdown", onPointerDown);
      node.wrapper.addEventListener("pointermove", onPointerMove);
      node.wrapper.addEventListener("pointerup", onPointerUp);
      node.wrapper.addEventListener("pointercancel", onPointerUp);
      node.wrapper.addEventListener("dblclick", onDoubleClick);
      node.wrapper.addEventListener("keydown", onKeyDown);
      node.wrapper.dataset.sgsListeners = "true";
    });

    const structureKey = `${rendered.id}::${kind}::${nodes.map((n) => n.id).join(",")}`;
    if (previousStructureKey !== structureKey || pendingFitRef.current) {
      graphic.dataset.structureKey = structureKey;
      pendingFitRef.current = false;
      fit();
    }

    return () => {
      guideGroup.remove();
      edgeControlsGroup.remove();
      nodes.forEach(({ wrapper }) => {
        wrapper.replaceWith(...Array.from(wrapper.childNodes));
      });
      selfLoops.forEach(({ wrapper }) => {
        wrapper.replaceWith(...Array.from(wrapper.childNodes));
      });
      labelEntries.forEach(({ label, origTransform }) => {
        if (origTransform === null) label.removeAttribute("transform");
        else label.setAttribute("transform", origTransform);
      });
      terminalEntries.forEach(({ term, origTransform }) => {
        if (origTransform === null) term.removeAttribute("transform");
        else term.setAttribute("transform", origTransform);
      });
    };
  }, [rendered, document.id, document.code, document.layout, fit, settings.colorizeBoxes]);

  const resolvedPalette = resolveDiagramPalette(settings);

  const handleViewportPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.button !== 0 || target?.closest("[data-sgs-node], [data-sgs-edge]")) return;
    if (!event.shiftKey) {
      if (selectedIdsRef.current.size > 0) {
        selectedIdsRef.current.clear();
      }
      graphicRef.current
        ?.querySelectorAll<SVGElement>("[data-sgs-node][data-selected], [data-sgs-edge][data-selected], path[data-selected]")
        .forEach((el) => {
          delete el.dataset.selected;
        });
    }
    if (readOnlyRef.current || toolModeRef.current === "hand" || spaceDown.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    setMarquee({ left: startX, top: startY, width: 0, height: 0 });

    const onMove = (moveEvent: PointerEvent) => {
      const curX = moveEvent.clientX - rect.left;
      const curY = moveEvent.clientY - rect.top;
      setMarquee({
        left: Math.min(startX, curX),
        top: Math.min(startY, curY),
        width: Math.abs(curX - startX),
        height: Math.abs(curY - startY),
      });
    };
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setMarquee(null);
      const boxLeft = Math.min(startClientX, upEvent.clientX);
      const boxRight = Math.max(startClientX, upEvent.clientX);
      const boxTop = Math.min(startClientY, upEvent.clientY);
      const boxBottom = Math.max(startClientY, upEvent.clientY);
      if (boxRight - boxLeft < 4 && boxBottom - boxTop < 4) return;
      selectedIdsRef.current.clear();
      graphicRef.current?.querySelectorAll<SVGGElement>("[data-sgs-node]").forEach((el) => {
        const b = el.getBoundingClientRect();
        const intersects = b.right >= boxLeft && b.left <= boxRight && b.bottom >= boxTop && b.top <= boxBottom;
        if (intersects && el.dataset.sgsNode) {
          selectedIdsRef.current.add(el.dataset.sgsNode);
          el.dataset.selected = "true";
        } else {
          delete el.dataset.selected;
        }
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(event.clientX - rect.left, Math.max(8, rect.width - 210));
    const y = Math.min(event.clientY - rect.top, Math.max(8, rect.height - 170));
    const target = event.target instanceof Element ? event.target : null;
    const nodeEl = target?.closest<SVGGElement>("[data-sgs-node]");
    const edgeEl = target?.closest<SVGGElement>("[data-sgs-edge], [data-sgs-edge-id]");
    setEditingLabel(false);
    setPickingShape(false);
    setPickingMembers(false);
    setAddingMember(false);
    setMemberDraft("");
    const edgeId = edgeEl?.dataset.sgsEdge || edgeEl?.dataset.sgsEdgeId;
    if (nodeEl?.dataset.sgsNode) {
      const id = nodeEl.dataset.sgsNode;
      const label = readNodeTitle(nodeEl, id);
      const memberEl = target?.closest(
        ".members-group .label, .methods-group .label, .members-group .nodeLabel, .methods-group .nodeLabel",
      );
      const rawMember = memberEl?.textContent?.trim();
      const member = rawMember && rawMember !== label ? rawMember : undefined;
      setLabelDraft(label);
      setContextMenu({ kind: "node", x, y, id, label, member });
    } else if (edgeId) {
      const label = edgeEl?.dataset.sgsEdgeLabel || "";
      setLabelDraft(label);
      setContextMenu({ kind: "edge", x, y, id: edgeId, label });
    } else {
      setContextMenu({ kind: "canvas", x, y });
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".canvas-context-menu")) return;
      setContextMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  return (
    <div
      className="diagram-viewport"
      ref={viewportRef}
      data-tool={toolMode}
      onPointerDown={handleViewportPointerDown}
      onContextMenu={handleContextMenu}
      style={{ backgroundColor: resolvedPalette.canvasColor }}
      role="group"
      aria-describedby="node-movement-help"
      aria-label={`Diagram preview. ${toolMode === "hand" ? "Hand tool" : "Move tool"}. Press H for hand, V for move, or Space while dragging to pan.`}
    >
      <div
        className="diagram-graphic"
        ref={graphicRef}
        style={{ fontFamily: settings.font }}
      />
      <button
        ref={zoomReadoutRef}
        className="zoom-readout"
        type="button"
        title="Fit diagram"
        aria-label="Zoom level. Click to fit the diagram."
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => fit(true)}
      >
        100%
      </button>
      {rendering && <div className="render-indicator" aria-live="polite">Rendering…</div>}
      {!rendered.svg && !rendering && (
        <div className="render-empty" role="status">Enter valid Mermaid syntax to preview.</div>
      )}
      {marquee && (
        <div
          className="sgs-marquee"
          style={{
            left: `${marquee.left}px`,
            top: `${marquee.top}px`,
            width: `${marquee.width}px`,
            height: `${marquee.height}px`,
          }}
        />
      )}
      {contextMenu && (
        <div
          className="canvas-context-menu"
          role="menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          {contextMenu.kind === "node" && (
            <>
              {editingLabel && onCodeChange ? (
                <form
                  className="canvas-context-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const updated = updateNodeLabelInCode(document.code, contextMenu.id, labelDraft);
                    if (updated) onCodeChange(updated);
                    setContextMenu(null);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Node label"
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                  />
                  <button className="button primary compact" type="submit">Apply</button>
                </form>
              ) : addingMember && onCodeChange ? (
                <form
                  className="canvas-context-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const updated = addNodeMemberInCode(document.code, contextMenu.id, memberDraft);
                    if (updated) onCodeChange(updated);
                    setContextMenu(null);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="New member or field"
                    placeholder={detectDiagramType(document.code) === "er" ? "string name" : "+String name"}
                    value={memberDraft}
                    onChange={(event) => setMemberDraft(event.target.value)}
                  />
                  <button className="button primary compact" type="submit">Add</button>
                </form>
              ) : pickingMembers && onCodeChange ? (
                <>
                  {(() => {
                    const members = listNodeMembersInCode(document.code, contextMenu.id);
                    const allHidden = members.length > 0 && members.every((m) => m.hidden);
                    return (
                      <>
                        <div className="context-members-head">
                          <button type="button" className="context-back-btn" onClick={() => setPickingMembers(false)}>
                            ← Back
                          </button>
                          <button
                            type="button"
                            className="context-toggle-all-btn"
                            onClick={() => {
                              const updated = setAllNodeMembersHiddenInCode(document.code, contextMenu.id, !allHidden);
                              if (updated) onCodeChange(updated);
                            }}
                          >
                            {allHidden ? "Show all" : "Hide all"}
                          </button>
                        </div>
                        {members.map((member) => (
                          <button
                            key={member.lineIndex}
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={!member.hidden}
                            className={`context-member-row${member.hidden ? " is-hidden" : ""}`}
                            onClick={() => {
                              const updated = toggleNodeMemberInCode(document.code, contextMenu.id, member.lineIndex);
                              if (updated) onCodeChange(updated);
                            }}
                          >
                            <span className="context-member-check" aria-hidden="true">
                              {member.hidden ? "☐" : "☑"}
                            </span>
                            <span className="context-member-text">{member.text}</span>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </>
              ) : pickingShape && onCodeChange ? (
                <>
                  {FLOWCHART_SHAPES.map((shape) => (
                    <button
                      key={shape.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const updated = updateNodeShapeInCode(
                          document.code,
                          contextMenu.id,
                          shape.open,
                          shape.close,
                          contextMenu.label,
                        );
                        if (updated) onCodeChange(updated);
                        setContextMenu(null);
                      }}
                    >
                      {shape.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {onCodeChange && !readOnly && updateNodeLabelInCode(document.code, contextMenu.id, contextMenu.label) && (
                    <button type="button" role="menuitem" onClick={() => setEditingLabel(true)}>
                      <Pencil aria-hidden="true" size={14} />
                      <span>Edit label…</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && detectDiagramType(document.code) === "flowchart" && (
                    <button type="button" role="menuitem" onClick={() => setPickingShape(true)}>
                      <Shapes aria-hidden="true" size={14} />
                      <span>Change shape…</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && (() => {
                    const addition = addManualItemInCode(document.code, contextMenu.id);
                    return addition ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onCodeChange(addition.code);
                          setContextMenu(null);
                        }}
                      >
                        <Plus aria-hidden="true" size={14} />
                        <span>{addition.label}</span>
                      </button>
                    ) : null;
                  })()}
                  {onCodeChange && !readOnly && (detectDiagramType(document.code) === "class" || detectDiagramType(document.code) === "er") && (
                    <button type="button" role="menuitem" onClick={() => setAddingMember(true)}>
                      <Plus aria-hidden="true" size={14} />
                      <span>Add member / field…</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && listNodeMembersInCode(document.code, contextMenu.id).length > 0 && (
                    <button type="button" role="menuitem" onClick={() => setPickingMembers(true)}>
                      <Eye aria-hidden="true" size={14} />
                      <span>Visibility / members…</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && contextMenu.member && hideClassMemberInCode(document.code, contextMenu.id, contextMenu.member) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const updated = hideClassMemberInCode(document.code, contextMenu.id, contextMenu.member!);
                        if (updated) onCodeChange(updated);
                        setContextMenu(null);
                      }}
                    >
                      <EyeOff aria-hidden="true" size={14} />
                      <span>Hide "{contextMenu.member}" (suppress)</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && hideNodeInCode(document.code, contextMenu.id) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const updated = hideNodeInCode(document.code, contextMenu.id);
                        if (updated) onCodeChange(updated);
                        setContextMenu(null);
                      }}
                    >
                      <EyeOff aria-hidden="true" size={14} />
                      <span>{detectDiagramType(document.code) === "class" ? "Hide class (suppress)" : "Hide node (suppress)"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onNodeSelect?.(contextMenu.id);
                      setContextMenu(null);
                    }}
                  >
                    <Code2 aria-hidden="true" size={14} />
                    <span>Jump to code</span>
                  </button>
                  {!readOnly && (contextMenu.id in document.layout || `${contextMenu.id}::end` in document.layout) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const next = { ...document.layout };
                        delete next[contextMenu.id];
                        delete next[`${contextMenu.id}::end`];
                        onLayoutChange(next);
                        setContextMenu(null);
                      }}
                    >
                      <RotateCcw aria-hidden="true" size={14} />
                      <span>Reset node position</span>
                    </button>
                  )}
                  {onCodeChange && !readOnly && deleteNodesInCode(document.code, [contextMenu.id]) && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger-item"
                      onClick={() => {
                        const updated = deleteNodesInCode(document.code, [contextMenu.id]);
                        if (updated) {
                          const nextLayout = { ...document.layout };
                          delete nextLayout[contextMenu.id];
                          onLayoutChange(nextLayout);
                          onCodeChange(updated);
                        }
                        setContextMenu(null);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                      <span>{detectDiagramType(document.code) === "class" ? "Delete class" : "Delete node"}</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {contextMenu.kind === "edge" && (
            <>
              {editingLabel && onCodeChange ? (
                <form
                  className="canvas-context-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const updated = updateEdgeLabelInCode(document.code, contextMenu.id, labelDraft);
                    if (updated) onCodeChange(updated);
                    setContextMenu(null);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Edge label"
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                  />
                  <button className="button primary compact" type="submit">Apply</button>
                </form>
              ) : (
                <>
                  {onCodeChange && !readOnly && updateEdgeLabelInCode(document.code, contextMenu.id, contextMenu.label || "label") && (
                    <button type="button" role="menuitem" onClick={() => setEditingLabel(true)}>
                      <Pencil aria-hidden="true" size={14} />
                      <span>Edit label…</span>
                    </button>
                  )}
                  {((contextMenu.id in document.layout) ||
                    (`${contextMenu.id}::start` in document.layout) ||
                    (`${contextMenu.id}::end` in document.layout)) && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={readOnly}
                      onClick={() => {
                        const next = { ...document.layout };
                        delete next[contextMenu.id];
                        delete next[`${contextMenu.id}::start`];
                        delete next[`${contextMenu.id}::end`];
                        onLayoutChange(next);
                        setContextMenu(null);
                      }}
                    >
                      <RotateCcw aria-hidden="true" size={14} />
                      <span>Reset line offset</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {contextMenu.kind === "canvas" && (
            <>
              {onCodeChange && !readOnly && (() => {
                const addition = addManualItemInCode(document.code);
                return addition ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onCodeChange(addition.code);
                      setContextMenu(null);
                    }}
                  >
                    <Plus aria-hidden="true" size={14} />
                    <span>{addition.label}</span>
                  </button>
                ) : null;
              })()}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fit(true);
                  setContextMenu(null);
                }}
              >
                <Scan aria-hidden="true" size={14} />
                <span>Fit to view</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  reset(true);
                  setContextMenu(null);
                }}
              >
                <RotateCcw aria-hidden="true" size={14} />
                <span>Reset zoom (100%)</span>
              </button>
              {onCodeChange && !readOnly && showHiddenNodesInCode(document.code) && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const updated = showHiddenNodesInCode(document.code);
                    if (updated) onCodeChange(updated);
                    setContextMenu(null);
                  }}
                >
                  <Eye aria-hidden="true" size={14} />
                  <span>Show hidden nodes</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});
