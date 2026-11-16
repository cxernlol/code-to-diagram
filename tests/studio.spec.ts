import { expect, test, type Locator } from "@playwright/test";

async function expectEdgeEndsAtNodes(edge: Locator): Promise<void> {
  const endpoints = await edge.evaluate((element) => {
    if (!(element instanceof SVGPathElement)) throw new Error("The edge is not an SVG path.");
    const path = element;
    const svg = path.ownerSVGElement;
    const matrix = path.getScreenCTM();
    if (!svg || !matrix) throw new Error("The edge has no SVG coordinate system.");
    const points = [0, path.getTotalLength()].map((length) => {
      const point = path.getPointAtLength(length);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
    const bounds: DOMRect[] = [];
    const nodes = svg.querySelectorAll("[data-sgs-node]");
    for (let index = 0; index < nodes.length; index += 1) {
      bounds.push(nodes[index]!.getBoundingClientRect());
    }
    return points.map((point) => Math.min(...bounds.map((rect) => {
      const dx = point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0;
      const dy = point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0;
      if (dx === 0) return Math.min(Math.abs(point.y - rect.top), Math.abs(point.y - rect.bottom));
      if (dy === 0) return Math.min(Math.abs(point.x - rect.left), Math.abs(point.x - rect.right));
      return Math.hypot(dx, dy);
    })));
  });
  expect(endpoints.every((distance) => distance < 3)).toBe(true);
}

test("moves one flowchart node and keeps its connectors attached", async ({ page }) => {
  await page.goto("/");
  const node = page.locator('[data-sgs-node="Check"]');
  await expect(node).toBeVisible();
  await expect(page.getByRole("region", { name: "Diagram preview" }).getByText("flowchart", { exact: true })).toBeVisible();

  const beforeTransform = await node.getAttribute("transform");
  const edge = page.locator(".diagram-graphic path.flowchart-link").first();
  const beforePath = await edge.getAttribute("d");
  const bounds = await node.boundingBox();
  if (!bounds) throw new Error("The Check node has no visible bounds.");

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 96, bounds.y + bounds.height / 2 + 52, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => node.getAttribute("transform")).not.toBe(beforeTransform);
  await expect.poll(() => edge.getAttribute("d")).not.toBe(beforePath);
  const movedTransform = await node.getAttribute("transform");
  const snappedPosition = await node.evaluate((wrapper) => {
    const read = (transform: string | null) => {
      const match = transform?.match(/translate\(\s*(-?[\d.]+)(?:[,\s]+(-?[\d.]+))?/);
      return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
    };
    const offset = read(wrapper.getAttribute("transform"));
    const base = read(wrapper.firstElementChild?.getAttribute("transform") ?? null);
    return { x: offset.x + base.x, y: offset.y + base.y };
  });
  expect(Math.abs(snappedPosition.x / 20 - Math.round(snappedPosition.x / 20))).toBeLessThan(0.00001);
  expect(Math.abs(snappedPosition.y / 20 - Math.round(snappedPosition.y / 20))).toBeLessThan(0.00001);

  await expectEdgeEndsAtNodes(edge);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.locator(".save-status")).toContainText("Saved");
  await page.reload();
  await expect(page.locator('[data-sgs-node="Check"]')).toHaveAttribute("transform", movedTransform ?? "");
});

test("class relationships follow a snapped class move", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Start from a template").selectOption({ label: "Class" });
  const node = page.locator('[data-sgs-node="Dog"]');
  const edge = page.locator(".diagram-graphic .edgePaths path.relation").first();
  await expect(node).toBeVisible();
  await expect(edge).toBeVisible();
  const beforePath = await edge.getAttribute("d");
  const bounds = await node.boundingBox();
  if (!bounds) throw new Error("The Dog class has no visible bounds.");

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 96, bounds.y + bounds.height / 2 + 56, { steps: 6 });
  await page.mouse.up();

  await expect.poll(() => edge.getAttribute("d")).not.toBe(beforePath);
  await expectEdgeEndsAtNodes(edge);
  const tangents = await edge.evaluate((el) => {
    const path = el as SVGPathElement;
    const len = path.getTotalLength();
    const p0 = path.getPointAtLength(0);
    const p1 = path.getPointAtLength(Math.min(10, len / 4));
    const pEndPrev = path.getPointAtLength(Math.max(0, len - Math.min(10, len / 4)));
    const pEnd = path.getPointAtLength(len);
    return {
      startDx: Math.abs(p1.x - p0.x),
      startDy: p1.y - p0.y,
      endDx: Math.abs(pEnd.x - pEndPrev.x),
      endDy: pEnd.y - pEndPrev.y,
    };
  });
  expect(tangents.startDx).toBeLessThan(0.5);
  expect(tangents.startDy).toBeGreaterThan(5);
  expect(tangents.endDx).toBeLessThan(0.5);
  expect(tangents.endDy).toBeGreaterThan(5);
});

