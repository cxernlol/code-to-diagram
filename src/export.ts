import { getDiagramBounds } from "./DiagramCanvas";
import { relativeLuminance, resolveDiagramPalette } from "./lib/mermaid";
import type { Position, StudioSettings } from "./types";

interface NodeSwatch {
  fill: string;
  stroke: string;
  text: string;
}

const LIGHT_EXPORT_SWATCHES = {
  startEnd: { fill: "#e6f4ea", stroke: "#2e7d5b", text: "#143527" },
  decision: { fill: "#fef3e6", stroke: "#ad612e", text: "#43230f" },
  io: { fill: "#f1ecf9", stroke: "#654b96", text: "#2b1d45" },
  cycle: [
    { fill: "#eaf1f8", stroke: "#2c5d8a", text: "#152b40" },
    { fill: "#e6f4ea", stroke: "#2e7d5b", text: "#143527" },
    { fill: "#fef3e6", stroke: "#ad612e", text: "#43230f" },
    { fill: "#f1ecf9", stroke: "#654b96", text: "#2b1d45" },
    { fill: "#fbecef", stroke: "#a8445c", text: "#451824" },
    { fill: "#e7f4f4", stroke: "#286e75", text: "#133337" },
  ],
} satisfies { startEnd: NodeSwatch; decision: NodeSwatch; io: NodeSwatch; cycle: NodeSwatch[] };

const DARK_EXPORT_SWATCHES = {
  startEnd: { fill: "#1a3328", stroke: "#5fb88f", text: "#e6f4ea" },
  decision: { fill: "#382618", stroke: "#e0935e", text: "#fef3e6" },
  io: { fill: "#292138", stroke: "#a890d8", text: "#f1ecf9" },
  cycle: [
    { fill: "#1b2b3a", stroke: "#73a9db", text: "#eaf1f8" },
    { fill: "#1a3328", stroke: "#5fb88f", text: "#e6f4ea" },
    { fill: "#382618", stroke: "#e0935e", text: "#fef3e6" },
    { fill: "#292138", stroke: "#a890d8", text: "#f1ecf9" },
    { fill: "#381e26", stroke: "#dd7d93", text: "#fbecef" },
    { fill: "#173134", stroke: "#5db5bd", text: "#e7f4f4" },
  ],
} satisfies { startEnd: NodeSwatch; decision: NodeSwatch; io: NodeSwatch; cycle: NodeSwatch[] };

