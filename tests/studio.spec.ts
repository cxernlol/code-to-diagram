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

test("shows the home page with Start and GitHub links and opens the diagram app on Start", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Code to diagram, or right-click to edit directly\./i })).toBeVisible();
  const githubLinks = page.getByRole("link", { name: /GitHub/i });
  await expect(githubLinks.first()).toHaveAttribute("href", "https://github.com/cxernlol/code-to-diagram");

  await page.getByRole("tab", { name: "SQL" }).click();
  await expect(page.locator(".home-preview-file")).toHaveText("schema.sql");
  await page.getByRole("button", { name: "Open SQL" }).click();
  await expect(page).toHaveURL(/#app$/);
  await expect(page.locator(".language-chip")).toHaveText("SQL DDL");

  await page.getByRole("button", { name: "CTD Studio home" }).click();
  await expect(page.getByRole("heading", { name: /Code to diagram, or right-click to edit directly\./i })).toBeVisible();

  await page.getByRole("button", { name: "Privacy & Cookies" }).click();
  await expect(page).toHaveURL(/#privacy$/);
  await expect(page.getByRole("heading", { name: /Privacy Policy \(No Cookies\)/i })).toBeVisible();
  await page.getByRole("button", { name: "Terms" }).click();
  await expect(page).toHaveURL(/#terms$/);
  await expect(page.getByRole("heading", { name: /Terms of Use/i })).toBeVisible();
  await page.getByRole("button", { name: "Back to home" }).click();
  await page.getByRole("button", { name: "Docs" }).first().click();
  await expect(page).toHaveURL(/#docs$/);
  await expect(page.getByRole("heading", { name: /Syntax & Template Docs/i })).toBeVisible();
  await expect(page.getByText("A -.-> B", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Graphviz DOT" }).click();
  await expect(page.locator(".docs-guide-split .docs-guide-code")).toContainText("digraph Architecture");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("complementary", { name: "Storage notice" })).toBeHidden();

  await page.locator(".home-cta-start").click();
  await expect(page).toHaveURL(/#app$/);
  await expect(page.locator(".diagram-graphic svg")).toBeVisible();
});

test("moves one flowchart node and keeps its connectors attached", async ({ page }) => {
  await page.goto("/#app");
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
  await page.goto("/#app");
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
  await page.goto("/#app");
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
  await page.goto("/#app");
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
  await page.goto("/#app");

  await expect(page.getByRole("tab", { name: "Legacy diagram" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mermaid diagram source" })).toContainText("Saved --> Work");
  expect(await page.evaluate(() => localStorage.getItem("mstudio2"))).toBe(legacy);
  await page.locator('summary[aria-label="Version history"]').click();
  await expect(page.getByText("Earlier edit")).toBeVisible();
});

test("zooms with the toolbar and wheel and keeps the dotted grid in sync", async ({ page }) => {
  await page.goto("/#app");
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
  await page.goto("/#app");
  await page.getByRole("button", { name: "Structure" }).click();
  await expect(page.getByRole("heading", { name: "Structured diagrams" })).toBeVisible();
  await expect(page.getByText("Checkout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Checkout" })).toBeVisible();
});

test("supports a narrow Code/Preview switch and disables node movement for sequences", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#app");
  await expect(page.getByRole("button", { name: "Code", exact: false })).toBeVisible();
  await page.getByLabel("Start from a template").selectOption({ label: "Sequence" });
  await expect(page.getByText(/sequence diagrams use automatic layout/i)).toBeVisible();
  await expect(page.locator("[data-sgs-node]")).toHaveCount(0);
  await page.getByRole("button", { name: "Code", exact: false }).click();
  await expect(page.getByRole("textbox", { name: "Mermaid diagram source" })).toBeVisible();
});

test("pans when dragging empty canvas space and preserves mindmap foreignObject labels", async ({ page }) => {
  await page.goto("/#app");
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

  const hostile = btoa(
    'flowchart TD\n  A["<script>alert(1)</script><img src=x onerror=alert(1)><animate attributeName=href to=javascript:alert(1)><set attributeName=href to=javascript:alert(1)>Safe"] --> B[Done]\n  click A "javascript:alert(1)"',
  );
  await page.goto(`/#d=${encodeURIComponent(hostile)}`);
  await expect(page.locator('[data-sgs-node="B"]')).toBeVisible();
  const unsafe = await page.locator(".diagram-graphic svg").evaluate((svg) => {
    const scripts = svg.querySelectorAll(
      "script, iframe, object, embed, animate, animateTransform, animateMotion, set, img",
    ).length;
    const inlineHandlers = Array.from(svg.querySelectorAll("*")).filter((el) =>
      Array.from(el.attributes).some((attr) => attr.name.toLowerCase().startsWith("on")),
    ).length;
    const jsLinks = Array.from(svg.querySelectorAll("[href], [xlink\\:href]")).filter((el) =>
      /^\s*javascript:/i.test(el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? ""),
    ).length;
    return { scripts, inlineHandlers, jsLinks };
  });
  expect(unsafe).toEqual({ scripts: 0, inlineHandlers: 0, jsLinks: 0 });
});

test("arranges nodes into a grid with one click and undo restores the original layout", async ({ page }) => {
  await page.goto("/#app");
  await page.getByLabel("Start from a template").selectOption({ label: "Class" });
  const dog = page.locator('[data-sgs-node="Dog"]');
  await expect(dog).toBeVisible();
  const initialTransform = await dog.getAttribute("transform");

  await page.getByRole("button", { name: "Arrange nodes in grid" }).click();
  await expect.poll(() => dog.getAttribute("transform")).not.toBe(initialTransform);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => dog.getAttribute("transform")).toBe(initialTransform);
});

test("selecting a theme preset updates primary, text, connector, and canvas colors", async ({ page }) => {
  await page.goto("/#app");
  await page.getByRole("button", { name: "Open settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Studio settings" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Theme").selectOption("forest");
  await expect(dialog.getByLabel("Primary color")).toHaveValue("#d8edd9");
  await expect(dialog.getByLabel("Node text")).toHaveValue("#163624");
  await expect(dialog.getByLabel("Connectors")).toHaveValue("#2d6a4f");
  await expect(dialog.getByLabel("Canvas")).toHaveValue("#f2f7f3");
});

test("expands preview pane, auto-focuses on grid layout, and enforces readable class diagram colors", async ({ page }) => {
  await page.goto("/#app");
  await page.getByLabel("Start from a template").selectOption({ label: "Class" });
  const animal = page.locator('[data-sgs-node="Animal"]');
  await expect(animal).toBeVisible();

  const colors = await animal.evaluate((node) => {
    const shape = node.querySelector<SVGElement>(".basic.label-container > path:first-child, rect");
    const text = node.querySelector<SVGElement>("text, tspan, .nodeLabel");
    return {
      fill: shape ? getComputedStyle(shape).fill : "",
      textFill: text ? getComputedStyle(text).fill : "",
    };
  });
  expect(colors.fill).toBe("rgb(255, 255, 255)");
  expect(colors.textFill).toBe("rgb(28, 52, 57)");

  const expandBtn = page.getByRole("button", { name: "Expand preview" });
  await expandBtn.click();
  await expect(page.getByRole("region", { name: "Mermaid editor" })).toBeHidden();
  await page.getByRole("button", { name: "Restore split view" }).click();
  await expect(page.getByRole("region", { name: "Mermaid editor" })).toBeVisible();

  const viewport = page.locator(".diagram-viewport");
  const vpBox = await viewport.boundingBox();
  if (!vpBox) throw new Error("Viewport has no bounds.");
  await page.mouse.move(vpBox.x + 20, vpBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(vpBox.x + 320, vpBox.y + 260, { steps: 4 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Arrange nodes in grid" }).click();
  const dogBox = await page.locator('[data-sgs-node="Dog"]').boundingBox();
  if (!dogBox) throw new Error("Dog node has no bounds.");
  expect(dogBox.x).toBeGreaterThanOrEqual(vpBox.x);
  expect(dogBox.y).toBeGreaterThanOrEqual(vpBox.y);
  expect(dogBox.x + dogBox.width).toBeLessThanOrEqual(vpBox.x + vpBox.width);
  expect(dogBox.y + dogBox.height).toBeLessThanOrEqual(vpBox.y + vpBox.height);
});

test("centers edge labels, supports movable lines, routes multi-class diagrams without spikes, and exports full SVG/PNG", async ({ page }) => {
  await page.goto("/#app");
  const checkNode = page.locator('[data-sgs-node="Check"]');
  await expect(checkNode).toBeVisible();

  const centering = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>(".diagram-graphic svg")!;
    const check = svg.querySelector<SVGGElement>('[data-sgs-node="Check"]')!;
    const checkRect = check.getBoundingClientRect();
    const checkCenterX = checkRect.left + checkRect.width / 2;

    const yesLabel = Array.from(svg.querySelectorAll<SVGGElement>("g.edgeLabel")).find(
      (el) => el.textContent?.trim() === "Yes",
    )!;
    const textRect = yesLabel.querySelector("text")!.getBoundingClientRect();
    const bgRect = yesLabel.querySelector("rect")!.getBoundingClientRect();
    const edgeControl = svg.querySelector<SVGGElement>('[data-sgs-edge^="edge::Check->"]')!;
    const edgeId = edgeControl.dataset.sgsEdge!;
    const targetId = edgeId.split("->")[1]!.split("::")[0]!;
    const edgePath = Array.from(
      svg.querySelectorAll<SVGPathElement>("path.flowchart-link"),
    ).find((p) => p.dataset.sgsSource === "Check" && p.dataset.sgsTarget === targetId)!;
    const ctm = edgePath.getScreenCTM()!;
    const startScreen = new DOMPoint(
      edgePath.getPointAtLength(0).x,
      edgePath.getPointAtLength(0).y,
    ).matrixTransform(ctm);

    return {
      textCenterOffsetX: Math.abs((textRect.left + textRect.width / 2) - (bgRect.left + bgRect.width / 2)),
      textCenterOffsetY: Math.abs((textRect.top + textRect.height / 2) - (bgRect.top + bgRect.height / 2)),
      unclippedWidth: bgRect.width >= textRect.width + 4,
      diamondExitOffsetX: Math.abs(startScreen.x - checkCenterX),
    };
  });
  expect(centering.textCenterOffsetX).toBeLessThan(1.5);
  expect(centering.textCenterOffsetY).toBeLessThan(1.5);
  expect(centering.unclippedWidth).toBe(true);
  expect(centering.diamondExitOffsetX).toBeLessThan(1.5);

  const edgeCtrl = page.locator('[data-sgs-edge]').first();
  const edgePath = page.locator(".diagram-graphic path.flowchart-link").first();
  const initialEdgeD = await edgePath.getAttribute("d");
  await edgeCtrl.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => edgePath.getAttribute("d")).not.toBe(initialEdgeD);
  await expectEdgeEndsAtNodes(edgePath);
  await page.keyboard.press("Control+z");
  await expect.poll(() => edgePath.getAttribute("d")).toBe(initialEdgeD);

  const ecommerceDiagram = [
    "classDiagram",
    "  class User {",
    "    -int id_user",
    "    +login()",
    "  }",
    "  class Customer {",
    "    +register()",
    "    +checkout()",
    "    +bayarPesanan()",
    "  }",
    "  class Admin {",
    "    +kelolaProduk()",
    "    +inputResi()",
    "  }",
    "  class Order {",
    "    -int id_order",
    "    +buatPesanan()",
    "  }",
    "  class Cart {",
    "    -int id_cart",
    "    +hitungTotal()",
    "  }",
    "  class CartItem {",
    "    -int id_cart_item",
    "    +tambahItem()",
    "  }",
    "  class Address {",
    "    -int id_address",
    "    +validasi()",
    "  }",
    "  class OrderItem {",
    "    -int id_order_item",
    "    +hitungSubtotal()",
    "  }",
    "  class Payment {",
    "    -int id_payment",
    "    +transaksi()",
    "  }",
    "  class Category {",
    "    -int id_category",
    "    +tambah()",
    "  }",
    "  class Product {",
    "    -int id_product",
    "    +ubahStok()",
    "  }",
    "  User <|-- Customer",
    "  User <|-- Admin",
    '  Customer "1" --> "1" Cart : memiliki',
    '  Customer "1" --> "0..*" Address : memiliki',
    '  Customer "1" --> "0..*" Order : membuat',
    '  Cart "1" *-- "0..*" CartItem : berisi',
    '  CartItem "0..*" --> "1" Product : merujuk',
    '  Order "0..*" --> "1" Address : dikirim ke',
    '  Order "1" *-- "1..*" OrderItem : terdiri dari',
    '  Order "1" --> "1" Payment : dibayar melalui',
    '  OrderItem "0..*" --> "1" Product : merujuk',
    '  Admin "1" --> "0..*" Category : mengelola',
    '  Category "1" --> "0..*" Product : mengelompokkan',
  ].join("\n");

  await page.locator('input[type="file"]').setInputFiles({
    name: "Ecommerce.mmd",
    mimeType: "text/plain",
    buffer: Buffer.from(ecommerceDiagram, "utf8"),
  });
  await expect(page.locator('[data-sgs-node="Product"]')).toBeVisible();

  await page.getByRole("button", { name: "Arrange nodes in grid" }).click();
  const routingCheck = await page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>(".diagram-graphic svg")!;
    const paths = Array.from(svg.querySelectorAll<SVGPathElement>("path.relation"));
    let spikes = 0;
    for (const p of paths) {
      const cmds = (p.getAttribute("d") ?? "")
        .trim()
        .split(/\s+/)
        .map((token) => {
          const [x, y] = token.replace(/^[ML]/, "").split(",").map(Number);
          return { x: x!, y: y! };
        });
      for (let i = 2; i < cmds.length; i += 1) {
        const a = cmds[i - 2]!;
        const b = cmds[i - 1]!;
        const c = cmds[i]!;
        const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
        if (dot < -0.01) spikes += 1;
      }
    }
    const labels = Array.from(svg.querySelectorAll<SVGGElement>("g.edgeLabel")).filter((l) =>
      Boolean(l.textContent?.trim()),
    );
    const unclippedLabels = labels.every((l) => {
      const t = l.querySelector("text")?.getBoundingClientRect();
      const r = l.querySelector("rect")?.getBoundingClientRect();
      return !t || !r || r.width >= t.width;
    });
    return { pathCount: paths.length, spikes, unclippedLabels };
  });
  expect(routingCheck.pathCount).toBe(13);
  expect(routingCheck.spikes).toBe(0);
  expect(routingCheck.unclippedLabels).toBe(true);

  const svgDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const svgDownload = await svgDownloadPromise;
  const svgPath = await svgDownload.path();
  expect(svgPath).toBeTruthy();
  const fs = await import("node:fs/promises");
  const exportedSvg = await fs.readFile(svgPath!, "utf8");
  const vbMatch = exportedSvg.match(/viewBox="([^"]+)"/);
  expect(vbMatch).toBeTruthy();
  const [, , vbW, vbH] = vbMatch![1]!.split(/\s+/).map(Number);
  expect(vbW).toBeGreaterThan(500);
  expect(vbH).toBeGreaterThan(500);
  expect(exportedSvg).not.toContain("sgs-edge-controls");
  expect(exportedSvg).toContain("Customer");
  expect(exportedSvg).toContain("Product");
  expect(exportedSvg).not.toContain("rgb(234, 241, 248)");

  await page.getByRole("button", { name: "Colorize boxes on export" }).click();
  const colorSvgPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const colorSvgDownload = await colorSvgPromise;
  const colorSvgPath = await colorSvgDownload.path();
  const colorExportedSvg = await fs.readFile(colorSvgPath!, "utf8");
  expect(colorExportedSvg).toContain("rgb(234, 241, 248)");
  expect(colorExportedSvg).toContain("rgb(230, 244, 234)");

  const pngDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const pngDownload = await pngDownloadPromise;
  const pngPath = await pngDownload.path();
  expect(pngPath).toBeTruthy();
  const pngBytes = await fs.readFile(pngPath!);
  expect(pngBytes[0]).toBe(0x89);
  expect(pngBytes[1]).toBe(0x50);
  const pngWidth = pngBytes.readUInt32BE(16);
  const pngHeight = pngBytes.readUInt32BE(20);
  expect(pngWidth).toBeGreaterThan(1000);
  expect(pngHeight).toBeGreaterThan(1000);

  await page.getByLabel("Start from a template").selectOption({ label: "Sequence" });
  await expect(page.locator(".diagram-graphic svg")).toContainText("DB");
  const seqSvgPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const seqSvgDownload = await seqSvgPromise;
  const seqSvgPath = await seqSvgDownload.path();
  const seqExportedSvg = await fs.readFile(seqSvgPath!, "utf8");
  const seqVb = seqExportedSvg.match(/viewBox="([^"]+)"/)![1]!.split(/\s+/).map(Number);
  const [seqVbX, , seqVbW] = seqVb as [number, number, number, number];
  const actorRects = [...seqExportedSvg.matchAll(/<rect[^>]*class="actor[^"]*"[^>]*>/g)].map((m) => {
    const x = Number(m[0].match(/\bx="([^"]+)"/)?.[1] ?? 0);
    const w = Number(m[0].match(/\bwidth="([^"]+)"/)?.[1] ?? 0);
    return { x, right: x + w };
  });
  expect(actorRects.length).toBeGreaterThanOrEqual(2);
  for (const rect of actorRects) {
    expect(rect.x).toBeGreaterThanOrEqual(seqVbX);
    expect(rect.right).toBeLessThanOrEqual(seqVbX + seqVbW);
  }
});

test("renders DOT, PlantUML, D2, SQL DDL, TypeScript, and XML code and translates between formats", async ({ page }) => {
  await page.goto("/#app");
  const cases = [
    { template: "DOT Graph", chip: "Graphviz DOT", text: "API Gateway", node: "API" },
    { template: "PlantUML Class", chip: "PlantUML", text: "Workspace", node: "Workspace" },
    { template: "D2 Flow", chip: "D2", text: "Compiler", node: "Compiler" },
    { template: "SQL Schema", chip: "SQL DDL", text: "projects" },
    { template: "TypeScript Types", chip: "TypeScript", text: "Diagram", node: "Diagram" },
    { template: "XML Diagram", chip: "XML", text: "API Gateway", node: "Gateway" },
  ];

  for (const item of cases) {
    await page.getByLabel("Start from a template").selectOption({ label: item.template });
    await expect(page.locator(".language-chip")).toHaveText(item.chip);
    await expect(page.locator(".diagram-graphic")).toContainText(item.text);
    if (item.node) {
      await expect(page.locator(`[data-sgs-node="${item.node}"]`)).toBeVisible();
    }
  }

  await page.getByLabel("Convert code format").selectOption("dot");
  await expect(page.locator(".language-chip")).toHaveText("Graphviz DOT");
  await expect(page.locator('[data-sgs-node="Gateway"]')).toBeVisible();

  await page.getByLabel("Convert code format").selectOption("typescript");
  await expect(page.locator(".language-chip")).toHaveText("TypeScript");
  await expect(page.locator('[data-sgs-node="Gateway"]')).toBeVisible();
});

test("hosts a live room via copy link up to 5 devices and ends room when host closes", async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const host = await context.newPage();
  await host.goto("/#app");
  await expect(host.locator('[data-sgs-node="Check"]')).toBeVisible();

  await host.getByRole("button", { name: "Host live room (max 5 devices)" }).click();
  await expect(host.getByText(/Hosting live room \(1\/5 devices\)/)).toBeVisible();
  const roomUrl = await host.evaluate(() => navigator.clipboard.readText());
  expect(roomUrl).toMatch(/#room=sgs-room-/);

  const guests = [];
  for (let i = 2; i <= 5; i += 1) {
    const guest = await context.newPage();
    await guest.goto(roomUrl);
    await expect(guest.getByText(new RegExp(`Connected to live room \\(${i}/5 devices\\)`))).toBeVisible();
    guests.push(guest);
  }
  await expect(host.getByText(/Hosting live room \(5\/5 devices\)/)).toBeVisible();

  const sixthDevice = await context.newPage();
  await sixthDevice.goto(roomUrl);
  await expect(sixthDevice.getByText(/Room is full \(maximum 5 devices\)/)).toBeVisible();
  await sixthDevice.close();

  await host.getByLabel("Start from a template").selectOption({ label: "Class" });
  await expect(guests[0]!.locator('[data-sgs-node="Animal"]')).toBeVisible({ timeout: 10000 });

  await host.close();
  await expect(guests[0]!.getByText(/Host closed the browser or ended the room/i)).toBeVisible();
  await expect(guests[0]!.getByRole("button", { name: "Arrange nodes in grid" })).toBeDisabled();
  await expect(guests[0]!.getByLabel("Convert code format")).toBeDisabled();
  await expect(guests[0]!.getByRole("button", { name: "Export SVG" })).toBeEnabled();
  await expect(guests[0]!.getByRole("button", { name: "Export PNG" })).toBeEnabled();
});

test("multi-selects nodes with Shift+click and box-select and drags them together", async ({ page }) => {
  await page.goto("/#app");
  const startNode = page.locator('[data-sgs-node="Start"]');
  const checkNode = page.locator('[data-sgs-node="Check"]');
  await expect(startNode).toBeVisible();
  await expect(checkNode).toBeVisible();

  const startBefore = await startNode.boundingBox();
  const checkBefore = await checkNode.boundingBox();
  expect(startBefore && checkBefore).toBeTruthy();

  // Shift+click both nodes
  await page.keyboard.down("Shift");
  await startNode.click();
  await checkNode.click();
  await page.keyboard.up("Shift");

  await expect(startNode).toHaveAttribute("data-selected", "true");
  await expect(checkNode).toHaveAttribute("data-selected", "true");

  // Drag Start node without Shift -> both Start and Check move together
  await page.mouse.move(startBefore!.x + startBefore!.width / 2, startBefore!.y + startBefore!.height / 2);
  await page.mouse.down();
  await page.mouse.move(startBefore!.x + startBefore!.width / 2 + 80, startBefore!.y + startBefore!.height / 2 + 40, { steps: 6 });
  await page.mouse.up();

  await expect.poll(async () => (await startNode.boundingBox())!.x).toBeGreaterThan(startBefore!.x + 40);
  await expect.poll(async () => (await checkNode.boundingBox())!.x).toBeGreaterThan(checkBefore!.x + 40);

  // Escape clears selection, then Shift+drag box-selects Start and Check
  await page.keyboard.press("Escape");
  await expect(startNode).not.toHaveAttribute("data-selected", "true");

  const startAfter = await startNode.boundingBox();
  const checkAfter = await checkNode.boundingBox();
  const minX = Math.min(startAfter!.x, checkAfter!.x) - 15;
  const minY = Math.min(startAfter!.y, checkAfter!.y) - 15;
  const maxX = Math.max(startAfter!.x + startAfter!.width, checkAfter!.x + checkAfter!.width) + 15;
  const maxY = Math.max(startAfter!.y + startAfter!.height, checkAfter!.y + checkAfter!.height) + 15;

  await page.keyboard.down("Shift");
  await page.mouse.move(minX, minY);
  await page.mouse.down();
  await page.mouse.move(maxX, maxY, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");

  await expect(startNode).toHaveAttribute("data-selected", "true");
  await expect(checkNode).toHaveAttribute("data-selected", "true");
});

test("colorize boxes toggle applies live palette preview and restores on toggle off", async ({ page }) => {
  await page.goto("/#app");
  const nodeShape = page.locator('[data-sgs-node="Check"] .label-container, [data-sgs-node="Check"] polygon').first();
  await expect(nodeShape).toBeVisible();

  const initialInlineFill = await nodeShape.evaluate((el) => (el as SVGElement).style.fill);
  expect(initialInlineFill).toBe("");

  const colorizeBtn = page.getByRole("button", { name: "Colorize boxes on export" });
  await colorizeBtn.click();
  await expect(colorizeBtn).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => nodeShape.evaluate((el) => (el as SVGElement).style.fill))
    .not.toBe("");

  await colorizeBtn.click();
  await expect(colorizeBtn).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => nodeShape.evaluate((el) => (el as SVGElement).style.fill))
    .toBe("");
});

