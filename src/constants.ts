import type { DiagramDocument, ProviderId, StudioSettings } from "./types";

export const LEGACY_STORAGE_KEY = "mstudio2";
export const DEFAULT_FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const THEME_PRESETS: Record<
  string,
  { primaryColor: string; textColor: string; lineColor: string; canvasColor: string }
> = {
  default: {
    primaryColor: "#ffffff",
    textColor: "#1c3439",
    lineColor: "#315158",
    canvasColor: "#f5f7f5",
  },
  dark: {
    primaryColor: "#1c2b30",
    textColor: "#eef4f2",
    lineColor: "#8ab4ad",
    canvasColor: "#0f171a",
  },
  forest: {
    primaryColor: "#d8edd9",
    textColor: "#163624",
    lineColor: "#2d6a4f",
    canvasColor: "#f2f7f3",
  },
  neutral: {
    primaryColor: "#eae6df",
    textColor: "#2b2927",
    lineColor: "#5c5751",
    canvasColor: "#f6f5f2",
  },
};

export const DEFAULT_SETTINGS: StudioSettings = {
  activeDocumentId: "",
  theme: "default",
  look: "classic",
  ...THEME_PRESETS.default,
  font: DEFAULT_FONT,
  splitPercent: 42,
  zoomSpeed: 1,
  panSpeed: 1,
  dragSpeed: 1,
  invertScroll: false,
  snapEnabled: true,
  snapSize: 20,
  smoothZoom: true,
  scrollMode: "zoom",
  colorizeBoxes: false,
  provider: {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    temperature: null,
  },
};

export const PROVIDERS: Record<
  ProviderId,
  { label: string; baseUrl: string; model: string }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  ollama: {
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "",
  },
  custom: {
    label: "Custom endpoint",
    baseUrl: "",
    model: "",
  },
};

export const TEMPLATES: Record<string, string> = {
  Flowchart: `flowchart TD
  Start([Start]) --> Check{Valid?}
  Check -->|Yes| Process[Process]
  Check -->|No| Fix[Fix Inputs]
  Fix --> Check
  Process --> Output[/Output/]
  Output --> Done([Done])`,

  Sequence: `sequenceDiagram
  autonumber
  actor User
  participant App
  participant DB
  User->>App: Request
  App->>DB: Query
  DB-->>App: Data
  App-->>User: Response`,

  Class: `classDiagram
  class Animal {
    +String name
    +int age
    +speak() void
  }
  class Dog {
    +String breed
    +fetch() void
  }
  class Cat {
    +Boolean indoor
    +purr() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,

  State: `stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start()
  Running --> Paused : pause()
  Paused --> Running : resume()
  Running --> [*] : stop()`,

  ER: `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ITEM : contains
  USER {
    int id PK
    string name
    string email
  }
  ORDER {
    int id PK
    date created_at
  }`,

  Gantt: `gantt
  title Project Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
  Design   :done, des, 2026-01-01, 7d
  Develop  :active, dev, after des, 10d
  section Phase 2
  Testing  :test, after dev, 5d
  Release  :crit, rel, after test, 2d`,

  Mindmap: `mindmap
  root((Project))
    Planning
      Goals
      Resources
    Execution
      Development
      Testing
    Delivery
      Deployment
      Monitoring`,

  Pie: `pie showData
  title Resource Allocation
  "Development" : 45
  "Testing" : 25
  "Design" : 20
  "Docs" : 10`,

  Journey: `journey
  title User Onboarding
  section Discovery
    Visit site: 4: User
    Read docs: 3: User
  section Setup
    Create account: 5: User
    Configure: 4: User
  section Usage
    First diagram: 5: User
    Share: 5: User`,

  "Git Graph": `gitGraph
  commit id: "Initial"
  branch feature
  checkout feature
  commit id: "Feature work"
  commit id: "More work"
  checkout main
  merge feature id: "Merge feature"
  commit id: "Release" tag: "v1.0"`,

  "C4 Architecture": `C4Context
  title System Context
  Person(user, "User", "Creates diagrams.")
  System(app, "CTD Studio", "Browser diagramming app.")
  System_Ext(ai, "AI API", "Diagram generation.")
  Rel(user, app, "Uses")
  Rel(app, ai, "Requests completions")`,

  "Requirement Diagram": `requirementDiagram
  requirement req_render {
    id: REQ-01
    text: Real-time debounced render within 250ms.
    risk: low
    verifymethod: test
  }
  element renderer {
    type: module
  }
  renderer - satisfies -> req_render`,

  "DOT Graph": `digraph ServiceFlow {
  rankdir=LR;
  Client [label="Web Client"];
  API [label="API Gateway"];
  Valid [label="Token Valid?", shape=diamond];
  DB [label="Database", shape=cylinder];
  Client -> API [label="HTTPS"];
  API -> Valid [label="Check"];
  Valid -> DB [label="Query"];
}`,

  "PlantUML Class": `@startuml
class Account {
  +String email
  +login()
}
class Workspace {
  +String title
  +exportSvg()
}
Account "1" --> "*" Workspace : owns
@enduml`,

  "D2 Flow": `direction: right
Browser -> Compiler: source code
Compiler -> Canvas: Mermaid code
Canvas -> Export: SVG or PNG`,

  "SQL Schema": `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255)
);
CREATE TABLE projects (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(120)
);`,

  "TypeScript Types": `interface Entity {
  id: string;
}
interface User extends Entity {
  email: string;
}
class Diagram implements Entity {
  id: string;
  owner: User;
  exportSvg(): string;
}`,

  "XML Diagram": `<diagram kind="flowchart" direction="LR">
  <nodes>
    <node id="Client" label="Web App" />
    <node id="Gateway" label="API Gateway" shape="diamond" />
    <node id="Store" label="Postgres" shape="cylinder" />
  </nodes>
  <edges>
    <edge from="Client" to="Gateway" label="HTTPS" />
    <edge from="Gateway" to="Store" label="SQL" />
  </edges>
