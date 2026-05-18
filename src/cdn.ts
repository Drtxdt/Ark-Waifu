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
  ModelRegistryIndex,
  ModelRegistryIndexEntry,
  MountArkWaifuOptions,
  ScannedModelManifest
} from "./core/types";

type RegistryModelEntry = ScannedModelManifest | ModelRegistryIndexEntry;

type RegistryControllerState = {
  widget: ArkWaifuWidget;
  registry?: ModelRegistry;
  registryIndex?: ModelRegistryIndex;
  registryUrl: string;
  registryBaseUrl: string;
  assetBaseUrl?: string;
  selected: RegistryModelEntry;
  matches: RegistryModelEntry[];
  panel?: HTMLElement;
  toggle: HTMLElement;
  searchInput?: HTMLInputElement;
  datalist?: HTMLDataListElement;
  actions?: HTMLElement;
  status?: HTMLElement;
  panelLoaded: boolean;
};

const DEFAULT_MODEL_ID = "models-4134-cetsyr-epoque-50-build-char-4134-cetsyr-epoque-50";

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
    const registryBaseUrl = resolveRegistryBaseUrl(currentScript);

    if (shouldUseRegistryMount(currentScript, registryUrl)) {
      autoMountRegistryModel(currentScript, registryUrl ?? getDefaultRegistryUrl(currentScript), registryBaseUrl).catch((error: unknown) => {
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
      modelId: currentScript?.dataset.model ?? DEFAULT_MODEL_ID,
      assetBaseUrl: currentScript?.dataset.assetBaseUrl ?? selectedCdn?.baseUrl,
      width: readNumberDataset(currentScript, "width"),
      height: readNumberDataset(currentScript, "height"),
      zIndex: readNumberDataset(currentScript, "zIndex"),
      draggable: readBooleanDataset(currentScript, "draggable", true),
      hitTest: readBooleanDataset(currentScript, "hitTest", true),
      clickAction: readStringOrFalseDataset(currentScript, "clickAction", "touch"),
      actionSchedule: readJsonDataset(currentScript, "actionSchedule"),
      defaultAction: currentScript?.dataset.defaultAction ?? "auto",
      sitTargets: readSelectorListDataset(currentScript, "sitTargets"),
      sitOptions: readJsonDataset(currentScript, "sitOptions"),
      dialogueUrl: currentScript?.dataset.dialogueUrl
        ? resolveDatasetUrl(currentScript.dataset.dialogueUrl, currentScript.dataset.dialogueUrl, currentScript)
        : undefined,
      tipsUrl: currentScript?.dataset.tipsUrl
        ? resolveDatasetUrl(currentScript.dataset.tipsUrl, currentScript.dataset.tipsUrl, currentScript)
        : undefined,
      bubbleDurationMs: readNumberDataset(currentScript, "bubbleDurationMs"),
      maxDpr: readNumberDataset(currentScript, "maxDpr"),
      fpsLimit: readNumberDataset(currentScript, "fpsLimit"),
      pauseWhenHidden: readBooleanDataset(currentScript, "pauseWhenHidden", true),
      pauseWhenOffscreen: readBooleanDataset(currentScript, "pauseWhenOffscreen", true),
      actionPanel: readBooleanDataset(currentScript, "actionPanel", false)
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

function shouldUseRegistryMount(
  script: HTMLScriptElement | null,
  registryUrl: string | undefined
): boolean {
  return Boolean(
    registryUrl ??
      script?.dataset.registryBase ??
      script?.dataset.model
  );
}

async function autoMountRegistryModel(
  script: HTMLScriptElement | null,
  registryUrl: string,
  registryBaseUrl: string
): Promise<void> {
  const assetBaseUrl = readAssetBaseUrl(script);
  const modelId = script?.dataset.model ?? DEFAULT_MODEL_ID;
  const initialModel = await loadInitialRegistryModel(script, registryUrl, registryBaseUrl, modelId);

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
    actionSchedule: readJsonDataset(script, "actionSchedule"),
    defaultAction: script?.dataset.defaultAction ?? "auto",
    sitTargets: readSelectorListDataset(script, "sitTargets"),
    sitOptions: readJsonDataset(script, "sitOptions"),
    dialogueUrl: script?.dataset.dialogueUrl
      ? resolveDatasetUrl(script.dataset.dialogueUrl, script.dataset.dialogueUrl, script)
      : undefined,
    tipsUrl: script?.dataset.tipsUrl
      ? resolveDatasetUrl(script.dataset.tipsUrl, script.dataset.tipsUrl, script)
      : undefined,
    bubbleDurationMs: readNumberDataset(script, "bubbleDurationMs"),
    maxDpr: readNumberDataset(script, "maxDpr"),
    fpsLimit: readNumberDataset(script, "fpsLimit"),
    pauseWhenHidden: readBooleanDataset(script, "pauseWhenHidden", true),
    pauseWhenOffscreen: readBooleanDataset(script, "pauseWhenOffscreen", true)
  });
  const toggle = createRegistryToggle();
  const state: RegistryControllerState = {
    widget,
    registry: undefined,
    registryIndex: undefined,
    registryUrl,
    registryBaseUrl,
    assetBaseUrl,
    selected: initialModel,
    matches: [initialModel],
    toggle,
    panelLoaded: false
  };

  toggle.addEventListener("click", () => {
    void openRegistryPanel(state);
  });

  await loadControllerModel(state, initialModel);

  if (readBooleanDataset(script, "modelSelectorOpen", false)) {
    await openRegistryPanel(state);
  }
}

async function loadControllerModel(
  state: RegistryControllerState,
  model: RegistryModelEntry
): Promise<void> {
  state.selected = model;
  if (state.searchInput) {
    state.searchInput.value = createModelInputValue(model);
  }
  if (state.status) {
    state.status.textContent = `Loading ${model.name}...`;
  }
  if (state.actions) {
    state.actions.innerHTML = "";
  }

  try {
    const manifest = await resolveControllerManifest(model, state.assetBaseUrl, state.registryBaseUrl);
    await state.widget.load(manifest);
    if (state.actions) {
      renderActionButtons(state, manifest);
    }
    if (state.status) {
      state.status.textContent = model.name;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (state.status) {
      state.status.textContent = `Failed to load ${model.name}: ${message}`;
    }
    console.error("[Ark-waifu] Failed to load model", error);
  }
}

function renderModelSuggestions(state: RegistryControllerState, term: string): void {
  const query = term.trim().toLowerCase();
  const models = getRegistryEntries(state);
  if (!state.datalist || !state.status) {
    return;
  }

  state.matches = query
    ? models.filter((model) =>
        (model.searchText ?? createSearchText(model)).includes(query)
      )
    : models;

  state.datalist.innerHTML = "";

  state.matches.slice(0, 80).forEach((model) => {
    const option = document.createElement("option");
    option.value = createModelInputValue(model);
    option.label = model.id;
    state.datalist?.appendChild(option);
  });

  state.status.textContent =
    state.matches.length > 0
      ? `${state.matches.length} model(s). Select a suggestion or press Enter.`
      : "No matching model.";
}

function renderActionButtons(state: RegistryControllerState, manifest: ModelManifest): void {
  const actions = state.actions;
  if (!actions) {
    return;
  }

  actions.innerHTML = "";

  Object.keys(manifest.actions).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action;
    Object.assign(button.style, actionButtonStyle());
    button.addEventListener("click", () => {
      state.widget.play(action);
    });
    actions.appendChild(button);
  });
}

