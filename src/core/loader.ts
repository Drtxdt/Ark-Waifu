import type { ModelManifest } from "./types";

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

export function validateManifest(manifest: ModelManifest): ModelManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new ManifestError("Model manifest is missing or invalid.");
  }

  if (!manifest.id) {
    throw new ManifestError("Model manifest must include an id.");
  }

  if (!manifest.name) {
    throw new ManifestError(`Model manifest "${manifest.id}" must include a name.`);
  }

  if (manifest.type !== "ark-spine") {
    throw new ManifestError(
      `Unsupported model type "${manifest.type}". Current MVP supports only "ark-spine".`
    );
  }

  if (!manifest.files?.skel && !manifest.files?.json) {
    throw new ManifestError(
      `Model manifest "${manifest.id}" must include files.skel or files.json.`
    );
  }

  if (!manifest.files.atlas) {
    throw new ManifestError(`Model manifest "${manifest.id}" must include files.atlas.`);
  }

  if (!Array.isArray(manifest.files.textures) || manifest.files.textures.length === 0) {
    throw new ManifestError(`Model manifest "${manifest.id}" must include files.textures.`);
  }

  if (!manifest.actions || Object.keys(manifest.actions).length === 0) {
    throw new ManifestError(`Model manifest "${manifest.id}" must define at least one action.`);
  }

  return manifest;
}
