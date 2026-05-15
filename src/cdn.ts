import {
  ArkWaifuWidget,
  ARK_MODELS_CDN_SOURCES,
  DEFAULT_ARK_MODELS_CDN_ID,
  getArkModelsCdnSource,
  getDefaultArkModelsCdnSource,
  loadManifest,
  loadRegistryManifest,
  mountArkWaifu,
  resolveManifestAssetUrls,
  rewriteScannedManifestAssetBase
} from "./index";
import type {
  ModelManifest,
  ModelRegistry,
  MountArkWaifuOptions,
  ScannedModelManifest
} from "./core/types";

type RegistryControllerState = {
  widget: ArkWaifuWidget;
  registry: ModelRegistry;
  assetBaseUrl?: string;
  selected: ScannedModelManifest;
  panel: HTMLElement;
  searchInput: HTMLInputElement;
  select: HTMLSelectElement;
  actions: HTMLElement;
  status: HTMLElement;
};

declare global {
  interface Window {
    ArkWaifu?: {
      ArkWaifuWidget: typeof ArkWaifuWidget;
      ARK_MODELS_CDN_SOURCES: typeof ARK_MODELS_CDN_SOURCES;
      DEFAULT_ARK_MODELS_CDN_ID: typeof DEFAULT_ARK_MODELS_CDN_ID;
      getArkModelsCdnSource: typeof getArkModelsCdnSource;
      getDefaultArkModelsCdnSource: typeof getDefaultArkModelsCdnSource;
      loadManifest: typeof loadManifest;
      loadRegistryManifest: typeof loadRegistryManifest;
      mountArkWaifu: typeof mountArkWaifu;
      resolveManifestAssetUrls: typeof resolveManifestAssetUrls;
      rewriteScannedManifestAssetBase: typeof rewriteScannedManifestAssetBase;
    };
  }
}

window.ArkWaifu = {
  ArkWaifuWidget,
  ARK_MODELS_CDN_SOURCES,
  DEFAULT_ARK_MODELS_CDN_ID,
  getArkModelsCdnSource,
  getDefaultArkModelsCdnSource,
  loadManifest,
  loadRegistryManifest,
  mountArkWaifu,
  resolveManifestAssetUrls,
  rewriteScannedManifestAssetBase
};

const currentScript = document.currentScript as HTMLScriptElement | null;

