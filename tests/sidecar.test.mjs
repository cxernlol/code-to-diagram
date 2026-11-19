import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { after, before } from "node:test";
import { createServer } from "vite";

let viteServer;
let sidecar;
let exportMod;
let layoutKeys;

before(async () => {
  viteServer = await createServer({
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
  });
  sidecar = await viteServer.ssrLoadModule("/src/lib/sidecar.ts");
  exportMod = await viteServer.ssrLoadModule("/src/export.ts");
  layoutKeys = await viteServer.ssrLoadModule("/src/lib/layoutKeys.ts");
});

after(async () => {
  await viteServer?.close();
});

test("schema/ctd-sidecar.v1.json matches sidecar constants", () => {
  const schemaPath = path.resolve("schema/ctd-sidecar.v1.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.equal(schema.properties.version.const, sidecar.SIDECAR_VERSION);
  assert.equal(schema.properties.layout.maxProperties, sidecar.MAX_LAYOUT_ENTRIES);
  assert.equal(schema.properties.layout.propertyNames.maxLength, sidecar.MAX_LAYOUT_KEY_LENGTH);
  assert.equal(schema.$defs.position.properties.x.maximum, sidecar.MAX_LAYOUT_COORD);
  assert.equal(schema.$defs.position.properties.x.minimum, -sidecar.MAX_LAYOUT_COORD);
});

test("serializeSidecar and parseSidecar round-trip nodes, edge anchors, and meta", () => {
  const layout = {
    A: { x: 120.5, y: -40 },
    B: { x: 400, y: 200 },
    "A-B-0::start": { x: 160, y: 0 },
    "A-B-0::end": { x: 360, y: 180 },
  };
  const meta = {
    generatedFrom: "architecture.mmd",
    sha256: "A".repeat(64),
    updatedAt: "2026-11-19T00:00:00.000Z",
  };

  const json = sidecar.serializeSidecar(layout, meta);
  const parsed = sidecar.parseSidecar(json);

  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.layout, layout);
  assert.deepEqual(parsed.meta, {
    generatedFrom: "architecture.mmd",
    sha256: "a".repeat(64),
    updatedAt: "2026-11-19T00:00:00.000Z",
  });
});

test("parseSidecar supports empty layout and omitted meta", () => {
  const json = sidecar.serializeSidecar({});
  const parsed = sidecar.parseSidecar(json);
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.layout, {});
  assert.equal("meta" in parsed, false);
});

test("parseSidecar rejects malformed JSON, wrong version, and non-object layout", () => {
  assert.throws(() => sidecar.parseSidecar("{not json"), /Invalid CTD sidecar JSON/);
  assert.throws(() => sidecar.parseSidecar("[]"), /expected a JSON object/);
  assert.throws(() => sidecar.parseSidecar(JSON.stringify({ layout: {} })), /Unsupported CTD sidecar version: missing/);
  assert.throws(() => sidecar.parseSidecar(JSON.stringify({ version: 2, layout: {} })), /Unsupported CTD sidecar version: 2/);
  assert.throws(() => sidecar.parseSidecar(JSON.stringify({ version: 1, layout: [] })), /"layout" must be an object/);
  assert.throws(() => sidecar.parseSidecar(JSON.stringify({ version: 1, layout: null })), /"layout" must be an object/);
});

test("parseLayoutRecord enforces room security and bounds limits", () => {
  assert.equal(sidecar.parseLayoutRecord(null), null);
  assert.equal(sidecar.parseLayoutRecord([]), null);
  assert.equal(sidecar.parseLayoutRecord("bad"), null);

  const maxId = "n".repeat(256);
  const overId = "n".repeat(257);
  const hostile = JSON.parse(
    `{
      "__proto__": {"x": 1, "y": 2},
      "constructor": {"x": 1, "y": 2},
      "prototype": {"x": 1, "y": 2},
      "": {"x": 1, "y": 2},
      "${overId}": {"x": 1, "y": 2},
      "${maxId}": {"x": 100000, "y": -100000},
      "tooBig": {"x": 100001, "y": 0},
      "tooSmall": {"x": 0, "y": -100001},
      "strCoord": {"x": "10", "y": 20},
      "missingY": {"x": 10},
      "arrayPos": [10, 20],
      "ok": {"x": 12, "y": 34}
    }`,
  );

  const sanitized = sidecar.parseLayoutRecord(hostile);
  assert.deepEqual(sanitized, {
    [maxId]: { x: 100000, y: -100000 },
    ok: { x: 12, y: 34 },
  });
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, "constructor"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, "prototype"), false);

  // Non-finite numbers are stripped
  assert.deepEqual(
    sidecar.parseLayoutRecord({
      badNaN: { x: Number.NaN, y: 1 },
      badInf: { x: 1, y: Number.POSITIVE_INFINITY },
      good: { x: 0, y: 0 },
    }),
    { good: { x: 0, y: 0 } },
  );

  // Entry cap at 5000
  const large = {};
  for (let i = 0; i < 5050; i += 1) {
    large[`node_${i}`] = { x: i, y: i };
  }
  const capped = sidecar.parseLayoutRecord(large);
  assert.equal(Object.keys(capped).length, 5000);
});

