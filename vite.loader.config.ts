import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/loader.ts"),
      name: "ArkWaifuLoader",
      formats: ["iife"],
      fileName: () => "ark-waifu.loader.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
