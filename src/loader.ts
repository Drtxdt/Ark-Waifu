const DEFAULT_LOAD_STRATEGY = "idle";

const currentScript = document.currentScript as HTMLScriptElement | null;

if (currentScript?.dataset.auto !== "false") {
  void scheduleRuntimeLoad(currentScript);
}

async function scheduleRuntimeLoad(script: HTMLScriptElement | null): Promise<void> {
  if (shouldSkipForSaveData(script)) {
    console.info("[Ark-waifu] Skipped because Save-Data is enabled.");
    return;
  }

  if (!hasWebGL()) {
    console.warn("[Ark-waifu] Skipped because WebGL is not available.");
    return;
  }

  const delayMs = readNumberDataset(script, "loadDelayMs") ?? 0;
  const strategy = script?.dataset.loadStrategy ?? DEFAULT_LOAD_STRATEGY;

  if (delayMs > 0) {
    await delay(delayMs);
  }

  if (strategy === "immediate") {
    loadRuntime(script);
    return;
  }

  if (strategy === "after-load") {
    await waitForWindowLoad();
    loadRuntime(script);
    return;
  }

  await waitForWindowLoad();
  await waitForIdle();
  loadRuntime(script);
}

function loadRuntime(script: HTMLScriptElement | null): void {
  const runtimeScript = document.createElement("script");
  runtimeScript.src = script?.dataset.runtimeSrc
    ? new URL(script.dataset.runtimeSrc, getScriptDirectoryUrl(script)).href
    : new URL("./ark-waifu.iife.js", getScriptDirectoryUrl(script)).href;
  runtimeScript.async = true;

  if (script) {
    Array.from(script.attributes).forEach((attribute) => {
      if (attribute.name.startsWith("data-")) {
        runtimeScript.setAttribute(attribute.name, attribute.value);
      }
    });
  }

  runtimeScript.dataset.auto = "true";
  document.head.appendChild(runtimeScript);
}

function shouldSkipForSaveData(script: HTMLScriptElement | null): boolean {
  const disabled = script?.dataset.disableOnSaveData ?? "true";
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return disabled !== "false" && Boolean(connection?.saveData);
}

function hasWebGL(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(
    canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")
  );
}

function waitForWindowLoad(): Promise<void> {
  if (document.readyState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };

    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => resolve(), { timeout: 2500 });
      return;
    }

    window.setTimeout(resolve, 1);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getScriptDirectoryUrl(script: HTMLScriptElement | null): string {
  if (script?.src) {
    return new URL(".", script.src).href;
  }

  return window.location.href;
}

function readNumberDataset(script: HTMLScriptElement | null, key: string): number | undefined {
  const value = script?.dataset[key];
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
