import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arrangementRecognitionProxy } from "./server/arrangementRecognitionProxy";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "arrangement-recognition-proxy",
      configureServer(server) {
        server.middlewares.use("/api/arrangement-recognition", arrangementRecognitionProxy);
      },
    },
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src"),
    },
  },
});