function isDiamondPolygon(polygon: SVGPolygonElement): boolean {
  const nums = (polygon.getAttribute("points") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (nums.length !== 8) return false;
  return Math.abs(nums[0]! - nums[4]!) < 2 || Math.abs(nums[3]! - nums[7]!) < 2;
}

function getExportNodeShapes(node: SVGGElement): SVGElement[] {
  const container = node.querySelector<SVGElement>(":scope > .basic.label-container");
  if (container) {
    if (container.matches("rect, polygon, circle, ellipse, path")) return [container];
    const nested = container.querySelectorAll<SVGElement>(":scope > path:first-child, :scope > rect, :scope > polygon");
    if (nested.length > 0) return Array.from(nested);
  }
  return Array.from(
    node.querySelectorAll<SVGElement>(":scope > rect, :scope > circle, :scope > ellipse, :scope > polygon, :scope > path"),
  );
}

function colorizeExportedNodes(svg: SVGSVGElement, settings?: StudioSettings) {
  const isDark = settings ? relativeLuminance(resolveDiagramPalette(settings).canvasColor) < 0.25 : false;
  const palette = isDark ? DARK_EXPORT_SWATCHES : LIGHT_EXPORT_SWATCHES;
  const nodes = svg.querySelectorAll<SVGGElement>("g.node, g.statediagram-state, g.entityBox, g.classGroup");
  let cycleIndex = 0;

  nodes.forEach((node) => {
    const shapes = getExportNodeShapes(node);
    if (shapes.length === 0) return;
    // Preserve explicit Mermaid `style` / `classDef` node fills authored by the user.
    if (shapes.some((shape) => Boolean(shape.style.fill))) return;

    const isClassOrEntity = node.matches("g.classGroup, g.entityBox, g.statediagram-state") ||
      Boolean(node.querySelector(".divider, .classTitleText"));
    let swatch: NodeSwatch;

    if (!isClassOrEntity && node.querySelector(":scope > circle, :scope > ellipse")) {
      swatch = palette.startEnd;
    } else if (!isClassOrEntity && shapes.some((s) => s.matches("rect") && Number(s.getAttribute("rx") ?? 0) >= 10)) {
      swatch = palette.startEnd;
    } else if (
      !isClassOrEntity &&
      shapes.some((s) => s.matches("path") && /[AC]/i.test(s.getAttribute("d") ?? ""))
    ) {
      swatch = palette.startEnd;
    } else if (!isClassOrEntity && node.querySelector(":scope > polygon")) {
      const poly = node.querySelector<SVGPolygonElement>(":scope > polygon");
      swatch = poly && isDiamondPolygon(poly) ? palette.decision : palette.io;
    } else {
      swatch = palette.cycle[cycleIndex % palette.cycle.length]!;
      cycleIndex += 1;
    }

    shapes.forEach((shape) => {
      shape.style.setProperty("fill", swatch.fill, "important");
      shape.style.setProperty("stroke", swatch.stroke, "important");
    });
    node
      .querySelectorAll<SVGElement>(".basic.label-container > path:nth-child(2), .divider, .divider path, g.classGroup line")
      .forEach((divider) => {
        divider.style.setProperty("fill", "none", "important");
        divider.style.setProperty("stroke", swatch.stroke, "important");
      });
    node
      .querySelectorAll<SVGElement>(".nodeLabel, .label text, .label tspan, .label span, .label div, g.classGroup text, .classTitleText, .node text, .entityLabel")
      .forEach((label) => {
        label.style.setProperty("fill", swatch.text, "important");
        label.style.setProperty("color", swatch.text, "important");
      });
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface SvgBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sourceSvg(): { svg: SVGSVGElement; box: SvgBounds } {
  const liveSvg = document.querySelector<SVGSVGElement>(".diagram-graphic svg");
  if (!liveSvg) throw new Error("Render a diagram before exporting.");
  const rawBox = getDiagramBounds(liveSvg);
  if (!rawBox.width || !rawBox.height) throw new Error("The current diagram has no exportable content.");
  const ctm = liveSvg.getCTM();
  const scaleX = ctm && Math.abs(ctm.a) > 0.0001 ? ctm.a : 1;
  const scaleY = ctm && Math.abs(ctm.d) > 0.0001 ? ctm.d : 1;
  const box = ctm
    ? {
        x: (rawBox.x - ctm.e) / scaleX,
        y: (rawBox.y - ctm.f) / scaleY,
        width: rawBox.width / scaleX,
        height: rawBox.height / scaleY,
      }
    : rawBox;
  return { svg: liveSvg.cloneNode(true) as SVGSVGElement, box };
}

function prepareSvg(svg: SVGSVGElement, box: SvgBounds, settings?: StudioSettings) {
  const padding = 28;
  const width = Math.ceil(box.width + padding * 2);
  const height = Math.ceil(box.height + padding * 2);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.removeProperty("max-width");
  svg.setAttribute(
    "viewBox",
    `${box.x - padding} ${box.y - padding} ${width} ${height}`,
  );
  if (settings?.colorizeBoxes) {
    colorizeExportedNodes(svg, settings);
  }
  svg.querySelectorAll(".sgs-alignment-guides, .sgs-edge-controls").forEach((el) => el.remove());
  svg
    .querySelectorAll("[tabindex], [aria-describedby], [data-sgs-node], [data-sgs-edge], [data-sgs-source], [data-sgs-target]")
    .forEach((element) => {
      element.removeAttribute("tabindex");
      element.removeAttribute("aria-describedby");
      element.removeAttribute("data-sgs-node");
      element.removeAttribute("data-sgs-edge");
      element.removeAttribute("data-sgs-source");
      element.removeAttribute("data-sgs-target");
      element.removeAttribute("role");
      element.removeAttribute("aria-label");
    });
  return { width, height };
}

export function exportSvg(filename: string, settings?: StudioSettings) {
  const { svg, box } = sourceSvg();
  prepareSvg(svg, box, settings);
  download(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }), filename);
}

export async function exportPng(filename: string, settings: StudioSettings) {
  const { svg, box } = sourceSvg();
  const { width, height } = prepareSvg(svg, box, settings);
  const serialized = new XMLSerializer().serializeToString(svg);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a PNG export.");
  context.fillStyle = resolveDiagramPalette(settings).canvasColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The browser could not rasterize the SVG diagram."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  });
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("The browser could not encode the diagram as PNG."));
    }, "image/png");
  });
  download(blob, filename);
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function getImportedMermaid(text: string, filename: string): string {
  if (/\.md$/i.test(filename)) {
    const match = text.match(/```mermaid\s*\r?\n([\s\S]*?)```/i);
    if (!match?.[1]) throw new Error("No fenced Mermaid diagram was found in that Markdown file.");
    return match[1].trim();
  }
  if (!text.trim()) throw new Error("The selected diagram file is empty.");
  return text;
}

export function getSharedPayload(
  hash: string,
): { code: string; layout: Record<string, Position> } | undefined {
  if (!hash.startsWith("#d=")) return undefined;
  const params = new URLSearchParams(hash.slice(1));
  const rawCode = params.get("d");
  if (!rawCode) return undefined;
  const code = decodeBase64(rawCode);
  if (!code.trim()) throw new Error("The shared diagram link contains no Mermaid source.");
  let layout: Record<string, Position> = {};
  const rawLayout = params.get("l");
  if (rawLayout) {
    try {
      const parsed = JSON.parse(decodeBase64(rawLayout)) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        layout = Object.fromEntries(
          Object.entries(parsed).flatMap(([id, pos]) => {
            if (!pos || typeof pos !== "object") return [];
            const { x, y } = pos as { x?: unknown; y?: unknown };
            return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)
              ? [[id, { x, y }]]
              : [];
          }),
        );
      }
    } catch {
      layout = {};
    }
  }
  return { code, layout };
}

export function getSharedCode(hash: string): string | undefined {
  return getSharedPayload(hash)?.code;
}

export function createShareHash(code: string, layout?: Record<string, Position>): string {
  const base = `#d=${encodeURIComponent(encodeBase64(code))}`;
  if (layout && Object.keys(layout).length > 0) {
    return `${base}&l=${encodeURIComponent(encodeBase64(JSON.stringify(layout)))}`;
  }
  return `#d=${encodeBase64(code)}`;
}