test("upgrades existing workspaces to grid snapping without changing the new default", async ({ page }) => {
  await page.route("**/src/main.tsx", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.goto("/");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("sgs-studio", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const documents = db.createObjectStore("documents", { keyPath: "id" });
      documents.createIndex("by-order", "sortOrder");
      db.createObjectStore("settings");
      db.createObjectStore("credentials");
      db.createObjectStore("metadata");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["documents", "settings", "credentials", "metadata"], "readwrite");
      tx.objectStore("documents").put({
        id: "existing",
        name: "Existing diagram",
        code: "flowchart LR\\n  A --> B",
        history: [],
        layout: {},
        createdAt: 1,
        updatedAt: 1,
        sortOrder: 0,
      });
      tx.objectStore("settings").put({
        activeDocumentId: "existing",
        theme: "default",
        look: "classic",
        primaryColor: "#6366f1",
        textColor: "#ffffff",
        lineColor: "#334155",
        canvasColor: "#ffffff",
        font: "Inter, sans-serif",
        splitPercent: 42,
        zoomSpeed: 1,
        panSpeed: 1,
        dragSpeed: 0.5,
        invertScroll: false,
        snapEnabled: false,
        snapSize: 20,
        smoothZoom: true,
        scrollMode: "zoom",
        provider: {
          provider: "deepseek",
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-chat",
          temperature: null,
        },
      }, "main");
      tx.objectStore("credentials").put({ apiKey: "" }, "provider");
      tx.objectStore("metadata").put("fresh", "initialized");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
  }));
  await page.unroute("**/src/main.tsx");
  await page.reload();
  await page.locator('summary[aria-label="Pan and zoom settings"]').click();
  await expect(page.getByLabel("Snap nodes to grid")).toBeChecked();
});

test("H pans, V moves, and keyboard history reverses node movement", async ({ page }) => {
  await page.goto("/");
  const viewport = page.locator(".diagram-viewport");
  const graphic = page.locator(".diagram-graphic");
  const node = page.locator('[data-sgs-node="Check"]');
  await expect(node).toBeVisible();

  const initialNodeTransform = await node.getAttribute("transform");
  const initialGraphicTransform = await graphic.getAttribute("style");
  await page.keyboard.press("h");
  await expect(viewport).toHaveAttribute("data-tool", "hand");
  const bounds = await node.boundingBox();
  if (!bounds) throw new Error("The Check node has no visible bounds.");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 64, bounds.y + bounds.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(initialGraphicTransform);
  await expect(node).toHaveAttribute("transform", initialNodeTransform ?? "");

  await page.keyboard.press("v");
  await expect(viewport).toHaveAttribute("data-tool", "move");
  const afterHandPan = await graphic.getAttribute("style");
  const panBounds = await node.boundingBox();
  if (!panBounds) throw new Error("The Check node has no visible bounds after panning.");
  await page.mouse.move(panBounds.x + panBounds.width / 2, panBounds.y + panBounds.height / 2);
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(panBounds.x + panBounds.width / 2 + 44, panBounds.y + panBounds.height / 2 + 24, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(afterHandPan);
  await expect(node).toHaveAttribute("transform", initialNodeTransform ?? "");

  const movedBounds = await node.boundingBox();
  if (!movedBounds) throw new Error("The Check node has no visible bounds after panning.");
  await page.mouse.move(movedBounds.x + movedBounds.width / 2, movedBounds.y + movedBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedBounds.x + movedBounds.width / 2 + 96, movedBounds.y + movedBounds.height / 2 + 52, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => node.getAttribute("transform")).not.toBe(initialNodeTransform);
  const movedTransform = await node.getAttribute("transform");
  await page.keyboard.press("Control+z");
  await expect.poll(() => node.getAttribute("transform")).toBe(initialNodeTransform);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => node.getAttribute("transform")).toBe(movedTransform);
});

test("migrates the legacy workspace without removing its recovery copy", async ({ page }) => {
  const legacy = JSON.stringify({
    docs: [{
      name: "Legacy diagram",
      code: "flowchart LR\n  Saved --> Work",
      hist: [{ code: "flowchart TD\n  Old --> Version", why: "Earlier edit", t: "2025-01-01T00:00:00.000Z" }],
    }],
    cur: 0,
    theme: "dark",
    key: "legacy-key",
  });
  await page.addInitScript((value) => localStorage.setItem("mstudio2", value), legacy);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Legacy diagram" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mermaid diagram source" })).toContainText("Saved --> Work");
  expect(await page.evaluate(() => localStorage.getItem("mstudio2"))).toBe(legacy);
  await page.locator('summary[aria-label="Version history"]').click();
  await expect(page.getByText("Earlier edit")).toBeVisible();
});

