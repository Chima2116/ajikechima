import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The portfolio in site/ is static and untouched. This only builds the React + Halaska UI entry (ui.html).
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5174 },
  build: { outDir: "site/assistant", emptyOutDir: true, rollupOptions: { input: "ui.html" } },
});
