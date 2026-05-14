export { ArkWaifuWidget } from "./core/Widget";
export { validateManifest, ManifestError } from "./core/loader";
export type {
  ActionPanelOptions,
  ActionScheduleItem,
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
import type {
  ActionPanelOptions,
  ModelFiles,
  ModelManifest,
  MountedArkWaifu,
  MountArkWaifuOptions
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

  if (!options.manifestUrl) {
    throw new Error("mountArkWaifu requires options.manifest or options.manifestUrl.");
  }

  return loadManifest(options.manifestUrl);
}

function resolveAssetUrl(assetUrl: string, baseUrl: string): string {
  const encodedAssetUrl = assetUrl.replace(/#/g, "%23").replace(/ /g, "%20");
  return new URL(encodedAssetUrl, baseUrl).href;
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