test("canvas context menu edits node and edge labels across diagram types and adds items", async ({ page }) => {
  await page.goto("/#app");
  const checkNode = page.locator('[data-sgs-node="Check"]');
  await expect(checkNode).toBeVisible();

  // Flowchart node label edit
  await checkNode.click({ button: "right" });
  const menu = page.locator(".canvas-context-menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Node label").fill("Ready?");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(checkNode).toContainText("Ready?");

  // Flowchart edge label edit
  const edgeLabel = page.locator("g.edgeLabel[data-sgs-edge-id]").first();
  await expect(edgeLabel).toBeVisible();
  await edgeLabel.click({ button: "right", force: true });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Edge label").fill("approved");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("g.edgeLabel", { hasText: "approved" })).toBeVisible();

  // Canvas right-click -> Add node, then right-click Node1 -> Change shape
  await expect(page.getByRole("button", { name: "Copy share link" })).toHaveCount(0);
  await page.locator(".diagram-viewport").click({ button: "right", position: { x: 16, y: 16 } });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Add node" }).click();
  const node1 = page.locator('[data-sgs-node="Node1"]');
  await expect(node1).toBeVisible();
  await node1.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Change shape…" }).click();
  await menu.getByRole("menuitem", { name: "Diamond" }).click();
  await expect(node1.locator("polygon")).toBeVisible();

  // Class diagram node label edit & Add class
  await page.getByLabel("Start from a template").selectOption({ label: "Class" });
  const animalNode = page.locator('[data-sgs-node="Animal"]');
  await expect(animalNode).toBeVisible({ timeout: 10000 });
  await animalNode.click({ button: "right" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await expect(menu.getByLabel("Node label")).toHaveValue("Animal");
  await menu.getByLabel("Node label").fill("Creature");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(animalNode).toContainText("Creature");

  const memberEl = animalNode.locator(".members-group .label").first();
  await memberEl.click({ button: "right" });
  await menu.getByRole("menuitem", { name: /Hide "\+String name" \(suppress\)/ }).click();
  await expect(animalNode).not.toContainText("+String name");

  await animalNode.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Hide class (suppress)" }).click();
  await expect(animalNode).toBeHidden();
  await page.locator(".diagram-viewport").click({ button: "right", position: { x: 16, y: 16 } });
  await menu.getByRole("menuitem", { name: "Show hidden nodes" }).click();
  await expect(animalNode).toBeVisible();
  await expect(animalNode).toContainText("+String name");

  await page.locator(".diagram-viewport").click({ button: "right", position: { x: 16, y: 16 } });
  await menu.getByRole("menuitem", { name: "Add class" }).click();
  await expect(page.locator('[data-sgs-node="Class1"]')).toBeVisible();

  // State diagram node/edge label edit & Add state
  await page.getByLabel("Start from a template").selectOption({ label: "State" });
  const idleNode = page.locator('[data-sgs-node="Idle"]');
  await expect(idleNode).toBeVisible({ timeout: 10000 });
  await idleNode.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Node label").fill("Waiting");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(idleNode).toContainText("Waiting");

  const stateEdgeLabel = page.locator("g.edgeLabel[data-sgs-edge-id]", { hasText: "start()" });
  await expect(stateEdgeLabel).toBeVisible();
  await stateEdgeLabel.click({ button: "right", force: true });
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Edge label").fill("begin()");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("g.edgeLabel", { hasText: "begin()" })).toBeVisible();

  await page.locator(".diagram-viewport").click({ button: "right", position: { x: 16, y: 16 } });
  await menu.getByRole("menuitem", { name: "Add state" }).click();
  await expect(page.locator('[data-sgs-node="State1"]')).toBeVisible();

  // ER diagram node/edge label edit & Add entity
  await page.getByLabel("Start from a template").selectOption({ label: "ER" });
  const userNode = page.locator('[data-sgs-node="USER"]');
  await expect(userNode).toBeVisible({ timeout: 10000 });
  await userNode.click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Node label").fill("Account");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(userNode).toContainText("Account");

  const erEdgeLabel = page.locator("g.edgeLabel[data-sgs-edge-id]", { hasText: "places" });
  await expect(erEdgeLabel).toBeVisible();
  await erEdgeLabel.click({ button: "right", force: true });
  await menu.getByRole("menuitem", { name: "Edit label…" }).click();
  await menu.getByLabel("Edge label").fill("submits");
  await menu.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("g.edgeLabel", { hasText: "submits" })).toBeVisible();

  await page.locator(".diagram-viewport").click({ button: "right", position: { x: 16, y: 16 } });
  await menu.getByRole("menuitem", { name: "Add entity" }).click();
  await expect(page.locator('[data-sgs-node="ENTITY1"]')).toBeVisible();
});

const XSS_MERMAID_PAYLOAD = [
  "flowchart TD",
  `  A["<foreignObject><img src=x onerror='window.__xss=1'><script>window.__xss=2</script></foreignObject>"] --> B["<a href='javascript:window.__xss=3'>js</a>"]`,
  `  B --> C["<a xlink:href='data:text/html,<script>window.__xss=4</script>'>data</a>"]`,
  `  C --> D["<animate onbegin='window.__xss=5'/><set attributeName='onmouseover' to='window.__xss=6'/>"]`,
  `  D --> E["SafeText"]`,
].join("\n");

async function assertSvgSanitized(page: import("@playwright/test").Page) {
  const result = await page.evaluate(() => {
    const svg = document.querySelector(".diagram-graphic svg");
    if (!svg) return { hasSvg: false };
    const dangerous = svg.querySelectorAll(
      "script, iframe, object, embed, animate, animateTransform, animateMotion, set, img, [onerror], [onload], [onbegin], [onmouseover]",
    );
    const badHrefs = Array.from(svg.querySelectorAll("[href], [xlink\\:href]")).filter((el) => {
      const val = (el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? "").trim();
      return val !== "" && !val.startsWith("#");
    });
    return {
      hasSvg: true,
      xss: (window as unknown as { __xss?: unknown }).__xss ?? null,
      dangerousCount: dangerous.length,
      badHrefCount: badHrefs.length,
    };
  });
  expect(result.hasSvg).toBe(true);
  expect(result.xss).toBeNull();
  expect(result.dangerousCount).toBe(0);
  expect(result.badHrefCount).toBe(0);
}

test("sanitizes malicious #d= share links and .mmd/.md imports against SVG XSS", async ({ page }) => {
  const encoded = Buffer.from(XSS_MERMAID_PAYLOAD, "utf8").toString("base64");
  await page.goto(`/#d=${encodeURIComponent(encoded)}`);
  await expect(page.locator(".diagram-graphic svg")).toBeVisible();
  await assertSvgSanitized(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: "malicious.mmd",
    mimeType: "text/plain",
    buffer: Buffer.from(XSS_MERMAID_PAYLOAD, "utf8"),
  });
  await expect(page.locator(".diagram-graphic svg")).toBeVisible();
  await assertSvgSanitized(page);

  const mdPayload = `# Diagram\n\n\`\`\`mermaid\n${XSS_MERMAID_PAYLOAD}\n\`\`\`\n`;
  await page.locator('input[type="file"]').setInputFiles({
    name: "malicious.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(mdPayload, "utf8"),
  });
  await expect(page.locator(".diagram-graphic svg")).toBeVisible();
  await assertSvgSanitized(page);

  const xxeXml = '<!DOCTYPE lolz [<!ENTITY lol "lol">]><diagram><node id="A" label="&lol;"/></diagram>';
  await page.locator('input[type="file"]').setInputFiles({
    name: "xxe.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(`\`\`\`mermaid\n${xxeXml}\n\`\`\``, "utf8"),
  });
  await expect(page.getByText(/DOCTYPE and ENTITY/i)).toBeVisible();
});

