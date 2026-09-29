import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: "web",
  // O .env fica na raiz do projeto (compartilhado com o servidor), não em web/.
  envDir: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@shared": path.resolve(import.meta.dirname, "shared") } },
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
});
