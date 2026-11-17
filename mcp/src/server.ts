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
import { detectDiagramType } from "../../src/lib/mermaid";
import {
  emitFromIR,
  parseMermaidToIR,
  parseXmlToIR,
  type DiagramIR,
} from "../../src/lib/translate";
import { ensureNodeDomPolyfills } from "./dom-polyfill";

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
      instructions:
        "CTD Studio MCP server (ctd-mcp) for detecting, parsing, converting, and translating diagrams across Mermaid (v12.3.0), Graphviz DOT, PlantUML, D2, SQL DDL, TypeScript, and XML (Draw.io, BPMN, and generic XML).",
    },
  );

  server.registerTool(
    "detect_format",
    {
      title: "Detect Diagram / Code Format",
      description:
        "Auto-detect the format of a diagram or code snippet (mermaid, dot, plantuml, d2, sql, typescript, xml) and its Mermaid diagram type.",
      inputSchema: {
        source: z.string().trim().min(1, "Source must not be empty."),
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
        source: z.string().trim().min(1, "Source must not be empty."),
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
        source: z.string().trim().min(1, "Source must not be empty."),
        targetFormat: FormatSchema,
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
        source: z.string().trim().min(1, "Source must not be empty."),
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
        ir: DiagramIRSchema,
        targetFormat: FormatSchema,
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
        name: z.string().optional(),
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
        url: "https://code-to-diagram.vercel.app/",
        repository: "https://github.com/cxernlol/code-to-diagram",
        formats: CODE_FORMATS.map((id) => ({
          id,
          label: FORMAT_LABELS[id],
          extension: FORMAT_EXTENSIONS[id],
        })),
        themes: Object.keys(THEME_PRESETS),
        templates: Object.keys(TEMPLATES),
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

  return server;
}
