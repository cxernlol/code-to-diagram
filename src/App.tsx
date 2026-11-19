import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppTooltip } from "./AppTooltip";
import { applyPageSeo } from "./lib/seo";
import { NotFoundPage } from "./NotFoundPage";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FolderOpen,
  GitBranch,
  Hand,
  History,
  ImageDown,
  LayoutGrid,
  Menu,
  Moon,
  MoreVertical,
  MousePointer,
  Palette,
  PanelRight,
  Pencil,
  Plus,
  Redo2,
  RefreshCcw,
  RotateCcw,
  Scan,
  Settings,
  Settings2,
  StopCircle,
  Sun,
  Trash2,
  Undo2,
  Users,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { CodeEditorHandle } from "./CodeEditor";
import type { DiagramCanvasHandle } from "./DiagramCanvas";
import { COURSEWORK_TEMPLATES, DocsPage } from "./DocsPage";
import { HomePage } from "./HomePage";
import { LegalPage, type LegalTab } from "./LegalPage";
import { AI_USAGE_TOKENS, PROVIDERS, TEMPLATES, THEME_PRESETS, createDocument } from "./constants";
import {
  cleanMermaidCode,
  fetchProviderModels,
  parseStructuredDiagrams,
  requestAiText,
  validateMermaid,
} from "./ai";

import {
  exportPng,
  exportSvg,
  getImportedMermaid,
  getSharedPayload,
} from "./export";

import {
  detectCodeFormat,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  translateCodeFormat,
  type CodeFormat,
} from "./lib/formats";
import {
  detectDiagramType,
  getPedagogicalErrorHint,
  MOVABLE_DIAGRAM_TYPES,
  renderMermaidPreview,
  type DiagramType,
} from "./lib/mermaid";
import type { GuestRoomSession, HostRoomSession } from "./lib/room";
import { parseSidecar, serializeSidecar, sidecarFilename } from "./lib/sidecar";

const MAX_ROOM_DEVICES = 5;
const FIRST_DRAG_DISMISSED_KEY = "ctd-first-drag-explainer-dismissed";
const COACHMARK_DISMISSED_KEY = "ctd-coachmark-dismissed";

function getRoomIdFromHash(hash: string): string | undefined {
  if (!hash.startsWith("#room=")) return undefined;
  try {
    const raw = decodeURIComponent(hash.slice("#room=".length)).trim();
    return raw || undefined;
  } catch {
    return undefined;
  }
}

const CodeEditor = lazy(() =>
  import("./CodeEditor").then((m) => ({ default: m.CodeEditor })),
);
const DiagramCanvas = lazy(() =>
  import("./DiagramCanvas").then((m) => ({ default: m.DiagramCanvas })),
);
import {
  broadcastDocumentChange,
  deleteDocument as deleteStoredDocument,
  DocumentConflictError,
  initializeStudio,
  LegacyDataError,
  listenForDocumentChanges,
  reloadStudio,
  saveCredentials,
  saveDocument,
  saveSettings,
} from "./storage";

import type {
  AiUsageLevel,
  DiagramDocument,
  Position,
  ProviderId,
  ProviderSettings,
  StudioData,
  StudioSettings,
  VersionEntry,
} from "./types";

type Snapshot = Pick<DiagramDocument, "code" | "layout">;
type EditKind = "code" | "layout";

interface EditEntry {
  before: Snapshot;
  after: Snapshot;
  kind: EditKind;
  at: number;
}

interface EditStack {
  undo: EditEntry[];
  redo: EditEntry[];
}

type AiPanel =
  | { kind: "refine"; code: string }
  | { kind: "structured"; result: { overview: string; diagrams: Array<{ name: string; code: string }> } }
  | { kind: "explain"; text: string };

const SYSTEM_MERMAID =
  "You edit Mermaid diagrams. Return only valid Mermaid source, without markdown fences or explanation. Preserve the user's intent, use clear stable node IDs, keep diagrams readable, and preserve existing %% sgs-hide: and %% sgs-hidden-member: comment directives unless asked to remove them.";
const SYSTEM_STRUCTURED =
  'Return one valid JSON object only: {"overview":"<Mermaid source>","diagrams":[{"name":"<short descriptive name>","code":"<Mermaid source>"}]}. Include an Overview and at least one named detail diagram. Keep each diagram focused and professional. Do not wrap the JSON in markdown.';
const SYSTEM_EXPLAIN =
  "Explain the supplied Mermaid diagram in concise plain language. Do not return Mermaid code or modify the diagram.";

const SYNTAX_GUIDANCE: Record<DiagramType, string> = {
  flowchart: "Use flowchart TD or LR, stable node IDs, and --> or labeled -->|text| edges.",
  class: "Use classDiagram, class blocks for members, and typed relationships such as A --> B.",
  state: "Use stateDiagram-v2 with explicit states and directed transitions.",
  er: "Use erDiagram, named entities, attributes, and cardinality markers such as ||--o{.",
  requirement: "Use requirementDiagram with quoted id/text/type fields and typed relationships such as - satisfies ->.",
  c4: "Use C4Context/C4Container with Person/System/Rel macros.",
  sequence: "Use sequenceDiagram with actor/participant declarations and message arrows.",
  gantt: "Use gantt with title, dateFormat, sections, and valid task durations.",
  mindmap: "Use mindmap with one root and consistently indented child branches.",
  pie: "Use pie with a title and quoted labels followed by numeric values.",
  journey: "Use journey with sections, steps, scores, and actor names.",
  other: "Use valid Mermaid syntax for the identified diagram type.",
};

function snapshot(document: DiagramDocument): Snapshot {
  return { code: document.code, layout: document.layout };
}