if (currentScript?.dataset.auto !== "false") {
  const autoMount = (): void => {
    const registryUrl = resolveRegistryUrl(currentScript);

    if (registryUrl && readBooleanDataset(currentScript, "modelSelector", true)) {
      autoMountRegistryController(currentScript, registryUrl).catch((error: unknown) => {
        console.error("[Ark-waifu] Auto mount failed", error);
      });
      return;
    }

    const selectedCdn = currentScript?.dataset.cdn
      ? getArkModelsCdnSource(currentScript.dataset.cdn)
      : undefined;
    const manifestUrl = registryUrl
      ? undefined
      : resolveDatasetUrl(
          currentScript?.dataset.manifest,
          getDefaultManifestUrl(currentScript),
          currentScript
        );
    const options: MountArkWaifuOptions = {
      manifestUrl,
      registryUrl,
      modelId: currentScript?.dataset.model,
      assetBaseUrl: currentScript?.dataset.assetBaseUrl ?? selectedCdn?.baseUrl,
      width: readNumberDataset(currentScript, "width"),
      height: readNumberDataset(currentScript, "height"),
      zIndex: readNumberDataset(currentScript, "zIndex"),
      draggable: readBooleanDataset(currentScript, "draggable", true),
      hitTest: readBooleanDataset(currentScript, "hitTest", true),
      clickAction: readStringOrFalseDataset(currentScript, "clickAction", "touch"),
      actionSchedule: readJsonDataset(currentScript, "actionSchedule"),
      actionPanel: readBooleanDataset(currentScript, "actionPanel", Boolean(registryUrl))
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

async function autoMountRegistryController(
  script: HTMLScriptElement | null,
  registryUrl: string
): Promise<void> {
  const registry = await loadRegistry(registryUrl);
  const assetBaseUrl = readAssetBaseUrl(script);
  const initialModel =
    findModel(registry, script?.dataset.model) ?? registry.operators[0];

  if (!initialModel) {
    throw new Error(`Registry "${registryUrl}" does not contain any model.`);
  }

  const widget = new ArkWaifuWidget({
    width: readNumberDataset(script, "width"),
    height: readNumberDataset(script, "height"),
    zIndex: readNumberDataset(script, "zIndex"),
    draggable: readBooleanDataset(script, "draggable", true),
    hitTest: readBooleanDataset(script, "hitTest", true),
    clickAction: readStringOrFalseDataset(script, "clickAction", "touch"),
    actionSchedule: readJsonDataset(script, "actionSchedule")
  });
  const panel = createRegistryPanel();
  const state: RegistryControllerState = {
    widget,
    registry,
    assetBaseUrl,
    selected: initialModel,
    panel,
    searchInput: panel.querySelector<HTMLInputElement>("[data-ark-waifu-search]")!,
    select: panel.querySelector<HTMLSelectElement>("[data-ark-waifu-select]")!,
    actions: panel.querySelector<HTMLElement>("[data-ark-waifu-actions]")!,
    status: panel.querySelector<HTMLElement>("[data-ark-waifu-status]")!
  };

  state.searchInput.addEventListener("input", () => {
    renderModelOptions(state, state.searchInput.value);
  });
  state.select.addEventListener("change", () => {
    const model = findModel(registry, state.select.value);

    if (model) {
      void loadControllerModel(state, model);
    }
  });

  renderModelOptions(state, "");
  await loadControllerModel(state, initialModel);
}

async function loadControllerModel(
  state: RegistryControllerState,
  model: ScannedModelManifest
): Promise<void> {
  state.selected = model;
  state.select.value = model.id;
  state.status.textContent = `Loading ${model.name}...`;
  state.actions.innerHTML = "";

  try {
    const manifest = resolveControllerManifest(model, state.assetBaseUrl);
    await state.widget.load(manifest);
    renderActionButtons(state, manifest);
    state.status.textContent = model.name;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.status.textContent = `Failed to load ${model.name}: ${message}`;
    console.error("[Ark-waifu] Failed to load model", error);
  }
}

function renderModelOptions(state: RegistryControllerState, term: string): void {
  const query = term.trim().toLowerCase();
  const matchedModels = query
    ? state.registry.operators.filter((model) =>
        (model.searchText ?? createSearchText(model)).includes(query)
      )
    : state.registry.operators;

  state.select.innerHTML = "";

  matchedModels.slice(0, 300).forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    option.selected = model.id === state.selected.id;
    state.select.appendChild(option);
  });

  if (!matchedModels.some((model) => model.id === state.selected.id)) {
    const option = document.createElement("option");
    option.value = state.selected.id;
    option.textContent = state.selected.name;
    option.selected = true;
    state.select.insertBefore(option, state.select.firstChild);
  }
}

function renderActionButtons(state: RegistryControllerState, manifest: ModelManifest): void {
  state.actions.innerHTML = "";

  Object.keys(manifest.actions).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action;
    Object.assign(button.style, actionButtonStyle());
    button.addEventListener("click", () => {
      state.widget.play(action);
    });
    state.actions.appendChild(button);
  });
}

function createRegistryPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "ark-waifu-registry-panel";
  Object.assign(panel.style, {
    position: "fixed",
    right: "24px",
    bottom: "452px",
    zIndex: "10001",
    display: "grid",
    gap: "8px",
    width: "min(360px, calc(100vw - 32px))",
    border: "1px solid rgba(120, 134, 155, 0.35)",
    borderRadius: "8px",
    padding: "10px",
    color: "#20242a",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 12px 32px rgba(19, 35, 52, 0.16)",
    font: "12px system-ui, sans-serif",
    pointerEvents: "auto"
  });

  panel.innerHTML = `
    <input data-ark-waifu-search type="search" placeholder="Search model..." />
    <select data-ark-waifu-select></select>
    <div data-ark-waifu-actions></div>
    <div data-ark-waifu-status></div>
  `;

  const input = panel.querySelector<HTMLInputElement>("[data-ark-waifu-search]");
  const select = panel.querySelector<HTMLSelectElement>("[data-ark-waifu-select]");
  const actions = panel.querySelector<HTMLElement>("[data-ark-waifu-actions]");
  const status = panel.querySelector<HTMLElement>("[data-ark-waifu-status]");

  [input, select].forEach((element) => {
    if (element) {
      Object.assign(element.style, {
        width: "100%",
        border: "1px solid #cad3df",
        borderRadius: "8px",
        padding: "8px 10px",
        color: "#20242a",
        background: "#ffffff",
        font: "12px system-ui, sans-serif"
      });
    }
  });

  if (actions) {
    Object.assign(actions.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px"
    });
  }

  if (status) {
    Object.assign(status.style, {
      color: "#4f5d6d",
      lineHeight: "1.4",
      wordBreak: "break-word"
    });
  }

  document.body.appendChild(panel);
  return panel;
}

