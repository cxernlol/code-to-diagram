import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2024",
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@codemirror") || id.includes("@lezer") || id.includes("/codemirror/")) {
            return "codemirror";
          }
          if (id.includes("lucide-react")) {
            return "icons";
          }
          if (id.includes("peerjs")) {
            return "peerjs";
          }
          if (id.includes("d3-")) {
            return "canvas-vendor";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    strictPort: true,
  },
});
