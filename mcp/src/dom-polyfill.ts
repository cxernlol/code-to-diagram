import { DOMParser as XmlDomParser } from "@xmldom/xmldom";

interface XmlElementLike {
  nodeType: number;
  tagName?: string;
  localName?: string;
  childNodes?: ArrayLike<XmlElementLike>;
  children?: XmlElementLike[];
  getElementsByTagName?(name: string): ArrayLike<XmlElementLike>;
  querySelector?(selector: string): XmlElementLike | null;
  querySelectorAll?(selector: string): XmlElementLike[];
}

function attachDomHelpers(root: XmlElementLike | null | undefined): void {
  if (!root) return;

  const walk = (node: XmlElementLike) => {
    if (node.nodeType === 1) {
      if (!("children" in node)) {
        Object.defineProperty(node, "children", {
          configurable: true,
          get() {
            const list: XmlElementLike[] = [];
            const children = node.childNodes;
            if (children) {
              for (let i = 0; i < children.length; i += 1) {
                const child = children[i];
                if (child && child.nodeType === 1) list.push(child);
              }
            }
            return list;
          },
        });
      }

      if (typeof node.querySelectorAll !== "function") {
        node.querySelectorAll = (selector: string): XmlElementLike[] => {
          return querySelectorAllOnNode(node, selector);
        };
      }

      if (typeof node.querySelector !== "function") {
        node.querySelector = (selector: string): XmlElementLike | null => {
          return querySelectorAllOnNode(node, selector)[0] ?? null;
        };
      }
    }

    const children = node.childNodes;
    if (children) {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child) walk(child);
      }
    }
  };

  walk(root);
}

function querySelectorAllOnNode(
  root: XmlElementLike,
  selector: string,
): XmlElementLike[] {
  const parts = selector
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const results: XmlElementLike[] = [];
  const seen = new Set<XmlElementLike>();

  const addMatch = (el: XmlElementLike) => {
    if (!seen.has(el)) {
      seen.add(el);
      results.push(el);
    }
  };

  for (const part of parts) {
    if (part.startsWith(":scope >")) {
      const tag = part.slice(":scope >".length).trim();
      const children = root.childNodes;
      if (children) {
        for (let i = 0; i < children.length; i += 1) {
          const child = children[i];
          if (
            child &&
            child.nodeType === 1 &&
            (child.tagName === tag || child.localName === tag)
          ) {
            addMatch(child);
          }
        }
      }
    } else {
      const descendants = root.getElementsByTagName?.(part);
      if (descendants) {
        for (let i = 0; i < descendants.length; i += 1) {
          const el = descendants[i];
          if (el) addMatch(el);
        }
      }
    }
  }

  return results;
}

export function ensureNodeDomPolyfills(): void {
  if (typeof globalThis.Node === "undefined") {
    (globalThis as unknown as { Node: { ELEMENT_NODE: number; TEXT_NODE: number } }).Node = {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3,
    };
  }

  if (typeof globalThis.DOMParser === "undefined") {
    class NodeDOMParser {
      parseFromString(source: string, _mimeType: string) {
        let hasParseError = false;
        const parser = new XmlDomParser({
          onError: () => {
            hasParseError = true;
          },
        });

        let doc: Document;
        try {
          doc = parser.parseFromString(source, "text/xml") as unknown as Document;
        } catch {
          hasParseError = true;
          doc = parser.parseFromString("<parsererror />", "text/xml") as unknown as Document;
        }

        if (!doc.documentElement) {
          hasParseError = true;
        }

        attachDomHelpers(doc.documentElement as unknown as XmlElementLike);

        const docLike = doc as unknown as {
          querySelector: (selector: string) => unknown;
          querySelectorAll: (selector: string) => unknown[];
          documentElement: XmlElementLike | null;
        };

        docLike.querySelectorAll = (selector: string) => {
          if (selector === "parsererror") {
            return hasParseError ? [{ tagName: "parsererror" }] : [];
          }
          if (!doc.documentElement) return [];
          const root = doc.documentElement as unknown as XmlElementLike;
          const matches = querySelectorAllOnNode(root, selector);
          const parts = selector
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (
            parts.some(
              (p) => !p.startsWith(":scope") && (root.tagName === p || root.localName === p),
            )
          ) {
            return [root, ...matches.filter((m) => m !== root)];
          }
          return matches;
        };

        docLike.querySelector = (selector: string) => {
          return docLike.querySelectorAll(selector)[0] ?? null;
        };

        return doc;
      }
    }

    (globalThis as unknown as { DOMParser: typeof NodeDOMParser }).DOMParser = NodeDOMParser;
  }
}
