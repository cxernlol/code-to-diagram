import type { StudioSettings } from "./types";

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
  const box = liveSvg.getBBox();
  if (!box.width || !box.height) throw new Error("The current diagram has no exportable content.");
  return { svg: liveSvg.cloneNode(true) as SVGSVGElement, box };
}

function prepareSvg(svg: SVGSVGElement, box: SvgBounds) {
  const padding = 28;
  const width = Math.ceil(box.width + padding * 2);
  const height = Math.ceil(box.height + padding * 2);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute(
    "viewBox",
    `${box.x - padding} ${box.y - padding} ${width} ${height}`,
  );
  svg.querySelectorAll("[tabindex], [aria-describedby], [data-sgs-node]").forEach((element) => {
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-describedby");
    element.removeAttribute("data-sgs-node");
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
  const image = await createImageBitmap(
    new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }),
  );
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create a PNG export.");
  context.fillStyle = settings.canvasColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("The browser could not encode the diagram as PNG."));
    }, "image/png");
  });
  download(blob, filename);
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

export function getSharedCode(hash: string): string | undefined {
  const match = hash.match(/^#d=([^&]+)$/);
  if (!match) return undefined;
  const binary = atob(match[1] ?? "");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const code = new TextDecoder().decode(bytes);
  if (!code.trim()) throw new Error("The shared diagram link contains no Mermaid source.");
  return code;
}

export function createShareHash(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `#d=${btoa(binary)}`;
}