async function openRegistryPanel(state: RegistryControllerState): Promise<void> {
  if (!state.registry) {
    state.toggle.textContent = "Loading...";
    await loadPanelRegistry(state);
  }

  if (!state.panelLoaded) {
    const panel = createRegistryPanel();
    state.panel = panel;
    state.searchInput = panel.querySelector<HTMLInputElement>("[data-ark-waifu-search]")!;
    state.datalist = panel.querySelector<HTMLDataListElement>("[data-ark-waifu-list]")!;
    state.actions = panel.querySelector<HTMLElement>("[data-ark-waifu-actions]")!;
    state.status = panel.querySelector<HTMLElement>("[data-ark-waifu-status]")!;
    state.panelLoaded = true;

    state.searchInput.addEventListener("input", () => {
      renderModelSuggestions(state, state.searchInput?.value ?? "");
    });
    state.searchInput.addEventListener("change", () => {
      const model = findSearchModel(state, state.searchInput?.value ?? "");

      if (model) {
        void loadControllerModel(state, model);
      }
    });
    state.searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      const model = findSearchModel(state, state.searchInput?.value ?? "") ?? state.matches[0];

      if (model) {
        void loadControllerModel(state, model);
      }
    });
  }

  if (state.panel) {
    state.panel.hidden = !state.panel.hidden;
    state.toggle.textContent = state.panel.hidden ? "Models" : "Close";
  }

  if (!state.panel?.hidden) {
    renderModelSuggestions(state, "");
    await loadControllerModel(state, state.selected);
  }
}

