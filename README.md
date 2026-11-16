# SGS Studio

A local-first, free-forever browser workspace for editing and visually tweaking Mermaid diagrams. Built to bypass paywalled SaaS tools and corporate cloud bloat.

## Features

- **Live Code & Visual Editing:** Edit raw Mermaid source code or manually drag and reposition individual nodes in flowcharts, class, state, and ER diagrams.
- **Local-First Storage:** All diagrams, layout adjustments, and settings live securely in your browser's IndexedDB. 
- **Zero Login:** Open the app and start working immediately. No accounts, no tracking, no subscriptions.
- **BYOK AI (Optional):** Use your own provider endpoint and API key. AI requests go directly from your browser to your configured provider.
- **Clean Export:** Export production-ready SVG or PNG assets instantly.

## Getting Started

Clone the repository and run it locally:

```bash
git clone https://github.com/cxernlol/sgs-chify.git
cd sgs-chify
npm install
npm run dev
```

To type-check and generate a production build in `dist/`:

```bash
npm run build
```

## Data & Privacy

- **Storage:** Data is stored locally in IndexedDB. On first launch, SGS Studio automatically migrates legacy `mstudio2` `localStorage` workspaces while leaving a recovery copy untouched.
- **AI Requests:** When you invoke an AI prompt, your code, prompt, and API key are sent directly from your browser to your endpoint. (Note: Some providers may require CORS configuration for browser-origin requests).
- **Cost:** SGS Studio has zero paid features, zero subscription tiers, and zero diagram limits. You only incur costs if you plug in a paid commercial AI provider key.
