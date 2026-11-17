import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json";
import { createSgsStudioMcpServer } from "./server";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      [
        `${pkg.name} v${pkg.version}`,
        "CTD Studio Model Context Protocol (MCP) server over stdio.",
        "",
        "Usage:",
        "  npx ctd-mcp",
        "  ctd-mcp [--help | --version]",
        "",
        "Connect from Claude Desktop, Cursor, Windsurf, or VS Code via stdio.",
      ].join("\n") + "\n",
    );
    return;
  }

  const server = createSgsStudioMcpServer(pkg.version);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`CTD Studio MCP server (ctd-mcp) v${pkg.version} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in CTD Studio MCP server:", error);
  process.exit(1);
});
