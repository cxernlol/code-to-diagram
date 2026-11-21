#!/usr/bin/env node
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

function printHelp() {
  console.log(`Usage: node scripts/render-diagram.mjs --input <file> [options]

Render a diagram source file (.mmd, .dot, .puml, .d2, .sql, .ts, .xml) with an
optional .ctd.json sidecar using the built CTD Studio renderer (dist/).

Options:
  --input <path>    Diagram source file to render (required)
  --sidecar <path>  Optional .ctd.json sidecar (defaults to <basename>.ctd.json if present)
  --out <path>      Output SVG path (defaults to <basename>.svg when neither --out nor --png is set)
  --png <path>      Optional output PNG path
  -h, --help        Show this help message
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (arg === "--input" && argv[i + 1]) {
      args.input = argv[++i];
    } else if (arg === "--sidecar" && argv[i + 1]) {
      args.sidecar = argv[++i];
    } else if (arg === "--out" && argv[i + 1]) {
      args.out = argv[++i];
    } else if (arg === "--png" && argv[i + 1]) {
      args.png = argv[++i];
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }
  return args;
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

function defaultSidecarPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.ctd.json`);
}

function defaultSvgPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.svg`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.input) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  if (!(await fileExists(inputPath))) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  let sidecarPath = args.sidecar ? path.resolve(args.sidecar) : undefined;
  if (sidecarPath) {
    if (!(await fileExists(sidecarPath))) {
      throw new Error(`Sidecar file not found: ${sidecarPath}`);
    }
  } else {
    const candidate = defaultSidecarPath(inputPath);
    if (await fileExists(candidate)) {
      sidecarPath = candidate;
    }
  }

  const svgOut = args.out ? path.resolve(args.out) : args.png ? undefined : defaultSvgPath(inputPath);
  const pngOut = args.png ? path.resolve(args.png) : undefined;

  const previewServer = await preview({
    preview: { port: 0, strictPort: false, open: false },
  });
  const baseUrl = previewServer.resolvedUrls?.local?.[0];
  if (!baseUrl) {
    throw new Error("Failed to start Vite preview server. Did you run `npm run build`?");
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(`${baseUrl.replace(/\/$/, "")}/#app`, { waitUntil: "networkidle" });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(inputPath);
    await page.locator(".diagram-graphic svg").first().waitFor({ state: "visible", timeout: 15000 });

    if (sidecarPath) {
      await fileInput.setInputFiles(sidecarPath);
      await page.locator(".toast", { hasText: /layout applied/i }).waitFor({ state: "visible", timeout: 10000 });
    }

    if (svgOut) {
      await mkdir(path.dirname(svgOut), { recursive: true });
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "More export…" }).click();
      await page.getByRole("menuitem", { name: "Export SVG" }).click();
      const download = await downloadPromise;
      const tmpPath = await download.path();
      if (!tmpPath) throw new Error("SVG download failed.");
      await copyFile(tmpPath, svgOut);
      console.log(`Rendered SVG: ${svgOut}`);
    }

    if (pngOut) {
      await mkdir(path.dirname(pngOut), { recursive: true });
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download PNG" }).click();
      const download = await downloadPromise;
      const tmpPath = await download.path();
      if (!tmpPath) throw new Error("PNG download failed.");
      await copyFile(tmpPath, pngOut);
      console.log(`Rendered PNG: ${pngOut}`);
    }
  } finally {
    await browser.close();
    previewServer.httpServer.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
