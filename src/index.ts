export { ArkWaifuWidget } from "./core/Widget";
export { validateManifest, ManifestError } from "./core/loader";
export type {
  CharacterAdapter,
  ModelFiles,
  ModelManifest,
  ModelPosition,
  ModelType,
  MountedArkWaifu,
  MountArkWaifuOptions,
  WidgetOptions
} from "./core/types";

import { ArkWaifuWidget } from "./core/Widget";
import type { ModelFiles, ModelManifest, MountedArkWaifu, MountArkWaifuOptions } from "./core/types";

export async function loadManifest(manifestUrl: string): Promise<ModelManifest> {
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(`Failed to load manifest "${manifestUrl}": ${response.status} ${response.statusText}`);
  }

  const manifest = (await response.json()) as ModelManifest;
  return resolveManifestAssetUrls(manifest, manifestUrl);
}

export function mountArkWaifu(options: MountArkWaifuOptions = {}): MountedArkWaifu {
  const widget = new ArkWaifuWidget(options);
  const ready = resolveMountManifest(options).then((manifest) => widget.load(manifest));

  return { widget, ready };
}

export function resolveManifestAssetUrls(manifest: ModelManifest, manifestUrl: string): ModelManifest {
  const baseUrl = new URL(manifestUrl, globalThis.location?.href).href;
  const files: ModelFiles = {
    ...manifest.files,
    skel: manifest.files.skel ? resolveAssetUrl(manifest.files.skel, baseUrl) : undefined,
    json: manifest.files.json ? resolveAssetUrl(manifest.files.json, baseUrl) : undefined,
    atlas: resolveAssetUrl(manifest.files.atlas, baseUrl),
    textures: manifest.files.textures.map((textureUrl) => resolveAssetUrl(textureUrl, baseUrl))
  };

  return { ...manifest, files };
}

async function resolveMountManifest(options: MountArkWaifuOptions): Promise<ModelManifest> {
  if (options.manifest) {
    return options.manifest;
  }

  if (!options.manifestUrl) {
    throw new Error("mountArkWaifu requires options.manifest or options.manifestUrl.");
  }

  return loadManifest(options.manifestUrl);
}

function resolveAssetUrl(assetUrl: string, baseUrl: string): string {
  const encodedAssetUrl = assetUrl.replace(/#/g, "%23").replace(/ /g, "%20");
  return new URL(encodedAssetUrl, baseUrl).href;
}
