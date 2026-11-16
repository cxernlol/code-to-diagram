export interface VersionEntry {
  id: string;
  createdAt: number;
  reason: string;
  code: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface DiagramDocument {
  id: string;
  name: string;
  code: string;
  history: VersionEntry[];
  layout: Record<string, Position>;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

export type ProviderId = "openai" | "deepseek" | "ollama" | "openrouter" | "groq" | "custom";

export interface ProviderSettings {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  temperature: number | null;
}

export interface StudioSettings {
  activeDocumentId: string;
  theme: string;
  look: string;
  primaryColor: string;
  textColor: string;
  lineColor: string;
  canvasColor: string;
  font: string;
  splitPercent: number;
  zoomSpeed: number;
  panSpeed: number;
  dragSpeed: number;
  invertScroll: boolean;
  snapEnabled: boolean;
  snapSize: number;
  smoothZoom: boolean;
  scrollMode: "pan" | "zoom";
  provider: ProviderSettings;
}

export interface ProviderCredentials {
  apiKey: string;
}

export interface StudioData {
  documents: DiagramDocument[];
  settings: StudioSettings;
  credentials: ProviderCredentials;
  migration: "fresh" | "legacy" | "skipped";
}

export interface LegacyHistoryEntry {
  t?: string;
  code?: string;
  why?: string;
}

export interface LegacyDocument {
  name?: string;
  code?: string;
  hist?: LegacyHistoryEntry[];
}

export interface LegacyState {
  docs?: LegacyDocument[];
  cur?: number;
  theme?: string;
  look?: string;
  c1?: string;
  c2?: string;
  c3?: string;
  c4?: string;
  font?: string;
  key?: string;
  base?: string;
  model?: string;
}

export interface DiagramNode {
  id: string;
  element: SVGGElement;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface DiagramEdge {
  id: string;
  path: SVGPathElement;
  sourceId: string;
  targetId: string;
}
