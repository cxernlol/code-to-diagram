import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "vite";

let viteServer;
let formats;
let translate;

before(async () => {
  viteServer = await createServer({
    logLevel: "silent",
    server: { middlewareMode: true },
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
  });
  const polyfill = await viteServer.ssrLoadModule("/mcp/src/dom-polyfill.ts");
  polyfill.ensureNodeDomPolyfills();
  formats = await viteServer.ssrLoadModule("/src/lib/formats.ts");
  translate = await viteServer.ssrLoadModule("/src/lib/translate.ts");
});

after(async () => {
  await viteServer?.close();
});

test("DOT subgraphs convert to Mermaid flowchart nodes and edges", () => {
  const dot = `
    digraph Architecture {
      rankdir=LR;
      subgraph cluster_edge {
        label="Edge";
        gateway [label="API Gateway", shape=diamond];
        auth [label="Auth"];
        gateway -> auth [label="verify"];
      }
      subgraph cluster_data {
        db [label="Postgres", shape=cylinder];
        auth -> db [style=dashed, label="read"];
      }
    }
  `;
  assert.equal(formats.detectCodeFormat(dot), "dot");
  const { format, mermaid } = formats.toMermaidSource(dot);
  assert.equal(format, "dot");
  assert.match(mermaid, /^flowchart LR/m);
  assert.match(mermaid, /gateway\{"API Gateway"\}/);
  assert.match(mermaid, /db\[\("Postgres"\)\]/);
  assert.match(mermaid, /gateway -->\|verify\| auth/);
  assert.match(mermaid, /auth -.->\|read\| db/);
});

test("PlantUML multiplicity quotes convert to Mermaid classDiagram", () => {
  const puml = `
    @startuml
    class Account {
      +id: string
    }
    class Workspace {
      +name: string
    }
    Account "1" --> "*" Workspace : owns
    Workspace "0..*" o-- "1" Member : contains
    @enduml
  `;
  assert.equal(formats.detectCodeFormat(puml), "plantuml");
  const { mermaid } = formats.toMermaidSource(puml);
  assert.match(mermaid, /^classDiagram/m);
  assert.match(mermaid, /Account "1" --> "\*" Workspace : owns/);
  assert.match(mermaid, /Workspace "0\.\.\*" o-- "1" Member : contains/);
});

