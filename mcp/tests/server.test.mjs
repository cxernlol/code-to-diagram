import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import test, { after, before } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_BIN = resolve(import.meta.dirname, "../dist/index.js");

let client;
let transport;

before(async () => {
  transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_BIN],
    stderr: "pipe",
  });
  client = new Client(
    { name: "ctd-mcp-test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
});

after(async () => {
  await transport?.close();
});

test("CLI --version and --help work cleanly", () => {
  const versionOut = execFileSync(process.execPath, [SERVER_BIN, "--version"], {
    encoding: "utf8",
  }).trim();
  assert.match(versionOut, /^\d+\.\d+\.\d+/);

  const helpOut = execFileSync(process.execPath, [SERVER_BIN, "--help"], {
    encoding: "utf8",
  });
  assert.match(helpOut, /ctd-mcp/);
  assert.match(helpOut, /stdio/);
});

test("lists expected tools, resources, resource templates, and prompts", async () => {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((t) => t.name).sort();
  assert.deepEqual(toolNames, [
    "detect_format",
    "emit_from_ir",
    "get_studio_info",
    "list_templates",
    "parse_diagram_ir",
    "to_mermaid",
    "translate_format",
  ]);

  const resources = await client.listResources();
  const uris = resources.resources.map((r) => r.uri);
  assert.ok(uris.includes("ctd://formats"));
  assert.ok(uris.includes("ctd://themes"));
  assert.ok(uris.includes("ctd://templates/Flowchart"));

  const templates = await client.listResourceTemplates();
  assert.equal(templates.resourceTemplates[0]?.uriTemplate, "ctd://templates/{name}");

  const prompts = await client.listPrompts();
  assert.deepEqual(
    prompts.prompts.map((p) => p.name),
    ["code_to_diagram"],
  );
});

test("detect_format identifies all 7 supported formats", async () => {
  const samples = [
    ["flowchart TD\n  A --> B", "mermaid", "flowchart"],
    ["digraph G { A -> B; }", "dot", "flowchart"],
    ["@startuml\nAlice -> Bob: Hi\n@enduml", "plantuml", "sequence"],
    ["api -> db: query", "d2", "flowchart"],
    ["CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));", "sql", "er"],
    ["export interface User { id: string; name: string; }", "typescript", "class"],
    ['<diagram><node id="a" label="A"/><edge from="a" to="b"/></diagram>', "xml", "flowchart"],
  ];

  for (const [source, expectedFormat, expectedType] of samples) {
    const res = await client.callTool({
      name: "detect_format",
      arguments: { source },
    });
    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.format, expectedFormat);
    assert.equal(data.diagramType, expectedType);
  }
});

