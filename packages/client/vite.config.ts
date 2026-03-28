import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
  build: {
    target: "ES2022",
  },
  resolve: {
    alias: {
      // Zustand 5.x tries to optionally require React — stub it out
      // since we use vanilla (non-React) Zustand.
      react: new URL("./src/shims/react.ts", import.meta.url).pathname,
    },
  },
});