function actionButtonStyle(): Partial<CSSStyleDeclaration> {
  return {
    border: "1px solid #cad3df",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#20242a",
    background: "#ffffff",
    font: "12px system-ui, sans-serif",
    cursor: "pointer"
  };
}

function resolveControllerManifest(
  model: ScannedModelManifest,
  assetBaseUrl: string | undefined
): ModelManifest {
  return assetBaseUrl ? rewriteScannedManifestAssetBase(model, assetBaseUrl) : model;
}

async function loadRegistry(registryUrl: string): Promise<ModelRegistry> {
  const response = await fetch(registryUrl);

  if (!response.ok) {
    throw new Error(`Failed to load registry "${registryUrl}": ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ModelRegistry;
}

function findModel(
  registry: ModelRegistry,
  modelId: string | undefined
): ScannedModelManifest | undefined {
  return modelId ? registry.operators.find((model) => model.id === modelId) : undefined;
}

function createSearchText(model: ScannedModelManifest): string {
  return [
    model.name,
    model.id,
    model.relativeDir,
    model.category,
    Object.keys(model.actions).join(" "),
    Object.values(model.actions).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function resolveRegistryUrl(script: HTMLScriptElement | null): string | undefined {
  return script?.dataset.registry
    ? resolveDatasetUrl(script.dataset.registry, getDefaultRegistryUrl(script), script)
    : undefined;
}

function readAssetBaseUrl(script: HTMLScriptElement | null): string | undefined {
  if (script?.dataset.assetBaseUrl) {
    return script.dataset.assetBaseUrl;
  }

  if (script?.dataset.cdn) {
    return getArkModelsCdnSource(script.dataset.cdn)?.baseUrl;
  }

  return getDefaultArkModelsCdnSource().baseUrl;
}

function resolveDatasetUrl(
  value: string | undefined,
  fallback: string,
  script: HTMLScriptElement | null
): string {
  const rawValue = value ?? fallback;

  if (window.location.protocol === "file:" && rawValue.startsWith("/")) {
    return new URL(`.${rawValue}`, getScriptDirectoryUrl(script)).href;
  }

  return new URL(rawValue, window.location.href).href;
}

function getDefaultManifestUrl(script: HTMLScriptElement | null): string {
  return new URL("./models/sample/manifest.json", getScriptDirectoryUrl(script)).href;
}

function getDefaultRegistryUrl(script: HTMLScriptElement | null): string {
  return new URL("./registry/operators.json", getScriptDirectoryUrl(script)).href;
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

function readBooleanDataset(
  script: HTMLScriptElement | null,
  key: string,
  defaultValue: boolean
): boolean {
  const value = script?.dataset[key];
  if (value === undefined) {
    return defaultValue;
  }

  return value !== "false" && value !== "0";
}

function readStringOrFalseDataset(
  script: HTMLScriptElement | null,
  key: string,
  defaultValue: string | false
): string | false {
  const value = script?.dataset[key];
  if (value === undefined) {
    return defaultValue;
  }

  return value === "false" ? false : value;
}

function readJsonDataset<T>(script: HTMLScriptElement | null, key: string): T | undefined {
  const value = script?.dataset[key];
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`[Ark-waifu] Ignoring invalid data-${toKebabCase(key)} JSON.`, error);
    return undefined;
  }
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
