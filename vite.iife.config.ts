import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/cdn.ts"),
      name: "ArkWaifu",
      formats: ["iife"],
      fileName: () => "ark-waifu.iife.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
