import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TEMPLATES, THEME_PRESETS } from "../../src/constants";
import {
  detectCodeFormat,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  toMermaidSource,
  translateCodeFormat,
  type CodeFormat,
} from "../../src/lib/formats";
import { partitionLayoutKeys, validLayoutKeysFromIR } from "../../src/lib/layoutKeys";
import { detectDiagramType } from "../../src/lib/mermaid";
import { parseSidecar, serializeSidecar, SIDECAR_VERSION } from "../../src/lib/sidecar";
import {
  emitFromIR,
  parseMermaidToIR,
  parseXmlToIR,
  type DiagramIR,
} from "../../src/lib/translate";
import { ensureNodeDomPolyfills } from "./dom-polyfill";

export const IR_VERSION = 1 as const;

const MERMAID_DIAGRAM_HEADER_RE =
  /^(?:%%\{[\s\S]*?\}%%\s*)?(?:flowchart|graph|classDiagram|stateDiagram(?:-v2)?|erDiagram|sequenceDiagram|gantt|mindmap|pie|journey|gitGraph|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|requirementDiagram)\b/i;

function hasValidMermaidHeader(source: string): boolean {
  const lines = source
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && (!line.startsWith("%%") || line.startsWith("%%{")));
  if (lines.length === 0) return false;
  return MERMAID_DIAGRAM_HEADER_RE.test(lines.join("\n"));
}

export const CODE_FORMATS = [
  "mermaid",
  "dot",
  "plantuml",
  "d2",
  "sql",
  "typescript",
  "xml",
] as const satisfies readonly CodeFormat[];

const FormatSchema = z.enum(CODE_FORMATS);

const IRNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  shape: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

const IREdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  dashed: z.boolean().optional(),
  relation: z.string().optional(),
});

const DiagramIRSchema = z.object({
  kind: z.enum(["flowchart", "class", "er"]),
  direction: z.enum(["TD", "LR"]),
  nodes: z.array(IRNodeSchema),
  edges: z.array(IREdgeSchema),
});

export function parseSourceToIR(source: string): {
  sourceFormat: CodeFormat;
  ir: DiagramIR;
} {
  ensureNodeDomPolyfills();
  const sourceFormat = detectCodeFormat(source);
  const ir =
    sourceFormat === "xml"
      ? parseXmlToIR(source)
      : parseMermaidToIR(toMermaidSource(source).mermaid);
  return { sourceFormat, ir };
}

function formatErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

