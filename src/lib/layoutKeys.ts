import type { Position } from "../types";
import { edgeAnchorKey } from "./sidecar";
import type { DiagramIR } from "./translate";

export function edgeLayoutId(from: string, to: string, index: number): string {
  return `edge::${from}->${to}::${index}`;
}

export function validLayoutKeySet(
  nodeIds: Iterable<string>,
  edgeIds: Iterable<string>,
): Set<string> {
  const keys = new Set<string>();
  for (const id of nodeIds) {
    keys.add(id);
  }
  for (const edgeId of edgeIds) {
    keys.add(edgeId);
    keys.add(edgeAnchorKey(edgeId, "start"));
    keys.add(edgeAnchorKey(edgeId, "end"));
  }
  return keys;
}

export function validLayoutKeysFromIR(ir: DiagramIR): Set<string> {
  const nodeIds = ir.nodes.map((node) => node.id);
  const edgeIds = ir.edges.map((edge, index) => edgeLayoutId(edge.from, edge.to, index));
  return validLayoutKeySet(nodeIds, edgeIds);
}

export function trimLayoutToValidKeys(
  layout: Record<string, Position>,
  validKeys: ReadonlySet<string>,
): Record<string, Position> {
  const trimmed: Record<string, Position> = {};
  for (const [key, pos] of Object.entries(layout)) {
    if (validKeys.has(key)) {
      trimmed[key] = pos;
    }
  }
  return trimmed;
}

export function partitionLayoutKeys(
  layout: Record<string, Position>,
  validKeys: ReadonlySet<string>,
): {
  preserved: Record<string, Position>;
  orphaned: string[];
  orphanedEntries: Record<string, Position>;
} {
  const preserved: Record<string, Position> = {};
  const orphaned: string[] = [];
  const orphanedEntries: Record<string, Position> = {};
  for (const [key, pos] of Object.entries(layout)) {
    if (validKeys.has(key)) {
      preserved[key] = pos;
    } else {
      orphaned.push(key);
      orphanedEntries[key] = pos;
    }
  }
  return { preserved, orphaned, orphanedEntries };
}