function createRegistryToggle(): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ark-waifu-registry-toggle";
  button.textContent = "Models";
  Object.assign(button.style, {
    position: "fixed",
    right: "24px",
    bottom: "452px",
    zIndex: "10001",
    border: "1px solid rgba(120, 134, 155, 0.42)",
    borderRadius: "8px",
    padding: "8px 10px",
    color: "#20242a",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 8px 22px rgba(19, 35, 52, 0.14)",
    font: "12px system-ui, sans-serif",
    cursor: "pointer",
    pointerEvents: "auto"
  });
  document.body.appendChild(button);
  return button;
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
    <input data-ark-waifu-search type="search" list="ark-waifu-model-list" placeholder="Search model..." />
    <datalist id="ark-waifu-model-list" data-ark-waifu-list></datalist>
    <div data-ark-waifu-actions></div>
    <div data-ark-waifu-status></div>
  `;

  const input = panel.querySelector<HTMLInputElement>("[data-ark-waifu-search]");
  const actions = panel.querySelector<HTMLElement>("[data-ark-waifu-actions]");
  const status = panel.querySelector<HTMLElement>("[data-ark-waifu-status]");

  if (input) {
    Object.assign(input.style, {
      width: "100%",
      border: "1px solid #cad3df",
      borderRadius: "8px",
      padding: "8px 10px",
      color: "#20242a",
      background: "#ffffff",
      font: "12px system-ui, sans-serif"
    });
  }

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

async function resolveControllerManifest(
  model: RegistryModelEntry,
  assetBaseUrl: string | undefined,
  registryBaseUrl: string
): Promise<ModelManifest> {
  if (isScannedModelManifest(model)) {
    return assetBaseUrl ? rewriteScannedManifestAssetBase(model, assetBaseUrl) : model;
  }

  const manifest = await loadRegistryModelManifest(registryBaseUrl, model.id);
  return assetBaseUrl ? rewriteScannedManifestAssetBase(manifest, assetBaseUrl) : manifest;
}

async function loadRegistry(registryUrl: string): Promise<ModelRegistry> {
  const response = await fetch(registryUrl);

  if (!response.ok) {
    throw new Error(`Failed to load registry "${registryUrl}": ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ModelRegistry;
}

