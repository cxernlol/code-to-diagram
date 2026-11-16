import { getDiagramBounds } from "./DiagramCanvas";
import { resolveDiagramPalette } from "./lib/mermaid";
import type { Position, StudioSettings } from "./types";

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

function prepareSvg(svg: SVGSVGElement, box: SvgBounds) {
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

export function exportSvg(filename: string) {
  const { svg, box } = sourceSvg();
  prepareSvg(svg, box);
  download(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }), filename);
}

export async function exportPng(filename: string, settings: StudioSettings) {
  const { svg, box } = sourceSvg();
  const { width, height } = prepareSvg(svg, box);
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
