import {
  ArkWaifuWidget,
  loadManifest,
  mountArkWaifu,
  resolveManifestAssetUrls
} from "./index";
import type { MountArkWaifuOptions } from "./core/types";

declare global {
  interface Window {
    ArkWaifu?: {
      ArkWaifuWidget: typeof ArkWaifuWidget;
      loadManifest: typeof loadManifest;
      mountArkWaifu: typeof mountArkWaifu;
      resolveManifestAssetUrls: typeof resolveManifestAssetUrls;
    };
  }
}

window.ArkWaifu = {
  ArkWaifuWidget,
  loadManifest,
  mountArkWaifu,
  resolveManifestAssetUrls
};

const currentScript = document.currentScript as HTMLScriptElement | null;

if (currentScript?.dataset.auto !== "false") {
  const autoMount = (): void => {
    const manifestUrl = currentScript?.dataset.manifest ?? getDefaultManifestUrl(currentScript);
    const options: MountArkWaifuOptions = {
      manifestUrl,
      width: readNumberDataset(currentScript, "width"),
      height: readNumberDataset(currentScript, "height"),
      zIndex: readNumberDataset(currentScript, "zIndex")
    };

    const { ready } = mountArkWaifu(options);
    ready.catch((error: unknown) => {
      console.error("[Ark-waifu] Auto mount failed", error);
    });
  };

  if (document.body) {
    autoMount();
  } else {
    window.addEventListener("DOMContentLoaded", autoMount, { once: true });
  }
}

function getDefaultManifestUrl(script: HTMLScriptElement | null): string {
  if (script?.src) {
    return new URL("./models/sample/manifest.json", script.src).href;
  }

  return new URL("/models/sample/manifest.json", window.location.href).href;
}

function readNumberDataset(script: HTMLScriptElement | null, key: string): number | undefined {
  const value = script?.dataset[key];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
