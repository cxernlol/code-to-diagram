import { useEffect, useRef } from "react";
import { autocompletion, closeBrackets, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  StreamLanguage,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
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

const completions = [
  { label: "flowchart TD", type: "keyword", apply: "flowchart TD\n  A[Start] --> B[End]" },
  { label: "classDiagram", type: "keyword", apply: "classDiagram\n  class Example {\n    +String name\n  }" },
  { label: "stateDiagram-v2", type: "keyword", apply: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> [*]" },
  { label: "erDiagram", type: "keyword", apply: "erDiagram\n  USER ||--o{ ORDER : places" },
  { label: "sequenceDiagram", type: "keyword", apply: "sequenceDiagram\n  actor User\n  User->>App: Request" },
];

export interface CodeEditorProps {
  value: string;
  error?: { message: string; line?: number };
  onChange: (value: string) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
}

export function CodeEditor({ value, error, onChange, onUndo, onRedo }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbackRef = useRef({ onChange, onUndo, onRedo });
  const suppressChange = useRef(false);
  const valueRef = useRef(value);

  callbackRef.current = { onChange, onUndo, onRedo };
  valueRef.current = value;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          bracketMatching(),
          closeBrackets(),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          mermaidLanguage,
          autocompletion({
            activateOnTyping: true,
            override: [
              (context) => {
                const word = context.matchBefore(/[\w-]*/);
                if (!word && !context.explicit) return null;
                return {
                  from: word?.from ?? context.pos,
                  options: completions,
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
    if (!view || view.state.doc.toString() === value) return;
    suppressChange.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
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
}
