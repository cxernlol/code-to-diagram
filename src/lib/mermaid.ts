import type { StudioSettings } from "../types";

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
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = parsed.documentElement;
  if (!(svg instanceof SVGSVGElement) || parsed.querySelector("parsererror")) {
    throw new Error("Mermaid returned an invalid SVG diagram.");
  }
  svg.querySelectorAll("script, iframe, object, embed").forEach((element) => {
    element.remove();
  });
  [svg, ...Array.from(svg.querySelectorAll("*"))].forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) element.removeAttribute(attribute.name);
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
  const firstLine = source.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]?.trim() ?? "";
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

export function renderMermaid(source: string, settings: StudioSettings): Promise<MermaidResult> {
  const sequence = ++renderSequence;
  const type = detectDiagramType(source);
  const result = renderQueue.then(async () => {
    if (sequence !== renderSequence) throw new DOMException("Stale render.", "AbortError");
    const color = (value: string, fallback: string) =>
      /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : fallback;
    const primaryColor = color(settings.primaryColor, "#ffffff");
    const textColor = color(settings.textColor, "#1c3439");
    const lineColor = color(settings.lineColor, "#315158");
    const canvasColor = color(settings.canvasColor, "#f5f7f5");
    const mermaid = await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      look: settings.look === "handDrawn" ? "handDrawn" : "classic",
      theme: "base",
      htmlLabels: false,
      themeVariables: {
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
    const rendered = await mermaid.render(`sgs-${sequence}`, source);
    if (sequence !== renderSequence) throw new DOMException("Stale render.", "AbortError");
    return { svg: rendered.svg, type };
  });
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function parseMermaid(source: string): Promise<void> {
  const result = renderQueue.then(async () => {
    const mermaid = await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
    });
    await mermaid.parse(source);
  });
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getMermaidErrorLine(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/line\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
