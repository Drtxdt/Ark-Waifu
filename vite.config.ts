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
      const srcModelsRoot = path.resolve(process.cwd(), "src", "models");
      const publicModelsRoot = path.resolve(process.cwd(), "public", "models");
      const arkModelsRoot = path.resolve(process.cwd(), "Ark-Models");

      server.middlewares.use((request, response, next) => {
        if (!request.url) {
          next();
          return;
        }

        const requestPath = decodeURIComponent(
          new URL(request.url, "http://localhost").pathname
        );

        const modelRoute = getModelRoute(requestPath);
        if (!modelRoute) {
          next();
          return;
        }

        const modelsRoot =
          modelRoute.kind === "src"
            ? srcModelsRoot
            : modelRoute.kind === "ark"
              ? arkModelsRoot
              : publicModelsRoot;
        const filePath = path.resolve(modelsRoot, modelRoute.relativePath);

        if (!isInsideDirectory(filePath, modelsRoot)) {
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

function getModelRoute(
  requestPath: string
): { kind: "src" | "public" | "ark"; relativePath: string } | null {
  if (requestPath.startsWith("/src/models/")) {
    return {
      kind: "src",
      relativePath: requestPath.slice("/src/models/".length)
    };
  }

  if (requestPath.startsWith("/Ark-Models/")) {
    return {
      kind: "ark",
      relativePath: requestPath.slice("/Ark-Models/".length)
    };
  }

  if (requestPath.startsWith("/models/")) {
    return {
      kind: "public",
      relativePath: requestPath.slice("/models/".length)
    };
  }

  return null;
}

function isInsideDirectory(filePath: string, directory: string): boolean {
  const relativePath = path.relative(directory, filePath);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
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
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
