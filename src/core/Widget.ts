import { SpineAdapter } from "../adapters/spine/SpineAdapter";
import { validateManifest } from "./loader";
import type { CharacterAdapter, ModelManifest, WidgetOptions } from "./types";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

export class ArkWaifuWidget {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly status: HTMLElement;
  private readonly options: Required<Omit<WidgetOptions, "container" | "className">> &
    Pick<WidgetOptions, "container" | "className">;
  private adapter: CharacterAdapter | null = null;

  constructor(options: WidgetOptions = {}) {
    this.options = {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      zIndex: options.zIndex ?? 9999,
      container: options.container,
      className: options.className
    };

    this.root = document.createElement("section");
    this.root.className = ["ark-waifu-widget", this.options.className].filter(Boolean).join(" ");
    this.root.style.width = `${this.options.width}px`;
    this.root.style.height = `${this.options.height}px`;
    this.root.style.zIndex = String(this.options.zIndex);

    this.viewport = document.createElement("div");
    this.viewport.className = "ark-waifu-viewport";

    this.status = document.createElement("div");
    this.status.className = "ark-waifu-status";
    this.status.hidden = true;

    this.root.append(this.viewport, this.status);
    (this.options.container ?? document.body).appendChild(this.root);

    window.addEventListener("resize", this.handleResize);
  }

  async init(manifest?: ModelManifest): Promise<void> {
    if (manifest) {
      await this.load(manifest);
    }
  }

  async load(rawManifest: ModelManifest): Promise<void> {
    const manifest = validateManifest(rawManifest);
    this.setStatus(`Loading ${manifest.name}...`, false);

    this.adapter?.destroy();
    this.viewport.replaceChildren();

    try {
      this.adapter = this.createAdapter(manifest);
      await this.adapter.load(manifest);
      this.setStatus("", true);
    } catch (error) {
      this.adapter?.destroy();
      this.adapter = null;
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to load ${manifest.name}: ${message}`, false);
      console.error("[Ark-waifu] Failed to load model", error);
    }
  }

  play(action: string): void {
    if (!this.adapter) {
      console.warn(`[Ark-waifu] Cannot play "${action}" before a model is loaded.`);
      return;
    }

    this.adapter.play(action);
  }

  destroy(): void {
    window.removeEventListener("resize", this.handleResize);
    this.adapter?.destroy();
    this.adapter = null;
    this.root.remove();
  }

  private createAdapter(manifest: ModelManifest): CharacterAdapter {
    if (manifest.type === "ark-spine") {
      return new SpineAdapter({
        container: this.viewport,
        width: this.options.width,
        height: this.options.height
      });
    }

    throw new Error(`Unsupported model type "${manifest.type}".`);
  }

  private readonly handleResize = (): void => {
    const width = this.root.clientWidth || this.options.width;
    const height = this.root.clientHeight || this.options.height;
    this.adapter?.resize(width, height);
  };

  private setStatus(message: string, hidden: boolean): void {
    this.status.textContent = message;
    this.status.hidden = hidden;
  }
}
