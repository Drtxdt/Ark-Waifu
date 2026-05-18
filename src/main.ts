import "./style.css";
import { ArkWaifuWidget } from "./core/Widget";
import { rewriteScannedManifestAssetBase } from "./index";
import {
  ARK_MODELS_CDN_SOURCES,
  getDefaultArkModelsCdnSource
} from "./registry/cdn-sources";
import sampleManifest from "./registry/sample-manifest.json";
import type {
  AssetCdnSource,
  ModelManifest,
  ModelRegistry,
  ScannedModelManifest
} from "./core/types";

type DemoState = {
  registry: ModelRegistry;
  filtered: ScannedModelManifest[];
  selected?: ScannedModelManifest;
  selectedCdn: AssetCdnSource;
  widget?: ArkWaifuWidget;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

const root = app;
const fallbackManifest = sampleManifest as ModelManifest;
const fallbackOperator: ScannedModelManifest = {
  ...fallbackManifest,
  relativeDir: "models/sample",
  sourceFiles: {
    skeleton: fallbackManifest.files.skel ?? fallbackManifest.files.json ?? "",
    atlas: fallbackManifest.files.atlas,
    textures: fallbackManifest.files.textures
  },
  displayName: fallbackManifest.name,
  searchText: `${fallbackManifest.name} ${fallbackManifest.id} ${Object.keys(fallbackManifest.actions).join(" ")}`
};

const state: DemoState = {
  registry: {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: "/models",
    operators: [fallbackOperator]
  },
  filtered: [fallbackOperator],
  selected: fallbackOperator,
  selectedCdn: getDefaultArkModelsCdnSource()
};

root.innerHTML = `
  <main class="demo-shell">
    <section class="demo-sidebar" aria-label="Operator registry">
      <header class="demo-header">
        <p class="demo-kicker">Ark-waifu MVP</p>
        <h1>Ark-Models registry preview</h1>
        <p class="demo-copy">
          Run <code>pnpm ark-waifu scan ./Ark-Models --out registry/operators.json</code>,
          then use this page to search, preview actions, and copy CDN config.
        </p>
      </header>

      <label class="demo-search">
        <span>Search</span>
        <input type="search" data-search placeholder="operator, model id, action..." />
      </label>

      <label class="demo-search">
        <span>Asset CDN</span>
        <select data-cdn></select>
      </label>

      <div class="demo-list" data-list role="listbox" aria-label="Scanned operators"></div>
    </section>

    <section class="demo-detail" aria-label="Selected operator">
      <div class="detail-head">
        <div>
          <p class="demo-kicker">Preview</p>
          <h2 data-name></h2>
          <p data-meta></p>
        </div>
        <button type="button" data-copy>Copy CDN config</button>
      </div>

      <div class="demo-panel" data-actions aria-label="Animation controls"></div>
      <pre class="demo-code" data-code></pre>
      <div class="demo-error" data-error hidden></div>
    </section>
  </main>
`;

const listElement = query<HTMLDivElement>("[data-list]");
const searchInput = query<HTMLInputElement>("[data-search]");
const cdnSelect = query<HTMLSelectElement>("[data-cdn]");
const nameElement = query<HTMLElement>("[data-name]");
const metaElement = query<HTMLElement>("[data-meta]");
const actionsElement = query<HTMLDivElement>("[data-actions]");
const codeElement = query<HTMLPreElement>("[data-code]");
const copyButton = query<HTMLButtonElement>("[data-copy]");
const errorElement = query<HTMLDivElement>("[data-error]");

async function bootstrap(): Promise<void> {
  state.registry = await loadRegistry();
  state.filtered = state.registry.operators;
  state.selected = state.registry.operators[0] ?? fallbackOperator;
  state.selectedCdn = pickInitialCdnSource(state.registry);

  searchInput.addEventListener("input", () => {
    applySearch(searchInput.value);
  });

  cdnSelect.addEventListener("change", () => {
    const cdn = ARK_MODELS_CDN_SOURCES.find((source) => source.id === cdnSelect.value);

    if (!cdn) {
      return;
    }

    state.selectedCdn = cdn;
    window.localStorage.setItem("ark-waifu-cdn-source", cdn.id);

    if (state.selected) {
      void selectOperator(state.selected);
    }
  });

  copyButton.addEventListener("click", async () => {
    if (!state.selected) {
      return;
    }

    await navigator.clipboard.writeText(
      createCdnConfig(state.selected, getPreviewManifest(state.selected))
    );
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy CDN config";
    }, 1200);
  });

  renderCdnOptions();
  renderList();
  await selectOperator(state.selected);
}

