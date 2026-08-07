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
  build: {
    rollupOptions: {
      input: {
        // O portal.
        index: path.resolve(import.meta.dirname, "index.html"),
        // Página de relay do popup de login (só usada quando o portal roda embutido em iframe;
        // ver src/msalRelay.ts). É uma SEGUNDA página do build — sem declará-la aqui ela
        // simplesmente não iria para o dist/ e o login do preview quebraria em produção.
        "msal-relay": path.resolve(import.meta.dirname, "msal-relay.html"),
      },
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": {
        target: process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
