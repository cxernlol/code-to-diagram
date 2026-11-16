import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  StreamLanguage,
} from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import type { Diagnostic } from "@codemirror/lint";
import { setDiagnostics } from "@codemirror/lint";

const mermaidLanguage = StreamLanguage.define({
  startState: () => ({}),
  token(stream) {
    if (stream.match(/%%.*/)) return "comment";
    if (stream.match(/^\s+/)) return null;
    if (stream.match(/"(?:\\.|[^"])*"/)) return "string";
    if (stream.match(/(?:-->|---|==>|-.->|--x|--o|<\|--|\*--|o--)/)) return "operator";
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

export interface CodeEditorProps {
  value: string;
  readOnly?: boolean;
  error?: { message: string; line?: number };
  onChange: (value: string) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
}

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, readOnly = false, error, onChange, onUndo, onRedo },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartment = useRef(new Compartment());
  const readOnlyRef = useRef(readOnly);
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
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          mermaidLanguage,
          autocompletion({
            activateOnTyping: true,
            override: [
              (context) => {
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
          EditorView.contentAttributes.of({
            "aria-label": "Mermaid diagram source",
            spellcheck: "false",
          }),
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
      effects: readOnlyCompartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    const selection = view.state.selection.main;
    suppressChange.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: {
        anchor: Math.min(selection.anchor, value.length),
        head: Math.min(selection.head, value.length),
      },
    });
    suppressChange.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const diagnostics: Diagnostic[] = error?.line
      ? (() => {
          const lineNumber = Math.min(error.line, view.state.doc.lines);
          const line = view.state.doc.line(Math.max(1, lineNumber));
          return [{
            from: line.from,
            to: line.to,
            severity: "error",
            message: error.message,
          }];
        })()
      : [];
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [error]);

  return <div className="code-editor" ref={hostRef} />;
});
