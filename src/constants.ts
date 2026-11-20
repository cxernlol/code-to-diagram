import type { AiProtocol, AiUsageLevel, DiagramDocument, ProviderId, StudioSettings } from "./types";

export const LEGACY_STORAGE_KEY = "mstudio2";
export const DEFAULT_FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const THEME_PRESETS: Record<
  string,
  { primaryColor: string; textColor: string; lineColor: string; canvasColor: string }
> = {
  default: {
    primaryColor: "#f3f7f5",
    textColor: "#1c3439",
    lineColor: "#315158",
    canvasColor: "#eaf0ed",
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
  primaryColor: "#f3f7f5",
  textColor: "#1c3439",
  lineColor: "#315158",
  canvasColor: "#eaf0ed",
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
    usage: "medium",
  },
};

export const AI_USAGE_TOKENS: Record<AiUsageLevel, { label: string; maxTokens: number }> = {
  low: { label: "Low (fast, concise)", maxTokens: 1024 },
  medium: { label: "Medium (balanced)", maxTokens: 2048 },
  high: { label: "High (detailed)", maxTokens: 4096 },
  max: { label: "Max (longest output)", maxTokens: 8192 },
};

export const PROVIDERS: Record<
  ProviderId,
  { label: string; protocol: AiProtocol; baseUrl: string; model: string; models: string[] }
> = {
  openai: {
    label: "OpenAI",
    protocol: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
  },
  anthropic: {
    label: "Anthropic",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5", "claude-3-7-sonnet-latest"],
  },
  gemini: {
    label: "Google Gemini",
    protocol: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  },
  deepseek: {
    label: "DeepSeek",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  openrouter: {
    label: "OpenRouter",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4.5",
    models: ["anthropic/claude-sonnet-4.5", "openai/gpt-4o", "google/gemini-2.5-flash", "deepseek/deepseek-chat"],
  },
  groq: {
    label: "Groq",
    protocol: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"],
  },
  xai: {
    label: "xAI (Grok)",
    protocol: "openai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-3-mini",
    models: ["grok-3", "grok-3-mini", "grok-2-latest"],
  },
  mistral: {
    label: "Mistral",
    protocol: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "codestral-latest"],
  },
  together: {
    label: "Together AI",
    protocol: "openai",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"],
  },
  fireworks: {
    label: "Fireworks AI",
    protocol: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/deepseek-v3"],
  },
  ollama: {
    label: "Ollama (local)",
    protocol: "openai",
    baseUrl: "http://localhost:11434/v1",
    model: "",
    models: ["llama3.2", "qwen2.5-coder", "deepseek-r1"],
  },
  lmstudio: {
    label: "LM Studio (local)",
    protocol: "openai",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    models: [],
  },
  "anthropic-compatible": {
    label: "Anthropic-compatible",
    protocol: "anthropic",
    baseUrl: "",
    model: "",
    models: [],
  },
  custom: {
    label: "OpenAI-compatible (Custom)",
    protocol: "openai",
    baseUrl: "",
    model: "",
    models: [],
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
    id: "REQ-01"
    text: "Real-time debounced render within 250ms."
    risk: low
    verifymethod: test
  }
  element renderer {
    type: "module"
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

  "UML Class (Suppression)": `@startuml
hide methods
hide empty members
interface Repository {
  +findById(id: string)
}
class User {
  +id: UUID
  -passwordHash: string
  #role: Role
  +authenticate()
}
class Order {
  +id: UUID
  -totalCents: number
  +markPaid()
}
Repository <|.. User
User "1" --> "*" Order : places
@enduml`,

  "UML Activity": `@startuml
start
:Receive Webhook;
if (Signature valid?) then (yes)
  :Enqueue Job;
  if (Idempotent?) then (yes)
    :Update Record;
  else (no)
    :Skip Duplicate;
  endif
else (no)
  :Return 401;
endif
stop
@enduml`,

  "System Architecture": `flowchart LR
  Client([Browser / Mobile]) --> CDN[CDN / Edge]
  CDN --> GW[API Gateway]
  GW --> Auth[Auth Service]
  GW --> Core[Core API]
  Core --> Cache[(Redis Cache)]
  Core --> DB[(Primary Postgres)]
  Core --> Queue[[Event Bus]]`,

  "Event-Driven Queue": `flowchart LR
  Producer[Order Service] -->|publish| Topic[(orders.created)]
  Topic --> WorkerA[Billing Worker]
  Topic --> WorkerB[Email Worker]
  WorkerA -->|retry > 3| DLQ[(Dead Letter Queue)]
  WorkerA --> Ledger[(Ledger DB)]`,

  "Deployment Topology": `flowchart TD
  Ingress[Load Balancer / TLS] --> App1[App Pod 1]
  Ingress --> App2[App Pod 2]
  App1 --> Primary[(Postgres Primary)]
  App2 --> Primary
  Primary -->|async replication| Replica[(Read Replica)]
  App1 --> Bucket[(Object Storage)]`,

  "Loop Trace": `flowchart TD
  Start([Start]) --> Init[i = 0]
  Init --> Cond{i < n?}
  Cond -->|Yes| Body[Process item i]
  Body --> Inc[i = i + 1]
  Inc --> Cond
  Cond -->|No| End([Done])`,

  "Intro OOP": `classDiagram
  class Shape {
    +String color
    +draw() void
  }
  class Circle {
    +int radius
  }
  class Rectangle {
    +int width
    +int height
  }
  Shape <|-- Circle
  Shape <|-- Rectangle`,

  "Student ER Lab": `erDiagram
  STUDENT ||--o{ ENROLLMENT : has
  COURSE ||--o{ ENROLLMENT : includes
  STUDENT {
    int id PK
    string name
  }
  COURSE {
    int id PK
    string title
  }
  ENROLLMENT {
    int student_id FK
    int course_id FK
    date enrolled_on
  }`,

  "Vending Machine": `stateDiagram-v2
  [*] --> Idle
  Idle --> Selecting : insert coin
  Selecting --> Dispensing : valid choice
  Selecting --> Idle : cancel
  Dispensing --> Idle : item delivered`,
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
