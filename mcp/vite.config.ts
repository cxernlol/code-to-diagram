import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

export default defineConfig({
  publicDir: false,
  build: {
    ssr: resolve(import.meta.dirname, "src/index.ts"),
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "node18",
    minify: false,
    rolldownOptions: {
      external: (id) => {
        if (NODE_BUILTINS.has(id)) return true;
        if (id === "zod" || id === "@xmldom/xmldom") return true;
        if (id === "@modelcontextprotocol/sdk" || id.startsWith("@modelcontextprotocol/sdk/")) {
          return true;
        }
        return false;
      },
      output: {
        format: "es",
        entryFileNames: "index.js",
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
