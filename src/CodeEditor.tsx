import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  StreamLanguage,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { forceLinting, linter } from "@codemirror/lint";
import type { CodeFormat } from "./lib/formats";
import { FORMAT_LABELS } from "./lib/formats";

const MERMAID_OPERATORS = ["-->", "---", "==>", "-.->", "--x", "--o", "<|--", "*--", "o--"] as const;

const mermaidLanguage = StreamLanguage.define({
  startState: () => ({}),
  token(stream) {
    if (stream.match(/%%.*/)) return "comment";
    if (stream.match(/^\s+/)) return null;
    if (stream.match(/"(?:\\[\s\S]|[^\\"])*"/)) return "string";
    if (MERMAID_OPERATORS.some((op) => stream.match(op))) return "operator";
    if (
      stream.match(
        /^(?:flowchart|graph|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|sequenceDiagram|gantt|mindmap|pie|journey)\b/i,
      )
    ) {
      return "keyword";
    }
    if (stream.match(/^(?:classDef|class|style|subgraph|end|direction)\b/)) return "keyword";
    if (stream.match(/[A-Za-z_][\w-]*/)) return "variableName";
    stream.next();
    return null;
  },
});

const OTHER_KEYWORDS: Record<Exclude<CodeFormat, "mermaid">, RegExp> = {
  dot: /\b(?:digraph|strict|subgraph|node|edge)\b/,
  plantuml: /(?:@startuml|@enduml|@startmindmap|@endmindmap|\b(?:class|interface|actor|participant|package|state)\b)/i,
  d2: /\b(?:shape|style|direction|classes|label)\b/,
  sql: /\b(?:CREATE|TABLE|ALTER|PRIMARY|FOREIGN|KEY|REFERENCES|CONSTRAINT|NOT|NULL)\b/i,
  typescript: /\b(?:interface|class|type|extends|implements|export|import)\b/,
  xml: /<\/?[A-Za-z_][\w:.-]*/,
};

