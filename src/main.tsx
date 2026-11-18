import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./styles.css";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  state = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Workbench render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="boot-screen" role="alert">
          <div
            style={{
              display: "grid",
              gap: "12px",
              justifyItems: "center",
              textAlign: "center",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "10px",
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--ink)",
              boxShadow: "var(--shadow)",
            }}
          >
            <strong style={{ fontSize: "16px", color: "var(--ink)" }}>Workbench could not render</strong>
            <span style={{ color: "var(--ink-soft)", fontSize: "13px", lineHeight: 1.5 }}>
              Reload the page to restore the diagram workbench.
            </span>
            {this.state.errorMessage && (
              <code
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  background: "var(--surface-2)",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {this.state.errorMessage}
              </code>
            )}
            <button className="button primary" type="button" onClick={() => window.location.reload()}>
              Reload workbench
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
    <Analytics />
  </React.StrictMode>,
);
