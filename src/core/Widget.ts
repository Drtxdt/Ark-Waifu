import { SpineAdapter } from "../adapters/spine/SpineAdapter";
import { validateManifest } from "./loader";
import type { ActionScheduleItem, CharacterAdapter, ModelManifest, WidgetOptions } from "./types";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

export class ArkWaifuWidget {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly status: HTMLElement;
  private readonly options: Required<
    Omit<WidgetOptions, "container" | "className" | "actionSchedule">
  > &
    Pick<WidgetOptions, "container" | "className" | "actionSchedule">;
  private adapter: CharacterAdapter | null = null;
  private manifest: ModelManifest | null = null;
  private dragState: { pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null =
    null;
  private scheduleTimers: number[] = [];

  constructor(options: WidgetOptions = {}) {
    this.options = {
      width: options.width ?? DEFAULT_WIDTH,
      height: options.height ?? DEFAULT_HEIGHT,
      zIndex: options.zIndex ?? 9999,
      draggable: options.draggable ?? true,
      clickAction: options.clickAction ?? "touch",
      hitTest: options.hitTest ?? true,
      actionSchedule: options.actionSchedule,
      container: options.container,
      className: options.className
    };

    this.root = document.createElement("section");
    this.root.className = ["ark-waifu-widget", this.options.className].filter(Boolean).join(" ");
    Object.assign(this.root.style, {
      position: "fixed",
      right: "24px",
      bottom: "16px",
      overflow: "hidden",
      pointerEvents: this.options.draggable || this.options.clickAction ? "auto" : "none",
      width: `${this.options.width}px`,
      height: `${this.options.height}px`,
      touchAction: "none",
      userSelect: "none",
      zIndex: String(this.options.zIndex)
    });

    this.viewport = document.createElement("div");
    this.viewport.className = "ark-waifu-viewport";
    Object.assign(this.viewport.style, {
      position: "absolute",
      inset: "0",
      cursor: this.options.draggable ? "grab" : "default"
    });

    this.status = document.createElement("div");
    this.status.className = "ark-waifu-status";
    Object.assign(this.status.style, {
      position: "absolute",
      right: "0",
      bottom: "0",
      left: "0",
      margin: "12px",
      border: "1px solid #d5b46a",
      borderRadius: "8px",
      padding: "10px 12px",
      color: "#593f00",
      background: "#fff7dd",
      fontSize: "13px",
      lineHeight: "1.45",
      pointerEvents: "auto"
    });
    this.status.hidden = true;

    this.root.append(this.viewport, this.status);
    (this.options.container ?? document.body).appendChild(this.root);

    window.addEventListener("resize", this.handleResize);
    this.root.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerUp);
    this.root.addEventListener("pointercancel", this.handlePointerCancel);
  }

  async init(manifest?: ModelManifest): Promise<void> {
    if (manifest) {
      await this.load(manifest);
    }
  }

  async load(rawManifest: ModelManifest): Promise<void> {
    const manifest = validateManifest(rawManifest);
    this.manifest = manifest;
    this.clearSchedule();
    this.setStatus(`Loading ${manifest.name}...`, false);

    this.adapter?.destroy();
    this.viewport.replaceChildren();

    try {
      this.adapter = this.createAdapter(manifest);
      await this.adapter.load(manifest);
      this.setStatus("", true);
      if (this.options.actionSchedule) {
        this.schedule(this.options.actionSchedule);
      }
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

  getManifest(): ModelManifest | null {
    return this.manifest;
  }

  schedule(items: ActionScheduleItem[]): void {
    this.clearSchedule();

    items.forEach((item) => {
      const delayMs = item.delayMs ?? 0;

      if (item.intervalMs && item.intervalMs > 0) {
        const timeoutId = window.setTimeout(() => {
          this.play(item.action);
          const intervalId = window.setInterval(() => {
            this.play(item.action);
          }, item.intervalMs);
          this.scheduleTimers.push(intervalId);
        }, delayMs);
        this.scheduleTimers.push(timeoutId);
        return;
      }

      const timeoutId = window.setTimeout(() => {
        this.play(item.action);
      }, delayMs);
      this.scheduleTimers.push(timeoutId);
    });
  }

  clearSchedule(): void {
    this.scheduleTimers.forEach((timerId) => {
      window.clearTimeout(timerId);
      window.clearInterval(timerId);
    });
    this.scheduleTimers = [];
  }

  destroy(): void {
    window.removeEventListener("resize", this.handleResize);
    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerUp);
    this.root.removeEventListener("pointercancel", this.handlePointerCancel);
    this.clearSchedule();
    this.adapter?.destroy();
    this.adapter = null;
    this.manifest = null;
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

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.options.draggable || event.button !== 0) {
      return;
    }

    const rect = this.root.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false
    };
    this.root.setPointerCapture(event.pointerId);
    this.viewport.style.cursor = "grabbing";
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    this.dragState.moved = true;
    const left = clamp(event.clientX - this.dragState.offsetX, 0, window.innerWidth - this.root.offsetWidth);
    const top = clamp(event.clientY - this.dragState.offsetY, 0, window.innerHeight - this.root.offsetHeight);

    Object.assign(this.root.style, {
      left: `${left}px`,
      top: `${top}px`,
      right: "auto",
      bottom: "auto"
    });
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      this.handleClickAction(event);
      return;
    }

    const wasDragged = this.dragState.moved;
    this.root.releasePointerCapture(event.pointerId);
    this.dragState = null;
    this.viewport.style.cursor = this.options.draggable ? "grab" : "default";

    if (!wasDragged) {
      this.handleClickAction(event);
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.dragState?.pointerId === event.pointerId) {
      this.dragState = null;
      this.viewport.style.cursor = this.options.draggable ? "grab" : "default";
    }
  };

  private handleClickAction(event: PointerEvent): void {
    if (!this.options.clickAction || !this.adapter) {
      return;
    }

    const rect = this.root.getBoundingClientRect();
    const width = this.root.clientWidth || this.options.width;
    const height = this.root.clientHeight || this.options.height;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;

    if (this.options.hitTest && this.adapter.hitTest && !this.adapter.hitTest(x, y)) {
      return;
    }

    this.play(this.options.clickAction);
  }

  private setStatus(message: string, hidden: boolean): void {
    this.status.textContent = message;
    this.status.hidden = hidden;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