test("zooms with the toolbar and wheel and keeps the dotted grid in sync", async ({ page }) => {
  await page.goto("/");
  const graphic = page.locator(".diagram-graphic");
  const viewport = page.locator(".diagram-viewport");
  await expect(page.locator('[data-sgs-node="Check"]')).toBeVisible();

  const initialTransform = await graphic.getAttribute("style");
  const initialGridSize = await viewport.evaluate((element) => element.style.backgroundSize);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(initialTransform);
  await expect.poll(() => viewport.evaluate((element) => element.style.backgroundSize)).not.toBe(initialGridSize);

  const afterButtonZoom = await graphic.getAttribute("style");
  await page.keyboard.press("Shift+1");
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(afterButtonZoom);
  const afterFit = await graphic.getAttribute("style");
  await page.keyboard.press("NumpadAdd");
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(afterFit);
  const afterHotkeyZoom = await graphic.getAttribute("style");

  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("The diagram preview has no visible bounds.");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(afterHotkeyZoom);

  await page.locator('summary[aria-label="Pan and zoom settings"]').click();
  await page.getByLabel("Scroll behavior").selectOption("pan");
  await expect(viewport).toHaveAttribute("aria-label", /Press H for hand/);
});

test("creates structured tabs only after every Mermaid block validates", async ({ page }) => {
  const result = JSON.stringify({
    overview: "flowchart LR\n  User --> Store",
    diagrams: [{ name: "Checkout", code: "flowchart TD\n  Cart --> Payment" }],
  });
  await page.route("**/chat/completions", async (route) => {
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: result } }] })}\n\ndata: [DONE]\n\n`;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Structure" }).click();
  await expect(page.getByRole("heading", { name: "Structured diagrams" })).toBeVisible();
  await expect(page.getByText("Checkout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Checkout" })).toBeVisible();
});

test("supports a narrow Code/Preview switch and disables node movement for sequences", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Code", exact: false })).toBeVisible();
  await page.getByLabel("Start from a template").selectOption({ label: "Sequence" });
  await expect(page.getByText(/sequence diagrams use automatic layout/i)).toBeVisible();
  await expect(page.locator("[data-sgs-node]")).toHaveCount(0);
  await page.getByRole("button", { name: "Code", exact: false }).click();
  await expect(page.getByRole("textbox", { name: "Mermaid diagram source" })).toBeVisible();
});

test("pans when dragging empty canvas space and preserves mindmap foreignObject labels", async ({ page }) => {
  await page.goto("/");
  const viewport = page.locator(".diagram-viewport");
  const graphic = page.locator(".diagram-graphic");
  await expect(page.locator('[data-sgs-node="Check"]')).toBeVisible();

  const beforePan = await graphic.getAttribute("style");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("The viewport has no visible bounds.");
  await page.mouse.move(box.x + 16, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + 76, box.y + 56, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => graphic.getAttribute("style")).not.toBe(beforePan);

  await page.getByLabel("Start from a template").selectOption({ label: "Mindmap" });
  await expect(page.locator(".diagram-graphic")).toContainText("Planning");
});

test("restores both Mermaid source and manual node layout from a share link", async ({ page }) => {
  const code = btoa("flowchart TD\n  A --> B");
  const layout = btoa(JSON.stringify({ A: { x: 180, y: 140 } }));
  await page.goto(`/#d=${encodeURIComponent(code)}&l=${encodeURIComponent(layout)}`);

  await expect(page.getByRole("tab", { name: "Shared diagram" })).toBeVisible();
  const nodeA = page.locator('[data-sgs-node="A"]');
  await expect(nodeA).toBeVisible();
  await expect(nodeA).not.toHaveAttribute("transform", "translate(0,0)");
});

test("arranges nodes into a grid with one click and undo restores the original layout", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Start from a template").selectOption({ label: "Class" });
  const dog = page.locator('[data-sgs-node="Dog"]');
  await expect(dog).toBeVisible();
  const initialTransform = await dog.getAttribute("transform");

  await page.getByRole("button", { name: "Arrange nodes in grid" }).click();
  await expect.poll(() => dog.getAttribute("transform")).not.toBe(initialTransform);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => dog.getAttribute("transform")).toBe(initialTransform);
});
