import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Starter do Hive — Vite + React + TS + Tailwind v4 + shadcn/ui. host:true → dev server em 0.0.0.0
// (o container de preview do Hive precisa alcançar).
export default defineConfig({
  // base relativo: o preview do modelo é servido sob um sub-path (/models/<id>/preview/) no Hive,
  // então os assets têm que ser ./assets/... (relativos), não /assets/... (raiz). Use HashRouter p/ as rotas.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: { host: true },
});
