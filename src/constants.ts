import type { DiagramDocument, ProviderId, StudioSettings } from "./types";

export const LEGACY_STORAGE_KEY = "mstudio2";
export const DEFAULT_FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const DEFAULT_SETTINGS: StudioSettings = {
  activeDocumentId: "",
  theme: "default",
  look: "classic",
  primaryColor: "#eef2ef",
  textColor: "#1c3439",
  lineColor: "#315158",
  canvasColor: "#f5f7f5",
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
  System(app, "SGS Studio", "Browser diagramming app.")
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
