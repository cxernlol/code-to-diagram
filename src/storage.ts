import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DEFAULT_SETTINGS, LEGACY_STORAGE_KEY, TEMPLATES } from "./constants";
import type {
  DiagramDocument,
  LegacyState,
  ProviderCredentials,
  StudioData,
  StudioSettings,
  VersionEntry,
} from "./types";

const DATABASE_NAME = "sgs-studio";
const DATABASE_VERSION = 1;
const SETTINGS_KEY = "main";
const CREDENTIALS_KEY = "provider";
const INITIALIZED_KEY = "initialized";
const GRID_SNAP_MIGRATION_KEY = "grid-snap-enabled";
const CHANNEL_NAME = "sgs-studio-updates";

interface StudioDatabase extends DBSchema {
  documents: {
    key: string;
    value: DiagramDocument;
    indexes: { "by-order": number };
  };
  settings: {
    key: string;
    value: StudioSettings;
  };
  credentials: {
    key: string;
    value: ProviderCredentials;
  };
  metadata: {
    key: string;
    value: string;
  };
}

export class LegacyDataError extends Error {
  constructor(readonly raw: string, cause: unknown) {
    super("The saved mstudio2 data could not be read.", { cause });
    this.name = "LegacyDataError";
  }
}

export class DocumentConflictError extends Error {
  constructor(readonly remote: DiagramDocument) {
    super("This diagram changed in another browser tab.");
    this.name = "DocumentConflictError";
  }
}

let databasePromise: Promise<IDBPDatabase<StudioDatabase>> | undefined;

function database(): Promise<IDBPDatabase<StudioDatabase>> {
  databasePromise ??= openDB<StudioDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      const documents = db.createObjectStore("documents", { keyPath: "id" });
      documents.createIndex("by-order", "sortOrder");
      db.createObjectStore("settings");
      db.createObjectStore("credentials");
      db.createObjectStore("metadata");
    },
  });
  return databasePromise;
}

function normalizeHistory(value: unknown): VersionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as { t?: unknown; code?: unknown; why?: unknown; createdAt?: unknown };
    if (typeof item.code !== "string") return [];
    const createdAt =
      typeof item.createdAt === "number"
        ? item.createdAt
        : typeof item.t === "string"
          ? Date.parse(item.t) || Date.now()
          : Date.now();
    return [{
      id: `legacy-${index}-${createdAt}`,
      createdAt,
      reason: typeof item.why === "string" ? item.why : "Edit",
      code: item.code,
    }];
  });
}

function normalizeLegacy(raw: string): StudioData {
  let state: LegacyState;
  try {
    state = JSON.parse(raw) as LegacyState;
  } catch (error) {
    throw new LegacyDataError(raw, error);
  }

  if (!state || typeof state !== "object") {
    throw new LegacyDataError(raw, new TypeError("Saved data is not an object."));
  }

  const legacyDocs = Array.isArray(state.docs) ? state.docs : [];
  const sourceDocs = legacyDocs.length
    ? legacyDocs
    : [{ name: "Flowchart", code: TEMPLATES.Flowchart, hist: [] }];
  const documents = sourceDocs.map((item, index) => {
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      name: typeof item.name === "string" && item.name.trim() ? item.name : `Diagram ${index + 1}`,
      code: typeof item.code === "string" ? item.code : TEMPLATES.Flowchart,
      history: normalizeHistory(item.hist),
      layout: {},
      createdAt: now,
      updatedAt: now,
      sortOrder: index,
    };
  });

  const currentIndex =
    typeof state.cur === "number" && state.cur >= 0 && state.cur < documents.length
      ? state.cur
      : 0;
  const activeDocument = documents[currentIndex];
  if (!activeDocument) throw new LegacyDataError(raw, new Error("No saved documents were found."));
  const settings: StudioSettings = {
    ...DEFAULT_SETTINGS,
    activeDocumentId: activeDocument.id,
    theme: typeof state.theme === "string" ? state.theme : DEFAULT_SETTINGS.theme,
    look: typeof state.look === "string" ? state.look : DEFAULT_SETTINGS.look,
    primaryColor: typeof state.c1 === "string" ? state.c1 : DEFAULT_SETTINGS.primaryColor,
    textColor: typeof state.c2 === "string" ? state.c2 : DEFAULT_SETTINGS.textColor,
    lineColor: typeof state.c3 === "string" ? state.c3 : DEFAULT_SETTINGS.lineColor,
    canvasColor: typeof state.c4 === "string" ? state.c4 : DEFAULT_SETTINGS.canvasColor,
    font: typeof state.font === "string" ? state.font : DEFAULT_SETTINGS.font,
    provider: {
      ...DEFAULT_SETTINGS.provider,
      baseUrl: typeof state.base === "string" ? state.base : DEFAULT_SETTINGS.provider.baseUrl,
      model: typeof state.model === "string" ? state.model : DEFAULT_SETTINGS.provider.model,
      provider:
        state.base?.includes("deepseek")
          ? "deepseek"
          : state.base?.includes("openai.com")
            ? "openai"
            : "custom",
    },
  };

  return {
    documents,
    settings,
    credentials: { apiKey: typeof state.key === "string" ? state.key : "" },
    migration: "legacy",
  };
}

