import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

export default defineConfig({
  assetsInclude: ["**/*.atlas", "**/*.skel"],
  plugins: [localModelDevServer()],
  server: {
    open: false
  }
});

function localModelDevServer(): Plugin {
  return {
    name: "ark-waifu-local-model-dev-server",
    apply: "serve",
    configureServer(server) {
      const modelsRoot = path.resolve(process.cwd(), "src", "models");

      server.middlewares.use((request, response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const requestPath = decodeURIComponent(
          new URL(request.url, "http://localhost").pathname
        );

        if (!requestPath.startsWith("/src/models/")) {
          next();
          return;
        }

        const relativePath = requestPath.slice("/src/models/".length);
        const filePath = path.resolve(modelsRoot, relativePath);

        if (!filePath.startsWith(`${modelsRoot}${path.sep}`)) {
          response.statusCode = 403;
          response.end("Forbidden model path.");
          return;
        }

        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          response.statusCode = 404;
          response.end("Model file not found.");
          return;
        }

        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Type", getContentType(filePath));

        if (request.method === "HEAD") {
          response.statusCode = 200;
          response.end();
          return;
        }

        createReadStream(filePath).pipe(response);
      });
    }
  };
}

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".atlas":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".skel":
      return "application/octet-stream";
    default:
      return "application/octet-stream";
  }
}