async function loadRegistryIndex(indexUrl: string): Promise<ModelRegistryIndex> {
  const response = await fetch(indexUrl);

  if (!response.ok) {
    throw new Error(`Failed to load registry index "${indexUrl}": ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ModelRegistryIndex;
}

async function loadInitialRegistryModel(
  script: HTMLScriptElement | null,
  registryUrl: string,
  registryBaseUrl: string,
  modelId: string
): Promise<ScannedModelManifest> {
  if (script?.dataset.modelManifestUrl) {
    return loadManifest(
      resolveDatasetUrl(script.dataset.modelManifestUrl, script.dataset.modelManifestUrl, script)
    ) as Promise<ScannedModelManifest>;
  }

  try {
    return await loadRegistryModelManifest(registryBaseUrl, modelId);
  } catch (modelError) {
    if (modelId === DEFAULT_MODEL_ID) {
      try {
        return (await loadManifest(resolveAgainstRegistryBase(registryBaseUrl, "default-model.json"))) as ScannedModelManifest;
      } catch {
        // Fall through to full registry fallback below.
      }
    }

    try {
      const registry = await loadRegistry(registryUrl);
      const model = findModel(registry, modelId) ?? registry.operators[0];
      if (model) {
        return model;
      }
    } catch {
      // Preserve the split-registry error for clearer root cause.
    }

    throw modelError;
  }
}

async function loadPanelRegistry(state: RegistryControllerState): Promise<void> {
  try {
    state.registryIndex = await loadRegistryIndex(resolveAgainstRegistryBase(state.registryBaseUrl, "index.json"));
    state.matches = state.registryIndex.models;
    return;
  } catch (error) {
    console.warn("[Ark-waifu] Failed to load split registry index; falling back to full registry.", error);
  }

  state.registry = await loadRegistry(state.registryUrl);
  state.matches = state.registry.operators;
}

async function loadRegistryModelManifest(
  registryBaseUrl: string,
  modelId: string
): Promise<ScannedModelManifest> {
  return (await loadManifest(resolveAgainstRegistryBase(registryBaseUrl, `models/${modelId}.json`))) as ScannedModelManifest;
}

function isScannedModelManifest(model: RegistryModelEntry): model is ScannedModelManifest {
  return "sourceFiles" in model;
}

function findModel(
  registry: ModelRegistry,
  modelId: string | undefined
): ScannedModelManifest | undefined {
  return modelId ? registry.operators.find((model) => model.id === modelId) : undefined;
}

function findSearchModel(
  state: RegistryControllerState,
  value: string
): RegistryModelEntry | undefined {
  const query = value.trim().toLowerCase();

  if (!query) {
    return undefined;
  }

  return (
    getRegistryEntries(state).find(
      (model) =>
        model.id.toLowerCase() === query ||
        createModelInputValue(model).toLowerCase() === query
    ) ??
    findUniqueNameMatch(state, query) ??
    state.matches.find((model) => (model.searchText ?? createSearchText(model)).includes(query))
  );
}

function findUniqueNameMatch(
  state: RegistryControllerState,
  query: string
): RegistryModelEntry | undefined {
  const matches = getRegistryEntries(state).filter((model) => model.name.toLowerCase() === query);
  return matches.length === 1 ? matches[0] : undefined;
}

function createModelInputValue(model: RegistryModelEntry): string {
  return `${model.name} | ${model.relativeDir} | ${model.id}`;
}

function createSearchText(model: RegistryModelEntry): string {
  return [
    model.name,
    model.id,
    model.relativeDir,
    model.category,
    "actions" in model ? Object.keys(model.actions).join(" ") : undefined,
    "actions" in model ? Object.values(model.actions).join(" ") : undefined
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getRegistryEntries(state: RegistryControllerState): RegistryModelEntry[] {
  return state.registryIndex?.models ?? state.registry?.operators ?? state.matches;
}

function resolveRegistryUrl(script: HTMLScriptElement | null): string | undefined {
  return script?.dataset.registry
    ? resolveDatasetUrl(script.dataset.registry, getDefaultRegistryUrl(script), script)
    : undefined;
}

function resolveRegistryBaseUrl(script: HTMLScriptElement | null): string {
  return resolveDatasetUrl(script?.dataset.registryBase, getDefaultRegistryBaseUrl(script), script);
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

function getDefaultRegistryBaseUrl(script: HTMLScriptElement | null): string {
  return new URL("./registry/", getScriptDirectoryUrl(script)).href;
}

function resolveAgainstRegistryBase(registryBaseUrl: string, relativePath: string): string {
  const baseUrl = registryBaseUrl.endsWith("/") ? registryBaseUrl : `${registryBaseUrl}/`;
  return new URL(relativePath, baseUrl).href;
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

function readSelectorListDataset(
  script: HTMLScriptElement | null,
  key: string
): string[] | undefined {
  const value = script?.dataset[key];

  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
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
