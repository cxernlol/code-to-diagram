export type SeoView = "home" | "studio" | "docs" | "privacy" | "terms";

interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
}

const SITE_ORIGIN = "https://code-to-diagram.vercel.app";

const PAGE_SEO: Record<SeoView, PageSeo> = {
  home: {
    title: "CTD Studio: Code to Diagram Editor for Mermaid, DOT, SQL & XML",
    description:
      "Write Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, or XML and drag boxes and connector lines into place. Local-first browser diagram editor with SVG/PNG export and ctd-mcp.",
    canonical: `${SITE_ORIGIN}/`,
    robots: "index, follow",
  },
  docs: {
    title: "Syntax & Template Docs — CTD Studio",
    description:
      "Quick reference for Mermaid arrows, flowchart shapes, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, XML, and starter templates in CTD Studio.",
    canonical: `${SITE_ORIGIN}/docs`,
    robots: "index, follow",
  },
  privacy: {
    title: "Privacy & Cookies — CTD Studio",
    description:
      "CTD Studio privacy policy: zero cookies, local-first IndexedDB storage, bundled assets, and optional BYOK AI requests.",
    canonical: `${SITE_ORIGIN}/privacy`,
    robots: "index, follow",
  },
  terms: {
    title: "Terms of Use — CTD Studio",
    description:
      "Terms of use for CTD Studio (Elastic License 2.0 (ELv2); commercial SaaS, reselling, or white-labeling requires a paid license).",
    canonical: `${SITE_ORIGIN}/terms`,
    robots: "index, follow",
  },
  studio: {
    title: "Diagram Workbench — CTD Studio",
    description:
      "Interactive local-first diagram workbench for Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML.",
    canonical: `${SITE_ORIGIN}/app`,
    robots: "noindex, follow",
  },
};

function setMetaContent(selector: string, content: string): void {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", content);
}

export function applyPageSeo(view: SeoView, customTitle?: string): void {
  const entry = PAGE_SEO[view];
  const title = customTitle ?? entry.title;

  document.title = title;
  setMetaContent('meta[name="description"]', entry.description);
  setMetaContent('meta[name="robots"]', entry.robots);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', entry.description);
  setMetaContent('meta[property="og:url"]', entry.canonical);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', entry.description);

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", entry.canonical);
}
