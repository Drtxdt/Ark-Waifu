import { SpineAdapter } from "../adapters/spine/SpineAdapter";
import { InteractionController } from "./interaction";
import { validateManifest } from "./loader";
import type {
  ActionScheduleItem,
  CharacterAdapter,
  InteractionOptions,
  ModelManifest,
  PlayOptions,
  WidgetOptions
} from "./types";

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 420;

export class ArkWaifuWidget {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly status: HTMLElement;
  private readonly bubble: HTMLElement;
  private readonly options: Required<
    Omit<
      WidgetOptions,
      | "container"
      | "className"
      | "actionSchedule"
      | "interaction"
      | "sitTargets"
      | "sitOptions"
      | "dialogue"
      | "dialogueUrl"
      | "tips"
      | "tipsUrl"
      | "pauseWhenHidden"
      | "pauseWhenOffscreen"
    >
  > &
    Pick<
      WidgetOptions,
      | "container"
      | "className"
      | "actionSchedule"
      | "interaction"
      | "sitTargets"
      | "sitOptions"
      | "dialogue"
      | "dialogueUrl"
      | "tips"
      | "tipsUrl"
      | "pauseWhenHidden"
      | "pauseWhenOffscreen"
    >;
  private adapter: CharacterAdapter | null = null;
  private manifest: ModelManifest | null = null;
  private interaction: InteractionController | null = null;
  private bubbleTimer: number | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private hiddenPaused = false;
  private offscreenPaused = false;
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
      interaction: options.interaction,
      defaultAction: options.defaultAction ?? "auto",
      sitTargets: options.sitTargets,
      sitOptions: options.sitOptions,
      dialogue: options.dialogue,
      dialogueUrl: options.dialogueUrl,
      tips: options.tips,
      tipsUrl: options.tipsUrl,
      bubbleDurationMs: options.bubbleDurationMs ?? 3600,
      maxDpr: options.maxDpr ?? 1.5,
      fpsLimit: options.fpsLimit ?? 30,
      pauseWhenHidden: options.pauseWhenHidden ?? true,
      pauseWhenOffscreen: options.pauseWhenOffscreen ?? true,
      container: options.container,
      className: options.className
    };

    this.root = document.createElement("section");
    this.root.className = ["ark-waifu-widget", this.options.className].filter(Boolean).join(" ");
    Object.assign(this.root.style, {
      position: "fixed",
      right: "24px",
      bottom: "16px",
      overflow: "visible",
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
      cursor: this.options.draggable ? "grab" : "default",
      overflow: "visible"
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

    this.bubble = document.createElement("div");
    this.bubble.className = "ark-waifu-bubble";
    Object.assign(this.bubble.style, {
      position: "absolute",
      right: "12px",
      bottom: "56%",
      maxWidth: "260px",
      border: "1px solid #e0c36d",
      borderRadius: "8px",
      padding: "9px 12px",
      color: "#594100",
      background: "#fff4bd",
      boxShadow: "0 8px 22px rgba(104, 79, 0, 0.16)",
      fontSize: "13px",
      lineHeight: "1.45",
      opacity: "0",
      transform: "translateY(4px)",
      transition: "opacity 160ms ease, transform 160ms ease",
      pointerEvents: "none"
    });
    this.bubble.hidden = true;

    this.root.append(this.viewport, this.bubble, this.status);
    (this.options.container ?? document.body).appendChild(this.root);

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.root.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerUp);
    this.root.addEventListener("pointercancel", this.handlePointerCancel);
    this.setupIntersectionObserver();
  }

  async init(manifest?: ModelManifest): Promise<void> {
    if (manifest) {
      await this.load(manifest);
    }
  }

  async load(rawManifest: ModelManifest): Promise<void> {
    const manifest = validateManifest(rawManifest);
    const previousManifest = this.manifest;
    const previousAdapter = this.adapter;
    const previousInteraction = this.interaction;
    this.clearSchedule();
    this.interaction?.stop();
    this.setStatus(`Loading ${manifest.name}...`, false);

    const nextAdapter = this.createAdapter(manifest);
    const nextInteraction = new InteractionController(
      {
        root: this.root,
        getManifest: () => this.manifest,
        hasAction: (action) => nextAdapter.hasAction?.(action) ?? Boolean(manifest.actions[action]),
        play: (action, options) => nextAdapter.play(action, options),
        showBubble: (message, durationMs) => {
          this.showBubble(message, durationMs);
        }
      },
      this.createInteractionOptions()
    );

    try {
      await nextAdapter.load(manifest);
      await nextInteraction.loadDialogue();
      previousAdapter?.destroy();
      previousInteraction?.destroy();
      this.adapter = nextAdapter;
      this.manifest = manifest;
      this.interaction = nextInteraction;
      this.setStatus("", true);
      this.interaction.start();
      this.updateAdapterPauseState();
      if (this.options.actionSchedule) {
        this.schedule(this.options.actionSchedule);
      }
    } catch (error) {
      nextAdapter.destroy();
      nextInteraction.destroy();
      this.adapter = previousAdapter;
      this.manifest = previousManifest;
      this.interaction = previousInteraction;
      this.interaction?.start();
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`Failed to load ${manifest.name}: ${message}`, false);
      this.interaction?.speak("error");
      console.error("[Ark-waifu] Failed to load model", error);
    }
  }

  play(action: string, options?: PlayOptions): boolean {
    if (!this.adapter) {
      console.warn(`[Ark-waifu] Cannot play "${action}" before a model is loaded.`);
      return false;
    }

    const playOptions =
      options ??
      (this.interaction && !isLoopingBaseAction(action)
        ? {
            loop: false,
            onComplete: () => {
              this.interaction?.playBaseAction();
            }
          }
        : undefined);
    const played = this.adapter.play(action, playOptions);
    if (played) {
      this.interaction?.handleManualAction(action);
    }

    return played;
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
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerUp);
    this.root.removeEventListener("pointercancel", this.handlePointerCancel);
    this.clearSchedule();
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.interaction?.destroy();
    this.interaction = null;
    this.clearBubble();
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
        height: this.options.height,
        maxDpr: this.options.maxDpr,
        fpsLimit: this.options.fpsLimit
      });
    }

    throw new Error(`Unsupported model type "${manifest.type}".`);
  }

  private createInteractionOptions(): InteractionOptions {
    return {
      ...this.options.interaction,
      defaultAction: this.options.interaction?.defaultAction ?? this.options.defaultAction,
      sitTargets: this.options.interaction?.sitTargets ?? this.options.sitTargets,
      sitOptions: this.options.interaction?.sitOptions ?? this.options.sitOptions,
      dialogue: this.options.interaction?.dialogue ?? this.options.dialogue,
      dialogueUrl: this.options.interaction?.dialogueUrl ?? this.options.dialogueUrl,
      tips: this.options.interaction?.tips ?? this.options.tips,
      tipsUrl: this.options.interaction?.tipsUrl ?? this.options.tipsUrl,
      bubbleDurationMs: this.options.interaction?.bubbleDurationMs ?? this.options.bubbleDurationMs
    };
  }

  private readonly handleResize = (): void => {
    const width = this.root.clientWidth || this.options.width;
    const height = this.root.clientHeight || this.options.height;
    this.adapter?.resize(width, height);
  };

  private readonly handleVisibilityChange = (): void => {
    this.hiddenPaused = Boolean(
      this.options.pauseWhenHidden && document.visibilityState === "hidden"
    );
    this.updateAdapterPauseState();
  };

  private setupIntersectionObserver(): void {
    if (!this.options.pauseWhenOffscreen || !("IntersectionObserver" in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      this.offscreenPaused = entry ? !entry.isIntersecting : false;
      this.updateAdapterPauseState();
    });
    this.intersectionObserver.observe(this.root);
  }

  private updateAdapterPauseState(): void {
    if (this.hiddenPaused || this.offscreenPaused) {
      this.adapter?.pause?.();
      return;
    }

    this.adapter?.resume?.();
  }

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
    } else {
      this.interaction?.markMoved();
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

    this.interaction?.handleClick(this.options.clickAction);
  }

  private setStatus(message: string, hidden: boolean): void {
    this.status.textContent = message;
    this.status.hidden = hidden;
  }

  private showBubble(message: string, durationMs = this.options.bubbleDurationMs): void {
    this.clearBubble();
    this.bubble.textContent = message;
    this.bubble.hidden = false;
    window.requestAnimationFrame(() => {
      this.bubble.style.opacity = "1";
      this.bubble.style.transform = "translateY(0)";
    });

    this.bubbleTimer = window.setTimeout(() => {
      this.bubble.style.opacity = "0";
      this.bubble.style.transform = "translateY(4px)";
      this.bubbleTimer = window.setTimeout(() => {
        this.bubble.hidden = true;
        this.bubbleTimer = null;
      }, 180);
    }, durationMs);
  }

  private clearBubble(): void {
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }

    this.bubble.hidden = true;
    this.bubble.style.opacity = "0";
    this.bubble.style.transform = "translateY(4px)";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function isLoopingBaseAction(action: string): boolean {
  return action === "idle" || action === "relax" || action === "walk" || action === "sit";
}