test("sanitizes live-room XSS payloads and enforces 512 KB and layout bounds", async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const host = await context.newPage();
  await host.goto("/#app");
  await expect(host.locator('[data-sgs-node="Check"]')).toBeVisible();

  await host.getByRole("button", { name: "Host live room (max 5 devices)" }).click();
  await expect(host.getByText(/Hosting live room \(1\/5 devices\)/)).toBeVisible();
  const roomUrl = await host.evaluate(() => navigator.clipboard.readText());
  const roomId = new URL(roomUrl).hash.slice("#room=".length);

  const guest = await context.newPage();
  await guest.goto(roomUrl);
  await expect(guest.getByText(/Connected to live room \(2\/5 devices\)/)).toBeVisible();

  // Inject XSS payload via BroadcastChannel sync message
  await host.evaluate(
    ({ id, code }) => {
      const ch = new BroadcastChannel(`sgs-room-${id}`);
      ch.postMessage({
        type: "sync",
        name: "Injected",
        code,
        layout: {},
        devices: 2,
      });
      ch.close();
    },
    { id: roomId, code: XSS_MERMAID_PAYLOAD },
  );

  await expect(guest.locator('[data-sgs-node="E"]')).toBeVisible({ timeout: 10000 });
  await assertSvgSanitized(guest);

  // Send layout with out-of-bounds, NaN, and valid coordinates
  await host.evaluate(
    ({ id, code }) => {
      const ch = new BroadcastChannel(`sgs-room-${id}`);
      ch.postMessage({
        type: "sync",
        name: "Injected",
        code,
        layout: {
          A: { x: 1e9, y: 50 },
          B: { x: 480, y: 420 },
          C: { x: Number.NaN, y: 20 },
        },
        devices: 2,
      });
      ch.close();
    },
    { id: roomId, code: XSS_MERMAID_PAYLOAD },
  );

  // Verify out-of-bounds A was ignored while valid B was kept
  await expect(guest.locator('[data-sgs-node="B"]')).not.toHaveAttribute("transform", "translate(0,0)");
  await expect(guest.locator('[data-sgs-node="A"]')).toHaveAttribute("transform", "translate(0,0)");

  // Oversized (> 512 KB) sync message must be rejected
  await host.evaluate((id) => {
    const ch = new BroadcastChannel(`sgs-room-${id}`);
    ch.postMessage({
      type: "sync",
      name: "Oversized",
      code: `flowchart TD\n${"  X --> Y\n".repeat(60000)}`,
      layout: {},
      devices: 2,
    });
    ch.close();
  }, roomId);

  // Guest should still display E from the previous valid diagram, not X/Y
  await guest.waitForTimeout(300);
  await expect(guest.locator('[data-sgs-node="E"]')).toBeVisible();
});

