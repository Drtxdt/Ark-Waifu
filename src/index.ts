export { ArkWaifuWidget } from "./core/Widget";
export { validateManifest, ManifestError } from "./core/loader";
export {
  ARK_MODELS_CDN_SOURCES,
  DEFAULT_ARK_MODELS_CDN_ID,
  getArkModelsCdnSource,
  getDefaultArkModelsCdnSource
} from "./registry/cdn-sources";
export type {
  ActionPanelOptions,
  ActionScheduleItem,
  AssetCdnSource,
  CharacterAdapter,
  DialogueEvent,
  DialogueManifest,
  InteractionOptions,
  ModelFiles,
  ModelManifest,
  ModelPosition,
  ModelRegistry,
  ModelType,
  MountedArkWaifu,
  MountArkWaifuOptions,
  PlayOptions,
  ScannedModelManifest,
  SitOptions,
  WidgetOptions
} from "./core/types";

import { ArkWaifuWidget } from "./core/Widget";
import type {
  ActionPanelOptions,
  ModelFiles,
  ModelManifest,
  ModelRegistry,
  MountedArkWaifu,
  MountArkWaifuOptions,
  ScannedModelManifest
} from "./core/types";

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
  const destroyWidget = widget.destroy.bind(widget);
  const mounted: MountedArkWaifu = {
    widget,
    ready: Promise.resolve()
  };

  widget.destroy = (): void => {
    mounted.actionPanel?.remove();
    destroyWidget();
  };

  mounted.ready = resolveMountManifest(options).then(async (manifest) => {
    await widget.load(manifest);

    if (options.actionPanel) {
      mounted.actionPanel = createActionPanel(widget, manifest, options.actionPanel);
    }
  });

  return mounted;
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

  if (options.registryUrl) {
    return loadRegistryManifest(options.registryUrl, options.modelId, options.assetBaseUrl);
  }

  if (!options.manifestUrl) {
    throw new Error(
      "mountArkWaifu requires options.manifest, options.manifestUrl, or options.registryUrl."
    );
  }

  return loadManifest(options.manifestUrl);
}

export async function loadRegistryManifest(
  registryUrl: string,
  modelId?: string,
  assetBaseUrl?: string
): Promise<ModelManifest> {
  const response = await fetch(registryUrl);

  if (!response.ok) {
    throw new Error(`Failed to load registry "${registryUrl}": ${response.status} ${response.statusText}`);
  }

  const registry = (await response.json()) as ModelRegistry;
  const model = modelId
    ? registry.operators.find((operator) => operator.id === modelId)
    : registry.operators[0];

  if (!model) {
    throw new Error(
      modelId
        ? `Model "${modelId}" was not found in registry "${registryUrl}".`
        : `Registry "${registryUrl}" does not contain any model.`
    );
  }

  return assetBaseUrl ? rewriteScannedManifestAssetBase(model, assetBaseUrl) : model;
}

export function rewriteScannedManifestAssetBase(
  manifest: ScannedModelManifest,
  assetBaseUrl: string
): ModelManifest {
  const skeletonPath = manifest.sourceFiles.skeleton;
  const files: ModelFiles = {
    skel: manifest.files.skel ? joinAssetBase(assetBaseUrl, skeletonPath) : undefined,
    json: manifest.files.json ? joinAssetBase(assetBaseUrl, skeletonPath) : undefined,
    atlas: joinAssetBase(assetBaseUrl, manifest.sourceFiles.atlas),
    textures: manifest.sourceFiles.textures.map((texture) => joinAssetBase(assetBaseUrl, texture))
  };

  return {
    id: manifest.id,
    name: manifest.name,
    type: manifest.type,
    version: manifest.version,
    files,
    actions: manifest.actions,
    scale: manifest.scale,
    position: manifest.position
  };
}

function resolveAssetUrl(assetUrl: string, baseUrl: string): string {
  const encodedAssetUrl = assetUrl.replace(/#/g, "%23").replace(/ /g, "%20");
  return new URL(encodedAssetUrl, baseUrl).href;
}

function joinAssetBase(assetBaseUrl: string, relativePath: string): string {
  const baseUrl = assetBaseUrl.endsWith("/") ? assetBaseUrl : `${assetBaseUrl}/`;
  const encodedPath = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join("/");

  return new URL(encodedPath, baseUrl).href;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createActionPanel(
  widget: ArkWaifuWidget,
  manifest: ModelManifest,
  options: true | ActionPanelOptions
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = [
    "ark-waifu-action-panel",
    typeof options === "object" ? options.className : undefined
  ]
    .filter(Boolean)
    .join(" ");

  Object.assign(panel.style, {
    position: "fixed",
    right: "24px",
    bottom: "452px",
    zIndex: "10000",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    maxWidth: "320px",
    pointerEvents: "auto"
  });

  Object.keys(manifest.actions).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action;
    button.dataset.action = action;
    Object.assign(button.style, {
      border: "1px solid #cad3df",
      borderRadius: "8px",
      padding: "8px 12px",
      color: "#20242a",
      background: "#ffffff",
      font: "12px system-ui, sans-serif",
      cursor: "pointer"
    });
    button.addEventListener("click", () => {
      widget.play(action);
    });
    panel.appendChild(button);
  });

  const container = typeof options === "object" ? options.container : undefined;
  (container ?? document.body).appendChild(panel);

  return panel;
}
