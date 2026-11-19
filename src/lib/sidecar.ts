import type { Position } from "../types";

export const SIDECAR_VERSION = 1 as const;
export const SIDECAR_EXTENSION = ".ctd.json";

export const MAX_LAYOUT_ENTRIES = 5000;
export const MAX_LAYOUT_COORD = 100_000;
export const MAX_LAYOUT_KEY_LENGTH = 256;
export const MAX_META_GENERATED_FROM_LENGTH = 512;

export const EDGE_ANCHOR_START_SUFFIX = "::start";
export const EDGE_ANCHOR_END_SUFFIX = "::end";

const FORBIDDEN_LAYOUT_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const ALLOWED_META_KEYS = new Set(["generatedFrom", "sha256", "updatedAt"]);
const SHA256_HEX_RE = /^[a-fA-F0-9]{64}$/;

export interface ParseSidecarOptions {
  onWarning?: (warning: string) => void;
}

export interface SidecarMeta {
  generatedFrom?: string;
  sha256?: string;
  updatedAt?: string;
}

export interface SidecarV1 {
  version: typeof SIDECAR_VERSION;
  layout: Record<string, Position>;
  meta?: SidecarMeta;
}

export function isEdgeAnchorKey(key: string): boolean {
  return (
    (key.endsWith(EDGE_ANCHOR_START_SUFFIX) && key.length > EDGE_ANCHOR_START_SUFFIX.length) ||
    (key.endsWith(EDGE_ANCHOR_END_SUFFIX) && key.length > EDGE_ANCHOR_END_SUFFIX.length)
  );
}

export function edgeAnchorKey(edgeId: string, end: "start" | "end"): string {
  return `${edgeId}${end === "start" ? EDGE_ANCHOR_START_SUFFIX : EDGE_ANCHOR_END_SUFFIX}`;
}

export function sidecarFilename(diagramFilename: string): string {
  const trimmed = diagramFilename.trim();
  if (!trimmed) return `diagram${SIDECAR_EXTENSION}`;
  if (trimmed.toLowerCase().endsWith(SIDECAR_EXTENSION)) return trimmed;
  const lastSlash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > lastSlash ? trimmed.slice(0, lastDot) : trimmed;
  return `${base || "diagram"}${SIDECAR_EXTENSION}`;
}

export function isValidLayoutKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= MAX_LAYOUT_KEY_LENGTH &&
    !FORBIDDEN_LAYOUT_KEYS.has(key)
  );
}

export function isValidPosition(pos: unknown): pos is Position {
  if (!pos || typeof pos !== "object" || Array.isArray(pos)) return false;
  const { x, y } = pos as { x?: unknown; y?: unknown };
  return (
    typeof x === "number" &&
    Number.isFinite(x) &&
    Math.abs(x) <= MAX_LAYOUT_COORD &&
    typeof y === "number" &&
    Number.isFinite(y) &&
    Math.abs(y) <= MAX_LAYOUT_COORD
  );
}

/**
 * Validates and sanitizes an untrusted layout object using Studio/Room limits:
 * - rejects non-objects and arrays (returns null)
 * - drops prototype-polluting keys (__proto__, constructor, prototype), empty keys, and keys > 256 chars
 * - caps entries at 5000
 * - requires finite x/y within [-100_000, 100_000]
 */
export function parseLayoutRecord(raw: unknown): Record<string, Position> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, Position> = {};
  let count = 0;
  for (const [id, pos] of Object.entries(raw)) {
    if (count >= MAX_LAYOUT_ENTRIES) break;
    if (!isValidLayoutKey(id)) continue;
    if (!isValidPosition(pos)) continue;
    out[id] = { x: pos.x, y: pos.y };
    count += 1;
  }
  return out;
}

function sanitizeMeta(raw: unknown, onWarning?: (warning: string) => void): SidecarMeta | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    onWarning?.("Sidecar meta must be an object; ignored.");
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (onWarning) {
    for (const key of Object.keys(obj)) {
      if (!ALLOWED_META_KEYS.has(key)) {
        onWarning(`Unknown sidecar meta key "${key}" ignored.`);
      }
    }
  }
  const meta: SidecarMeta = {};
  if (obj.generatedFrom !== undefined) {
    if (
      typeof obj.generatedFrom === "string" &&
      obj.generatedFrom.trim().length > 0 &&
      obj.generatedFrom.length <= MAX_META_GENERATED_FROM_LENGTH
    ) {
      meta.generatedFrom = obj.generatedFrom.trim();
    } else {
      onWarning?.("Invalid sidecar meta.generatedFrom ignored.");
    }
  }
  if (obj.sha256 !== undefined) {
    if (typeof obj.sha256 === "string" && SHA256_HEX_RE.test(obj.sha256)) {
      meta.sha256 = obj.sha256.toLowerCase();
    } else {
      onWarning?.("Invalid sidecar meta.sha256 ignored (expected 64-char hex).");
    }
  }
  if (obj.updatedAt !== undefined) {
    if (typeof obj.updatedAt === "string" && obj.updatedAt.trim().length > 0) {
      meta.updatedAt = obj.updatedAt.trim();
    } else {
      onWarning?.("Invalid sidecar meta.updatedAt ignored.");
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function serializeSidecar(
  layout: Record<string, Position>,
  meta?: SidecarMeta,
  options?: { pretty?: boolean },
): string {
  const sanitizedLayout = parseLayoutRecord(layout) ?? {};
  const sanitizedMeta = sanitizeMeta(meta);
  const doc: SidecarV1 = sanitizedMeta
    ? { version: SIDECAR_VERSION, layout: sanitizedLayout, meta: sanitizedMeta }
    : { version: SIDECAR_VERSION, layout: sanitizedLayout };
  const pretty = options?.pretty ?? true;
  return pretty ? `${JSON.stringify(doc, null, 2)}\n` : JSON.stringify(doc);
}

export function parseSidecar(raw: string | unknown, options?: ParseSidecarOptions): SidecarV1 {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid CTD sidecar JSON.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid CTD sidecar: expected a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== SIDECAR_VERSION) {
    throw new Error(
      `Unsupported CTD sidecar version: ${obj.version === undefined ? "missing" : String(obj.version)}.`,
    );
  }
  const layout = parseLayoutRecord(obj.layout);
  if (layout === null) {
    throw new Error('Invalid CTD sidecar: "layout" must be an object.');
  }
  const meta = sanitizeMeta(obj.meta, options?.onWarning);
  return meta
    ? { version: SIDECAR_VERSION, layout, meta }
    : { version: SIDECAR_VERSION, layout };
}