test("preserves prefix-like user node IDs without collisions and respects data-id", async ({ page }) => {
  const code = btoa(
    "flowchart TD\n  node-1[Node One] --> 1[One]\n  state-A[State A] --> A[Just A]\n  node-Check[Node Check] --> Check[Just Check]",
  );
  await page.goto(`/#d=${encodeURIComponent(code)}`);

  for (const id of ["node-1", "1", "state-A", "A", "node-Check", "Check"]) {
    await expect(page.locator(`[data-sgs-node="${id}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-sgs-node="${id}"]`)).toBeVisible();
  }

  const node1 = page.locator('[data-sgs-node="node-1"]');
  const plain1 = page.locator('[data-sgs-node="1"]');
  const box = await node1.boundingBox();
  if (!box) throw new Error("node-1 has no visible bounding box.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();

  await expect(node1).not.toHaveAttribute("transform", "translate(0,0)");
  await expect(plain1).toHaveAttribute("transform", "translate(0,0)");

  const compositeState = btoa(
    "stateDiagram-v2\n  [*] --> Active\n  state Active {\n    [*] --> Running\n  }",
  );
  await page.goto("about:blank");
  await page.goto(`/#d=${encodeURIComponent(compositeState)}`);
  await expect(page.locator('[data-sgs-node="Active"]')).toHaveCount(1);
  await expect(page.locator('[data-sgs-node="Running"]')).toHaveCount(1);

  const classDiagram = btoa("classDiagram\n  class classId-Foo\n  class Foo\n  classId-Foo --> Foo");
  await page.goto("about:blank");
  await page.goto(`/#d=${encodeURIComponent(classDiagram)}`);
  await expect(page.locator('[data-sgs-node="classId-Foo"]')).toHaveCount(1);
  await expect(page.locator('[data-sgs-node="Foo"]')).toHaveCount(1);

  const erDiagram = btoa("erDiagram\n  entity-Item ||--o{ Item : contains");
  await page.goto("about:blank");
  await page.goto(`/#d=${encodeURIComponent(erDiagram)}`);
  await expect(page.locator('[data-sgs-node="entity-Item"]')).toHaveCount(1);
  await expect(page.locator('[data-sgs-node="Item"]')).toHaveCount(1);
});
