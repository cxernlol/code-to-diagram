import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Download,
  FileImage,
  FolderOpen,
  GitBranch,
  Hand,
  LayoutGrid,
  Maximize2,
  MousePointer,
  PanelRight,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Share2,
  StopCircle,
  Undo2,
  Users,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
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

import { CodeEditor, type CodeEditorHandle } from "./CodeEditor";
import { DiagramCanvas, type DiagramCanvasHandle } from "./DiagramCanvas";
import { HomePage } from "./HomePage";
import { LegalPage, type LegalTab } from "./LegalPage";
import { PROVIDERS, TEMPLATES, THEME_PRESETS, createDocument } from "./constants";
import {
  cleanMermaidCode,
  parseStructuredDiagrams,
  requestAiText,
  validateMermaid,
} from "./ai";

import {
  createShareHash,
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
import { detectDiagramType, type DiagramType } from "./lib/mermaid";
import {
  createRoomId,
  createRoomUrl,
  getRoomIdFromHash,
  joinHostRoom,
  MAX_ROOM_DEVICES,
  startHostRoom,
  type GuestRoomSession,
  type HostRoomSession,
} from "./lib/room";
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
  DiagramDocument,
  Position,
  ProviderId,
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
  "You edit Mermaid diagrams. Return only valid Mermaid source, without markdown fences or explanation. Preserve the user's intent, use clear stable node IDs, and keep diagrams readable.";
const SYSTEM_STRUCTURED =
  'Return one valid JSON object only: {"overview":"<Mermaid source>","diagrams":[{"name":"<short descriptive name>","code":"<Mermaid source>"}]}. Include an Overview and at least one named detail diagram. Keep each diagram focused and professional. Do not wrap the JSON in markdown.';
const SYSTEM_EXPLAIN =
  "Explain the supplied Mermaid diagram in concise plain language. Do not return Mermaid code or modify the diagram.";

const SYNTAX_GUIDANCE: Record<DiagramType, string> = {
  flowchart: "Use flowchart TD or LR, stable node IDs, and --> or labeled -->|text| edges.",
  class: "Use classDiagram, class blocks for members, and typed relationships such as A --> B.",
  state: "Use stateDiagram-v2 with explicit states and directed transitions.",
  er: "Use erDiagram, named entities, attributes, and cardinality markers such as ||--o{.",
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

type AppView = "home" | "studio" | "privacy" | "terms";

function isStudioHash(hash: string): boolean {
  return hash === "#app" || hash.startsWith("#d=") || hash.startsWith("#room=");
}

function viewFromHash(hash: string): AppView {
  if (isStudioHash(hash)) return "studio";
  if (hash === "#privacy") return "privacy";
  if (hash === "#terms") return "terms";
  return "home";
}

function App() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<AppView>(() => viewFromHash(window.location.hash));
  const [data, setData] = useState<StudioData | null>(null);
  const dataRef = useRef<StudioData | null>(null);
  const historyRef = useRef(new Map<string, EditStack>());
  const expectedUpdatedAt = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const aiController = useRef<AbortController | null>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const canvasRef = useRef<DiagramCanvasHandle>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
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
  const [renameId, setRenameId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"refine" | "structured" | "explain">("refine");
  const [aiPanel, setAiPanel] = useState<AiPanel | null>(null);
  const [aiStream, setAiStream] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [roomMode, setRoomMode] = useState<"none" | "host" | "guest">("none");
  const [roomDevices, setRoomDevices] = useState(1);
  const [roomNotice, setRoomNotice] = useState("");
  const hostRoomRef = useRef<HostRoomSession | null>(null);
  const guestRoomRef = useRef<GuestRoomSession | null>(null);
  const roomDocIdRef = useRef<string>("");
  const applyingRoomSyncRef = useRef(false);

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
      if (!activeDocument || activeDocument.code === code) return;
      const before = snapshot(activeDocument);
      const after = { ...before, code };
      rememberEdit(activeDocument.id, before, after, "code");
      updateDocument(activeDocument.id, (document) => ({ ...document, code }));
    },
    [activeDocument, rememberEdit, updateDocument],
  );

  const changeLayout = useCallback(
    (layout: Record<string, Position>) => {
      if (!activeDocument) return;
      const before = snapshot(activeDocument);
      if (JSON.stringify(before.layout) === JSON.stringify(layout)) return;
      const after = { ...before, layout };
      rememberEdit(activeDocument.id, before, after, "layout");
      updateDocument(activeDocument.id, (document) => ({ ...document, layout }));
    },
    [activeDocument, rememberEdit, updateDocument],
  );

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

  const announceNodeMoved = useCallback((id: string) => {
    setAnnouncement(`Moved ${id}.`);
  }, []);

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

  const boot = useCallback(async (ignoreLegacy = false) => {
    setBootError(undefined);
    setLegacyError(undefined);
    try {
      const loaded = await initializeStudio(ignoreLegacy);
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
            window.setTimeout(() => {
              applyingRoomSyncRef.current = false;
            }, 0);
          },
          onEnded: (reason) => {
            guestRoomRef.current = null;
            setRoomMode("none");
            setRoomNotice(reason);
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
      }
    } catch (error) {
      setBootError(error);
      if (error instanceof LegacyDataError) setLegacyError(error);
    }
  }, [updateData]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (view === "home") {
      document.title = "SGS Studio: Code to Diagram Editor for Mermaid, DOT & SQL";
    } else if (view === "privacy") {
      document.title = "Privacy & Cookies — SGS Studio";
    } else if (view === "terms") {
      document.title = "Terms of Use — SGS Studio";
    } else if (activeDocument) {
      document.title = `${activeDocument.name} — SGS Studio`;
    }
  }, [view, activeDocument?.name]);

  useEffect(() => {
    const onHashChange = () => {
      setView(viewFromHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const openLegal = useCallback((tab: LegalTab) => {
    setView(tab);
    window.location.hash = `#${tab}`;
  }, []);

  const openHome = useCallback(() => {
    setView("home");
    if (window.location.hash) {
      history.pushState(null, "", window.location.pathname + window.location.search);
    }
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
            setStorageError("");
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
        setAiPanel({ kind: "explain", text });
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
    try {
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
    if (!activeDocument || applyingRoomSyncRef.current) return;
    if (roomMode === "host" && hostRoomRef.current) {
      hostRoomRef.current.broadcast({
        name: activeDocument.name,
        code: activeDocument.code,
        layout: activeDocument.layout,
      });
    } else if (roomMode === "guest" && guestRoomRef.current) {
      guestRoomRef.current.sendEdit(activeDocument.code, activeDocument.layout);
    }
  }, [activeDocument?.name, activeDocument?.code, activeDocument?.layout, roomMode]);

  useEffect(() => {
    return () => {
      hostRoomRef.current?.close();
      guestRoomRef.current?.leave();
    };
  }, []);

  const startLiveRoom = async () => {
    if (!activeDocument) return;
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
          if (!targetId) return;
          applyingRoomSyncRef.current = true;
          updateDocument(targetId, (doc) => ({ ...doc, code, layout }));
          window.setTimeout(() => {
            applyingRoomSyncRef.current = false;
          }, 0);
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

  const share = async () => {
    if (!activeDocument) return;
    try {
      const url = `${window.location.origin}${window.location.pathname}${createShareHash(activeDocument.code, activeDocument.layout)}`;
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied.");
    } catch (error) {
      setStorageError(`Share link could not be copied: ${errorText(error)}`);
    }
  };

  const saveMmd = () => {
    if (!activeDocument) return;
    const format = detectCodeFormat(activeDocument.code);
    const ext = FORMAT_EXTENSIONS[format];
    downloadText(`${activeDocument.name.replace(/[\\/:*?"<>|]/g, "-")}.${ext}`, activeDocument.code);
    setNotice(`${FORMAT_LABELS[format]} file downloaded.`);
  };

  const saveSvg = () => {
    if (!activeDocument) return;
    try {
      exportSvg(`${activeDocument.name.replace(/[\\/:*?"<>|]/g, "-")}.svg`);
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
      changeSettings({ splitPercent: Math.min(72, Math.max(28, ((moveEvent.clientX - rect.left) / rect.width) * 100)) });
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
          <h1>SGS Studio</h1>
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
    return <HomePage onStart={openStudio} onLegal={openLegal} />;
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

  const supportedMovement = ["flowchart", "class", "state", "er"].includes(diagramType);
  const codeFormat = detectCodeFormat(activeDocument.code);

  return (
    <main className="studio" style={{ "--split": `${data.settings.splitPercent}%` } as CSSProperties}>
      <header className="topbar">
        <div className="brand-lockup">
          <button
            className="brand-home-button"
            type="button"
            onClick={openHome}
            title="Back to home"
            aria-label="SGS Studio home"
          >
            <span className="brand-mark"><GitBranch aria-hidden="true" size={17} /></span>
            <span className="brand-name">SGS Studio</span>
          </button>
          <span className="brand-divider" aria-hidden="true" />
          <span className="workbench-label">Diagram workbench</span>
        </div>
        <div className="top-actions">
          <span className={`save-status ${saveState}`} role="status">
            {saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved" : `Saved ${timeLabel(lastSavedAt)}`}
          </span>
          <button className="icon-button" title="Open Mermaid or Markdown file" aria-label="Open Mermaid or Markdown file" onClick={() => fileInput.current?.click()}>
            <FolderOpen aria-hidden="true" size={17} />
          </button>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".mmd,.mermaid,.md,.dot,.gv,.puml,.plantuml,.d2,.sql,.ts,.xml,text/plain,text/markdown,application/xml" onChange={(event) => void importFile(event)} />
          <button className="icon-button" title="Copy source" aria-label="Copy Mermaid source" onClick={() => void copyCode()}>
            <Clipboard aria-hidden="true" size={17} />
          </button>
          <button className="icon-button" title="Copy share link" aria-label="Copy share link" onClick={() => void share()}>
            <Share2 aria-hidden="true" size={17} />
          </button>
          <button
            className={`icon-button${roomMode !== "none" ? " room-active" : ""}`}
            title={roomMode === "host" ? `Live room (${roomDevices}/${MAX_ROOM_DEVICES} devices)` : "Host live room (max 5 devices)"}
            aria-label={roomMode === "host" ? "Copy live room link" : "Host live room (max 5 devices)"}
            onClick={() => void startLiveRoom()}
          >
            <Users aria-hidden="true" size={17} />
          </button>
          <button className="icon-button" title="Export SVG" aria-label="Export SVG" onClick={saveSvg}>
            <FileImage aria-hidden="true" size={17} />
          </button>
          <button className="icon-button" title="Export PNG" aria-label="Export PNG" disabled={saveBusy} onClick={() => void savePng()}>
            <ArrowDownToLine aria-hidden="true" size={17} />
          </button>
          <button className="icon-button settings-trigger" aria-label="Open settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 aria-hidden="true" size={17} />
          </button>
        </div>
      </header>

      <section className="document-strip" aria-label="Diagrams">
        <div className="document-tabs" role="tablist" aria-label="Open diagrams">
          {data.documents.map((document, index) => (
            <div className="document-tab" role="presentation" key={document.id}>
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
              {pendingDeleteId === document.id ? (
                <span className="tab-delete-confirm">
                  <button type="button" onClick={() => void removeTab(document.id)}>Delete</button>
                  <button type="button" aria-label="Cancel delete" onClick={() => setPendingDeleteId("")}>Cancel</button>
                </span>
              ) : (
                <button
                  className="tab-close"
                  type="button"
                  aria-label={`Close ${document.name}`}
                  onClick={() => setPendingDeleteId(document.id)}
                >
                  <X aria-hidden="true" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="new-tab-button" type="button" onClick={() => createTab()} aria-label="New diagram">
          <Plus aria-hidden="true" size={17} />
        </button>
        <label className="template-picker">
          <span className="visually-hidden">Start from a template</span>
          <select
            value=""
            aria-label="Start from a template"
            onChange={(event) => {
              const name = event.target.value;
              if (name && TEMPLATES[name]) createTab(name, TEMPLATES[name]);
            }}
          >
            <option value="">Templates</option>
            {Object.keys(TEMPLATES).map((name) => <option key={name}>{name}</option>)}
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </label>
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
            <span>{storageError || renderError?.message}</span>
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
                value=""
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
              <button className="icon-button compact" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" onClick={undo}><Undo2 aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" onClick={redo}><Redo2 aria-hidden="true" size={15} /></button>
              <details className="history-menu">
                <summary aria-label="Version history"><RotateCcw aria-hidden="true" size={15} /></summary>
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
            <CodeEditor
              ref={editorRef}
              value={activeDocument.code}
              error={renderError}
              onChange={changeCode}
              onUndo={undo}
              onRedo={redo}
            />
          </div>
          <div className="editor-footer">
            <span>{activeDocument.code.split(/\r?\n/).length} lines</span>
            <span>Move a node with drag or arrow keys; Shift moves farther.</span>
          </div>
          <div className="ai-controls">
            <label htmlFor="ai-request">Ask AI to refine or organize this diagram</label>
            <textarea
              id="ai-request"
              rows={2}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !aiBusy) {
                  event.preventDefault();
                  setAiMode("refine");
                  void runAi("refine");
                }
              }}
              placeholder="Describe the change you want. Leave blank for a structured cleanup."
            />
            <div className="ai-buttons">
              <button className="button primary" type="button" disabled={aiBusy} onClick={() => { setAiMode("refine"); void runAi("refine"); }}>
                <Wand2 aria-hidden="true" size={15} /> Refine
              </button>
              <button className="button secondary" type="button" disabled={aiBusy} onClick={() => { setAiMode("structured"); void runAi("structured"); }}>
                <GitBranch aria-hidden="true" size={15} /> Structure
              </button>
              <button className="button text-button" type="button" disabled={aiBusy} onClick={() => { setAiMode("refine"); void runAi("refine", "Fix any syntax errors so the diagram renders cleanly while preserving its meaning."); }}>
                Fix syntax
              </button>
              <button className="button text-button" type="button" disabled={aiBusy} onClick={() => { setAiMode("refine"); void runAi("refine", "Add cohesive classDef or style definitions to highlight key nodes while keeping all labels and relationships intact."); }}>
                Style it
              </button>
              <button className="button text-button" type="button" disabled={aiBusy} onClick={() => { setAiMode("refine"); void runAi("refine", "Tidy the layout, shorten verbose labels, and simplify structure without losing meaning."); }}>
                Tidy
              </button>
              <button className="button text-button" type="button" disabled={aiBusy} onClick={() => { setAiMode("explain"); void runAi("explain"); }}>
                Explain
              </button>
              {aiBusy && <button className="button stop-button" type="button" onClick={stopAi}><StopCircle aria-hidden="true" size={15} /> Stop</button>}
            </div>
            <p className="privacy-note">An AI request sends this prompt and diagram directly to your selected provider.</p>
          </div>
        </section>

        <div
          className="split-handle"
          role="separator"
          aria-label="Resize source and preview panes"
          aria-orientation="vertical"
          aria-valuemin={28}
          aria-valuemax={72}
          aria-valuenow={Math.round(data.settings.splitPercent)}
          tabIndex={0}
          onPointerDown={beginSplit}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              changeSettings({ splitPercent: Math.min(72, Math.max(28, data.settings.splitPercent + (event.key === "ArrowRight" ? 2 : -2))) });
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
              <span>Preview</span>
              <span className={`diagram-kind ${supportedMovement ? "movable" : ""}`}>{diagramType}</span>
            </div>
            <div className="preview-actions">
              <button
                className="icon-button compact"
                aria-label="Move tool (V)"
                title="Move tool (V)"
                aria-pressed={canvasTool === "move"}
                onClick={() => canvasRef.current?.setTool("move")}
              >
                <MousePointer aria-hidden="true" size={15} />
              </button>
              <button
                className="icon-button compact"
                aria-label="Hand pan tool (H)"
                title="Hand pan tool (H)"
                aria-pressed={canvasTool === "hand"}
                onClick={() => canvasRef.current?.setTool("hand")}
              >
                <Hand aria-hidden="true" size={15} />
              </button>
              <button className="icon-button compact" aria-label="Zoom out" title="Zoom out (-)" onClick={() => canvasRef.current?.zoomBy(1 / 1.15)}><ZoomOut aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Zoom in" title="Zoom in (+)" onClick={() => canvasRef.current?.zoomBy(1.15)}><ZoomIn aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Fit diagram" title="Fit diagram (Shift+1)" onClick={() => canvasRef.current?.fit()}><Maximize2 aria-hidden="true" size={15} /></button>
              <button className="icon-button compact" aria-label="Reset pan and zoom" title="Reset pan and zoom" onClick={() => canvasRef.current?.reset()}><RotateCcw aria-hidden="true" size={15} /></button>
              <button
                className="icon-button compact"
                aria-label="Arrange nodes in grid"
                title="Arrange nodes in grid"
                disabled={!supportedMovement}
                onClick={() => canvasRef.current?.arrangeGrid()}
              >
                <LayoutGrid aria-hidden="true" size={15} />
              </button>
              <button
                className="icon-button compact"
                aria-label="Reset node positions to automatic layout"
                title="Reset node positions"
                disabled={!Object.keys(activeDocument.layout).length}
                onClick={() => {
                  changeLayout({});
                  requestAnimationFrame(() => canvasRef.current?.fit());
                }}
              >
                <RotateCcw aria-hidden="true" size={15} />
              </button>
              <details className="sensitivity-menu">
                <summary aria-label="Pan and zoom settings"><Settings2 aria-hidden="true" size={15} /></summary>
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
                  <label>Grid size <input type="number" min="4" max="100" step="4" value={data.settings.snapSize} onChange={(event) => changeSettings({ snapSize: Number(event.target.value) })} /></label>
                  <p>V: move. H: hand. Space+drag: pan. Shift+1: fit. +/-: zoom. Shift: precision. Alt: bypass grid.</p>
                </div>
              </details>
            </div>
          </div>
          <div className="canvas-status">
            {supportedMovement
              ? <span id="node-movement-help">V: move. H: hand. Space+drag: pan. Shift+1: fit. +/-: zoom. Arrow keys: nudge a box. Alt: bypass grid.</span>
              : `${diagramType} diagrams use automatic layout; individual node movement is unavailable.`}
          </div>
          <DiagramCanvas
            ref={canvasRef}
            document={activeDocument}
            settings={data.settings}
            onLayoutChange={changeLayout}
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
        </section>
      </section>

      <AnimatePresence>
        {(aiPanel || aiError || (aiBusy && aiStream)) && (
          <motion.aside
            className="ai-result-panel"
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            aria-label="AI result"
          >
            <div className="result-heading">
              <div><Wand2 aria-hidden="true" size={16} /><h2>{aiPanel?.kind === "explain" ? "Explanation" : aiPanel?.kind === "structured" ? "Structured diagrams" : "AI preview"}</h2></div>
              <button className="icon-button compact" aria-label="Close AI result" onClick={() => { setAiPanel(null); setAiError(""); setAiStream(""); }}><X aria-hidden="true" size={15} /></button>
            </div>
            {aiError && <p className="ai-error" role="alert">{aiError}</p>}
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
          <div><h2 id="settings-title">Studio settings</h2><p>Appearance, movement, and AI provider.</p></div>
          <button className="icon-button" type="button" aria-label="Close settings" onClick={() => settingsDialog.current?.close()}><X aria-hidden="true" size={17} /></button>
        </div>
        <div className="settings-content">
          <fieldset>
            <legend>Diagram appearance</legend>
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
              <label>Primary color <input type="color" value={data.settings.primaryColor} onChange={(event) => changeSettings({ primaryColor: event.target.value })} /></label>
              <label>Node text <input type="color" value={data.settings.textColor} onChange={(event) => changeSettings({ textColor: event.target.value })} /></label>
              <label>Connectors <input type="color" value={data.settings.lineColor} onChange={(event) => changeSettings({ lineColor: event.target.value })} /></label>
              <label>Canvas <input type="color" value={data.settings.canvasColor} onChange={(event) => changeSettings({ canvasColor: event.target.value })} /></label>
              <label className="wide-field">Diagram font<input value={data.settings.font} onChange={(event) => changeSettings({ font: event.target.value })} /></label>
            </div>
          </fieldset>
          <fieldset>
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
                    changeSettings({ provider: { ...data.settings.provider, provider, baseUrl: preset.baseUrl, model } });
                  }}
                >
                  {Object.entries(PROVIDERS).map(([id, provider]) => <option key={id} value={id}>{provider.label}</option>)}
                </select>
              </label>
              <label>Model<input value={data.settings.provider.model} onChange={(event) => changeSettings({ provider: { ...data.settings.provider, model: event.target.value } })} /></label>
              <label className="wide-field">Compatible API base URL<input type="url" value={data.settings.provider.baseUrl} onChange={(event) => changeSettings({ provider: { ...data.settings.provider, baseUrl: event.target.value } })} /></label>
              <label className="wide-field">API key<input type="password" autoComplete="off" value={data.credentials.apiKey} onChange={(event) => {
                const current = dataRef.current;
                if (current) updateData({ ...current, credentials: { apiKey: event.target.value } });
              }} /></label>
              <label>Temperature<input type="number" min="0" max="2" step="0.1" value={data.settings.provider.temperature ?? ""} onChange={(event) => changeSettings({ provider: { ...data.settings.provider, temperature: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
            </div>
            <p id="provider-privacy" className="form-note">AI requests include the diagram, prompt, and API key, and go directly to the selected provider. Some endpoints block browser requests with CORS. Provider charges are separate from SGS Studio.</p>
            <div className="settings-actions">
              <button className="button secondary" type="button" onClick={() => void testConnection()}>Test connection</button>
              <span role="status">{testStatus}</span>
            </div>
          </fieldset>
          <div className="dialog-footer">
            <button className="button primary" type="button" onClick={() => settingsDialog.current?.close()}>Done</button>
          </div>
        </div>
      </dialog>

      {notice && (
        <div className="toast" role="status">
          <Check aria-hidden="true" size={15} /> {notice}
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X aria-hidden="true" size={14} /></button>
        </div>
      )}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>
    </main>
  );
}

export default App;
