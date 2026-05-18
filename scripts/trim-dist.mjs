import { rmSync } from "node:fs";
import path from "node:path";

const distRoot = path.resolve("dist");

for (const target of [
  path.join(distRoot, "registry", "operators.json"),
  path.join(distRoot, "models")
]) {
  rmSync(target, { force: true, recursive: true });
}
