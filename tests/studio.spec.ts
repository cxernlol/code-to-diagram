import { expect, test } from "@playwright/test";

test("moves one flowchart node and keeps its connectors attached", async ({ page }) => {
  await page.goto("/");
  const node = page.locator('[data-sgs-node="Check"]');
  await expect(node).toBeVisible();
  await expect(page.getByText("flowchart", { exact: true })).toBeVisible();

  const beforeTransform = await node.getAttribute("transform");
  const edge = page.locator("g.edgePath path").first();
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
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-sgs-node="Check"]')).toHaveAttribute("transform", movedTransform ?? "");
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
  await page.getByRole("button", { name: "Version history" }).click();
  await expect(page.getByText("Earlier edit")).toBeVisible();
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