export function createSgsStudioMcpServer(version = "1.0.0"): McpServer {
  ensureNodeDomPolyfills();

  const server = new McpServer(
    {
      name: "ctd-mcp",
      version,
    },
    {
      instructions: [
        "CTD Studio MCP server (ctd-mcp) for detecting, parsing, converting, configuring, translating, and verifying diagrams + .ctd.json sidecar layouts across Mermaid (v12.3.0), Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML (Draw.io, BPMN, generic XML).",
        "Recommended AI workflow: (1) Call detect_format, to_mermaid, or translate_format to convert/inspect diagrams. (2) Call parse_diagram_ir or diff_ir to inspect structure and changes. (3) Call regen_preserve_layout, list_orphan_layout, check_drift, verify_diagram, and patch_source to update diagrams while preserving manual .ctd.json layouts. (4) Call get_studio_info for capabilities and irVersion.",
      ].join(" "),
    },
  );

  server.registerTool(
    "detect_format",
    {
      title: "Detect Diagram / Code Format",
      description:
        "Auto-detect the format of a diagram or code snippet (mermaid, dot, plantuml, d2, sql, typescript, xml) and its Mermaid diagram type.",
      inputSchema: {
        source: z
          .string()
          .trim()
          .min(1, "Source must not be empty.")
          .describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML)."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source }) => {
      try {
        const format = detectCodeFormat(source);
        const diagramType = detectDiagramType(source);
        const result = {
          format,
          formatLabel: FORMAT_LABELS[format],
          extension: FORMAT_EXTENSIONS[format],
          diagramType,
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "to_mermaid",
    {
      title: "Convert Code/Diagram to Mermaid",
      description:
        "Convert Mermaid, Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, or XML (Draw.io mxGraphModel, BPMN, explicit diagram XML, or generic XML) into Mermaid syntax.",
      inputSchema: {
        source: z
          .string()
          .trim()
          .min(1, "Source must not be empty.")
          .describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML)."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source }) => {
      try {
        ensureNodeDomPolyfills();
        const { format, mermaid } = toMermaidSource(source);
        const diagramType = detectDiagramType(mermaid);
        return {
          content: [
            {
              type: "text",
              text: mermaid,
            },
          ],
          structuredContent: {
            sourceFormat: format,
            diagramType,
            mermaid,
          },
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "translate_format",
    {
      title: "Translate Between Diagram Formats",
      description:
        "Translate diagram or code source between any two supported CTD Studio formats: mermaid, dot, plantuml, d2, sql, typescript, xml.",
      inputSchema: {
        source: z
          .string()
          .trim()
          .min(1, "Source must not be empty.")
          .describe("Input diagram or code snippet in any supported CTD Studio format."),
        targetFormat: FormatSchema.describe(
          "Target output format: mermaid, dot, plantuml, d2, sql, typescript, or xml.",
        ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, targetFormat }) => {
      try {
        ensureNodeDomPolyfills();
        const sourceFormat = detectCodeFormat(source);
        const output = translateCodeFormat(source, targetFormat);
        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
          structuredContent: {
            sourceFormat,
            targetFormat,
            output,
          },
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "parse_diagram_ir",
    {
      title: "Parse Diagram to Intermediate Representation",
      description:
        "Parse any supported diagram or code format into CTD Studio's structured DiagramIR (kind, direction, nodes, edges).",
      inputSchema: {
        source: z
          .string()
          .trim()
          .min(1, "Source must not be empty.")
          .describe("Diagram or code snippet to inspect (Mermaid, DOT, PlantUML, D2, SQL DDL, TypeScript, or XML)."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source }) => {
      try {
        const result = parseSourceToIR(source);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "emit_from_ir",
    {
      title: "Emit Diagram from Intermediate Representation",
      description:
        "Generate diagram or code in any target format (mermaid, dot, plantuml, d2, sql, typescript, xml) from a structured DiagramIR object.",
      inputSchema: {
        ir: DiagramIRSchema.describe("Structured DiagramIR object (typically returned by parse_diagram_ir)."),
        targetFormat: FormatSchema.describe(
          "Target output format: mermaid, dot, plantuml, d2, sql, typescript, or xml.",
        ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ ir, targetFormat }) => {
      try {
        const output = emitFromIR(ir, targetFormat);
        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
          structuredContent: {
            targetFormat,
            output,
          },
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "list_templates",
    {
      title: "List CTD Studio Diagram Templates",
      description:
        "List built-in CTD Studio diagram templates or retrieve a specific template by name.",
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe("Optional template name (case-insensitive). Omit to list all built-in templates."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ name }) => {
      if (name) {
        const matchedKey = Object.keys(TEMPLATES).find(
          (key) => key.toLowerCase() === name.trim().toLowerCase(),
        );
        if (!matchedKey) {
          return formatErrorResult(
            `Unknown template "${name}". Available templates: ${Object.keys(TEMPLATES).join(", ")}`,
          );
        }
        const code = TEMPLATES[matchedKey]!;
        return {
          content: [{ type: "text", text: code }],
          structuredContent: { name: matchedKey, code },
        };
      }

      const templates = Object.entries(TEMPLATES).map(([templateName, code]) => ({
        name: templateName,
        diagramType: detectDiagramType(code),
        code,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ templates }, null, 2),
          },
        ],
        structuredContent: { templates },
      };
    },
  );

  server.registerTool(
    "get_studio_info",
    {
      title: "Get CTD Studio Capabilities",
      description:
        "Return CTD Studio supported formats, file extensions, theme presets, and web app URL.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const info = {
        name: "CTD Studio",
        mcpName: "ctd-mcp",
        mermaidVersion: "12.3.0",
        irVersion: IR_VERSION,
        sidecarVersion: SIDECAR_VERSION,
        url: "https://code-to-diagram.vercel.app/",
        repository: "https://github.com/cxernlol/code-to-diagram",
        capabilities: [
          "detect_format",
          "to_mermaid",
          "translate_format",
          "parse_diagram_ir",
          "emit_from_ir",
          "list_templates",
          "get_studio_info",
          "configure_mermaid_diagram",
          "regen_preserve_layout",
          "list_orphan_layout",
          "diff_ir",
          "verify_diagram",
          "verify_against_files",
          "patch_source",
          "preview_patch",
          "check_drift",
        ],
        formats: CODE_FORMATS.map((id) => ({
          id,
          label: FORMAT_LABELS[id],
          extension: FORMAT_EXTENSIONS[id],
        })),
        themes: Object.keys(THEME_PRESETS),
        templates: Object.keys(TEMPLATES),
        directions: ["TD", "BT", "LR", "RL"],
        looks: ["classic", "handDrawn"],
        suppressionDirectives: {
          hideNode: "%% sgs-hide: <NodeId>",
          hideMember: "%% sgs-hidden-member: <memberLine>",
        },
        features: [
          "dark-mode",
          "multi-font-sizing",
          "canva-style-suppression",
          "node-member-editing",
          "multi-direction-layout",
          "live-rooms",
          "svg-png-export",
        ],
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(info, null, 2),
          },
        ],
        structuredContent: info,
      };
    },
  );

  server.registerTool(
    "configure_mermaid_diagram",
    {
      title: "Configure Mermaid Diagram",
      description:
        "Update a Mermaid diagram's layout direction (TD/BT/LR/RL), toggle Canva-style node suppression (%% sgs-hide: <id>), or add a member/field to a class or ER entity.",
      inputSchema: {
        code: z.string().min(1).describe("Mermaid diagram source code."),
        direction: z.enum(["TD", "TB", "BT", "LR", "RL"]).optional().describe("Optional layout direction to apply."),
        hideNodes: z.array(z.string().min(1)).optional().describe("Node IDs to hide via %% sgs-hide directives."),
        showNodes: z.array(z.string().min(1)).optional().describe("Node IDs to unhide by removing %% sgs-hide directives."),
        addMember: z
          .object({
            nodeId: z.string().min(1),
            member: z.string().min(1),
          })
          .optional()
          .describe("Optional member/field line to add inside a classDiagram class or erDiagram entity."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ code, direction, hideNodes, showNodes, addMember }) => {
      const maxSourceBytes = 512 * 1024;
      if (code.length > maxSourceBytes) {
        return {
          isError: true,
          content: [{ type: "text", text: `Source exceeds ${maxSourceBytes} byte limit.` }],
        };
      }
      let next = code;
      if (direction) {
        const headerRe = /^(\s*(?:flowchart|graph)\s+)(TB|TD|BT|LR|RL)\b/im;
        if (headerRe.test(next)) {
          next = next.replace(headerRe, `$1${direction}`);
        } else if (/^\s*direction\s+(TB|TD|BT|LR|RL)\b/im.test(next)) {
          next = next.replace(/^(\s*direction\s+)(TB|TD|BT|LR|RL)\b/im, `$1${direction}`);
        } else {
          const lines = next.split(/\r?\n/);
          if (lines.length > 0 && /^(?:classDiagram|stateDiagram(?:-v2)?|erDiagram)\b/i.test(lines[0]!.trim())) {
            lines.splice(1, 0, `  direction ${direction}`);
            next = lines.join("\n");
          }
        }
      }
      if (showNodes?.length) {
        const showSet = new Set(showNodes.map((n) => n.trim()));
        next = next
          .split(/\r?\n/)
          .filter((line) => {
            const m = line.match(/^\s*%%\s*sgs-hide:\s*(.+)$/);
            return !(m && showSet.has(m[1]!.trim()));
          })
          .join("\n");
      }
      if (hideNodes?.length) {
        const existing = new Set<string>();
        for (const line of next.split(/\r?\n/)) {
          const m = line.match(/^\s*%%\s*sgs-hide:\s*(.+)$/);
          if (m) existing.add(m[1]!.trim());
        }
        const additions = hideNodes
          .map((n) => n.trim())
          .filter((n) => n && !existing.has(n))
          .map((n) => `  %% sgs-hide: ${n}`);
        if (additions.length) next = `${next.trimEnd()}\n${additions.join("\n")}`;
      }
      if (addMember) {
        const escaped = addMember.nodeId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const member = addMember.member.replace(/[\r\n]+/g, " ").trim();
        const lines = next.split(/\r?\n/);
        const blockStart = lines.findIndex((line) =>
          new RegExp(`^\\s*(?:class\\s+)?${escaped}(?:\\s*\\[[^\\]]*\\])?\\s*\\{`).test(line),
        );
        if (blockStart !== -1) {
          let blockEnd = blockStart;
          for (let i = blockStart + 1; i < lines.length; i += 1) {
            if (lines[i]!.includes("}")) {
              blockEnd = i;
              break;
            }
          }
          if (blockEnd > blockStart) {
            lines.splice(blockEnd, 0, `    ${member}`);
            next = lines.join("\n");
          }
        } else {
          const isClass = /^\s*classDiagram\b/im.test(next);
          next = isClass
            ? `${next.trimEnd()}\n  class ${addMember.nodeId.trim()} {\n    ${member}\n  }`
            : `${next.trimEnd()}\n  ${addMember.nodeId.trim()} {\n    ${member}\n  }`;
        }
      }
      return {
        content: [{ type: "text", text: next }],
        structuredContent: { code: next },
      };
    },
  );

  const SidecarInputSchema = z
    .union([z.string().min(1), z.record(z.string(), z.unknown())])
    .describe("CTD sidecar v1 JSON string or parsed object.");

  const sha256Hex = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

  server.registerTool(
    "regen_preserve_layout",
    {
      title: "Regenerate & Preserve Sidecar Layout",
      description:
        "Compare old and new diagram source, preserve matching node/edge layout keys from a .ctd.json sidecar, report orphaned keys and likely renamed node IDs, and return an updated sidecar.",
      inputSchema: {
        oldSource: z.string().trim().min(1, "oldSource must not be empty."),
        newSource: z.string().trim().min(1, "newSource must not be empty."),
        sidecar: SidecarInputSchema,
        generatedFrom: z.string().optional().describe("Optional source filename for sidecar meta.generatedFrom."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ oldSource, newSource, sidecar, generatedFrom }) => {
      try {
        const warnings: string[] = [];
        const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
        const { ir: oldIr } = parseSourceToIR(oldSource);
        const { ir: newIr } = parseSourceToIR(newSource);
        const validNewKeys = validLayoutKeysFromIR(newIr);
        const { preserved, orphaned } = partitionLayoutKeys(parsedSidecar.layout, validNewKeys);

        const oldNodeIds = new Set(oldIr.nodes.map((n) => n.id));
        const newNodeIds = new Set(newIr.nodes.map((n) => n.id));
        const removedNodes = oldIr.nodes.filter((n) => !newNodeIds.has(n.id));
        const addedNodes = newIr.nodes.filter((n) => !oldNodeIds.has(n.id));
        const renamed: { from: string; to: string; reason: string }[] = [];
        for (const oldNode of removedNodes) {
          if (!(oldNode.id in parsedSidecar.layout)) continue;
          const match = addedNodes.find(
            (n) => n.label.trim().toLowerCase() === oldNode.label.trim().toLowerCase(),
          );
          if (match) {
            renamed.push({ from: oldNode.id, to: match.id, reason: "matching-label" });
          }
        }

        const updatedSidecar = serializeSidecar(preserved, {
          ...parsedSidecar.meta,
          ...(generatedFrom ? { generatedFrom } : {}),
          sha256: sha256Hex(newSource),
          updatedAt: new Date().toISOString(),
        });

        const result = {
          ok: true,
          irVersion: IR_VERSION,
          preserved,
          orphaned,
          renamed,
          sidecar: updatedSidecar,
          warnings,
          errors: [] as string[],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "list_orphan_layout",
    {
      title: "List Orphaned Layout Keys",
      description:
        "Inspect a .ctd.json sidecar against diagram source and list layout keys whose node or edge IDs no longer exist in the diagram.",
      inputSchema: {
        source: z.string().trim().min(1, "Source must not be empty."),
        sidecar: SidecarInputSchema,
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, sidecar }) => {
      try {
        const warnings: string[] = [];
        const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
        const { ir } = parseSourceToIR(source);
        const validKeys = validLayoutKeysFromIR(ir);
        const { preserved, orphaned, orphanedEntries } = partitionLayoutKeys(
          parsedSidecar.layout,
          validKeys,
        );
        const result = {
          ok: true,
          irVersion: IR_VERSION,
          preservedCount: Object.keys(preserved).length,
          orphaned,
          orphanedEntries,
          warnings,
          errors: [] as string[],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "diff_ir",
    {
      title: "Diff Diagram IR",
      description:
        "Compare two diagram sources at the DiagramIR level and return added, removed, and changed nodes and edges.",
      inputSchema: {
        oldSource: z.string().trim().min(1, "oldSource must not be empty."),
        newSource: z.string().trim().min(1, "newSource must not be empty."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ oldSource, newSource }) => {
      try {
        const { ir: oldIr } = parseSourceToIR(oldSource);
        const { ir: newIr } = parseSourceToIR(newSource);

        const oldNodes = new Map(oldIr.nodes.map((n) => [n.id, n]));
        const newNodes = new Map(newIr.nodes.map((n) => [n.id, n]));

        const addedNodes = newIr.nodes.filter((n) => !oldNodes.has(n.id));
        const removedNodes = oldIr.nodes.filter((n) => !newNodes.has(n.id));
        const changedNodes = newIr.nodes
          .filter((n) => {
            const prev = oldNodes.get(n.id);
            if (!prev) return false;
            return (
              prev.label !== n.label ||
              prev.shape !== n.shape ||
              JSON.stringify(prev.fields ?? []) !== JSON.stringify(n.fields ?? [])
            );
          })
          .map((n) => ({ id: n.id, before: oldNodes.get(n.id)!, after: n }));

        const edgeKey = (e: DiagramIR["edges"][number]) =>
          `${e.from}-->${e.to}|${e.label ?? ""}|${Boolean(e.dashed)}|${e.relation ?? ""}`;
        const oldEdgeKeys = new Set(oldIr.edges.map(edgeKey));
        const newEdgeKeys = new Set(newIr.edges.map(edgeKey));
        const addedEdges = newIr.edges.filter((e) => !oldEdgeKeys.has(edgeKey(e)));
        const removedEdges = oldIr.edges.filter((e) => !newEdgeKeys.has(edgeKey(e)));

        const result = {
          ok: true,
          irVersion: IR_VERSION,
          kindChanged: oldIr.kind !== newIr.kind,
          directionChanged: oldIr.direction !== newIr.direction,
          addedNodes,
          removedNodes,
          changedNodes,
          addedEdges,
          removedEdges,
          summary: `+${addedNodes.length}/-${removedNodes.length}/~${changedNodes.length} nodes, +${addedEdges.length}/-${removedEdges.length} edges`,
          warnings: [] as string[],
          errors: [] as string[],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerTool(
    "verify_diagram",
    {
      title: "Verify Diagram & Sidecar",
      description:
        "Verify that a diagram parses cleanly, optional .ctd.json sidecar layout keys are a subset of IR node/edge IDs, and optional SQL DDL table names appear in ER entities.",
      inputSchema: {
        source: z.string().trim().min(1, "Source must not be empty."),
        sidecar: SidecarInputSchema.optional(),
        sqlSource: z.string().optional().describe("Optional SQL DDL to verify table names against diagram entities."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, sidecar, sqlSource }) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      let sourceFormat: CodeFormat | null = null;
      let diagramKind: DiagramIR["kind"] | null = null;
      let orphanLayoutKeys: string[] = [];
      let missingSqlTables: string[] = [];
      let validSource = false;
      let ir: DiagramIR | null = null;

      try {
        const parsed = parseSourceToIR(source);
        sourceFormat = parsed.sourceFormat;
        ir = parsed.ir;
        diagramKind = ir.kind;
        if (sourceFormat === "mermaid" && !hasValidMermaidHeader(source)) {
          errors.push("Unrecognized diagram format or missing Mermaid diagram header.");
        } else {
          validSource = true;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      if (ir && sidecar !== undefined) {
        try {
          const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
          const validKeys = validLayoutKeysFromIR(ir);
          orphanLayoutKeys = partitionLayoutKeys(parsedSidecar.layout, validKeys).orphaned;
          if (orphanLayoutKeys.length > 0) {
            warnings.push(`Found ${orphanLayoutKeys.length} orphaned layout key(s).`);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      if (ir && sqlSource && sqlSource.trim().length > 0) {
        try {
          const { sourceFormat: sqlFormat, ir: sqlIr } = parseSourceToIR(sqlSource);
          if (sqlFormat !== "sql" || sqlIr.nodes.length === 0) {
            errors.push("Invalid sqlSource: expected SQL DDL with at least one CREATE TABLE statement.");
          } else {
            const diagramIds = new Set(ir.nodes.map((n) => n.id.toLowerCase()));
            missingSqlTables = sqlIr.nodes
              .map((n) => n.id)
              .filter((table) => !diagramIds.has(table.toLowerCase()));
            if (missingSqlTables.length > 0) {
              warnings.push(`SQL tables missing from diagram: ${missingSqlTables.join(", ")}`);
            }
          }
        } catch (error) {
          errors.push(`Invalid sqlSource: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const ok = validSource && errors.length === 0 && orphanLayoutKeys.length === 0 && missingSqlTables.length === 0;
      const result = {
        ok,
        irVersion: IR_VERSION,
        validSource,
        sourceFormat,
        diagramKind,
        orphanLayoutKeys,
        missingSqlTables,
        warnings,
        errors,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "patch_source",
    {
      title: "Patch Diagram Source",
      description:
        "Apply targeted find/replace hunks to diagram source without rewriting the whole file, and validate that the patched source still parses.",
      inputSchema: {
        source: z.string().min(1, "Source must not be empty."),
        patches: z
          .array(
            z.object({
              find: z.string().min(1),
              replace: z.string(),
              all: z.boolean().optional(),
            }),
          )
          .min(1),
        dryRun: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, patches, dryRun }) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      let patched = source;
      let appliedCount = 0;

      for (const patch of patches) {
        if (!patched.includes(patch.find)) {
          warnings.push(`Patch target not found: ${JSON.stringify(patch.find)}`);
          continue;
        }
        patched = patch.all
          ? patched.split(patch.find).join(patch.replace)
          : patched.replace(patch.find, patch.replace);
        appliedCount += 1;
      }

      try {
        const { sourceFormat } = parseSourceToIR(patched);
        if (sourceFormat === "mermaid" && !hasValidMermaidHeader(patched)) {
          errors.push("Patched source is missing a valid Mermaid diagram header.");
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      const result = {
        ok: errors.length === 0,
        irVersion: IR_VERSION,
        dryRun: Boolean(dryRun),
        changed: patched !== source,
        appliedCount,
        patchedSource: patched,
        warnings,
        errors,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "preview_patch",
    {
      title: "Preview Diagram Patch",
      description:
        "Preview targeted find/replace hunks on diagram source without writing, validate that the patched source parses, and return IR node/edge diffs alongside line changes.",
      inputSchema: {
        source: z.string().min(1, "Source must not be empty."),
        patches: z
          .array(
            z.object({
              find: z.string().min(1),
              replace: z.string(),
              all: z.boolean().optional(),
            }),
          )
          .min(1),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, patches }) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      let patched = source;
      let appliedCount = 0;

      for (const patch of patches) {
        if (!patched.includes(patch.find)) {
          warnings.push(`Patch target not found: ${JSON.stringify(patch.find)}`);
          continue;
        }
        patched = patch.all
          ? patched.split(patch.find).join(patch.replace)
          : patched.replace(patch.find, patch.replace);
        appliedCount += 1;
      }

      let addedNodes: DiagramIR["nodes"] = [];
      let removedNodes: DiagramIR["nodes"] = [];
      let summary = "0 changes";

      try {
        const { sourceFormat: oldFmt, ir: oldIr } = parseSourceToIR(source);
        const { sourceFormat: newFmt, ir: newIr } = parseSourceToIR(patched);
        if (newFmt === "mermaid" && !hasValidMermaidHeader(patched)) {
          errors.push("Patched source is missing a valid Mermaid diagram header.");
        }
        if (oldFmt === "mermaid" && !hasValidMermaidHeader(source)) {
          warnings.push("Original source was missing a valid Mermaid diagram header.");
        }
        const oldIds = new Set(oldIr.nodes.map((n) => n.id));
        const newIds = new Set(newIr.nodes.map((n) => n.id));
        addedNodes = newIr.nodes.filter((n) => !oldIds.has(n.id));
        removedNodes = oldIr.nodes.filter((n) => !newIds.has(n.id));
        summary = `+${addedNodes.length}/-${removedNodes.length} nodes (${appliedCount} hunk(s) applied)`;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      const oldLines = source.split(/\r?\n/);
      const newLines = patched.split(/\r?\n/);
      const diffLines: string[] = [];
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i += 1) {
        const a = oldLines[i];
        const b = newLines[i];
        if (a === b) continue;
        if (a !== undefined) diffLines.push(`- ${a}`);
        if (b !== undefined) diffLines.push(`+ ${b}`);
      }

      const result = {
        ok: errors.length === 0,
        irVersion: IR_VERSION,
        dryRun: true as const,
        changed: patched !== source,
        appliedCount,
        patchedSource: patched,
        diffLines,
        addedNodes,
        removedNodes,
        summary,
        warnings,
        errors,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "verify_against_files",
    {
      title: "Verify Diagram Against Source / Schema Files",
      description:
        "Verify that a diagram parses cleanly and check its node/entity IDs against optional reference code/schema content or disk file paths (SQL DDL tables, TypeScript interfaces/classes/types, or another diagram).",
      inputSchema: {
        source: z.string().trim().min(1, "Source must not be empty.").describe("Diagram source to verify."),
        filePath: z
          .string()
          .optional()
          .describe("Optional local file path (e.g. schema.sql or models.ts) to read and compare against the diagram."),
        fileContent: z
          .string()
          .optional()
          .describe("Optional inline file content (SQL DDL, TypeScript, or diagram source) to compare when not reading from disk."),
        sidecar: SidecarInputSchema.optional().describe("Optional .ctd.json sidecar to check for orphaned layout keys."),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, filePath, fileContent, sidecar }) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      let sourceFormat: CodeFormat | null = null;
      let diagramKind: DiagramIR["kind"] | null = null;
      let validSource = false;
      let ir: DiagramIR | null = null;
      let referenceFormat: CodeFormat | null = null;
      let expectedNames: string[] = [];
      let matchedNames: string[] = [];
      let missingFromDiagram: string[] = [];
      let extraInDiagram: string[] = [];
      let orphanLayoutKeys: string[] = [];

      try {
        const parsed = parseSourceToIR(source);
        sourceFormat = parsed.sourceFormat;
        ir = parsed.ir;
        diagramKind = ir.kind;
        if (sourceFormat === "mermaid" && !hasValidMermaidHeader(source)) {
          errors.push("Unrecognized diagram format or missing Mermaid diagram header.");
        } else {
          validSource = true;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }

      if (ir && sidecar !== undefined) {
        try {
          const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
          const validKeys = validLayoutKeysFromIR(ir);
          orphanLayoutKeys = partitionLayoutKeys(parsedSidecar.layout, validKeys).orphaned;
          if (orphanLayoutKeys.length > 0) {
            warnings.push(`Found ${orphanLayoutKeys.length} orphaned layout key(s).`);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      let refText = fileContent?.trim() ?? "";
      if (!refText && filePath && filePath.trim().length > 0) {
        try {
          refText = (await readFile(filePath.trim(), "utf8")).trim();
        } catch (error) {
          errors.push(`Failed to read filePath "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (ir && refText.length > 0) {
        try {
          const refParsed = parseSourceToIR(refText);
          referenceFormat = refParsed.sourceFormat;
          expectedNames = refParsed.ir.nodes.map((n) => n.id);
          if (expectedNames.length === 0) {
            warnings.push("Reference file parsed with 0 identifiable entities/types/nodes.");
          } else {
            const diagramMap = new Map(ir.nodes.map((n) => [n.id.toLowerCase(), n.id]));
            const expectedLower = new Set(expectedNames.map((n) => n.toLowerCase()));
            for (const name of expectedNames) {
              if (diagramMap.has(name.toLowerCase())) {
                matchedNames.push(name);
              } else {
                missingFromDiagram.push(name);
              }
            }
            extraInDiagram = ir.nodes
              .map((n) => n.id)
              .filter((id) => !expectedLower.has(id.toLowerCase()));
            if (missingFromDiagram.length > 0) {
              warnings.push(`Reference entities/types missing from diagram: ${missingFromDiagram.join(", ")}`);
            }
          }
        } catch (error) {
          errors.push(`Failed to parse reference file content: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const ok =
        validSource &&
        errors.length === 0 &&
        orphanLayoutKeys.length === 0 &&
        missingFromDiagram.length === 0;
      const result = {
        ok,
        irVersion: IR_VERSION,
        validSource,
        sourceFormat,
        diagramKind,
        referenceFormat,
        expectedNames,
        matchedNames,
        missingFromDiagram,
        extraInDiagram,
        orphanLayoutKeys,
        warnings,
        errors,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "check_drift",
    {
      title: "Check Diagram / Sidecar Drift",
      description:
        "Compare current diagram source SHA-256 against sidecar meta.sha256 and check for orphaned layout keys.",
      inputSchema: {
        source: z.string().min(1, "Source must not be empty."),
        sidecar: SidecarInputSchema,
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ source, sidecar }) => {
      try {
        const warnings: string[] = [];
        const parsedSidecar = parseSidecar(sidecar, { onWarning: (w) => warnings.push(w) });
        const { ir } = parseSourceToIR(source);
        const validKeys = validLayoutKeysFromIR(ir);
        const orphanLayoutKeys = partitionLayoutKeys(parsedSidecar.layout, validKeys).orphaned;
        const currentSha256 = sha256Hex(source);
        const expectedSha256 = parsedSidecar.meta?.sha256;
        const hasBaselineSha256 = Boolean(expectedSha256);
        if (!hasBaselineSha256) {
          warnings.push("Sidecar meta.sha256 is missing; drift check fell back to orphan key check.");
        }
        const shaDrifted = hasBaselineSha256 && expectedSha256 !== currentSha256;
        const drifted = shaDrifted || orphanLayoutKeys.length > 0;
        const result = {
          ok: true,
          irVersion: IR_VERSION,
          hasBaselineSha256,
          drifted,
          currentSha256,
          expectedSha256: expectedSha256 ?? null,
          generatedFrom: parsedSidecar.meta?.generatedFrom ?? null,
          orphanLayoutKeys,
          warnings,
          errors: [] as string[],
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  );

  server.registerResource(
    "formats",
    "ctd://formats",
    {
      title: "CTD Studio Supported Formats",
      description: "Supported diagram and code formats with labels and file extensions.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            CODE_FORMATS.map((id) => ({
              id,
              label: FORMAT_LABELS[id],
              extension: FORMAT_EXTENSIONS[id],
            })),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "themes",
    "ctd://themes",
    {
      title: "CTD Studio Theme Presets",
      description: "Built-in color palette presets for CTD Studio diagrams.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(THEME_PRESETS, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "template",
    new ResourceTemplate("ctd://templates/{name}", {
      list: async () => ({
        resources: Object.keys(TEMPLATES).map((name) => ({
          uri: `ctd://templates/${encodeURIComponent(name)}`,
          name,
          mimeType: "text/plain",
        })),
      }),
    }),
    {
      title: "CTD Studio Diagram Template",
      description: "Built-in Mermaid diagram template.",
      mimeType: "text/plain",
    },
    async (uri, { name }) => {
      const requested = decodeURIComponent(String(name ?? ""));
      const matchedKey = Object.keys(TEMPLATES).find(
        (key) => key.toLowerCase() === requested.toLowerCase(),
      );
      if (!matchedKey) {
        throw new Error(`Template "${requested}" not found.`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: TEMPLATES[matchedKey]!,
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "code_to_diagram",
    {
      title: "Code to Diagram",
      description:
        "Convert source code, SQL schema, XML, or architecture notes into a clean diagram using CTD Studio.",
      argsSchema: {
        source: z.string().describe("Source code, schema, or diagram text to convert"),
        targetFormat: FormatSchema.optional().describe(
          "Desired output format (defaults to mermaid)",
        ),
      },
    },
    ({ source, targetFormat }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Use CTD Studio MCP tools (\`detect_format\`, \`to_mermaid\`, \`translate_format\`, \`parse_diagram_ir\`) to convert the following input into a clean ${targetFormat ?? "mermaid"} diagram:`,
              "",
              "```",
              source,
              "```",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "configure_diagram",
    {
      title: "Configure Mermaid Diagram",
      description:
        "Adjust layout direction, hide/show nodes with %% sgs-hide directives, or add class/ER members using configure_mermaid_diagram.",
      argsSchema: {
        code: z.string().describe("Existing Mermaid diagram source code"),
        changes: z.string().describe("Requested layout direction, node visibility, or member changes"),
      },
    },
    ({ code, changes }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Use the \`configure_mermaid_diagram\` MCP tool to apply these changes: ${changes}`,
              "",
              "```mermaid",
              code,
              "```",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "explain_diagram",
    {
      title: "Explain Diagram Structure",
      description:
        "Parse a diagram or code snippet with parse_diagram_ir and explain its nodes, edges, and flow concisely.",
      argsSchema: {
        source: z.string().describe("Diagram or code snippet to analyze"),
      },
    },
    ({ source }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Call `detect_format` and `parse_diagram_ir` on the input below, then summarize its structure, key components, and relationships concisely:",
              "",
              "```",
              source,
              "```",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  return server;
}
