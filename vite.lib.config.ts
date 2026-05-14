import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "ark-waifu.es.js"
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