function freshData(migration: StudioData["migration"] = "fresh"): StudioData {
  const now = Date.now();
  const document: DiagramDocument = {
    id: crypto.randomUUID(),
    name: "Flowchart",
    code: TEMPLATES.Flowchart,
    history: [],
    layout: {},
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
  };
  return {
    documents: [document],
    settings: { ...DEFAULT_SETTINGS, activeDocumentId: document.id },
    credentials: { apiKey: "" },
    migration,
  };
}

async function writeInitialData(
  db: IDBPDatabase<StudioDatabase>,
  data: StudioData,
): Promise<void> {
  const tx = db.transaction(["documents", "settings", "credentials", "metadata"], "readwrite");
  const documents = tx.objectStore("documents");
  await Promise.all(data.documents.map((document) => documents.put(document)));
  await tx.objectStore("settings").put(data.settings, SETTINGS_KEY);
  await tx.objectStore("credentials").put(data.credentials, CREDENTIALS_KEY);
  const [storedDocuments, storedSettings, storedCredentials] = await Promise.all([
    documents.getAll(),
    tx.objectStore("settings").get(SETTINGS_KEY),
    tx.objectStore("credentials").get(CREDENTIALS_KEY),
  ]);
  if (
    storedDocuments.length !== data.documents.length ||
    !storedSettings ||
    !storedCredentials ||
    storedDocuments.some((document) => !data.documents.some((item) => item.id === document.id))
  ) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error("Saved data verification failed.");
  }
  await tx.objectStore("metadata").put(data.migration, INITIALIZED_KEY);
  await tx.objectStore("metadata").put("done", GRID_SNAP_MIGRATION_KEY);
  await tx.done;
}

export async function initializeStudio(ignoreLegacy = false): Promise<StudioData> {
  const db = await database();
  const initialized = await db.get("metadata", INITIALIZED_KEY);
  if (initialized) {
    const data = await readStudioData(db, initialized as StudioData["migration"]);
    if (!(await db.get("metadata", GRID_SNAP_MIGRATION_KEY))) {
      data.settings = { ...data.settings, snapEnabled: true };
      await db.put("settings", data.settings, SETTINGS_KEY);
      await db.put("metadata", "done", GRID_SNAP_MIGRATION_KEY);
    }
    return data;
  }

  let data: StudioData;
  if (!ignoreLegacy) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      throw new Error("Browser storage is unavailable; SGS Studio could not load saved work.", {
        cause: error,
      });
    }
    data = raw ? normalizeLegacy(raw) : freshData();
  } else {
    data = freshData("skipped");
  }

  await writeInitialData(db, data);
  return data;
}

async function readStudioData(
  db: IDBPDatabase<StudioDatabase>,
  migration: StudioData["migration"],
): Promise<StudioData> {
  const [documents, settings, credentials] = await Promise.all([
    db.getAllFromIndex("documents", "by-order"),
    db.get("settings", SETTINGS_KEY),
    db.get("credentials", CREDENTIALS_KEY),
  ]);
  if (!settings || !credentials || !documents.length) {
    throw new Error("The IndexedDB workspace is incomplete.");
  }
  return {
    documents,
    settings,
    credentials,
    migration,
  };
}

export async function reloadStudio(): Promise<StudioData> {
  const db = await database();
  const migration = (await db.get("metadata", INITIALIZED_KEY)) as
    | StudioData["migration"]
    | undefined;
  if (!migration) throw new Error("Studio storage has not been initialized.");
  return readStudioData(db, migration);
}

export async function saveSettings(settings: StudioSettings): Promise<void> {
  const db = await database();
  await db.put("settings", settings, SETTINGS_KEY);
}

export async function saveCredentials(credentials: ProviderCredentials): Promise<void> {
  const db = await database();
  await db.put("credentials", credentials, CREDENTIALS_KEY);
}

export async function saveDocument(
  document: DiagramDocument,
  expectedUpdatedAt: number,
): Promise<DiagramDocument> {
  const db = await database();
  const tx = db.transaction("documents", "readwrite");
  const store = tx.objectStore("documents");
  const current = await store.get(document.id);
  if ((!current && expectedUpdatedAt !== 0) || (current && current.updatedAt !== expectedUpdatedAt)) {
    tx.abort();
    await tx.done.catch(() => undefined);
    if (!current) throw new Error("This diagram was deleted in another browser tab.");
    throw new DocumentConflictError(current);
  }
  const saved = { ...document, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) };
  await store.put(saved);
  await tx.done;
  return saved;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await database();
  await db.delete("documents", id);
}

export function broadcastDocumentChange(id: string): void {
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "document-updated", id });
    channel.close();
  }
}

export function listenForDocumentChanges(
  onChange: (id: string) => void,
): () => void {
  if (!("BroadcastChannel" in window)) return () => undefined;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.addEventListener("message", (event: MessageEvent<{ type?: string; id?: string }>) => {
    if (event.data?.type === "document-updated" && typeof event.data.id === "string") {
      onChange(event.data.id);
    }
  });
  return () => channel.close();
}