function newEditStack(): EditStack {
  return { undo: [], redo: [] };
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function downloadText(filename: string, value: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([value], { type: mime }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function errorText(error: unknown): string {
  const message = messageFromError(error);
  return error instanceof TypeError && /fetch/i.test(message)
    ? "The request could not reach that endpoint. Check the URL, API key, network, and provider CORS settings."
    : message;
}

type AppView = "home" | "studio" | "docs" | "privacy" | "terms" | "notFound";

function isStudioHash(hash: string): boolean {
  return hash === "#app" || hash.startsWith("#d=") || hash.startsWith("#room=");
}

function detectDirectionFromCode(source: string): "TD" | "BT" | "LR" | "RL" {
  const lines = source.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  const headerMatch = first.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i);
  if (headerMatch) {
    const dir = headerMatch[1]!.toUpperCase();
    return dir === "TB" ? "TD" : (dir as "TD" | "BT" | "LR" | "RL");
  }
  for (let i = 1; i < lines.length; i += 1) {
    const dirMatch = lines[i]?.match(/^\s*direction\s+(TD|TB|BT|LR|RL)\b/i);
    if (dirMatch) {
      const dir = dirMatch[1]!.toUpperCase();
      return dir === "TB" ? "TD" : (dir as "TD" | "BT" | "LR" | "RL");
    }
  }
  return "TD";
}

function applyDiagramDirection(source: string, dir: "TD" | "BT" | "LR" | "RL"): string {
  const lines = source.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  if (/^(flowchart|graph)\b/i.test(first)) {
    lines[0] = lines[0]!.replace(/^(flowchart|graph)(?:\s+(?:TD|TB|BT|LR|RL))?\b/i, `$1 ${dir}`);
    return lines.join("\n");
  }
  if (/^(classDiagram|stateDiagram(?:-v2)?)\b/i.test(first)) {
    const dirIdx = lines.findIndex((line, i) => i > 0 && /^\s*direction\s+(?:TD|TB|BT|LR|RL)\b/i.test(line));
    if (dirIdx >= 0) {
      lines[dirIdx] = `  direction ${dir}`;
    } else {
      lines.splice(1, 0, `  direction ${dir}`);
    }
    return lines.join("\n");
  }
  return source;
}

function viewFromLocation(pathname: string, hash: string): AppView {
  if (isStudioHash(hash)) return "studio";
  if (hash === "#docs") return "docs";
  if (hash === "#privacy") return "privacy";
  if (hash === "#terms") return "terms";
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/") return "home";
  if (normalizedPath === "/app") return "studio";
  if (normalizedPath === "/docs") return "docs";
  if (normalizedPath === "/privacy") return "privacy";
  if (normalizedPath === "/terms") return "terms";
  return "notFound";
}

function App() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<AppView>(() =>
    viewFromLocation(window.location.pathname, window.location.hash),
  );
  const [data, setData] = useState<StudioData | null>(null);
  const dataRef = useRef<StudioData | null>(null);
  const historyRef = useRef(new Map<string, EditStack>());
  const expectedUpdatedAt = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const aiController = useRef<AbortController | null>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const canvasRef = useRef<DiagramCanvasHandle>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const newDiagramDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [bootError, setBootError] = useState<unknown>();
  const [legacyError, setLegacyError] = useState<LegacyDataError>();
  const [storageError, setStorageError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState(Date.now());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [externalConflict, setExternalConflict] = useState<DiagramDocument>();
  const [notice, setNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [renderError, setRenderError] = useState<{ message: string; line?: number }>();
  const [diagramType, setDiagramType] = useState<DiagramType>("other");
  const [canvasTool, setCanvasTool] = useState<"move" | "hand">("move");
  const [mobilePane, setMobilePane] = useState<"code" | "preview">("preview");
  const [expandedPane, setExpandedPane] = useState<"none" | "code" | "preview">("none");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newDiagramOpen, setNewDiagramOpen] = useState(false);
  const [newDiagramLane, setNewDiagramLane] = useState<"all" | "coursework" | "project">("all");
  const [firstDragDismissed, setFirstDragDismissed] = useState(() => {
    try {
      return localStorage.getItem(FIRST_DRAG_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [firstDragTriggered, setFirstDragTriggered] = useState(false);
  const [coachmarkDismissed, setCoachmarkDismissed] = useState(() => {
    try {
      return localStorage.getItem(COACHMARK_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [newDiagramSelection, setNewDiagramSelection] = useState<{
    kind: "template" | "starter";
    label: string;
    title: string;
    code: string;
  }>(() => ({
    kind: "template",
    label: "Flowchart",
    title: "Flowchart",
    code: TEMPLATES.Flowchart,
  }));
  const [newDiagramPreviewBusy, setNewDiagramPreviewBusy] = useState(false);
  const newDiagramPreviewRef = useRef<HTMLDivElement>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBarVisible, setAiBarVisible] = useState(true);
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{
    docId: string | null;
    x: number;
    y: number;
  } | null>(null);
  const [studioMenuOpen, setStudioMenuOpen] = useState(false);
  const [directionMenuOpen, setDirectionMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"appearance" | "ai">("appearance");
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"refine" | "structured" | "explain">("refine");
  const [aiPanel, setAiPanel] = useState<AiPanel | null>(null);
  const [explainPopups, setExplainPopups] = useState<Array<{ id: string; title: string; text: string }>>([]);
  const [aiStream, setAiStream] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [roomMode, setRoomMode] = useState<"none" | "host" | "guest">("none");
  const [roomDevices, setRoomDevices] = useState(1);
  const [roomNotice, setRoomNotice] = useState("");
  const [endedRoomDocIds, setEndedRoomDocIds] = useState<Set<string>>(() => new Set());
  const hostRoomRef = useRef<HostRoomSession | null>(null);
  const guestRoomRef = useRef<GuestRoomSession | null>(null);
  const roomDocIdRef = useRef<string>("");
  const applyingRoomSyncRef = useRef(false);
  const initPromiseRef = useRef<Promise<StudioData> | null>(null);

  const activeDocument = useMemo(() => {
    if (!data) return undefined;
    return (
      data.documents.find((document) => document.id === data.settings.activeDocumentId) ??
      data.documents[0]
    );
  }, [data]);

  const updateData = useCallback((next: StudioData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const markDirty = useCallback((id: string) => {
    setDirtyIds((current) => new Set(current).add(id));
    setSaveState("saving");
  }, []);

  const updateDocument = useCallback(
    (id: string, update: (document: DiagramDocument) => DiagramDocument, shouldSave = true) => {
      const current = dataRef.current;
      const document = current?.documents.find((item) => item.id === id);
      if (!current || !document) return;
      const next = {
        ...current,
        documents: current.documents.map((item) => (item.id === id ? update(item) : item)),
      };
      updateData(next);
      if (shouldSave) markDirty(id);
    },
    [markDirty, updateData],
  );

  const rememberEdit = useCallback(
    (id: string, before: Snapshot, after: Snapshot, kind: EditKind) => {
      const history = historyRef.current.get(id) ?? newEditStack();
      const previous = history.undo.at(-1);
      const now = Date.now();
      if (kind === "code" && previous?.kind === "code" && now - previous.at < 750) {
        previous.after = after;
        previous.at = now;
      } else {
        history.undo.push({ before, after, kind, at: now });
      }
      if (history.undo.length > 100) history.undo.shift();
      history.redo = [];
      historyRef.current.set(id, history);
    },
    [],
  );

  const changeCode = useCallback(
    (code: string) => {
      if (!activeDocument || activeDocument.code === code || endedRoomDocIds.has(activeDocument.id)) return;
      const before = snapshot(activeDocument);
      const after = { ...before, code };
      rememberEdit(activeDocument.id, before, after, "code");
      updateDocument(activeDocument.id, (document) => ({ ...document, code }));
    },
    [activeDocument, endedRoomDocIds, rememberEdit, updateDocument],
  );

  const changeLayout = useCallback(
    (layout: Record<string, Position>) => {
      if (!activeDocument || endedRoomDocIds.has(activeDocument.id)) return;
      const before = snapshot(activeDocument);
      if (JSON.stringify(before.layout) === JSON.stringify(layout)) return;
      const after = { ...before, layout };
      rememberEdit(activeDocument.id, before, after, "layout");
      updateDocument(activeDocument.id, (document) => ({ ...document, layout }));
    },
    [activeDocument, endedRoomDocIds, rememberEdit, updateDocument],
  );

  const dismissFirstDragExplainer = useCallback(() => {
    setFirstDragDismissed(true);
    setFirstDragTriggered(false);
    try {
      localStorage.setItem(FIRST_DRAG_DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  const dismissCoachmark = useCallback(() => {
    setCoachmarkDismissed(true);
    try {
      localStorage.setItem(COACHMARK_DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }, []);

  const changeSettings = useCallback(
    (update: Partial<StudioSettings>) => {
      const current = dataRef.current;
      if (!current) return;
      updateData({ ...current, settings: { ...current.settings, ...update } });
    },
    [updateData],
  );

  const setActiveDocument = useCallback(
    (id: string) => changeSettings({ activeDocumentId: id }),
    [changeSettings],
  );

  const announceNodeMoved = useCallback(
    (id: string) => {
      setAnnouncement(`Moved ${id}.`);
      if (!firstDragDismissed) {
        setFirstDragTriggered(true);
      }
    },
    [firstDragDismissed],
  );

  const undo = useCallback(() => {
    if (!activeDocument) return false;
    const stack = historyRef.current.get(activeDocument.id);
    const entry = stack?.undo.pop();
    if (!entry || !stack) return false;
    stack.redo.push(entry);
    updateDocument(activeDocument.id, (document) => ({
      ...document,
      code: entry.before.code,
      layout: entry.before.layout,
    }));
    return true;
  }, [activeDocument, updateDocument]);

  const redo = useCallback(() => {
    if (!activeDocument) return false;
    const stack = historyRef.current.get(activeDocument.id);
    const entry = stack?.redo.pop();
    if (!entry || !stack) return false;
    stack.undo.push(entry);
    updateDocument(activeDocument.id, (document) => ({
      ...document,
      code: entry.after.code,
      layout: entry.after.layout,
    }));
    return true;
  }, [activeDocument, updateDocument]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        const doc = dataRef.current?.documents.find(
          (item) => item.id === dataRef.current?.settings.activeDocumentId,
        ) ?? dataRef.current?.documents[0];
        if (!doc) return;
        event.preventDefault();
        downloadText(`${doc.name.replace(/[\\/:*?"<>|]/g, "-")}.mmd`, doc.code);
        setNotice("Mermaid file downloaded.");
        return;
      }
      if (key !== "z" && key !== "y") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  const boot = useCallback(async (ignoreLegacy = false, isCancelled?: () => boolean) => {
    setBootError(undefined);
    setLegacyError(undefined);
    try {
      if (!initPromiseRef.current || ignoreLegacy || !isCancelled) {
        initPromiseRef.current = initializeStudio(ignoreLegacy);
      }
      const loaded = await initPromiseRef.current;
      if (isCancelled?.()) return;
      try {
        const sharedPayload = getSharedPayload(window.location.hash);
        if (sharedPayload) {
          const shared = {
            ...createDocument("Shared diagram", sharedPayload.code, loaded.documents.length),
            layout: sharedPayload.layout,
          };
          loaded.documents = [...loaded.documents, shared];
          loaded.settings = { ...loaded.settings, activeDocumentId: shared.id };
          setView("studio");
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}#app`);
          expectedUpdatedAt.current.set(shared.id, 0);
          setDirtyIds((current) => new Set(current).add(shared.id));
        }
      } catch (error) {
        setStorageError(`The share link could not be opened: ${errorText(error)}`);
      }
      loaded.documents.forEach((document) => {
        if (!expectedUpdatedAt.current.has(document.id)) {
          expectedUpdatedAt.current.set(document.id, document.updatedAt);
        }
      });
      updateData(loaded);
      const roomId = getRoomIdFromHash(window.location.hash);
      if (roomId && !guestRoomRef.current && !hostRoomRef.current) {
        setRoomMode("guest");
        setRoomNotice("");
        void import("./lib/room").then(({ joinHostRoom }) => {
          if (guestRoomRef.current || hostRoomRef.current) return;
          guestRoomRef.current = joinHostRoom(roomId, {
            onSync: (payload, devices) => {
              setRoomDevices(devices);
              const current = dataRef.current;
              if (!current) return;
              applyingRoomSyncRef.current = true;
              const existing = current.documents.find((d) => d.id === roomDocIdRef.current);
              if (existing) {
                updateData({
                  ...current,
                  documents: current.documents.map((d) =>
                    d.id === existing.id
                      ? { ...d, name: payload.name, code: payload.code, layout: payload.layout }
                      : d,
                  ),
                  settings: { ...current.settings, activeDocumentId: existing.id },
                });
                markDirty(existing.id);
              } else {
                const doc = {
                  ...createDocument(payload.name || "Live room", payload.code, current.documents.length),
                  layout: payload.layout,
                };
                roomDocIdRef.current = doc.id;
                expectedUpdatedAt.current.set(doc.id, 0);
                updateData({
                  ...current,
                  documents: [...current.documents, doc],
                  settings: { ...current.settings, activeDocumentId: doc.id },
                });
                markDirty(doc.id);
              }
            },
            onEnded: (reason) => {
              guestRoomRef.current = null;
              setRoomMode("none");
              if (roomDocIdRef.current) {
                setEndedRoomDocIds((prev) => new Set(prev).add(roomDocIdRef.current));
              }
              setRoomNotice(`${reason} Editing is locked; you can still export SVG, PNG, or source.`);
              if (window.location.hash.startsWith("#room=")) {
                history.replaceState(null, "", `${window.location.pathname}${window.location.search}#app`);
              }
            },
            onError: (message) => {
              guestRoomRef.current = null;
              setRoomMode("none");
              setStorageError(message);
            },
          });
        });
      }
    } catch (error) {
      initPromiseRef.current = null;
      setBootError(error);
      if (error instanceof LegacyDataError) setLegacyError(error);
    }
  }, [updateData]);

  useEffect(() => {
    let cancelled = false;
    void boot(false, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [boot]);

  useEffect(() => {
    const customTitle = view === "studio" && activeDocument ? `${activeDocument.name} — CTD Studio` : undefined;
    applyPageSeo(view, customTitle);
  }, [view, activeDocument?.name]);

  useEffect(() => {
    document.documentElement.dataset.theme =
      view === "studio" && data?.settings.theme === "dark" ? "dark" : "light";
  }, [view, data?.settings.theme]);

  useEffect(() => {
    if (!roomNotice) return;
    const timer = window.setTimeout(() => setRoomNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [roomNotice]);

  useEffect(() => {
    if (!aiError) return;
    const timer = window.setTimeout(() => setAiError(""), 4500);
    return () => window.clearTimeout(timer);
  }, [aiError]);

  useEffect(() => {
    if (!testStatus) return;
    const timer = window.setTimeout(() => setTestStatus(""), 4000);
    return () => window.clearTimeout(timer);
  }, [testStatus]);

  const closeAllMenus = useCallback((keepDetails?: HTMLDetailsElement | null) => {
    setStudioMenuOpen(false);
    setTabMenuOpen(false);
    setTabContextMenu(null);
    setDirectionMenuOpen(false);
    setAiMenuOpen(false);
    document.querySelectorAll("details.history-menu[open], details.sensitivity-menu[open]").forEach((el) => {
      if (keepDetails && el === keepDetails) return;
      el.removeAttribute("open");
    });
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (studioMenuOpen && !target?.closest(".studio-menu-wrap")) setStudioMenuOpen(false);
      if (tabMenuOpen && !target?.closest(".tab-actions-wrap")) setTabMenuOpen(false);
      if (tabContextMenu && !target?.closest(".tab-context-menu")) setTabContextMenu(null);
      if (directionMenuOpen && !target?.closest(".direction-menu-wrap")) setDirectionMenuOpen(false);
      if (aiMenuOpen && !target?.closest(".ai-floating-wrap")) setAiMenuOpen(false);
      document.querySelectorAll("details.history-menu[open], details.sensitivity-menu[open]").forEach((el) => {
        if (!target?.closest("details.history-menu, details.sensitivity-menu") || !el.contains(target)) {
          el.removeAttribute("open");
        }
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAllMenus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [studioMenuOpen, tabMenuOpen, tabContextMenu, directionMenuOpen, aiMenuOpen, closeAllMenus]);

  useEffect(() => {
    if (!newDiagramOpen || !data) return;
    let cancelled = false;
    setNewDiagramPreviewBusy(true);
    void import("dompurify")
      .then(async ({ default: DOMPurify }) => {
        const result = await renderMermaidPreview(newDiagramSelection.code, data.settings);
        if (cancelled) return;
        const host = newDiagramPreviewRef.current;
        if (!host) return;
        const clean = DOMPurify.sanitize(result.svg, {
          USE_PROFILES: { svg: true, svgFilters: true, html: true },
          ADD_TAGS: ["foreignObject"],
          FORBID_TAGS: ["script", "iframe", "object", "embed"],
        });
        const parsed = new DOMParser().parseFromString(clean, "image/svg+xml");
        const svgEl = parsed.documentElement;
        if (svgEl.tagName.toLowerCase() === "svg") {
          svgEl.removeAttribute("width");
          svgEl.removeAttribute("height");
          host.replaceChildren(window.document.importNode(svgEl, true));
        } else {
          host.replaceChildren();
        }
      })
      .catch(() => {
        if (!cancelled && newDiagramPreviewRef.current) {
          newDiagramPreviewRef.current.replaceChildren();
        }
      })
      .finally(() => {
        if (!cancelled) setNewDiagramPreviewBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    newDiagramOpen,
    newDiagramSelection,
    data?.settings.theme,
    data?.settings.look,
    data?.settings.primaryColor,
    data?.settings.textColor,
    data?.settings.lineColor,
    data?.settings.canvasColor,
    data?.settings.font,
  ]);

  useEffect(() => {
    if (window.location.hash === "#docs") {
      window.history.replaceState(null, "", "/docs");
      setView("docs");
    }
  }, []);

  useEffect(() => {
    const onRouteChange = () => {
      if (window.location.hash === "#docs") {
        window.history.replaceState(null, "", "/docs");
        setView("docs");
        return;
      }
      setView(viewFromLocation(window.location.pathname, window.location.hash));
    };
    window.addEventListener("hashchange", onRouteChange);
    window.addEventListener("popstate", onRouteChange);
    return () => {
      window.removeEventListener("hashchange", onRouteChange);
      window.removeEventListener("popstate", onRouteChange);
    };
  }, []);

  const openLegal = useCallback((tab: LegalTab) => {
    setView(tab);
    window.location.hash = `#${tab}`;
    window.scrollTo(0, 0);
  }, []);

  const openDocs = useCallback((anchor?: string) => {
    const cleanAnchor = typeof anchor === "string" ? anchor.replace(/^#/, "").trim() : "";
    const targetUrl = cleanAnchor ? `/docs#${cleanAnchor}` : "/docs";
    setView("docs");
    window.history.pushState(null, "", targetUrl);
    if (!cleanAnchor) {
      window.scrollTo(0, 0);
    }
  }, []);

  const openHome = useCallback(() => {
    setView("home");
    if (window.location.hash || window.location.pathname !== "/") {
      history.pushState(null, "", `/${window.location.search}`);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (data) dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const timer = window.setTimeout(() => {
      void Promise.all([
        saveSettings(data.settings),
        saveCredentials(data.credentials),
      ]).catch((error: unknown) => {
        setStorageError(errorText(error));
        setSaveState("error");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data?.settings, data?.credentials]);

  useEffect(() => {
    if (!data || !dirtyIds.size) return;
    const timer = window.setTimeout(() => {
      const current = dataRef.current;
      if (!current) return;
      dirtyIds.forEach((id) => {
        if (inFlight.current.has(id)) return;
        const document = current.documents.find((item) => item.id === id);
        if (!document) return;
        inFlight.current.add(id);
        const expected = expectedUpdatedAt.current.has(id)
          ? expectedUpdatedAt.current.get(id) ?? 0
          : document.updatedAt;
        void saveDocument(document, expected)
          .then((saved) => {
            expectedUpdatedAt.current.set(id, saved.updatedAt);
            broadcastDocumentChange(id);
            const latest = dataRef.current?.documents.find((item) => item.id === id);
            if (latest === document) {
              setDirtyIds((items) => {
                const next = new Set(items);
                next.delete(id);
                return next;
              });
            }
            setLastSavedAt(Date.now());
            setSaveState("saved");
            setStorageError((prev) =>
              prev && /CTD sidecar|JSON|read-only|too large|Empty|Unsupported/i.test(prev)
                ? prev
                : "",
            );
          })
          .catch((error: unknown) => {
            if (error instanceof DocumentConflictError) {
              setExternalConflict(error.remote);
            }
            setDirtyIds((items) => {
              const next = new Set(items);
              next.delete(id);
              return next;
            });
            setStorageError(errorText(error));
            setSaveState("error");
          })
          .finally(() => inFlight.current.delete(id));
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [data?.documents, dirtyIds]);

  useEffect(
    () =>
      listenForDocumentChanges((id) => {
        void reloadStudio()
          .then((latest) => {
            const remote = latest.documents.find((document) => document.id === id);
            const local = dataRef.current?.documents.find((document) => document.id === id);
            if (!remote || !local || remote.updatedAt === expectedUpdatedAt.current.get(id)) return;
            if (dirtyIds.has(id)) {
              setExternalConflict(remote);
              return;
            }
            const current = dataRef.current;
            if (current) {
              updateData({
                ...current,
                documents: current.documents.map((document) =>
                  document.id === id ? remote : document,
                ),
              });
              expectedUpdatedAt.current.set(id, remote.updatedAt);
            }
          })
          .catch((error: unknown) => setStorageError(errorText(error)));
      }),
    [dirtyIds, updateData],
  );

  useEffect(() => {
    if (settingsOpen && settingsDialog.current && !settingsDialog.current.open) {
      settingsDialog.current.showModal();
    } else if (!settingsOpen && settingsDialog.current?.open) {
      settingsDialog.current.close();
    }
  }, [settingsOpen]);

  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!dialog) return;
    if (pendingDeleteId && !dialog.open) {
      dialog.showModal();
    } else if (!pendingDeleteId && dialog.open) {
      dialog.close();
    }
  }, [pendingDeleteId]);

  useEffect(() => {
    const dialog = newDiagramDialog.current;
    if (!dialog) return;
    if (newDiagramOpen && !dialog.open) {
      dialog.showModal();
    } else if (!newDiagramOpen && dialog.open) {
      dialog.close();
    }
  }, [newDiagramOpen]);

  const createTab = useCallback(
    (name = "Flowchart", code = TEMPLATES.Flowchart) => {
      const current = dataRef.current;
      if (!current) return;
      const created = createDocument(name, code, current.documents.length);
      expectedUpdatedAt.current.set(created.id, 0);
      updateData({
        ...current,
        documents: [...current.documents, created],
        settings: { ...current.settings, activeDocumentId: created.id },
      });
      markDirty(created.id);
      setRenameId("");
    },
    [markDirty, updateData],
  );

  const openStudio = useCallback(
    (templateName?: string) => {
      if (templateName && TEMPLATES[templateName]) {
        createTab(templateName, TEMPLATES[templateName]);
      }
      setView("studio");
      if (!isStudioHash(window.location.hash)) {
        window.location.hash = "#app";
      }
    },
    [createTab],
  );

  const openSampleGitFlow = useCallback(async () => {
    let sampleCode = [
      "flowchart TD",
      '  Client["Client App"] --> Gateway["API Gateway"]',
      '  Gateway --> Auth["Auth Service"]',
      '  Gateway --> Worker["Job Worker"]',
    ].join("\n");
    let sampleLayout: Record<string, Position> = {
      Client: { x: 160, y: 90 },
      Gateway: { x: 160, y: 210 },
    };
    try {
      const [mmdRes, ctdRes] = await Promise.all([
        fetch("/samples/git-flow/flow.mmd"),
        fetch("/samples/git-flow/flow.ctd.json"),
      ]);
      if (mmdRes.ok) {
        sampleCode = (await mmdRes.text()).replace(/\r\n/g, "\n").trim();
      }
      if (ctdRes.ok) {
        const parsed = parseSidecar(await ctdRes.text());
        sampleLayout = parsed.layout;
      }
    } catch {
      // fallback to embedded golden git-flow pair
    }
    const current = dataRef.current;
    if (current) {
      const created = {
        ...createDocument("flow", sampleCode, current.documents.length),
        layout: sampleLayout,
      };
      expectedUpdatedAt.current.set(created.id, 0);
      updateData({
        ...current,
        documents: [...current.documents, created],
        settings: { ...current.settings, activeDocumentId: created.id },
      });
      markDirty(created.id);
      setRenameId("");
    }
    setNewDiagramOpen(false);
    setView("studio");
    if (!isStudioHash(window.location.hash)) {
      window.location.hash = "#app";
    }
    setNotice("Opened git-flow sample (flow.mmd + flow.ctd.json).");
  }, [markDirty, updateData]);

  const startRename = (document: DiagramDocument) => {
    setRenameId(document.id);
    setRenameValue(document.name);
  };

  const commitRename = () => {
    if (!renameId) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameId("");
      return;
    }
    updateDocument(renameId, (document) => ({ ...document, name }));
    setRenameId("");
  };

  const removeTab = async (id: string) => {
    const current = dataRef.current;
    if (!current) return;
    const remaining = current.documents.filter((document) => document.id !== id);
    let documents = remaining;
    let activeId = current.settings.activeDocumentId;
    expectedUpdatedAt.current.delete(id);
    setDirtyIds((items) => {
      const next = new Set(items);
      next.delete(id);
      return next;
    });
    try {
      await deleteStoredDocument(id);
      if (!remaining.length) {
        const replacement = createDocument("Flowchart", TEMPLATES.Flowchart, 0);
        expectedUpdatedAt.current.set(replacement.id, 0);
        documents = [replacement];
        activeId = replacement.id;
        markDirty(replacement.id);
      } else if (activeId === id) {
        activeId = remaining[0]?.id ?? current.settings.activeDocumentId;
      }
      updateData({
        ...current,
        documents,
        settings: { ...current.settings, activeDocumentId: activeId },
      });
      setPendingDeleteId("");
    } catch (error) {
      setStorageError(errorText(error));
    }
  };

  const addVersion = (document: DiagramDocument, reason: string): VersionEntry[] => [
    {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      reason,
      code: document.code,
    },
    ...document.history,
  ].slice(0, 30);

  const restoreVersion = (version: VersionEntry) => {
    if (!activeDocument) return;
    changeCode(version.code);
    setNotice(`Restored “${version.reason}”.`);
  };

  useEffect(() => {
    if (!activeDocument || endedRoomDocIds.has(activeDocument.id)) return;
    const latestCode = activeDocument.history[0]?.code;
    if (latestCode === activeDocument.code) return;
    const docId = activeDocument.id;
    const snapshotCode = activeDocument.code;
    const timer = window.setTimeout(() => {
      updateDocument(docId, (doc) => {
        if (doc.code !== snapshotCode || doc.history[0]?.code === snapshotCode) return doc;
        return {
          ...doc,
          history: [
            {
              id: crypto.randomUUID(),
              createdAt: Date.now(),
              reason: doc.history.length === 0 ? "Initial snapshot" : "Edited diagram",
              code: snapshotCode,
            },
            ...doc.history,
          ].slice(0, 30),
        };
      });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [activeDocument?.id, activeDocument?.code, activeDocument?.history, endedRoomDocIds, updateDocument]);

  const acceptAiResult = () => {
    if (!aiPanel || !activeDocument) return;
    if (aiPanel.kind === "refine") {
      const current = dataRef.current;
      const document = current?.documents.find((item) => item.id === activeDocument.id);
      if (!current || !document) return;
      const before = snapshot(document);
      const after = { ...before, code: aiPanel.code };
      rememberEdit(document.id, before, after, "code");
      updateDocument(document.id, (item) => ({
        ...item,
        code: aiPanel.code,
        history: addVersion(item, "Before AI refinement"),
      }));
      setNotice("AI changes applied.");
    } else if (aiPanel.kind === "structured") {
      const generated = [
        { name: "Overview", code: aiPanel.result.overview },
        ...aiPanel.result.diagrams,
      ].map((item, index) =>
        createDocument(item.name, item.code, dataRef.current?.documents.length ?? index),
      );
      generated.forEach((document) => expectedUpdatedAt.current.set(document.id, 0));
      const current = dataRef.current;
      if (!current) return;
      updateData({
        ...current,
        documents: [...current.documents, ...generated],
        settings: { ...current.settings, activeDocumentId: generated[0]?.id ?? current.settings.activeDocumentId },
      });
      generated.forEach((document) => markDirty(document.id));
      setNotice(`${generated.length} structured diagrams added.`);
    }
    setAiPanel(null);
    setAiError("");
    setAiPrompt("");
  };

  const runAi = async (mode = aiMode, promptOverride?: string) => {
    if (!activeDocument || !data) return;
    if (!data.settings.provider.baseUrl.trim() || !data.settings.provider.model.trim()) {
      setAiError("Add an endpoint and model in AI settings first.");
      setSettingsOpen(true);
      return;
    }
    const controller = new AbortController();
    aiController.current = controller;
    setAiBusy(true);
    setAiError("");
    setAiPanel(null);
    setAiStream("");
    let feedback = "";
    const customPrompt = (promptOverride ?? aiPrompt).trim();
    try {
      if (mode === "explain") {
        const text = await requestAiText({
          provider: data.settings.provider,
          apiKey: data.credentials.apiKey,
          system: SYSTEM_EXPLAIN,
          prompt: `Diagram type: ${detectDiagramType(activeDocument.code)}\n\n${activeDocument.code}`,
          signal: controller.signal,
          onText: setAiStream,
        });
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setExplainPopups((prev) => [
          ...prev.slice(-3),
          { id, title: activeDocument.name || "Explanation", text },
        ]);
        window.setTimeout(() => {
          setExplainPopups((prev) => prev.filter((item) => item.id !== id));
        }, 6000);
        setAiStream("");
        return;
      }
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const structured = mode === "structured";
        const prompt = [
          structured
            ? `Create structured diagrams from the source below. Return JSON with an Overview and at least one named detail diagram. Diagram type: ${detectDiagramType(activeDocument.code)}.`
            : `Improve this ${detectDiagramType(activeDocument.code)} diagram. Keep its meaning and IDs where practical. Return valid Mermaid source.`,
          `Syntax guidance: ${SYNTAX_GUIDANCE[detectDiagramType(activeDocument.code)]}`,
          customPrompt ||
          (structured
            ? "Organize the content into a clear overview and focused supporting diagrams."
            : "Improve the structure and readability without changing the meaning."),
          `Existing Mermaid source:\n${activeDocument.code}`,
          feedback && `Validation feedback from attempt ${attempt + 1}: ${feedback}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        const output = await requestAiText({
          provider: data.settings.provider,
          apiKey: data.credentials.apiKey,
          system: structured ? SYSTEM_STRUCTURED : SYSTEM_MERMAID,
          prompt,
          signal: controller.signal,
          onText: setAiStream,
        });
        try {
          if (structured) {
            const result = parseStructuredDiagrams(output);
            await validateMermaid(result.overview);
            for (const diagram of result.diagrams) await validateMermaid(diagram.code);
            setAiPanel({ kind: "structured", result });
          } else {
            const code = cleanMermaidCode(output);
            await validateMermaid(code);
            setAiPanel({ kind: "refine", code });
          }
          setAiError("");
          return;
        } catch (error) {
          feedback = messageFromError(error);
          if (attempt === 2) throw new Error(`The AI response failed validation: ${feedback}`);
        }
      }
    } catch (error) {
      setAiError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Request stopped."
          : errorText(error),
      );
    } finally {
      if (aiController.current === controller) aiController.current = null;
      setAiBusy(false);
    }
  };

  const stopAi = () => aiController.current?.abort();

  const detectModels = async (providerOverride?: ProviderSettings, silent = false) => {
    const current = dataRef.current;
    if (!current) return;
    const target = providerOverride ?? current.settings.provider;
    if (!target.baseUrl.trim()) {
      if (!silent) setTestStatus("Enter an endpoint base URL first.");
      return;
    }
    if (!silent) setTestStatus("Detecting models...");
    try {
      const models = await fetchProviderModels(target, current.credentials.apiKey);
      setDetectedModels(models);
      if (models.length > 0 && !target.model.trim()) {
        changeSettings({ provider: { ...target, model: models[0]! } });
      }
      if (!silent) {
        setTestStatus(models.length > 0 ? `Detected ${models.length} model(s).` : "No models returned by endpoint.");
      }
    } catch (error) {
      setDetectedModels([]);
      if (!silent) setTestStatus(errorText(error));
    }
  };

  const testConnection = async () => {
    if (!data) return;
    const controller = new AbortController();
    setTestStatus("Testing…");
    try {
      await requestAiText({
        provider: data.settings.provider,
        apiKey: data.credentials.apiKey,
        system: "Reply with OK only.",
        prompt: "Test connection",
        signal: controller.signal,
        onText: () => undefined,
      });
      setTestStatus("Connection succeeded.");
    } catch (error) {
      setTestStatus(errorText(error));
    }
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStorageError("");
    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".ctd.json") || lowerName.endsWith(".json")) {
        if (!activeDocument) return;
        if (endedRoomDocIds.has(activeDocument.id)) {
          setStorageError("This live room has ended; layout is read-only.");
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          throw new Error("Sidecar file is too large (max 2 MB).");
        }
        const sidecar = parseSidecar(await file.text());
        changeLayout(sidecar.layout);
        setNotice(`${file.name} layout applied.`);
        return;
      }
      const code = getImportedMermaid(await file.text(), file.name);
      const name = file.name.replace(/\.(mmd|mermaid|md)$/i, "") || "Imported diagram";
      createTab(name, code);
      setNotice(`${file.name} opened.`);
    } catch (error) {
      setStorageError(errorText(error));
    } finally {
      event.target.value = "";
    }
  };

  useEffect(() => {
    if (!activeDocument) return;
    if (roomMode === "host" && hostRoomRef.current) {
      roomDocIdRef.current = activeDocument.id;
    }
    if (applyingRoomSyncRef.current) return;
    if (roomMode === "host" && hostRoomRef.current) {
      hostRoomRef.current.broadcast({
        name: activeDocument.name,
        code: activeDocument.code,
        layout: activeDocument.layout,
      });
    } else if (roomMode === "guest" && guestRoomRef.current && activeDocument.id === roomDocIdRef.current) {
      guestRoomRef.current.sendEdit(activeDocument.code, activeDocument.layout);
    }
  }, [activeDocument?.id, activeDocument?.name, activeDocument?.code, activeDocument?.layout, roomMode]);

  useEffect(() => {
    applyingRoomSyncRef.current = false;
  }, [data]);

  useEffect(() => {
    return () => {
      hostRoomRef.current?.close();
      hostRoomRef.current = null;
      guestRoomRef.current?.leave();
      guestRoomRef.current = null;
    };
  }, []);

  const startLiveRoom = async () => {
    if (!activeDocument) return;
    const { createRoomId, createRoomUrl, startHostRoom } = await import("./lib/room");
    if (roomMode === "host" && hostRoomRef.current) {
      try {
        await navigator.clipboard.writeText(createRoomUrl(hostRoomRef.current.roomId));
        setNotice("Live room link copied (max 5 devices).");
      } catch {
        setStorageError("Clipboard access was blocked.");
      }
      return;
    }
    guestRoomRef.current?.leave();
    guestRoomRef.current = null;
    const roomId = createRoomId();
    roomDocIdRef.current = activeDocument.id;
    setRoomMode("host");
    setRoomNotice("");
    const session = startHostRoom(
      roomId,
      () => {
        const doc =
          dataRef.current?.documents.find((d) => d.id === roomDocIdRef.current) ??
          dataRef.current?.documents[0];
        return {
          name: doc?.name ?? "Live room",
          code: doc?.code ?? "",
          layout: doc?.layout ?? {},
        };
      },
      {
        onDevicesChange: setRoomDevices,
        onGuestEdit: (code, layout) => {
          const targetId = roomDocIdRef.current;
          if (!targetId || !dataRef.current?.documents.some((d) => d.id === targetId)) return;
          applyingRoomSyncRef.current = true;
          updateDocument(targetId, (doc) => ({ ...doc, code, layout }));
        },
        onError: (msg) => setStorageError(msg),
      },
    );
    hostRoomRef.current = session;
    try {
      await navigator.clipboard.writeText(createRoomUrl(roomId));
      setNotice("Live room started and link copied (max 5 devices).");
    } catch {
      setNotice("Live room started (max 5 devices).");
    }
  };

  const endLiveRoom = () => {
    hostRoomRef.current?.close();
    hostRoomRef.current = null;
    guestRoomRef.current?.leave();
    guestRoomRef.current = null;
    setRoomMode("none");
    setRoomDevices(1);
    setNotice("Live room ended.");
  };

  const copyCode = async () => {
    if (!activeDocument) return;
    try {
      await navigator.clipboard.writeText(activeDocument.code);
      setNotice("Mermaid source copied.");
    } catch (error) {
      setStorageError(`Clipboard access failed: ${errorText(error)}`);
    }
  };

  const saveMmd = () => {
    if (!activeDocument) return;
    const format = detectCodeFormat(activeDocument.code);
    const ext = FORMAT_EXTENSIONS[format];
    downloadText(`${activeDocument.name.replace(/[\\/:*?"<>|]/g, "-")}.${ext}`, activeDocument.code);
    setNotice(`${FORMAT_LABELS[format]} file downloaded.`);
  };

  const saveSidecar = () => {
    if (!activeDocument) return;
    const format = detectCodeFormat(activeDocument.code);
    const ext = FORMAT_EXTENSIONS[format];
    const safeBase = activeDocument.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "diagram";
    const filename = sidecarFilename(safeBase);
    const generatedFrom = safeBase.toLowerCase().endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`;
    const content = serializeSidecar(activeDocument.layout, {
      generatedFrom,
      updatedAt: new Date().toISOString(),
    });
    downloadText(filename, content, "application/json");
    setNotice(`${filename} downloaded.`);
  };

  const saveSvg = async () => {
    if (!activeDocument || !data) return;
    try {
      await exportSvg(
        `${activeDocument.name.replace(/[\\/:*?"<>|]/g, "-")}.svg`,
        data.settings,
      );
    } catch (error) {
      setStorageError(errorText(error));
    }
  };

  const savePng = async () => {
    if (!activeDocument || !data) return;
    setSaveBusy(true);
    try {
      await exportPng(
        `${activeDocument.name.replace(/[\\/:*?"<>|]/g, "-")}.png`,
        data.settings,
      );
    } catch (error) {
      setStorageError(errorText(error));
    } finally {
      setSaveBusy(false);
    }
  };

  const saveSubmission = async () => {
    if (!activeDocument || !data) return;
    const format = detectCodeFormat(activeDocument.code);
    const ext = FORMAT_EXTENSIONS[format];
    const safeBase = activeDocument.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "diagram";
    const hasLayout = Object.keys(activeDocument.layout).length > 0;
    setSaveBusy(true);
    try {
      await exportPng(`${safeBase}.png`, data.settings);
      downloadText(`${safeBase}.${ext}`, activeDocument.code);
      if (hasLayout) {
        const filename = sidecarFilename(safeBase);
        const generatedFrom = safeBase.toLowerCase().endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`;
        const content = serializeSidecar(activeDocument.layout, {
          generatedFrom,
          updatedAt: new Date().toISOString(),
        });
        downloadText(filename, content, "application/json");
        setNotice(`Submission exported: ${safeBase}.png, ${safeBase}.${ext}, and ${filename}.`);
      } else {
        setNotice(`Submission exported: ${safeBase}.png and ${safeBase}.${ext}.`);
      }
    } catch (error) {
      setStorageError(errorText(error));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleTabKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const tabs = Array.from(
      event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (!tabs.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const tab = tabs[nextIndex];
    tab?.focus();
    if (tab?.dataset.documentId) setActiveDocument(tab.dataset.documentId);
  };

  const beginSplit = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      changeSettings({ splitPercent: Math.min(50, Math.max(22, ((moveEvent.clientX - rect.left) / rect.width) * 100)) });
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };

  if (bootError && !data) {
    return (
      <main className="boot-screen">
        <div className="boot-card">
          <GitBranch aria-hidden="true" size={22} />
          <h1>CTD Studio</h1>
          <p>{legacyError ? "Your older saved workspace could not be migrated." : errorText(bootError)}</p>
          {legacyError && (
            <button
              className="button secondary"
              onClick={() => downloadText("mstudio2-recovery.json", legacyError.raw, "application/json")}
            >
              <Download aria-hidden="true" size={16} /> Download recovery copy
            </button>
          )}
          <div className="button-row">
            <button className="button primary" onClick={() => void boot()}>Retry</button>
            {legacyError && (
              <button className="button secondary" onClick={() => void boot(true)}>
                Start fresh without deleting backup
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (view === "home") {
    return <HomePage onStart={openStudio} onDocs={openDocs} onLegal={openLegal} />;
  }

  if (view === "notFound") {
    return (
      <NotFoundPage
        path={window.location.pathname}
        onHome={openHome}
        onStart={() => openStudio()}
        onDocs={openDocs}
      />
    );
  }

  if (view === "docs") {
    return (
      <DocsPage
        onBack={openHome}
        onStart={openStudio}
        onOpenSample={() => void openSampleGitFlow()}
        onLegal={openLegal}
      />
    );
  }

  if (view === "privacy" || view === "terms") {
    return (
      <LegalPage
        tab={view}
        onSwitch={openLegal}
        onBack={openHome}
        onStart={() => openStudio()}
      />
    );
  }

  if (!data || !activeDocument) {
    return <main className="boot-screen" aria-live="polite">Loading saved diagrams…</main>;
  }

  const supportedMovement = MOVABLE_DIAGRAM_TYPES.has(diagramType);
  const currentDirection = detectDirectionFromCode(activeDocument.code);
  const codeFormat = detectCodeFormat(activeDocument.code);
  const isReadOnlySnapshot = endedRoomDocIds.has(activeDocument.id);
  const hasCustomLayout = Object.keys(activeDocument.layout).length > 0;
  const activeErrorText = storageError || renderError?.message || "";
  const pedagogicalHint = activeErrorText
    ? getPedagogicalErrorHint(activeDocument.code, activeErrorText)
    : null;

  const clampedSplitPercent = Math.min(50, Math.max(22, data.settings.splitPercent));
  const aiFloatingBar = aiBarVisible ? (
    <div className="ai-floating-wrap">
      {aiMenuOpen && (
        <div className="ai-actions-popover" role="menu">
          <button type="button" role="menuitem" disabled={aiBusy || isReadOnlySnapshot} onClick={() => { setAiMenuOpen(false); setAiMode("structured"); void runAi("structured"); }}>
            <GitBranch aria-hidden="true" size={14} /> Structure
          </button>
          <button type="button" role="menuitem" disabled={aiBusy || isReadOnlySnapshot} onClick={() => { setAiMenuOpen(false); setAiMode("refine"); void runAi("refine", "Fix any syntax errors so the diagram renders cleanly while preserving its meaning."); }}>
            Fix syntax
          </button>
          <button type="button" role="menuitem" disabled={aiBusy || isReadOnlySnapshot} onClick={() => { setAiMenuOpen(false); setAiMode("refine"); void runAi("refine", "Add cohesive classDef or style definitions to highlight key nodes while keeping all labels and relationships intact."); }}>
            Style it
          </button>
          <button type="button" role="menuitem" disabled={aiBusy || isReadOnlySnapshot} onClick={() => { setAiMenuOpen(false); setAiMode("refine"); void runAi("refine", "Tidy the layout, shorten verbose labels, and simplify structure without losing meaning."); }}>
            Tidy
          </button>
          <button type="button" role="menuitem" disabled={aiBusy} onClick={() => { setAiMenuOpen(false); setAiMode("explain"); void runAi("explain"); }}>
            Explain
          </button>
        </div>
      )}
      <div className="ai-floating-pill">
        <button
          className="ai-pill-plus"
          type="button"
          title="AI actions"
          aria-label="AI actions"
          aria-expanded={aiMenuOpen}
          onClick={() => {
            const next = !aiMenuOpen;
            closeAllMenus();
            setAiMenuOpen(next);
          }}
        >
          <Plus aria-hidden="true" size={16} />
        </button>
        <input
          id="ai-request"
          type="text"
          value={aiPrompt}
          onChange={(event) => setAiPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || ((event.ctrlKey || event.metaKey) && event.key === "Enter")) && !aiBusy && !isReadOnlySnapshot) {
              event.preventDefault();
              setAiMode("refine");
              void runAi("refine");
            }
          }}
          placeholder="Describe your idea or change..."
          aria-label="Describe your idea or change"
        />
        {aiBusy ? (
          <button className="button stop-button ai-pill-send" type="button" onClick={stopAi}>
            <StopCircle aria-hidden="true" size={15} /> Stop
          </button>
        ) : (
          <button
            className="button primary ai-pill-send"
            type="button"
            disabled={isReadOnlySnapshot}
            title="Refine with AI"
            onClick={() => { setAiMode("refine"); void runAi("refine"); }}
          >
            <Wand2 aria-hidden="true" size={15} /> Refine
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <main className="studio" style={{ "--split": `${clampedSplitPercent}%` } as CSSProperties}>
      <header className="topbar">
        <div className="brand-lockup">
          <button
            className="brand-home-button"
            type="button"
            onClick={openHome}
            title="Back to home"
            aria-label="CTD Studio home"
          >
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="brand-name">CTD Studio</span>
          </button>
          <span className="brand-divider" aria-hidden="true" />
          <span className="workbench-label">Diagram workbench</span>
        </div>
        <div className="top-actions">
          <span className={`save-status ${saveState}`} role="status">
            {saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved" : `Saved ${timeLabel(lastSavedAt)}`}
          </span>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".mmd,.mermaid,.md,.dot,.gv,.puml,.plantuml,.d2,.sql,.ts,.xml,.ctd.json,.json,text/plain,text/markdown,application/xml,application/json" onChange={(event) => void importFile(event)} />
          <button
            className={`live-share-button${roomMode !== "none" ? " room-active" : ""}`}
            type="button"
            title={roomMode === "host" ? `Live room (${roomDevices}/${MAX_ROOM_DEVICES} devices)` : "Host live room (max 5 devices)"}
            aria-label={roomMode === "host" ? "Copy live room link" : "Host live room (max 5 devices)"}
            onClick={() => void startLiveRoom()}
          >
            <Users aria-hidden="true" size={15} />
            <span>{roomMode === "none" ? "Share live" : `Live ${roomDevices}/${MAX_ROOM_DEVICES}`}</span>
          </button>
          <button className="icon-button" title="Export SVG" aria-label="Export SVG" onClick={saveSvg}>
            <FileCode2 aria-hidden="true" size={17} />
          </button>
          <button className="icon-button" title="Export PNG" aria-label="Export PNG" disabled={saveBusy} onClick={() => void savePng()}>
            <ImageDown aria-hidden="true" size={17} />
          </button>
          <button className="icon-button settings-trigger" title="Settings" aria-label="Open settings" onClick={() => setSettingsOpen(true)}>
            <Settings aria-hidden="true" size={17} />
          </button>
          <div className="studio-menu-wrap">
            <button
              className="icon-button"
              type="button"
              title="Menu"
              aria-label="Studio menu"
              aria-expanded={studioMenuOpen}
              onClick={() => {
                const next = !studioMenuOpen;
                closeAllMenus();
                setStudioMenuOpen(next);
              }}
            >
              <Menu aria-hidden="true" size={17} />
            </button>
            {studioMenuOpen && (
              <div className="studio-menu-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); fileInput.current?.click(); }}>
                  <FolderOpen aria-hidden="true" size={15} /> Open file…
                </button>
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); fileInput.current?.click(); }}>
                  <LayoutGrid aria-hidden="true" size={15} /> Import layout (.ctd.json)…
                </button>
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); saveSidecar(); }}>
                  <Download aria-hidden="true" size={15} /> Export layout (.ctd.json)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={saveBusy}
                  onClick={() => {
                    setStudioMenuOpen(false);
                    void saveSubmission();
                  }}
                >
                  <ImageDown aria-hidden="true" size={15} />{" "}
                  {hasCustomLayout
                    ? "Submission export (PNG + .mmd + .ctd.json)"
                    : "Submission export (PNG + .mmd)"}
                </button>
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); void copyCode(); }}>
                  <Copy aria-hidden="true" size={15} /> Copy source
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(data.settings.colorizeBoxes)}
                  className="theme-switch-row"
                  onClick={() => changeSettings({ colorizeBoxes: !data.settings.colorizeBoxes })}
                >
                  <span className="theme-switch-label">
                    <Palette aria-hidden="true" size={15} />
                    <span>Colorized export</span>
                  </span>
                  <span className={`theme-switch-track${data.settings.colorizeBoxes ? " is-on" : ""}`} aria-hidden="true">
                    <span className="theme-switch-thumb">
                      <Palette size={11} />
                    </span>
                  </span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); openDocs(); }}>
                  <BookOpen aria-hidden="true" size={15} /> Docs &amp; tutorial
                </button>
                <button type="button" role="menuitem" onClick={() => { setStudioMenuOpen(false); openHome(); }}>
                  <GitBranch aria-hidden="true" size={15} /> Back to home
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={data.settings.theme === "dark"}
                  className="theme-switch-row"
                  onClick={() => {
                    const nextTheme = data.settings.theme === "dark" ? "default" : "dark";
                    changeSettings({ theme: nextTheme, ...THEME_PRESETS[nextTheme] });
                  }}
                >
                  <span className="theme-switch-label">
                    {data.settings.theme === "dark" ? <Moon aria-hidden="true" size={15} /> : <Sun aria-hidden="true" size={15} />}
                    <span>Dark mode</span>
                  </span>
                  <span className={`theme-switch-track${data.settings.theme === "dark" ? " is-on" : ""}`} aria-hidden="true">
                    <span className="theme-switch-thumb">
                      {data.settings.theme === "dark" ? <Moon size={11} /> : <Sun size={11} />}
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section
        className="document-strip"
        aria-label="Diagrams"
        onContextMenu={(event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest(".document-tab")) return;
          event.preventDefault();
          closeAllMenus();
          setTabContextMenu({
            docId: null,
            x: Math.min(window.innerWidth - 180, Math.max(8, event.clientX)),
            y: Math.min(window.innerHeight - 120, Math.max(8, event.clientY)),
          });
        }}
      >
        <div className="document-tabs" role="tablist" aria-label="Open diagrams">
          {data.documents.map((document, index) => (
            <div
              className="document-tab"
              role="presentation"
              key={document.id}
              onContextMenu={(event) => {
                event.preventDefault();
                closeAllMenus();
                setTabContextMenu({
                  docId: document.id,
                  x: Math.min(window.innerWidth - 180, Math.max(8, event.clientX)),
                  y: Math.min(window.innerHeight - 170, Math.max(8, event.clientY)),
                });
              }}
            >
              {renameId === document.id ? (
                <input
                  className="rename-input"
                  aria-label="Diagram name"
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") setRenameId("");
                  }}
                />
              ) : (
                <button
                  id={`tab-${document.id}`}
                  className="document-tab-button"
                  type="button"
                  role="tab"
                  aria-selected={document.id === activeDocument.id}
                  tabIndex={document.id === activeDocument.id ? 0 : -1}
                  data-document-id={document.id}
                  onClick={() => setActiveDocument(document.id)}
                  onDoubleClick={() => startRename(document)}
                  onKeyDown={(event) => handleTabKey(event, index)}
                  title="Double-click to rename"
                >
                  <span>{document.name}</span>
                </button>
              )}
              <button
                className="tab-close"
                type="button"
                aria-label={`Close ${document.name}`}
                onClick={() => setPendingDeleteId(document.id)}
              >
                <X aria-hidden="true" size={13} />
              </button>
            </div>
          ))}
        </div>
        <button className="new-tab-button" type="button" onClick={() => setNewDiagramOpen(true)} aria-label="New diagram" title="New diagram">
          <Plus aria-hidden="true" size={17} />
        </button>
        <div className="tab-actions-wrap">
          <button
            className="new-tab-button"
            type="button"
            title="Diagram actions (Rename, Duplicate, Delete)"
            aria-label="Diagram actions"
            aria-expanded={tabMenuOpen}
            onClick={() => {
              const next = !tabMenuOpen;
              closeAllMenus();
              setTabMenuOpen(next);
            }}
          >
            <MoreVertical aria-hidden="true" size={16} />
          </button>
          {tabMenuOpen && (
            <div className="studio-menu-popover tab-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => { setTabMenuOpen(false); startRename(activeDocument); }}>
                <Pencil aria-hidden="true" size={14} /> Rename
              </button>
              <button type="button" role="menuitem" onClick={() => { setTabMenuOpen(false); createTab(`${activeDocument.name} copy`, activeDocument.code); }}>
                <Copy aria-hidden="true" size={14} /> Duplicate
              </button>
              <button type="button" role="menuitem" className="danger-item" onClick={() => { setTabMenuOpen(false); setPendingDeleteId(activeDocument.id); }}>
                <Trash2 aria-hidden="true" size={14} /> Delete
              </button>
            </div>
          )}
        </div>
        {tabContextMenu && (() => {
          if (tabContextMenu.docId === null) {
            return (
              <div
                className="studio-menu-popover tab-context-menu"
                role="menu"
                aria-label="Tab strip actions"
                style={{ position: "fixed", left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px`, right: "auto" }}
              >
                <button type="button" role="menuitem" onClick={() => { setTabContextMenu(null); setNewDiagramOpen(true); }}>
                  <Plus aria-hidden="true" size={14} /> New diagram
                </button>
              </div>
            );
          }
          const targetDoc = data.documents.find((doc) => doc.id === tabContextMenu.docId) ?? activeDocument;
          return (
            <div
              className="studio-menu-popover tab-context-menu"
              role="menu"
              aria-label={`Actions for ${targetDoc.name}`}
              style={{ position: "fixed", left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px`, right: "auto" }}
            >
              <button type="button" role="menuitem" onClick={() => { setTabContextMenu(null); startRename(targetDoc); }}>
                <Pencil aria-hidden="true" size={14} /> Rename
              </button>
              <button type="button" role="menuitem" onClick={() => { setTabContextMenu(null); createTab(`${targetDoc.name} copy`, targetDoc.code); }}>
                <Copy aria-hidden="true" size={14} /> Duplicate
              </button>
              <button type="button" role="menuitem" className="danger-item" onClick={() => { setTabContextMenu(null); setPendingDeleteId(targetDoc.id); }}>
                <Trash2 aria-hidden="true" size={14} /> Delete
              </button>
            </div>
          );
        })()}
      </section>

      <div className="message-stack">
        {roomMode !== "none" && (
          <section className="room-banner" role="status">
            <span>
              {roomMode === "host"
                ? `Hosting live room (${roomDevices}/${MAX_ROOM_DEVICES} devices). Closing this browser ends the room.`
                : `Connected to live room (${roomDevices}/${MAX_ROOM_DEVICES} devices).`}
            </span>
            {roomMode === "host" && (
              <button type="button" onClick={() => void startLiveRoom()}>
                Copy room link
              </button>
            )}
            <button type="button" onClick={endLiveRoom}>
              {roomMode === "host" ? "End room" : "Leave room"}
            </button>
          </section>
        )}
        {roomNotice && (
          <section className="conflict-banner" role="status">
            <span>{roomNotice}</span>
            <button type="button" onClick={() => setRoomNotice("")}>
              Dismiss
            </button>
          </section>
        )}
        {externalConflict && (
          <section className="conflict-banner" role="alert">
            <span>“{externalConflict.name}” changed in another browser tab.</span>
            <button
              type="button"
              onClick={() => {
                const conflict = externalConflict;
                expectedUpdatedAt.current.set(conflict.id, conflict.updatedAt);
                updateDocument(conflict.id, () => conflict, false);
                setExternalConflict(undefined);
                setStorageError("");
              }}
            >
              Load other version
            </button>
            <button
              type="button"
              onClick={() => {
                expectedUpdatedAt.current.set(externalConflict.id, externalConflict.updatedAt);
                setExternalConflict(undefined);
                markDirty(externalConflict.id);
              }}
            >
              Keep my version
            </button>
          </section>
        )}
        {(storageError || renderError) && (
          <section className="error-banner" role="alert">
            <span title={pedagogicalHint ? `${activeErrorText} — ${pedagogicalHint.hint}` : activeErrorText}>
              {activeErrorText}
              {pedagogicalHint ? ` — ${pedagogicalHint.hint}` : ""}
            </span>
            {renderError?.line && (
              <button
                type="button"
                onClick={() => {
                  setMobilePane("code");
                  setExpandedPane((current) => (current === "preview" ? "none" : current));
                  editorRef.current?.focusLine(renderError.line!);
                }}
              >
                Line {renderError.line}
              </button>
            )}
            {pedagogicalHint && (
              <button
                type="button"
                className="error-docs-link"
                title={`${pedagogicalHint.hint} Open /docs#${pedagogicalHint.anchor}`}
                onClick={() => openDocs(pedagogicalHint.anchor)}
              >
                {pedagogicalHint.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss error" onClick={() => { setStorageError(""); setRenderError(undefined); }}>
              <X aria-hidden="true" size={15} />
            </button>
          </section>
        )}
      </div>

      <div className="mobile-pane-switch" role="group" aria-label="Editor and preview">
        <button type="button" aria-pressed={mobilePane === "code"} onClick={() => setMobilePane("code")}><Code2 aria-hidden="true" size={15} /> Code</button>
        <button type="button" aria-pressed={mobilePane === "preview"} onClick={() => setMobilePane("preview")}><PanelRight aria-hidden="true" size={15} /> Preview</button>
      </div>

      <section
        ref={splitRef}
        className={`workspace mobile-${mobilePane}${expandedPane !== "none" ? ` expanded-${expandedPane}` : ""}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeDocument.id}`}
      >
        <section className="editor-pane" aria-label="Mermaid editor">
          <div className="pane-toolbar editor-toolbar">
            <div className="pane-title">
              <button
                className="icon-button compact pane-toggle"
                type="button"
                aria-label={expandedPane === "code" ? "Restore split view" : "Expand source editor"}
                title={expandedPane === "code" ? "Restore split view" : "Expand source editor"}
                aria-pressed={expandedPane === "code"}
                onClick={() => {
                  setExpandedPane((current) => (current === "code" ? "none" : "code"));
                  requestAnimationFrame(() => canvasRef.current?.fit());
                }}
              >
                <Code2 aria-hidden="true" size={15} />
              </button>
              <span>Source</span>
              <span className="language-chip">{FORMAT_LABELS[codeFormat]}</span>
              <select
                className="format-convert-select"
                aria-label="Convert code format"
                title="Translate current code to another format"
                disabled={isReadOnlySnapshot}
                value=""
                onPointerDown={() => closeAllMenus()}
                onFocus={() => closeAllMenus()}
                onChange={(event) => {
                  const target = event.target.value as CodeFormat | "";
                  if (!target) return;
                  try {
                    const converted = translateCodeFormat(activeDocument.code, target);
                    changeCode(converted);
                    setNotice(`Translated to ${FORMAT_LABELS[target]}.`);
                  } catch (error) {
                    setStorageError(errorText(error));
                  }
                }}
              >
                <option value="">Convert to…</option>
                {(Object.keys(FORMAT_LABELS) as CodeFormat[])
                  .filter((fmt) => fmt !== codeFormat)
                  .map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {FORMAT_LABELS[fmt]}
                    </option>
                  ))}
              </select>
            </div>
            <div className="pane-actions">
              <button className="icon-button compact" aria-label="Download source file" title="Download source file (Ctrl/Cmd+S)" onClick={saveMmd}><Download aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={isReadOnlySnapshot} onClick={undo}><Undo2 aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={isReadOnlySnapshot} onClick={redo}><Redo2 aria-hidden="true" size={15} /></button>
              <details
                className="history-menu"
                onToggle={(event) => {
                  if (event.currentTarget.open) closeAllMenus(event.currentTarget);
                }}
              >
                <summary aria-label="Version history" title="Version history"><History aria-hidden="true" size={15} /></summary>
                <div className="history-popover">
                  <strong>Version history</strong>
                  {activeDocument.history.length ? activeDocument.history.map((version) => (
                    <button key={version.id} type="button" onClick={() => restoreVersion(version)}>
                      <span>{version.reason}</span><small>{timeLabel(version.createdAt)}</small>
                    </button>
                  )) : <p>No saved versions yet.</p>}
                </div>
              </details>
            </div>
          </div>
          <div className="editor-content">
            <Suspense fallback={null}>
              <CodeEditor
                ref={editorRef}
                value={activeDocument.code}
                readOnly={isReadOnlySnapshot}
                darkMode={data.settings.theme === "dark"}
                error={renderError}
                onChange={changeCode}
                onUndo={undo}
                onRedo={redo}
              />
            </Suspense>
          </div>
          <div className="editor-footer">
            <span>{activeDocument.code.split(/\r?\n/).length} lines</span>
            <span>Move a node with drag or arrow keys; Shift moves farther.</span>
          </div>
        </section>

        <div
          className="split-handle"
          role="separator"
          aria-label="Resize source and preview panes"
          aria-orientation="vertical"
          aria-valuemin={22}
          aria-valuemax={50}
          aria-valuenow={Math.round(clampedSplitPercent)}
          tabIndex={0}
          onPointerDown={beginSplit}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              changeSettings({ splitPercent: Math.min(50, Math.max(22, clampedSplitPercent + (event.key === "ArrowRight" ? 2 : -2))) });
            }
          }}
        />

        <section className="preview-pane" aria-label="Diagram preview">
          <div className="pane-toolbar preview-toolbar">
            <div className="pane-title">
              <button
                className="icon-button compact pane-toggle"
                type="button"
                aria-label={expandedPane === "preview" ? "Restore split view" : "Expand preview"}
                title={expandedPane === "preview" ? "Restore split view" : "Expand preview"}
                aria-pressed={expandedPane === "preview"}
                onClick={() => {
                  setExpandedPane((current) => (current === "preview" ? "none" : "preview"));
                  requestAnimationFrame(() => canvasRef.current?.fit());
                }}
              >
                <PanelRight aria-hidden="true" size={15} />
              </button>
              <span className="preview-pane-label">Preview</span>
              <span className={`diagram-kind ${supportedMovement ? "movable" : ""}`}>{diagramType}</span>
              <button
                type="button"
                className={`diagram-capability-badge ${supportedMovement ? "is-draggable" : "is-render-only"}`}
                aria-label={`${supportedMovement ? "Draggable" : "Render-only"} diagram type — view compatibility matrix in docs`}
                title={
                  supportedMovement
                    ? "Draggable (Full Studio): drag nodes and 3-point lines, export .ctd.json sidecar. Click for format matrix in /docs."
                    : "Render-only (Auto-layout): rendered by Mermaid without manual box dragging. Click for format matrix in /docs."
                }
                onClick={() => openDocs("compatibility-matrix")}
              >
                {supportedMovement ? "Draggable" : "Render-only"}
              </button>
            </div>
            <div className="preview-actions">
              <div className="direction-menu-wrap">
                <button
                  className="icon-button compact"
                  type="button"
                  title="Diagram direction"
                  aria-label="Diagram direction"
                  aria-expanded={directionMenuOpen}
                  disabled={!supportedMovement || isReadOnlySnapshot}
                  onClick={() => {
                    const next = !directionMenuOpen;
                    closeAllMenus();
                    setDirectionMenuOpen(next);
                  }}
                >
                  <LayoutGrid aria-hidden="true" size={15} />
                </button>
                {directionMenuOpen && (
                  <div className="studio-menu-popover direction-popover" role="menu">
                    <span className="menu-section-title">Direction</span>
                    {(
                      [
                        { dir: "TD", label: "Top to bottom", Icon: ArrowDown },
                        { dir: "BT", label: "Bottom to top", Icon: ArrowUp },
                        { dir: "LR", label: "Left to right", Icon: ArrowRight },
                        { dir: "RL", label: "Right to left", Icon: ArrowLeft },
                      ] as const
                    ).map(({ dir, label, Icon }) => (
                      <button
                        key={dir}
                        type="button"
                        role="menuitem"
                        className={currentDirection === dir ? "active-dir" : undefined}
                        onClick={() => {
                          setDirectionMenuOpen(false);
                          changeCode(applyDiagramDirection(activeDocument.code, dir));
                          changeLayout({});
                          requestAnimationFrame(() => canvasRef.current?.fit());
                        }}
                      >
                        <span>{label}</span>
                        <Icon aria-hidden="true" size={14} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="icon-button compact"
                type="button"
                aria-label={aiBarVisible ? "Hide AI assistant bar" : "Show AI assistant bar"}
                title={aiBarVisible ? "Hide AI assistant bar" : "Show AI assistant bar"}
                aria-pressed={aiBarVisible}
                onClick={() => setAiBarVisible((current) => !current)}
              >
                <Wand2 aria-hidden="true" size={15} />
              </button>
              <button
                className="icon-button compact"
                type="button"
                aria-label="Reset node positions to automatic layout"
                title="Reset node positions"
                disabled={!Object.keys(activeDocument.layout).length || isReadOnlySnapshot}
                onClick={() => {
                  changeLayout({});
                  requestAnimationFrame(() => canvasRef.current?.fit());
                }}
              >
                <RefreshCcw aria-hidden="true" size={15} />
              </button>
              <details
                className="sensitivity-menu"
                onToggle={(event) => {
                  if (event.currentTarget.open) closeAllMenus(event.currentTarget);
                }}
              >
                <summary aria-label="Pan and zoom settings" title="Pan and zoom settings"><Settings2 aria-hidden="true" size={15} /></summary>
                <div className="sensitivity-popover">
                  <strong>Pan and zoom</strong>
                  <label>Scroll behavior
                    <select value={data.settings.scrollMode} onChange={(event) => changeSettings({ scrollMode: event.target.value as "pan" | "zoom" })}>
                      <option value="pan">Scroll to pan</option>
                      <option value="zoom">Scroll to zoom</option>
                    </select>
                  </label>
                  <label>Zoom speed <input type="range" min="0.5" max="2" step="0.1" value={data.settings.zoomSpeed} onChange={(event) => changeSettings({ zoomSpeed: Number(event.target.value) })} /></label>
                  <label>Pan speed <input type="range" min="0.4" max="2" step="0.1" value={data.settings.panSpeed} onChange={(event) => changeSettings({ panSpeed: Number(event.target.value) })} /></label>
                  <label>Drag speed <input type="range" min="0.25" max="1.5" step="0.05" value={data.settings.dragSpeed} onChange={(event) => changeSettings({ dragSpeed: Number(event.target.value) })} /></label>
                  <label className="check-row"><input type="checkbox" checked={data.settings.invertScroll} onChange={(event) => changeSettings({ invertScroll: event.target.checked })} /> Invert scroll</label>
                  <label className="check-row"><input type="checkbox" checked={data.settings.smoothZoom} onChange={(event) => changeSettings({ smoothZoom: event.target.checked })} /> Smooth zoom</label>
                  <label className="check-row"><input type="checkbox" checked={data.settings.snapEnabled} onChange={(event) => changeSettings({ snapEnabled: event.target.checked })} /> Snap nodes to grid</label>
                  <label>Grid size <input type="number" min={0} max={100} step={1} value={data.settings.snapSize} onChange={(event) => { const raw = Number(event.target.value); changeSettings({ snapSize: Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0 }); }} /></label>
                  <p>V: move. H: hand. Space+drag: pan. Shift+1: fit. +/-: zoom. Shift: precision. Alt: bypass grid.</p>
                </div>
              </details>
            </div>
          </div>
          <div className="canvas-status">
            <span className="canvas-status-primary">
              {isReadOnlySnapshot
                ? "Room ended by host. Read-only snapshot: export SVG, PNG, or source."
                : supportedMovement
                  ? <span id="node-movement-help">V: move. H: hand. Space+drag: pan. Shift+1: fit. +/-: zoom. Arrow keys: nudge a box. Alt: bypass grid.</span>
                  : `${diagramType} diagrams use automatic layout; individual node movement is unavailable.`}
            </span>
            {!isReadOnlySnapshot && firstDragTriggered && !firstDragDismissed ? (
              <span className="first-drag-explainer" role="status" aria-label="First-drag sidecar hint">
                <span className="first-drag-copy">Layout set: save <code>.ctd.json</code> sidecar or bundle</span>
                <button
                  type="button"
                  className="canvas-status-btn"
                  title="Export PNG + source (.mmd) + layout (.ctd.json)"
                  onClick={() => void saveSubmission()}
                >
                  Export bundle
                </button>
                <button
                  type="button"
                  className="canvas-status-dismiss"
                  aria-label="Dismiss sidecar hint"
                  title="Dismiss sidecar layout hint"
                  onClick={dismissFirstDragExplainer}
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </span>
            ) : !isReadOnlySnapshot && !coachmarkDismissed ? (
              <span className="studio-coachmark" role="region" aria-label="First-run guide">
                <button
                  type="button"
                  className="canvas-status-btn"
                  title="Open 5-minute first-time code-to-diagram tutorial in /docs"
                  onClick={() => openDocs()}
                >
                  First time? Tutorial (/docs)
                </button>
                <button
                  type="button"
                  className="canvas-status-dismiss"
                  aria-label="Dismiss quick start hint"
                  title="Dismiss first-run hint"
                  onClick={dismissCoachmark}
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </span>
            ) : null}
          </div>
          <div className="canvas-stage">
            <Suspense fallback={null}>
              <DiagramCanvas
                ref={canvasRef}
                document={activeDocument}
                settings={data.settings}
                readOnly={isReadOnlySnapshot}
                onLayoutChange={changeLayout}
                onCodeChange={changeCode}
                onNodeMoved={announceNodeMoved}
                onNodeSelect={(id) => {
                  setMobilePane("code");
                  setExpandedPane((current) => (current === "preview" ? "none" : current));
                  editorRef.current?.focusNode(id);
                }}
                onToolChange={setCanvasTool}
                onRenderError={setRenderError}
                onTypeChange={setDiagramType}
              />
            </Suspense>
            <div className="canvas-vertical-dock" role="toolbar" aria-label="Canvas tools" aria-orientation="vertical">
              <button
                className="icon-button compact"
                type="button"
                aria-label="Move tool (V)"
                title="Move tool (V)"
                aria-pressed={canvasTool === "move"}
                onClick={() => canvasRef.current?.setTool("move")}
              >
                <MousePointer aria-hidden="true" size={15} />
              </button>
              <button
                className="icon-button compact"
                type="button"
                aria-label="Hand pan tool (H)"
                title="Hand pan tool (H)"
                aria-pressed={canvasTool === "hand"}
                onClick={() => canvasRef.current?.setTool("hand")}
              >
                <Hand aria-hidden="true" size={15} />
              </button>
              <span className="dock-separator" aria-hidden="true" />
              <button className="icon-button compact" type="button" aria-label="Zoom out" title="Zoom out (-)" onClick={() => canvasRef.current?.zoomBy(1 / 1.15)}><ZoomOut aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" type="button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => canvasRef.current?.zoomBy(1.15)}><ZoomIn aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" type="button" aria-label="Fit diagram" title="Fit diagram (Shift+1)" onClick={() => canvasRef.current?.fit()}><Scan aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" type="button" aria-label="Reset pan and zoom" title="Reset pan and zoom" onClick={() => canvasRef.current?.reset()}><RotateCcw aria-hidden="true" size={15} /></button>
            </div>
            {expandedPane !== "code" && aiFloatingBar}
          </div>
        </section>
      </section>

      <AnimatePresence>
        {(aiPanel || aiError || (aiBusy && aiStream && aiMode !== "explain")) && (
          <motion.aside
            className="ai-result-panel"
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            aria-label="AI result"
          >
            <div className="result-heading">
              <div>
                <Wand2 aria-hidden="true" size={16} />
                <h2>{aiPanel?.kind === "explain" ? "Explanation" : aiPanel?.kind === "structured" ? "Structured diagrams" : "AI preview"}</h2>
                <span className="ai-provider-pill">{PROVIDERS[data.settings.provider.provider].label} · {data.settings.provider.model}</span>
              </div>
              <button className="icon-button compact" aria-label="Close AI result" onClick={() => { setAiPanel(null); setAiError(""); setAiStream(""); }}><X aria-hidden="true" size={15} /></button>
            </div>
            {aiError && (
              <div className="ai-error" role="alert">
                <p>{aiError}</p>
                <div className="ai-error-actions">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setSettingsTab("ai");
                      setSettingsOpen(true);
                    }}
                  >
                    <Settings aria-hidden="true" size={14} />
                    Open AI settings
                  </button>
                  <button
                    className="button text-button"
                    type="button"
                    onClick={() => setAiError("")}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {aiBusy && <p className="stream-status" aria-live="polite">Receiving response…</p>}
            {aiPanel?.kind === "explain" && <div className="explanation-copy">{aiPanel.text}</div>}
            {aiPanel?.kind === "refine" && (
              <div className="code-preview">
                <pre>{aiPanel.code}</pre>
              </div>
            )}
            {aiPanel?.kind === "structured" && (
              <div className="structured-list">
                <article><strong>Overview</strong><pre>{aiPanel.result.overview}</pre></article>
                {aiPanel.result.diagrams.map((diagram) => (
                  <article key={diagram.name}><strong>{diagram.name}</strong><pre>{diagram.code}</pre></article>
                ))}
              </div>
            )}
            {!aiPanel && aiBusy && <pre className="stream-preview">{aiStream || "Waiting for the provider…"}</pre>}
            {aiPanel && aiPanel.kind !== "explain" && (
              <div className="result-actions">
                <button className="button primary" type="button" onClick={acceptAiResult}><Check aria-hidden="true" size={15} /> Apply</button>
                <button className="button secondary" type="button" onClick={() => setAiPanel(null)}>Discard</button>
              </div>
            )}
            <p className="privacy-note">Requests go directly from this browser to your configured provider.</p>
          </motion.aside>
        )}
      </AnimatePresence>

      <dialog
        ref={settingsDialog}
        className="settings-dialog"
        aria-labelledby="settings-title"
        aria-describedby="provider-privacy"
        onClose={() => setSettingsOpen(false)}
      >
        <div className="dialog-heading">
          <div><h2 id="settings-title">Studio settings</h2><p>Diagram appearance, theme presets, and AI provider.</p></div>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={() => settingsDialog.current?.close()}><X aria-hidden="true" size={17} /></button>
        </div>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {(
            [
              { id: "appearance", label: "Appearance" },
              { id: "ai", label: "AI provider" },
            ] as const
          ).map((tab) => {
            const active = settingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`settings-tab${active ? " active" : ""}`}
                onClick={() => setSettingsTab(tab.id)}
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab-pill"
                    className="settings-tab-pill"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="settings-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="settings-content">
          {settingsTab === "appearance" ? (
            <fieldset className="settings-card">
              <legend>Diagram appearance</legend>
              <button
                type="button"
                role="switch"
                aria-checked={data.settings.theme === "dark"}
                className="theme-switch-row settings-dark-row"
                onClick={() => {
                  const nextTheme = data.settings.theme === "dark" ? "default" : "dark";
                  changeSettings({ theme: nextTheme, ...THEME_PRESETS[nextTheme] });
                }}
              >
                <span className="theme-switch-label">
                  {data.settings.theme === "dark" ? <Moon aria-hidden="true" size={15} /> : <Sun aria-hidden="true" size={15} />}
                  <span>Dark mode</span>
                </span>
                <span className={`theme-switch-track${data.settings.theme === "dark" ? " is-on" : ""}`} aria-hidden="true">
                  <span className="theme-switch-thumb">
                    {data.settings.theme === "dark" ? <Moon size={11} /> : <Sun size={11} />}
                  </span>
                </span>
              </button>
              <div
                className="settings-preview-swatch"
                data-look={data.settings.look}
                aria-hidden="true"
                style={{ backgroundColor: data.settings.canvasColor }}
              >
                <div
                  className="swatch-node"
                  style={{
                    backgroundColor: data.settings.primaryColor,
                    borderColor: data.settings.lineColor,
                    color: data.settings.textColor,
                    fontFamily: data.settings.font,
                  }}
                >
                  Node A
                </div>
                <svg width="44" height="16" viewBox="0 0 44 16">
                  <line x1="2" y1="8" x2="36" y2="8" stroke={data.settings.lineColor} strokeWidth="1.8" />
                  <polygon points="34,3 42,8 34,13" fill={data.settings.lineColor} />
                </svg>
                <div
                  className="swatch-node"
                  style={{
                    backgroundColor: data.settings.primaryColor,
                    borderColor: data.settings.lineColor,
                    color: data.settings.textColor,
                    fontFamily: data.settings.font,
                  }}
                >
                  Node B
                </div>
              </div>
              <div className="settings-grid">
                <label>Theme
                  <select
                    value={data.settings.theme}
                    onChange={(event) => {
                      const theme = event.target.value;
                      const preset = THEME_PRESETS[theme];
                      changeSettings(preset ? { theme, ...preset } : { theme });
                    }}
                  >
                    {["default", "dark", "forest", "neutral"].map((theme) => <option key={theme}>{theme}</option>)}
                  </select>
                </label>
                <label>Look
                  <select value={data.settings.look} onChange={(event) => changeSettings({ look: event.target.value })}>
                    <option value="classic">Classic</option><option value="handDrawn">Hand drawn</option>
                  </select>
                </label>
                <label>Primary color
                  <span className="color-input-row">
                    <input type="color" value={data.settings.primaryColor} onChange={(event) => changeSettings({ primaryColor: event.target.value })} />
                    <code>{data.settings.primaryColor}</code>
                  </span>
                </label>
                <label>Node text
                  <span className="color-input-row">
                    <input type="color" value={data.settings.textColor} onChange={(event) => changeSettings({ textColor: event.target.value })} />
                    <code>{data.settings.textColor}</code>
                  </span>
                </label>
                <label>Connectors
                  <span className="color-input-row">
                    <input type="color" value={data.settings.lineColor} onChange={(event) => changeSettings({ lineColor: event.target.value })} />
                    <code>{data.settings.lineColor}</code>
                  </span>
                </label>
                <label>Canvas
                  <span className="color-input-row">
                    <input type="color" value={data.settings.canvasColor} onChange={(event) => changeSettings({ canvasColor: event.target.value })} />
                    <code>{data.settings.canvasColor}</code>
                  </span>
                </label>
                <label className="wide-field">
                  Diagram font
                  <select
                    value={data.settings.font}
                    onChange={(event) => changeSettings({ font: event.target.value })}
                  >
                    {[
                      { label: "Inter / Sans (Default)", value: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
                      { label: "System UI", value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
                      { label: "JetBrains Mono (Code)", value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
                      { label: "Fira Code (Monospace)", value: "'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace" },
                      { label: "Georgia (Serif)", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
                      { label: "Trebuchet MS", value: "'Trebuchet MS', Verdana, Arial, sans-serif" },
                      { label: "Verdana", value: "Verdana, Geneva, Tahoma, sans-serif" },
                      { label: "Comic Sans MS (Handwritten)", value: "'Comic Sans MS', 'Segoe Print', cursive, sans-serif" },
                      ...(
                        [
                          "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                          "'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace",
                          "Georgia, Cambria, 'Times New Roman', Times, serif",
                          "'Trebuchet MS', Verdana, Arial, sans-serif",
                          "Verdana, Geneva, Tahoma, sans-serif",
                          "'Comic Sans MS', 'Segoe Print', cursive, sans-serif",
                        ].includes(data.settings.font)
                          ? []
                          : [{ label: `Custom (${data.settings.font})`, value: data.settings.font }]
                      ),
                    ].map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide-field settings-toggle-row">
                  <input
                    type="checkbox"
                    checked={Boolean(data.settings.colorizeBoxes)}
                    onChange={(event) => changeSettings({ colorizeBoxes: event.target.checked })}
                  />
                  <span className="settings-toggle-copy">
                    <strong>Colorize boxes &amp; classes on export</strong>
                    <span>Apply distinct palette colors to flowchart shapes and class boxes in SVG/PNG exports.</span>
                  </span>
                </label>
              </div>
            </fieldset>
          ) : (
            <fieldset className="settings-card">
              <legend>AI provider</legend>
              <div className="settings-grid">
                <label>Provider
                  <select
                    value={data.settings.provider.provider}
                    onChange={(event) => {
                      const provider = event.target.value as ProviderId;
                      const preset = PROVIDERS[provider];
                      const oldPreset = PROVIDERS[data.settings.provider.provider];
                      const model = data.settings.provider.model === oldPreset.model
                        ? preset.model
                        : data.settings.provider.model;
                      const nextProvider: ProviderSettings = {
                        ...data.settings.provider,
                        provider,
                        baseUrl: preset.baseUrl,
                        model,
                      };
                      setDetectedModels([]);
                      setTestStatus("");
                      changeSettings({ provider: nextProvider });
                      if (preset.baseUrl && (data.credentials.apiKey.trim() || provider === "ollama" || provider === "lmstudio")) {
                        void detectModels(nextProvider, true);
                      }
                    }}
                  >
                    {Object.entries(PROVIDERS).map(([id, provider]) => <option key={id} value={id}>{provider.label}</option>)}
                  </select>
                </label>
                <label>Model
                  <span className="password-input-row">
                    <input
                      list="ai-model-options"
                      value={data.settings.provider.model}
                      placeholder="Select or type model ID"
                      onChange={(event) => changeSettings({ provider: { ...data.settings.provider, model: event.target.value } })}
                    />
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() => void detectModels()}
                    >
                      Detect
                    </button>
                  </span>
                  <datalist id="ai-model-options">
                    {Array.from(
                      new Set([...detectedModels, ...(PROVIDERS[data.settings.provider.provider]?.models ?? [])]),
                    ).map((id) => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                </label>
                <label className="wide-field">
                  {PROVIDERS[data.settings.provider.provider]?.protocol === "anthropic"
                    ? "Anthropic API base URL"
                    : "Compatible API base URL"}
                  <input type="url" value={data.settings.provider.baseUrl} onChange={(event) => changeSettings({ provider: { ...data.settings.provider, baseUrl: event.target.value } })} />
                  {/^http:\/\/(?!localhost\b|127\.0\.0\.1\b|\[::1\])/i.test(data.settings.provider.baseUrl.trim()) && (
                    <span className="field-hint">
                      Warning: Use HTTPS for remote endpoints so API keys and diagrams are encrypted in transit.
                    </span>
                  )}
                </label>
                <label className="wide-field">API key
                  <span className="password-input-row">
                    <input
                      type={showApiKey ? "text" : "password"}
                      autoComplete="off"
                      placeholder={
                        PROVIDERS[data.settings.provider.provider]?.protocol === "anthropic" ? "sk-ant-..." : "sk-..."
                      }
                      value={data.credentials.apiKey}
                      onChange={(event) => {
                        const current = dataRef.current;
                        if (current) updateData({ ...current, credentials: { apiKey: event.target.value } });
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button compact"
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowApiKey((v) => !v)}
                    >
                      {showApiKey ? <EyeOff aria-hidden="true" size={14} /> : <Eye aria-hidden="true" size={14} />}
                    </button>
                  </span>
                </label>
                <label>Usage
                  <select
                    value={data.settings.provider.usage ?? "medium"}
                    onChange={(event) =>
                      changeSettings({ provider: { ...data.settings.provider, usage: event.target.value as AiUsageLevel } })
                    }
                  >
                    {(Object.entries(AI_USAGE_TOKENS) as Array<[AiUsageLevel, { label: string }]>).map(([level, info]) => (
                      <option key={level} value={level}>{info.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p id="provider-privacy" className="form-note">AI requests include the diagram, prompt, and API key, and go directly to the selected provider. Some endpoints block browser requests with CORS. Provider charges are separate from CTD Studio.</p>
              <div className="settings-actions">
                <button className="button secondary" type="button" onClick={() => void testConnection()}>Test connection</button>
                <span role="status">{testStatus}</span>
              </div>
            </fieldset>
          )}
        </div>
        <div className="dialog-footer">
          <button
            className="button text-button"
            type="button"
            onClick={() => {
              const preset = THEME_PRESETS[data.settings.theme] ?? THEME_PRESETS.default!;
              changeSettings({ ...preset });
            }}
          >
            Reset theme colors
          </button>
          <button className="button primary" type="button" onClick={() => settingsDialog.current?.close()}>Done</button>
        </div>
      </dialog>

      {(() => {
        const target = pendingDeleteId ? data.documents.find((doc) => doc.id === pendingDeleteId) ?? null : null;
        return (
          <dialog
            ref={deleteDialog}
            className="confirm-dialog"
            role="alertdialog"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onClose={() => setPendingDeleteId("")}
            onClick={(event) => {
              if (event.target === deleteDialog.current) setPendingDeleteId("");
            }}
          >
            <div className="confirm-dialog-body">
              <h2 id="delete-dialog-title">Delete &lsquo;{target?.name ?? "diagram"}&rsquo;?</h2>
              <p id="delete-dialog-desc">Once deleted, it cannot be restored.</p>
            </div>
            <div className="dialog-footer">
              <button className="button secondary" type="button" onClick={() => setPendingDeleteId("")}>
                Cancel
              </button>
              <button
                className="button danger"
                type="button"
                onClick={() => {
                  if (target) void removeTab(target.id);
                }}
              >
                Delete
              </button>
            </div>
          </dialog>
        );
      })()}

      {explainPopups.length > 0 && (
        <div className="explain-pop-stack" role="region" aria-label="Diagram explanations">
          {explainPopups.map((popup) => (
            <article key={popup.id} className="explain-pop" role="status">
              <div className="explain-pop-head">
                <span className="explain-pop-title">
                  <Wand2 aria-hidden="true" size={14} />
                  <span>{popup.title}</span>
                </span>
                <button
                  type="button"
                  aria-label="Dismiss explanation"
                  onClick={() => setExplainPopups((prev) => prev.filter((item) => item.id !== popup.id))}
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </div>
              <div className="explain-pop-body">{popup.text}</div>
            </article>
          ))}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check aria-hidden="true" size={15} /> {notice}
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X aria-hidden="true" size={14} /></button>
        </div>
      )}
      {expandedPane === "code" && aiFloatingBar}

      <dialog
        ref={newDiagramDialog}
        className="new-diagram-dialog"
        aria-labelledby="new-diagram-title"
        onClose={() => setNewDiagramOpen(false)}
        onClick={(event) => {
          if (event.target === newDiagramDialog.current) setNewDiagramOpen(false);
        }}
      >
        <div className="dialog-heading">
          <div>
            <h2 id="new-diagram-title">New diagram</h2>
            <p>Start from a template or pick a starter node.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close new diagram picker" onClick={() => setNewDiagramOpen(false)}>
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="new-diagram-body">
          <div className="new-diagram-picker">
            <div className="new-diagram-section new-diagram-lanes" aria-label="Onboarding lanes">
              <div className="new-diagram-lanes-head">
                <h3>Onboarding Lanes</h3>
                <div className="new-diagram-lane-pills" role="group" aria-label="Filter templates by lane">
                  <button
                    type="button"
                    className={`lane-filter-pill${newDiagramLane === "all" ? " active" : ""}`}
                    aria-pressed={newDiagramLane === "all"}
                    onClick={() => setNewDiagramLane("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`lane-filter-pill${newDiagramLane === "coursework" ? " active" : ""}`}
                    aria-pressed={newDiagramLane === "coursework"}
                    onClick={() => {
                      setNewDiagramLane("coursework");
                      if (!MOVABLE_DIAGRAM_TYPES.has(detectDiagramType(newDiagramSelection.code))) {
                        setNewDiagramSelection({
                          kind: "template",
                          label: "Flowchart",
                          title: "Flowchart",
                          code: TEMPLATES.Flowchart,
                        });
                      }
                    }}
                  >
                    Coursework (Draggable)
                  </button>
                  <button
                    type="button"
                    className={`lane-filter-pill${newDiagramLane === "project" ? " active" : ""}`}
                    aria-pressed={newDiagramLane === "project"}
                    onClick={() => setNewDiagramLane("project")}
                  >
                    Project &amp; Git
                  </button>
                </div>
              </div>
              <div className="new-diagram-lane-cards">
                <article className={`new-diagram-lane-card${newDiagramLane === "coursework" ? " active" : ""}`} data-lane="coursework">
                  <div className="lane-card-top">
                    <strong>Coursework</strong>
                    <span className="lane-card-badge">Draggable types only</span>
                  </div>
                  <p>
                    First-time labs &amp; assignments: edit code, drag nodes with <code>V</code>, and export PNG or
                    submission bundle.
                  </p>
                  <div className="lane-card-actions">
                    <button
                      type="button"
                      className="lane-action-btn"
                      onClick={() => void openSampleGitFlow()}
                    >
                      Open git-flow sample
                    </button>
                    <button
                      type="button"
                      className="lane-action-link"
                      onClick={() => {
                        setNewDiagramOpen(false);
                        openDocs();
                      }}
                    >
                      Coursework guide (/docs)
                    </button>
                  </div>
                </article>
                <article className={`new-diagram-lane-card${newDiagramLane === "project" ? " active" : ""}`} data-lane="project">
                  <div className="lane-card-top">
                    <strong>Project</strong>
                    <span className="lane-card-badge">.mmd + .ctd.json</span>
                  </div>
                  <p>
                    Keep <code>&lt;name&gt;.mmd</code> source paired with <code>&lt;name&gt;.ctd.json</code> sidecar
                    layout in git (<code>docs/GIT_AND_AGENT_WORKFLOW.md</code>).
                  </p>
                  <div className="lane-card-actions">
                    <button
                      type="button"
                      className="lane-action-link"
                      onClick={() => {
                        setNewDiagramOpen(false);
                        openDocs("workbench-sidecar");
                      }}
                    >
                      Sidecar &amp; Git workflow (/docs)
                    </button>
                  </div>
                </article>
              </div>
            </div>
            {newDiagramLane !== "project" && (
              <div className="new-diagram-section" aria-label="Coursework templates">
                <h3>Coursework Starters (Draggable)</h3>
                <div className="new-diagram-grid">
                  {COURSEWORK_TEMPLATES.map((name) => {
                    const code = TEMPLATES[name]!;
                    return (
                      <button
                        key={`cw-${name}`}
                        type="button"
                        className="new-diagram-option"
                        aria-pressed={newDiagramSelection.kind === "template" && newDiagramSelection.label === name}
                        onClick={() => {
                          setNewDiagramSelection({ kind: "template", label: name, title: name, code });
                        }}
                      >
                        <strong>{name}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="new-diagram-section">
              <h3>{newDiagramLane === "coursework" ? "Draggable Templates" : "Templates"}</h3>
              <div className="new-diagram-grid">
                {Object.entries(TEMPLATES)
                  .filter(([, code]) =>
                    newDiagramLane === "coursework"
                      ? MOVABLE_DIAGRAM_TYPES.has(detectDiagramType(code))
                      : true,
                  )
                  .map(([name, code]) => (
                    <button
                      key={name}
                      type="button"
                      className="new-diagram-option"
                      aria-pressed={newDiagramSelection.kind === "template" && newDiagramSelection.label === name}
                      onClick={() => {
                        setNewDiagramSelection({ kind: "template", label: name, title: name, code });
                      }}
                    >
                      <strong>{name}</strong>
                    </button>
                  ))}
              </div>
            </div>
            <div className="new-diagram-section">
              <h3>Quick Nodes &amp; Shapes</h3>
              <div className="new-diagram-grid">
                {[
                  { label: "Rectangle [Node]", title: "Flowchart", code: "flowchart TD\n  A[Start]" },
                  { label: "Decision {Check}", title: "Decision Flow", code: "flowchart TD\n  Start([Start]) --> Check{Condition?}" },
                  { label: "Database [(DB)]", title: "Service DB", code: "flowchart TD\n  Service[Service] --> DB[(Database)]" },
                  { label: "Class { }", title: "Class", code: "classDiagram\n  class Class1 {\n    +String id\n  }" },
                  { label: "ER Entity { }", title: "ER Entity", code: "erDiagram\n  ENTITY1 {\n    int id PK\n  }" },
                  { label: "State (* -> Idle)", title: "State", code: "stateDiagram-v2\n  [*] --> Idle" },
                ].map((nodeItem) => (
                  <button
                    key={nodeItem.label}
                    type="button"
                    className="new-diagram-option"
                    aria-pressed={newDiagramSelection.kind === "starter" && newDiagramSelection.label === nodeItem.label}
                    onClick={() => {
                      setNewDiagramSelection({
                        kind: "starter",
                        label: nodeItem.label,
                        title: nodeItem.title,
                        code: nodeItem.code,
                      });
                    }}
                  >
                    <strong>{nodeItem.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="new-diagram-preview-pane" aria-label="Template preview">
            <div className="new-diagram-preview-header">
              <span>Preview</span>
              <strong>{newDiagramSelection.label}</strong>
            </div>
            <div
              className="new-diagram-preview-canvas"
              style={{ backgroundColor: data.settings.canvasColor }}
            >
              <div ref={newDiagramPreviewRef} className="new-diagram-preview-svg" />
              {newDiagramPreviewBusy && <span className="new-diagram-preview-status">Rendering…</span>}
            </div>
          </div>
        </div>
        <div className="dialog-footer" style={{ justifyContent: "flex-end" }}>
          <button
            className="button apply-green-btn"
            type="button"
            onClick={() => {
              createTab(newDiagramSelection.title, newDiagramSelection.code);
              setNewDiagramOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      </dialog>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>
      <AppTooltip />
    </main>
  );
}

export default App;