test("createShareHash and getSharedPayload share sidecar layout rules and URL encoding", () => {
  const code = "flowchart LR\n  A[Start 🎉] --> B[End]";
  const layout = {
    A: { x: 10, y: 20 },
    B: { x: 250, y: 20 },
    "A-B-0::start": { x: 60, y: 20 },
    "A-B-0::end": { x: 200, y: 20 },
  };

  const hashWithLayout = exportMod.createShareHash(code, layout);
  const payload = exportMod.getSharedPayload(hashWithLayout);
  assert.ok(payload);
  assert.equal(payload.code, code);

  const fromSidecar = sidecar.parseSidecar(sidecar.serializeSidecar(layout));
  assert.deepEqual(payload.layout, fromSidecar.layout);

  // Empty layout and no-layout share hashes should both URL-encode #d= and decode cleanly
  const hashEmpty = exportMod.createShareHash(code, {});
  const hashNone = exportMod.createShareHash(code);
  assert.equal(hashEmpty, hashNone);
  assert.equal(hashNone.includes("&l="), false);
  assert.deepEqual(exportMod.getSharedPayload(hashNone), { code, layout: {} });

  // Invalid or hostile layout entries in #d= are sanitized identically
  const hostile = JSON.parse(`{"__proto__":{"x":1,"y":2},"ok":{"x":5,"y":6},"bad":{"x":999999,"y":0}}`);
  const encodedCode = encodeURIComponent(Buffer.from(code, "utf8").toString("base64"));
  const encodedHostileLayout = encodeURIComponent(
    Buffer.from(JSON.stringify(hostile), "utf8").toString("base64"),
  );
  const restored = exportMod.getSharedPayload(`#d=${encodedCode}&l=${encodedHostileLayout}`);
  assert.deepEqual(restored, { code, layout: { ok: { x: 5, y: 6 } } });

  // Corrupt l= falls back to empty layout
  assert.deepEqual(exportMod.getSharedPayload(`#d=${encodedCode}&l=%%%`), { code, layout: {} });
  assert.equal(exportMod.getSharedPayload("#room=abc"), undefined);
});

test("sidecarFilename and edge anchor helpers format expected keys", () => {
  assert.equal(sidecar.sidecarFilename("architecture.mmd"), "architecture.ctd.json");
  assert.equal(sidecar.sidecarFilename("docs/flow.mmd"), "docs/flow.ctd.json");
  assert.equal(sidecar.sidecarFilename("diagram"), "diagram.ctd.json");
  assert.equal(sidecar.sidecarFilename("flow.ctd.json"), "flow.ctd.json");
  assert.equal(sidecar.sidecarFilename("  "), "diagram.ctd.json");

  assert.equal(sidecar.edgeAnchorKey("e1", "start"), "e1::start");
  assert.equal(sidecar.edgeAnchorKey("e1", "end"), "e1::end");
  assert.equal(sidecar.isEdgeAnchorKey("e1::start"), true);
  assert.equal(sidecar.isEdgeAnchorKey("e1::end"), true);
  assert.equal(sidecar.isEdgeAnchorKey("::start"), false);
  assert.equal(sidecar.isEdgeAnchorKey("nodeA"), false);
});

test("parseSidecar ignores unknown/invalid meta and emits optional warnings", () => {
  const warnings = [];
  const parsed = sidecar.parseSidecar(
    {
      version: 1,
      layout: { A: { x: 10, y: 20 } },
      meta: {
        generatedFrom: "flow.mmd",
        sha256: "bad-hash",
        extraField: "hello",
      },
    },
    { onWarning: (w) => warnings.push(w) },
  );
  assert.deepEqual(parsed.meta, { generatedFrom: "flow.mmd" });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /Unknown sidecar meta key "extraField"/);
  assert.match(warnings[1], /Invalid sidecar meta\.sha256/);
});

test("layoutKeys helpers build valid key sets, trim layouts, and partition orphans", () => {
  const ir = {
    kind: "flowchart",
    direction: "LR",
    nodes: [
      { id: "A", label: "Start" },
      { id: "B", label: "End" },
    ],
    edges: [{ from: "A", to: "B" }],
  };
  const valid = layoutKeys.validLayoutKeysFromIR(ir);
  const edgeId = layoutKeys.edgeLayoutId("A", "B", 0);
  assert.equal(valid.has("A"), true);
  assert.equal(valid.has("B"), true);
  assert.equal(valid.has(edgeId), true);
  assert.equal(valid.has(`${edgeId}::start`), true);
  assert.equal(valid.has(`${edgeId}::end`), true);

  const layout = {
    A: { x: 10, y: 20 },
    [`${edgeId}::end`]: { x: 30, y: 40 },
    GhostNode: { x: 99, y: 99 },
  };
  const trimmed = layoutKeys.trimLayoutToValidKeys(layout, valid);
  assert.deepEqual(trimmed, {
    A: { x: 10, y: 20 },
    [`${edgeId}::end`]: { x: 30, y: 40 },
  });

  const partitioned = layoutKeys.partitionLayoutKeys(layout, valid);
  assert.deepEqual(partitioned.preserved, trimmed);
  assert.deepEqual(partitioned.orphaned, ["GhostNode"]);
  assert.deepEqual(partitioned.orphanedEntries, { GhostNode: { x: 99, y: 99 } });
});