test("SQL DDL foreign keys (inline and table-level) convert to Mermaid erDiagram", () => {
  const sql = `
    CREATE TABLE users (
      id INT PRIMARY KEY,
      email VARCHAR(255)
    );
    CREATE TABLE orders (
      id INT PRIMARY KEY,
      user_id INT REFERENCES users(id),
      org_id INT,
      CONSTRAINT fk_org FOREIGN KEY (org_id) REFERENCES orgs(id)
    );
  `;
  assert.equal(formats.detectCodeFormat(sql), "sql");
  const { mermaid } = formats.toMermaidSource(sql);
  assert.match(mermaid, /^erDiagram/m);
  assert.match(mermaid, /int id PK/);
  assert.match(mermaid, /int user_id FK/);
  assert.match(mermaid, /users \|\|--o\{ orders : references/);
  assert.match(mermaid, /orgs \|\|--o\{ orders : references/);
});

test("D2 containers convert to Mermaid subgraphs with qualified node IDs", () => {
  const d2 = `
    direction: right
    network: {
      api -> db: query
      db.shape: cylinder
    }
    client -> network.api: HTTPS
  `;
  assert.equal(formats.detectCodeFormat(d2), "d2");
  const { mermaid } = formats.toMermaidSource(d2);
  assert.match(mermaid, /^flowchart LR/m);
  assert.match(mermaid, /subgraph network\["network"\]/);
  assert.match(mermaid, /network_db\[\("db"\)\]/);
  assert.match(mermaid, /network_api -->\|query\| network_db/);
  assert.match(mermaid, /end/);
  assert.match(mermaid, /client -->\|HTTPS\| network_api/);
});

test("TypeScript interfaces and union properties convert to Mermaid classDiagram", () => {
  const ts = `
    interface Admin {
      level: number;
    }
    interface Guest {
      expiresAt: string;
    }
    export interface User {
      id: string;
      role: Admin | Guest;
      login(): boolean;
    }
  `;
  assert.equal(formats.detectCodeFormat(ts), "typescript");
  const { mermaid } = formats.toMermaidSource(ts);
  assert.match(mermaid, /^classDiagram/m);
  assert.match(mermaid, /class User \{/);
  assert.match(mermaid, /\+login\(\) boolean/);
  assert.match(mermaid, /User --> Admin : role/);
  assert.match(mermaid, /User --> Guest : role/);
});

test("Draw.io mxGraphModel XML converts to Mermaid flowchart", () => {
  const drawio = `
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="start" value="Start" vertex="1" style="ellipse"/>
        <mxCell id="check" value="Valid?" vertex="1" style="rhombus"/>
        <mxCell id="store" value="DB" vertex="1" style="cylinder"/>
        <mxCell id="e1" value="submit" edge="1" source="start" target="check"/>
        <mxCell id="e2" value="save" edge="1" source="check" target="store" style="dashed=1"/>
      </root>
    </mxGraphModel>
  `;
  assert.equal(formats.detectCodeFormat(drawio), "xml");
  const { mermaid } = formats.toMermaidSource(drawio);
  assert.match(mermaid, /^flowchart TD/m);
  assert.match(mermaid, /start\(\("Start"\)\)/);
  assert.match(mermaid, /check\{"Valid\?"\}/);
  assert.match(mermaid, /store\[\("DB"\)\]/);
  assert.match(mermaid, /start -->\|submit\| check/);
  assert.match(mermaid, /check -.->\|save\| store/);
});

test("BPMN XML converts to Mermaid flowchart", () => {
  const bpmn = `
    <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="orderProcess">
        <startEvent id="s1" name="Order Received"/>
        <exclusiveGateway id="g1" name="In Stock?"/>
        <userTask id="t1" name="Ship Order"/>
        <endEvent id="e1" name="Done"/>
        <sequenceFlow id="f1" sourceRef="s1" targetRef="g1"/>
        <sequenceFlow id="f2" sourceRef="g1" targetRef="t1" name="yes"/>
        <sequenceFlow id="f3" sourceRef="t1" targetRef="e1"/>
      </process>
    </definitions>
  `;
  assert.equal(formats.detectCodeFormat(bpmn), "xml");
  const { mermaid } = formats.toMermaidSource(bpmn);
  assert.match(mermaid, /^flowchart TD/m);
  assert.match(mermaid, /s1\(\("Order Received"\)\)/);
  assert.match(mermaid, /g1\{"In Stock\?"\}/);
  assert.match(mermaid, /s1 --> g1/);
  assert.match(mermaid, /g1 -->\|yes\| t1/);
  assert.match(mermaid, /t1 --> e1/);
});

test("enforces 512 KB source limit and XML DOCTYPE/ENTITY/depth/element caps", () => {
  const oversized = `flowchart TD\n${"  A --> B\n".repeat(60000)}`;
  assert.ok(oversized.length > formats.MAX_SOURCE_CHARS);
  assert.throws(() => formats.toMermaidSource(oversized), /512 KB limit/);
  assert.throws(() => formats.translateCodeFormat(oversized, "dot"), /512 KB limit/);

  assert.throws(
    () =>
      translate.parseXmlToIR(
        '<!DOCTYPE lolz [<!ENTITY lol "lol">]><diagram><node id="A" label="&lol;"/></diagram>',
      ),
    /DOCTYPE and ENTITY/,
  );

  const tooDeep = `${"<a>".repeat(66)}leaf${"</a>".repeat(66)}`;
  assert.throws(() => translate.parseXmlToIR(tooDeep), /maximum supported depth \(64\)/);

  const tooManyNodes = `<root>${"<item/>".repeat(1501)}</root>`;
  assert.throws(() => translate.parseXmlToIR(tooManyNodes), /maximum supported element count \(1500\)/);
});