function keywordLanguage(pattern: RegExp) {
  return StreamLanguage.define({
    startState: () => ({}),
    token(stream) {
      if (stream.match(/^\s+/)) return null;
      if (stream.match(/\/\*[\s\S]*?\*\/|\/\/.*|-- .*/)) return "comment";
      if (stream.match(/"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'/)) return "string";
      if (stream.match(pattern)) return "keyword";
      stream.next();
      return null;
    },
  });
}

const otherLanguages = {
  dot: keywordLanguage(OTHER_KEYWORDS.dot),
  plantuml: keywordLanguage(OTHER_KEYWORDS.plantuml),
  d2: keywordLanguage(OTHER_KEYWORDS.d2),
  sql: keywordLanguage(OTHER_KEYWORDS.sql),
  typescript: keywordLanguage(OTHER_KEYWORDS.typescript),
  xml: keywordLanguage(OTHER_KEYWORDS.xml),
} satisfies Record<Exclude<CodeFormat, "mermaid">, ReturnType<typeof keywordLanguage>>;

function languageFor(format: CodeFormat) {
  return format === "mermaid" ? mermaidLanguage : otherLanguages[format];
}

function sourceLabel(format: CodeFormat) {
  return EditorView.contentAttributes.of({
    "aria-label": `${FORMAT_LABELS[format]} diagram source`,
    spellcheck: "false",
  });
}

const headerCompletions = [
  { label: "flowchart TD", type: "keyword", apply: "flowchart TD\n  A[Start] --> B[End]" },
  { label: "classDiagram", type: "keyword", apply: "classDiagram\n  class Example {\n    +String name\n  }" },
  { label: "stateDiagram-v2", type: "keyword", apply: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> [*]" },
  { label: "erDiagram", type: "keyword", apply: "erDiagram\n  USER ||--o{ ORDER : places" },
  { label: "sequenceDiagram", type: "keyword", apply: "sequenceDiagram\n  actor User\n  User->>App: Request" },
];

const bodyCompletions = [
  { label: "subgraph", type: "keyword", apply: "subgraph Group\n  \nend" },
  { label: "classDef", type: "keyword", apply: "classDef highlight fill:#f5e8dc,stroke:#ad612e,color:#1c3439" },
  { label: "direction TB", type: "keyword" },
  { label: "direction LR", type: "keyword" },
  { label: "-->", type: "operator", detail: "directed edge" },
  { label: "-.->", type: "operator", detail: "dotted edge" },
  { label: "==>", type: "operator", detail: "thick edge" },
  { label: "<|--", type: "operator", detail: "inheritance" },
  { label: "||--o{", type: "operator", detail: "one-to-many" },
];

const RESERVED_WORDS = new Set([
  "flowchart", "graph", "classDiagram", "stateDiagram", "stateDiagram-v2",
  "erDiagram", "sequenceDiagram", "gantt", "mindmap", "pie", "journey",
  "subgraph", "end", "direction", "TB", "TD", "BT", "RL", "LR", "class",
  "classDef", "style", "actor", "participant", "section", "title", "dateFormat",
]);

function extractNodeOptions(docText: string) {
  const seen = new Set<string>();
  const matches = docText.matchAll(/\b([A-Za-z_][\w-]{1,30})\b/g);
  for (const match of matches) {
    const token = match[1];
    if (token && !RESERVED_WORDS.has(token)) seen.add(token);
  }
  return Array.from(seen, (label) => ({ label, type: "variable" }));
}

export interface CodeEditorHandle {
  focusLine: (lineNumber: number) => void;
  focusNode: (nodeId: string) => void;
}

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#f0a36b", fontWeight: "600" },
  { tag: tags.variableName, color: "#8ad6cb" },
  { tag: tags.string, color: "#a8d99a" },
  { tag: tags.operator, color: "#f3c98b" },
  { tag: tags.comment, color: "#7d9691", fontStyle: "italic" },
  { tag: [tags.punctuation, tags.bracket], color: "#b5c9c5" },
]);

export interface CodeEditorProps {
  value: string;
  format?: CodeFormat;
  readOnly?: boolean;
  darkMode?: boolean;
  error?: { message: string; line?: number };
  onChange: (value: string) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, format = "mermaid", readOnly = false, darkMode = false, error, onChange, onUndo, onRedo },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const highlightCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());
  const labelCompartment = useRef(new Compartment());
  const readOnlyRef = useRef(readOnly);
  const formatRef = useRef(format);
  const errorRef = useRef(error);
  formatRef.current = format;
  errorRef.current = error;
  const callbackRef = useRef({ onChange, onUndo, onRedo });
  const suppressChange = useRef(false);
  const valueRef = useRef(value);

  callbackRef.current = { onChange, onUndo, onRedo };
  readOnlyRef.current = readOnly;
  valueRef.current = value;

  useImperativeHandle(
    ref,
    () => ({
      focusLine(lineNumber: number) {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
        const line = view.state.doc.line(clamped);
        view.dispatch({
          selection: { anchor: line.from, head: line.to },
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
        view.focus();
      },
      focusNode(nodeId: string) {
        const view = viewRef.current;
        if (!view || !nodeId) return;
        const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const text = view.state.doc.toString();
        const match =
          new RegExp(`\\bclass\\s+${escaped}\\b`).exec(text) ??
          new RegExp(`^\\s*${escaped}\\b`, "m").exec(text) ??
          new RegExp(`\\b${escaped}\\b`).exec(text);
        if (!match || match.index === undefined) return;
        const line = view.state.doc.lineAt(match.index);
        view.dispatch({
          selection: { anchor: line.from, head: line.to },
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
        view.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          readOnlyCompartment.current.of([
            EditorState.readOnly.of(readOnlyRef.current),
            EditorView.editable.of(!readOnlyRef.current),
          ]),
          lineNumbers(),
          foldGutter(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          search({ top: true }),
          highlightSelectionMatches(),
          highlightCompartment.current.of(
            syntaxHighlighting(darkMode ? darkHighlightStyle : defaultHighlightStyle, { fallback: true }),
          ),
          languageCompartment.current.of(languageFor(formatRef.current)),
          labelCompartment.current.of(sourceLabel(formatRef.current)),
          linter((view) => {
            const current = errorRef.current;
            if (!current?.line) return [];
            const lineNumber = Math.min(current.line, view.state.doc.lines);
            const line = view.state.doc.line(Math.max(1, lineNumber));
            return [{ from: line.from, to: line.to, severity: "error", message: current.message }];
          }),
          autocompletion({
            activateOnTyping: true,
            override: [
              (context) => {
                if (formatRef.current !== "mermaid") return null;
                const word = context.matchBefore(/[\w-]*/);
                if ((!word || word.from === word.to) && !context.explicit) return null;
                const line = context.state.doc.lineAt(context.pos);
                return {
                  from: word?.from ?? context.pos,
                  options:
                    line.number === 1
                      ? headerCompletions
                      : [...bodyCompletions, ...extractNodeOptions(context.state.doc.toString())],
                };
              },
            ],
          }),
          keymap.of([
            {
              key: "Mod-z",
              run: () => callbackRef.current.onUndo(),
            },
            {
              key: "Mod-Shift-z",
              run: () => callbackRef.current.onRedo(),
            },
            indentWithTab,
            ...searchKeymap,
            ...completionKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !suppressChange.current) {
              callbackRef.current.onChange(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": { height: "100%", backgroundColor: "transparent" },
            ".cm-scroller": { overflow: "auto", fontFamily: "var(--mono)" },
            ".cm-content": { padding: "20px 16px 36px 0", caretColor: "var(--accent)" },
            ".cm-gutters": {
              backgroundColor: "transparent",
              color: "var(--muted)",
              border: "none",
            },
            ".cm-activeLineGutter": { backgroundColor: "var(--surface-2)" },
            ".cm-activeLine": { backgroundColor: "var(--surface-2)" },
            ".cm-cursor": { borderLeftColor: "var(--text)" },
            ".cm-selectionBackground, ::selection": { backgroundColor: "var(--selection)" },
            ".cm-tooltip": {
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            },
            ".cm-tooltip-autocomplete ul li[aria-selected]": {
              backgroundColor: "var(--accent)",
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: highlightCompartment.current.reconfigure(
        syntaxHighlighting(darkMode ? darkHighlightStyle : defaultHighlightStyle, { fallback: true }),
      ),
    });
  }, [darkMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        languageCompartment.current.reconfigure(languageFor(format)),
        labelCompartment.current.reconfigure(sourceLabel(format)),
      ],
    });
  }, [format]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    let from = 0;
    const maxEq = Math.min(current.length, value.length);
    while (from < maxEq && current.charCodeAt(from) === value.charCodeAt(from)) from += 1;
    let endOld = current.length;
    let endNew = value.length;
    while (
      endOld > from &&
      endNew > from &&
      current.charCodeAt(endOld - 1) === value.charCodeAt(endNew - 1)
    ) {
      endOld -= 1;
      endNew -= 1;
    }
    suppressChange.current = true;
    view.dispatch({
      changes: { from, to: endOld, insert: value.slice(from, endNew) },
    });
    suppressChange.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: highlightCompartment.current.reconfigure(
        syntaxHighlighting(darkMode ? darkHighlightStyle : defaultHighlightStyle, { fallback: true }),
      ),
    });
  }, [darkMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) forceLinting(view);
  }, [error]);

  return <div className="code-editor" ref={hostRef} />;
});