</diagram>`,

  "API Auth Flow": `flowchart TD
  Req([Client Request]) --> GW[API Gateway]
  GW --> Auth{JWT Valid?}
  Auth -->|Yes| Handler[Route Handler]
  Auth -->|No| Err([401 Unauthorized])
  Handler --> Cache[(Redis Cache)]
  Handler -.->|Async Log| Audit[Audit Queue]
  Handler ==> Resp([200 OK])`,

  "CI/CD Pipeline": `flowchart LR
  Push([Push to main]) --> Check[Typecheck & Build]
  Check --> Tests[Unit & E2E Tests]
  Tests --> Pass{All Passed?}
  Pass -->|Yes| Deploy[Deploy Production]
  Pass -.->|Failed| Alert([Notify Author])
  Deploy --> Live([Live])`,

  "Microservices Flow": `flowchart LR
  Web([Web App]) --> Gateway[API Gateway]
  Gateway --> Auth[Auth Service]
  Gateway --> Orders[Order Service]
  Orders --> DB[(Postgres)]
  Orders -.->|order.created| Bus[Event Bus]
  Bus -.-> Mail[Notification Worker]`,

  "Checkout Sequence": `sequenceDiagram
  autonumber
  actor Customer
  participant App as Web App
  participant Pay as Payment API
  Customer->>App: Submit checkout
  App->>Pay: Authorize card
  alt Approved
    Pay-->>App: 200 Paid
    App-->>Customer: Order confirmed
  else Declined
    Pay-->>App: 402 Declined
    App-->>Customer: Retry payment
  end`,

  "BPMN Flow": `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="OrderProcess">
    <startEvent id="Start" name="Order Placed" />
    <task id="Check" name="Verify Stock" />
    <exclusiveGateway id="InStock" name="In Stock?" />
    <endEvent id="Ship" name="Ship Order" />
    <sequenceFlow sourceRef="Start" targetRef="Check" />
    <sequenceFlow sourceRef="Check" targetRef="InStock" />
    <sequenceFlow sourceRef="InStock" targetRef="Ship" name="Yes" />
  </process>
</definitions>`,
};

export function createDocument(
  name: string,
  code: string,
  sortOrder: number,
): DiagramDocument {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    code,
    history: [],
    layout: {},
    createdAt: now,
    updatedAt: now,
    sortOrder,
  };
}