test("to_mermaid converts DOT, PlantUML, D2, SQL, TypeScript, and XML (explicit, Draw.io, BPMN, generic)", async () => {
  const cases = [
    {
      name: "DOT",
      source: 'digraph G { rankdir=LR; start [label="Begin"]; start -> done [label="ok"]; }',
      expectMatch: /flowchart LR[\s\S]*start\["Begin"\][\s\S]*-->\|ok\| done/,
    },
    {
      name: "PlantUML",
      source: "@startuml\nAlice -> Bob: Hello\nBob --> Alice: Hi\n@enduml",
      expectMatch: /sequenceDiagram[\s\S]*Alice ->> Bob: Hello[\s\S]*Bob -->> Alice: Hi/,
    },
    {
      name: "PlantUML Class Multiplicity",
      source: '@startuml\nclass Account\nclass Workspace\nAccount "1" --> "*" Workspace : owns\n@enduml',
      expectMatch: /classDiagram[\s\S]*Account "1" --> "\*" Workspace : owns/,
    },
    {
      name: "D2",
      source: "direction: right\napi -> db: query\ndb.shape: cylinder",
      expectMatch: /flowchart LR[\s\S]*db\[\("db"\)\][\s\S]*api -->\|query\| db/,
    },
    {
      name: "SQL",
      source: "CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));",
      expectMatch: /erDiagram[\s\S]*users \|\|--o\{ orders/,
    },
    {
      name: "TypeScript",
      source: "interface Account { id: string; owner: User; } interface User { id: string; }",
      expectMatch: /classDiagram[\s\S]*class Account[\s\S]*Account --> User : owner/,
    },
    {
      name: "Explicit XML",
      source:
        '<diagram direction="LR"><nodes><node id="api" label="API" shape="diamond"/><node id="db" label="DB"/></nodes><edges><edge from="api" to="db" label="read" dashed="true"/></edges></diagram>',
      expectMatch: /flowchart LR[\s\S]*api\{"API"\}[\s\S]*-\.->\|read\| db/,
    },
    {
      name: "Draw.io mxGraphModel XML",
      source:
        '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="n1" value="Start" vertex="1" style="ellipse"/><mxCell id="n2" value="End" vertex="1"/><mxCell id="e1" value="go" edge="1" source="n1" target="n2"/></root></mxGraphModel>',
      expectMatch: /flowchart TD[\s\S]*n1\(\("Start"\)\)[\s\S]*-->\|go\| n2/,
    },
    {
      name: "BPMN XML",
      source:
        '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="p1"><startEvent id="s1" name="Start"/><userTask id="t1" name="Review"/><sequenceFlow id="f1" sourceRef="s1" targetRef="t1" name="submit"/></process></definitions>',
      expectMatch: /flowchart TD[\s\S]*s1\(\("Start"\)\)[\s\S]*-->\|submit\| t1/,
    },
    {
      name: "Generic XML tree",
      source: "<app><service name=\"Auth\"><store>Redis</store></service></app>",
      expectMatch: /flowchart TD[\s\S]*Auth[\s\S]*store: Redis/,
    },
  ];

  for (const c of cases) {
    const res = await client.callTool({
      name: "to_mermaid",
      arguments: { source: c.source },
    });
    assert.equal(res.isError, undefined, `${c.name} should not error`);
    assert.match(res.content[0].text, c.expectMatch, `${c.name} output mismatch`);
  }
});

test("translate_format translates between formats", async () => {
  const res = await client.callTool({
    name: "translate_format",
    arguments: {
      source: "flowchart LR\n  A[Client] -->|HTTP| B[Server]",
      targetFormat: "d2",
    },
  });
  assert.equal(res.isError, undefined);
  assert.match(res.content[0].text, /direction: right/);
  assert.match(res.content[0].text, /A -> B: HTTP/);
});

test("parse_diagram_ir and emit_from_ir round-trip cleanly", async () => {
  const parsed = await client.callTool({
    name: "parse_diagram_ir",
    arguments: {
      source: "flowchart TD\n  Start([Start]) --> Check{Valid?}\n  Check -->|Yes| Done[Done]",
    },
  });
  assert.equal(parsed.isError, undefined);
  const { ir } = JSON.parse(parsed.content[0].text);
  assert.equal(ir.kind, "flowchart");
  assert.equal(ir.direction, "TD");
  assert.equal(ir.nodes.length, 3);
  assert.equal(ir.edges.length, 2);

  const emitted = await client.callTool({
    name: "emit_from_ir",
    arguments: { ir, targetFormat: "dot" },
  });
  assert.equal(emitted.isError, undefined);
  assert.match(emitted.content[0].text, /digraph Diagram/);
  assert.match(emitted.content[0].text, /Check -> Done \[label="Yes"\]/);
});

test("list_templates, get_studio_info, resources, and prompts work", async () => {
  const allTemplates = await client.callTool({
    name: "list_templates",
    arguments: {},
  });
  assert.equal(allTemplates.isError, undefined);
  const parsedTemplates = JSON.parse(allTemplates.content[0].text);
  assert.ok(parsedTemplates.templates.length >= 4);

  const oneTemplate = await client.callTool({
    name: "list_templates",
    arguments: { name: "flowchart" },
  });
  assert.equal(oneTemplate.isError, undefined);
  assert.match(oneTemplate.content[0].text, /flowchart TD/);

  const info = await client.callTool({
    name: "get_studio_info",
    arguments: {},
  });
  assert.equal(info.isError, undefined);
  const parsedInfo = JSON.parse(info.content[0].text);
  assert.equal(parsedInfo.name, "CTD Studio");
  assert.equal(parsedInfo.mcpName, "ctd-mcp");
  assert.equal(parsedInfo.mermaidVersion, "12.3.0");
  assert.equal(parsedInfo.formats.length, 7);

  const formatsRes = await client.readResource({ uri: "ctd://formats" });
  const formatsJson = JSON.parse(formatsRes.contents[0].text);
  assert.equal(formatsJson.length, 7);

  const templateRes = await client.readResource({ uri: "ctd://templates/Flowchart" });
  assert.match(templateRes.contents[0].text, /flowchart TD/);

  const promptRes = await client.getPrompt({
    name: "code_to_diagram",
    arguments: { source: "interface A { x: number }", targetFormat: "mermaid" },
  });
  assert.match(promptRes.messages[0].content.text, /interface A/);
});

test("edge cases: invalid XML and empty input return errors without crashing server", async () => {
  const badXml = await client.callTool({
    name: "to_mermaid",
    arguments: { source: "<diagram><unclosed></diagram>" },
  });
  assert.equal(badXml.isError, true);
  assert.match(badXml.content[0].text, /Invalid XML syntax/);

  const entityXml = await client.callTool({
    name: "to_mermaid",
    arguments: {
      source: '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><diagram><node id="A" label="&lol2;"/></diagram>',
    },
  });
  assert.equal(entityXml.isError, true);
  assert.match(entityXml.content[0].text, /DOCTYPE and ENTITY/);

  const deepXml = `${"<a>".repeat(80)}leaf${"</a>".repeat(80)}`;
  const deepRes = await client.callTool({
    name: "to_mermaid",
    arguments: { source: deepXml },
  });
  assert.equal(deepRes.isError, true);
  assert.match(deepRes.content[0].text, /maximum supported depth/);

  const wideXml = `<root>${"<item/>".repeat(1501)}</root>`;
  const wideRes = await client.callTool({
    name: "to_mermaid",
    arguments: { source: wideXml },
  });
  assert.equal(wideRes.isError, true);
  assert.match(wideRes.content[0].text, /maximum supported element count \(1500\)/);

  const hugeDot = `digraph G {\n${"  a -> b;\n".repeat(60000)}}`;
  const hugeRes = await client.callTool({
    name: "to_mermaid",
    arguments: { source: hugeDot },
  });
  assert.equal(hugeRes.isError, true);
  assert.match(hugeRes.content[0].text, /512 KB limit/);

  const unknownTemplate = await client.callTool({
    name: "list_templates",
    arguments: { name: "does-not-exist" },
  });
  assert.equal(unknownTemplate.isError, true);

  // Server should still respond normally after errors
  const infoAfter = await client.callTool({
    name: "get_studio_info",
    arguments: {},
  });
  assert.equal(infoAfter.isError, undefined);
});
