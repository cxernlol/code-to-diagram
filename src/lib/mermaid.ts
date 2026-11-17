import DOMPurify from "dompurify";
import type { StudioSettings } from "../types";
import { toMermaidSource } from "./formats";

export type DiagramType =
  | "flowchart"
  | "class"
  | "state"
  | "er"
  | "sequence"
  | "gantt"
  | "mindmap"
  | "pie"
  | "journey"
  | "other";

export interface MermaidResult {
  svg: string;
  type: DiagramType;
}

export function parseMermaidSvg(markup: string): SVGSVGElement {
  const sanitized = DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    PARSER_MEDIA_TYPE: "image/svg+xml",
    ADD_TAGS: ["foreignObject", "div", "span", "p", "br", "b", "i", "em", "strong", "code"],
    ADD_ATTR: ["xmlns"],
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "animate",
      "animateTransform",
      "animateMotion",
      "set",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "link",
      "meta",
      "base",
      "img",
      "audio",
      "video",
    ],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  const parsed = new DOMParser().parseFromString(sanitized, "image/svg+xml");
  const svg = parsed.documentElement;
  if (!(svg instanceof SVGSVGElement) || parsed.querySelector("parsererror")) {
    throw new Error("Mermaid returned an invalid SVG diagram.");
  }
  [svg, ...Array.from(svg.querySelectorAll("*"))].forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        (name === "href" || name === "xlink:href") &&
        value !== "" &&
        !value.startsWith("#")
      ) {
        element.removeAttribute(attribute.name);
      }
      if (name === "style" && /url\((?!\s*['"]?#)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  svg.querySelectorAll("style").forEach((style) => {
    if (/@import|url\((?!\s*['"]?#)/i.test(style.textContent ?? "")) style.remove();
  });
  const viewBox = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    viewBox &&
    viewBox.length === 4 &&
    Number.isFinite(viewBox[2]) &&
    Number.isFinite(viewBox[3]) &&
    viewBox[2]! > 0 &&
    viewBox[3]! > 0
  ) {
    svg.setAttribute("width", String(viewBox[2]));
    svg.setAttribute("height", String(viewBox[3]));
    svg.style.removeProperty("max-width");
  }
  return document.importNode(svg, true);
}

let renderSequence = 0;
let renderQueue: Promise<void> = Promise.resolve();

async function ensureMermaid(): Promise<typeof window.mermaid> {
  if (typeof window.mermaid !== "undefined") return window.mermaid;
  await new Promise<void>((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>('script[src*="mermaid"]');
    if (!script) {
      reject(new Error("Mermaid script tag is missing."));
      return;
    }
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load Mermaid runtime."));
    };
    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
  });
  return window.mermaid;
}

export function detectDiagramType(source: string): DiagramType {
  const normalized = toMermaidSource(source).mermaid;
  const firstLine = normalized.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]?.trim() ?? "";
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

function expandHex(value: string, fallback: string): string {
  const clean = value.trim();
  if (/^#[\da-f]{6}$/i.test(clean)) return clean.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(clean)) {
    const [, r, g, b] = clean;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function relativeLuminance(hex: string): number {
  const normalized = expandHex(hex, "#ffffff");
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(normalized.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveDiagramPalette(
  settings: Pick<StudioSettings, "theme" | "primaryColor" | "textColor" | "lineColor" | "canvasColor">,
): { primaryColor: string; textColor: string; lineColor: string; canvasColor: string } {
  let primaryColor = expandHex(settings.primaryColor, "#ffffff");
  let textColor = expandHex(settings.textColor, "#1c3439");
  let lineColor = expandHex(settings.lineColor, "#315158");
  let canvasColor = expandHex(settings.canvasColor, "#f5f7f5");

  if (settings.theme !== "dark" && relativeLuminance(canvasColor) < 0.08) {
    canvasColor = settings.theme === "forest" ? "#f2f7f3" : settings.theme === "neutral" ? "#f6f5f2" : "#f5f7f5";
  }
  if (settings.theme === "dark" && relativeLuminance(primaryColor) > 0.45) {
    primaryColor = "#1c2b30";
  }
  if (contrastRatio(primaryColor, textColor) < 3.5) {
    textColor = relativeLuminance(primaryColor) > 0.35 ? "#162427" : "#eef4f2";
  }
  if (contrastRatio(canvasColor, lineColor) < 2.6) {
    lineColor = relativeLuminance(canvasColor) < 0.25 ? "#8ab4ad" : "#315158";
  }
  return { primaryColor, textColor, lineColor, canvasColor };
}

export function renderMermaid(source: string, settings: StudioSettings): Promise<MermaidResult> {
  const sequence = ++renderSequence;
  const result = renderQueue.then(async () => {
    if (sequence !== renderSequence) throw new DOMException("Stale render.", "AbortError");
    const compiled = toMermaidSource(source).mermaid;
    const type = detectDiagramType(compiled);
    const { primaryColor, textColor, lineColor, canvasColor } = resolveDiagramPalette(settings);
    const mermaid = await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      look: settings.look === "handDrawn" ? "handDrawn" : "classic",
      theme: "base",
      htmlLabels: false,
      flowchart: { htmlLabels: false, nodeSpacing: 56, rankSpacing: 68, padding: 16 },
      class: { htmlLabels: false, nodeSpacing: 56, rankSpacing: 68, diagramPadding: 16 },
      state: { htmlLabels: false, nodeSpacing: 56, rankSpacing: 68 },

      themeCSS: `
        .node > rect, .node > circle, .node > ellipse, .node > polygon, .node > path, .node .basic.label-container, g.classGroup rect, .basic.label-container > path:first-child, .stateGroup rect, .entityBox { fill: ${primaryColor}; stroke: ${lineColor}; }
        .basic.label-container > path:nth-child(2), .divider, .divider path, g.classGroup line { fill: none; stroke: ${lineColor}; }
        .nodeLabel, .label text, .label tspan, .label span, .label div, g.classGroup text, .classTitleText, .node text, .entityLabel, .edgeTerminals text, .edgeTerminals span { fill: ${textColor} !important; color: ${textColor} !important; }
        .edgePath .path, .flowchart-link, path.relation, .transition, .er.relationshipLine { stroke: ${lineColor}; }
        .edgeLabel, .edgeLabel rect, .edgeLabel span, .labelBkg { background-color: ${canvasColor}; fill: ${canvasColor}; color: ${textColor}; }
        .edgeLabel p, .edgeTerminals p { margin: 0; padding: 0; }
        foreignObject { overflow: visible; }
      `,

      themeVariables: {
        darkMode: relativeLuminance(canvasColor) < 0.25,
        primaryColor,
        mainBkg: primaryColor,
        nodeBkg: primaryColor,
        secondBkg: primaryColor,
        tertiaryColor: canvasColor,
        primaryTextColor: textColor,
        secondaryTextColor: textColor,
        tertiaryTextColor: textColor,
        textColor,
        classText: textColor,
        primaryBorderColor: lineColor,
        secondaryBorderColor: lineColor,
        tertiaryBorderColor: lineColor,
        nodeBorder: lineColor,
        lineColor,
        background: canvasColor,
        fontFamily: settings.font.replace(/[;{}<>]/g, ""),
      },
    });

    const rendered = await mermaid.render(`sgs-${sequence}`, compiled);
    if (sequence !== renderSequence) throw new DOMException("Stale render.", "AbortError");
    return { svg: rendered.svg, type };
  });
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function parseMermaid(source: string): Promise<void> {
  const compiled = toMermaidSource(source).mermaid;
  const result = renderQueue.then(async () => {
    const mermaid = await ensureMermaid();
    await mermaid.parse(compiled);
  });
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getMermaidErrorLine(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/line\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