async function loadRegistry(): Promise<ModelRegistry> {
  try {
    const response = await fetch("/registry/operators.json", { cache: "no-cache" });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const registry = (await response.json()) as ModelRegistry;

    if (!Array.isArray(registry.operators) || registry.operators.length === 0) {
      throw new Error("registry has no operators");
    }

    return registry;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Registry not found; using bundled sample manifest. ${message}`);
    return state.registry;
  }
}

function applySearch(term: string): void {
  const queryText = term.trim().toLowerCase();
  state.filtered = queryText
    ? state.registry.operators.filter((operator) =>
        (operator.searchText ?? createSearchText(operator)).includes(queryText)
      )
    : state.registry.operators;
  renderList();
}

function renderList(): void {
  listElement.innerHTML = "";

  if (state.filtered.length === 0) {
    listElement.innerHTML = `<p class="empty-state">No operators matched.</p>`;
    return;
  }

  state.filtered.forEach((operator) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = operator.id === state.selected?.id ? "operator-row is-active" : "operator-row";
    button.dataset.id = operator.id;
    button.innerHTML = `
      <span>${escapeHtml(operator.name)}</span>
      <small>${escapeHtml(operator.relativeDir)}</small>
    `;
    button.addEventListener("click", () => {
      void selectOperator(operator);
    });
    listElement.appendChild(button);
  });
}

function renderCdnOptions(): void {
  cdnSelect.innerHTML = "";

  ARK_MODELS_CDN_SOURCES.forEach((source) => {
    const option = document.createElement("option");
    option.value = source.id;
    option.textContent = source.recommended ? `${source.label} (recommended)` : source.label;
    option.selected = source.id === state.selectedCdn.id;
    cdnSelect.appendChild(option);
  });
}

async function selectOperator(operator: ScannedModelManifest): Promise<void> {
  state.selected = operator;
  renderList();
  renderDetails(operator);

  state.widget?.destroy();
  state.widget = new ArkWaifuWidget({
    draggable: true,
    clickAction: "touch",
    hitTest: true
  });

  try {
    await state.widget.load(getPreviewManifest(operator));
    hideError();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Failed to load ${operator.name}: ${message}`);
  }
}

function renderDetails(operator: ScannedModelManifest): void {
  const previewManifest = getPreviewManifest(operator);
  nameElement.textContent = operator.name;
  metaElement.textContent = [
    operator.category,
    operator.relativeDir,
    canUseArkModelsCdn(operator) ? state.selectedCdn.label : "manifest asset URLs",
    Object.keys(operator.actions).length > 0 ? `${Object.keys(operator.actions).length} actions` : undefined
  ]
    .filter(Boolean)
    .join(" / ");
  codeElement.textContent = createCdnConfig(operator, previewManifest);
  actionsElement.innerHTML = "";

  Object.keys(operator.actions).forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action;
    button.addEventListener("click", () => {
      state.widget?.play(action);
    });
    actionsElement.appendChild(button);
  });

  if (operator.warnings?.length) {
    showError(operator.warnings.join("\n"));
  }
}

function createCdnConfig(
  operator: ScannedModelManifest,
  manifest: ModelManifest
): string {
  if (canUseArkModelsCdn(operator)) {
    return [
      `<script`,
      `  src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.8/dist/ark-waifu.iife.js"`,
      `  data-registry="/registry/operators.json"`,
      `  data-model="${escapeAttribute(operator.id)}"`,
      `  data-cdn="${escapeAttribute(state.selectedCdn.id)}"`,
      `  data-action-panel="true"`,
      `></script>`
    ].join("\n");
  }

  return [
    `<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.8/dist/ark-waifu.iife.js" data-auto="false"></script>`,
    `<script>window.ArkWaifu.mountArkWaifu({manifest:${JSON.stringify(manifest)},draggable:true,clickAction:"touch",actionPanel:true});</script>`
  ].join("\n");
}

function getPreviewManifest(operator: ScannedModelManifest): ModelManifest {
  if (!canUseArkModelsCdn(operator)) {
    return operator;
  }

  return rewriteScannedManifestAssetBase(operator, state.selectedCdn.baseUrl);
}

function canUseArkModelsCdn(operator: ScannedModelManifest): boolean {
  const sourcePath = operator.sourceFiles.skeleton.replace(/\\/g, "/");
  return sourcePath.startsWith("models/") || sourcePath.startsWith("models_enemies/");
}

function pickInitialCdnSource(registry: ModelRegistry): AssetCdnSource {
  const savedSourceId = window.localStorage.getItem("ark-waifu-cdn-source");
  const savedSource = ARK_MODELS_CDN_SOURCES.find((source) => source.id === savedSourceId);

  if (savedSource) {
    return savedSource;
  }

  if (registry.operators.some(canUseArkModelsCdn)) {
    return getDefaultArkModelsCdnSource();
  }

  return ARK_MODELS_CDN_SOURCES.find((source) => source.id === "local") ?? getDefaultArkModelsCdnSource();
}

function createSearchText(operator: ScannedModelManifest): string {
  return [
    operator.name,
    operator.id,
    operator.relativeDir,
    operator.category,
    Object.keys(operator.actions).join(" "),
    Object.values(operator.actions).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function showError(message: string): void {
  errorElement.hidden = false;
  errorElement.textContent = message;
}

function hideError(): void {
  errorElement.hidden = true;
  errorElement.textContent = "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return entities[char] ?? char;
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"]/g, (char) => (char === "&" ? "&amp;" : "&quot;"));
}

function query<T extends Element>(selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing demo element: ${selector}`);
  }

  return element;
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  showError(`Failed to initialize Ark-waifu demo: ${message}`);
  console.error("[Ark-waifu] Demo bootstrap failed", error);
});
