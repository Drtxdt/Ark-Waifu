import type {
  DialogueEvent,
  DialogueManifest,
  InteractionOptions,
  ModelManifest,
  PlayOptions,
  SitOptions,
  TipsManifest,
  TipsRule
} from "./types";

const DEFAULT_SIT_OPTIONS: Required<SitOptions> = {
  hoverMs: 3000,
  durationMs: 15000,
  cooldownMs: 0,
  minOverlapRatio: 0.25,
  scanIntervalMs: 400
};

const RELAX_BRANCH_DELAY_MS = 20000;
const SPECIAL_DELAY_MS = 5000;
const DEFAULT_TIPS_COOLDOWN_MS = 3000;
const DEFAULT_SETTLE_DELAY_MS = 3000;

type InteractionControllerContext = {
  root: HTMLElement;
  getManifest: () => ModelManifest | null;
  hasAction: (action: string) => boolean;
  play: (action: string, options?: PlayOptions) => boolean;
  showBubble: (message: string, durationMs?: number) => void;
};

type SitCandidate = {
  element: Element;
  startedAt: number;
};

export class InteractionController {
  private readonly context: InteractionControllerContext;
  private readonly options: InteractionOptions;
  private readonly sitOptions: Required<SitOptions>;
  private sitTimer: number | null = null;
  private sitDurationTimer: number | null = null;
  private relaxBranchTimer: number | null = null;
  private specialDelayTimer: number | null = null;
  private candidate: SitCandidate | null = null;
  private readonly tipCleanups: Array<() => void> = [];
  private readonly tipCooldowns = new WeakMap<TipsRule, number>();
  private settleCandidates = new WeakMap<TipsRule, { element: Element; startedAt: number }>();
  private currentBaseAction = "idle";
  private sitting = false;

  constructor(context: InteractionControllerContext, options: InteractionOptions = {}) {
    this.context = context;
    this.options = options;
    this.sitOptions = { ...DEFAULT_SIT_OPTIONS, ...options.sitOptions };
  }

  async loadDialogue(): Promise<void> {
    await Promise.all([this.loadDialogueLines(), this.loadTips()]);
  }

  start(): void {
    this.stop();
    this.currentBaseAction = this.pickBaseAction();
    this.playBaseAction();
    this.speak("load");
    this.bindTips();
    this.triggerTips("load");
    this.startSitScanner();
  }

  stop(): void {
    if (this.sitTimer !== null) {
      window.clearInterval(this.sitTimer);
      this.sitTimer = null;
    }

    this.clearActionTimers();
    this.clearTips();

    this.candidate = null;
    this.sitting = false;
  }

  destroy(): void {
    this.stop();
  }

  handleManualAction(action: string): void {
    if (action === "sit") {
      this.enterSit();
      return;
    }

    if (action === "sleep") {
      this.enterSleep();
      return;
    }

    if (action === "relax" || action === "idle") {
      this.currentBaseAction = action;
      this.sitting = false;
      this.armRelaxBranch();
    }
  }

  handleClick(action: string): void {
    this.speak("click");
    this.playTemporary(action);
  }

  markMoved(): void {
    this.candidate = null;

    if (this.sitting && this.context.hasAction("relax")) {
      this.sitting = false;
      this.currentBaseAction = "relax";
      this.clearActionTimers();
      this.context.play("relax", { loop: true });
      this.speak("relax");
      this.armRelaxBranch();
      return;
    }

    this.sitting = false;
  }

  speak(event: DialogueEvent): void {
    const lines = this.options.dialogue?.lines[event];

    if (!lines?.length) {
      return;
    }

    const line = lines[Math.floor(Math.random() * lines.length)];
    if (line) {
      this.context.showBubble(line, this.options.bubbleDurationMs);
    }
  }

  playTemporary(action: string): void {
    if (!this.context.hasAction(action)) {
      return;
    }

    this.context.play(action, {
      loop: false,
      onComplete: () => {
        if (!this.sitting) {
          this.playBaseAction();
        }
      }
    });
  }

  playBaseAction(): void {
    const action = this.context.hasAction(this.currentBaseAction)
      ? this.currentBaseAction
      : this.pickBaseAction();
    this.currentBaseAction = action;
    this.context.play(action, { loop: true });

    if (action === "relax") {
      this.speak("relax");
      this.armRelaxBranch();
    } else {
      this.clearRelaxBranchTimers();
    }
  }

  private pickBaseAction(): string {
    const configured = this.options.defaultAction ?? "auto";

    if (configured !== "auto" && this.context.hasAction(configured)) {
      return configured;
    }

    if (this.context.hasAction("relax")) {
      return "relax";
    }

    return "idle";
  }

  private startSitScanner(): void {
    if (!this.options.sitTargets && !this.hasSettleTips()) {
      return;
    }

    this.sitTimer = window.setInterval(() => {
      this.scanSitTargets();
    }, this.sitOptions.scanIntervalMs);
  }

  private scanSitTargets(): void {
    if (this.sitting) {
      return;
    }

    const target = this.findSitTarget();
    this.scanSettleTips(target);

    if (!target) {
      this.candidate = null;
      return;
    }

    if (this.candidate?.element !== target) {
      this.candidate = { element: target, startedAt: Date.now() };
      return;
    }

    if (Date.now() - this.candidate.startedAt >= this.sitOptions.hoverMs) {
      this.enterSit();
    }
  }

  private enterSit(): void {
    if (!this.context.hasAction("sit") || this.sitting) {
      return;
    }

    this.sitting = true;
    this.candidate = null;
    this.clearActionTimers();
    this.context.play("sit", { loop: true });
    this.speak("sit");

    this.sitDurationTimer = window.setTimeout(() => {
      this.leaveSitForRelax();
    }, this.sitOptions.durationMs);
  }

  private enterSleep(): void {
    if (!this.context.hasAction("sleep")) {
      return;
    }

    this.sitting = false;
    this.clearActionTimers();
    this.context.play("sleep", { loop: false, onComplete: () => this.playBaseAction() });
  }

  private leaveSitForRelax(): void {
    this.sitDurationTimer = null;
    this.sitting = false;
    this.speak("stand");

    if (this.context.hasAction("relax")) {
      this.currentBaseAction = "relax";
      this.context.play("relax", { loop: true });
      this.speak("relax");
      this.armRelaxBranch();
      return;
    }

    this.playBaseAction();
  }

  private armRelaxBranch(): void {
    this.clearRelaxBranchTimers();

    if (!this.context.hasAction("relax")) {
      return;
    }

    this.relaxBranchTimer = window.setTimeout(() => {
      this.relaxBranchTimer = null;
      this.runRelaxBranch();
    }, RELAX_BRANCH_DELAY_MS);
  }

  private runRelaxBranch(): void {
    if (this.sitting) {
      return;
    }

    const hasSit = this.context.hasAction("sit");
    const hasSleep = this.context.hasAction("sleep");
    const hasSpecial = this.context.hasAction("special");

    if (hasSpecial) {
      const roll = Math.random();

      if (roll < 1 / 3 && hasSit) {
        this.enterSit();
        return;
      }

      if (roll < 2 / 3 && hasSleep) {
        this.enterSleep();
        return;
      }

      this.specialDelayTimer = window.setTimeout(() => {
        this.specialDelayTimer = null;
        this.playTemporary("special");
      }, SPECIAL_DELAY_MS);
      return;
    }

    const candidates = [
      hasSit ? "sit" : undefined,
      hasSleep ? "sleep" : undefined
    ].filter((action): action is "sit" | "sleep" => Boolean(action));

    if (candidates.length === 0) {
      return;
    }

    const action = candidates[Math.floor(Math.random() * candidates.length)];

    if (action === "sit") {
      this.enterSit();
    } else {
      this.enterSleep();
    }
  }

  private findSitTarget(): Element | null {
    const selectors = normalizeSelectors(this.options.sitTargets);
    const rootRect = this.context.root.getBoundingClientRect();
    const footLeft = rootRect.left + rootRect.width * (0.5 - this.sitOptions.minOverlapRatio / 2);
    const footRight = rootRect.left + rootRect.width * (0.5 + this.sitOptions.minOverlapRatio / 2);
    const footY = rootRect.bottom;

    for (const selector of selectors) {
      for (const element of Array.from(document.querySelectorAll(selector))) {
        const rect = element.getBoundingClientRect();

        if (!isVisibleElement(element, rect)) {
          continue;
        }

        const horizontalOverlap = Math.min(footRight, rect.right) - Math.max(footLeft, rect.left);
        const overlapRatio = horizontalOverlap / Math.max(1, footRight - footLeft);
        const nearTop = Math.abs(footY - rect.top) <= Math.max(16, rootRect.height * 0.08);

        if (nearTop && overlapRatio >= this.sitOptions.minOverlapRatio) {
          return element;
        }
      }
    }

    return null;
  }

  private clearActionTimers(): void {
    if (this.sitDurationTimer !== null) {
      window.clearTimeout(this.sitDurationTimer);
      this.sitDurationTimer = null;
    }

    this.clearRelaxBranchTimers();
  }

  private clearRelaxBranchTimers(): void {
    if (this.relaxBranchTimer !== null) {
      window.clearTimeout(this.relaxBranchTimer);
      this.relaxBranchTimer = null;
    }

    if (this.specialDelayTimer !== null) {
      window.clearTimeout(this.specialDelayTimer);
      this.specialDelayTimer = null;
    }
  }

  private async loadDialogueLines(): Promise<void> {
    if (this.options.dialogue || !this.options.dialogueUrl) {
      return;
    }

    try {
      const response = await fetch(this.options.dialogueUrl, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      this.options.dialogue = (await response.json()) as DialogueManifest;
    } catch (error) {
      console.warn("[Ark-waifu] Failed to load dialogue manifest.", error);
    }
  }

  private async loadTips(): Promise<void> {
    if (this.options.tips || !this.options.tipsUrl) {
      return;
    }

    try {
      const response = await fetch(this.options.tipsUrl, { cache: "no-cache" });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const manifest = (await response.json()) as TipsManifest;
      this.options.tips = manifest;

      if (!this.options.dialogue && manifest.lines) {
        this.options.dialogue = {
          version: manifest.version,
          lines: manifest.lines
        };
      }
    } catch (error) {
      console.warn("[Ark-waifu] Failed to load tips manifest.", error);
    }
  }

  private bindTips(): void {
    const rules = this.options.tips?.rules ?? [];

    rules.forEach((rule) => {
      if (rule.event === "load" || rule.event === "settle" || !rule.selector) {
        return;
      }

      const listener = (event: Event): void => {
        this.triggerTip(rule, event.currentTarget instanceof Element ? event.currentTarget : undefined);
      };

      document.querySelectorAll(rule.selector).forEach((element) => {
        element.addEventListener(rule.event, listener);
        this.tipCleanups.push(() => {
          element.removeEventListener(rule.event, listener);
        });
      });
    });
  }

  private clearTips(): void {
    while (this.tipCleanups.length > 0) {
      this.tipCleanups.pop()?.();
    }

    this.settleCandidates = new WeakMap();
  }

  private triggerTips(event: TipsRule["event"]): void {
    const rules = this.options.tips?.rules ?? [];

    rules
      .filter((rule) => rule.event === event)
      .forEach((rule) => {
        this.triggerTip(rule);
      });
  }

  private scanSettleTips(activeTarget: Element | null): void {
    const rules = this.options.tips?.rules ?? [];

    rules
      .filter((rule) => rule.event === "settle" && rule.selector)
      .forEach((rule) => {
        const target = activeTarget?.matches(rule.selector ?? "") ? activeTarget : this.findRuleTarget(rule);

        if (!target) {
          this.settleCandidates.delete(rule);
          return;
        }

        const candidate = this.settleCandidates.get(rule);

        if (candidate?.element !== target) {
          this.settleCandidates.set(rule, { element: target, startedAt: Date.now() });
          return;
        }

        if (Date.now() - candidate.startedAt >= (rule.delayMs ?? DEFAULT_SETTLE_DELAY_MS)) {
          this.triggerTip(rule, target);
          this.settleCandidates.set(rule, { element: target, startedAt: Date.now() });
        }
      });
  }

  private findRuleTarget(rule: TipsRule): Element | null {
    if (!rule.selector) {
      return null;
    }

    const rootRect = this.context.root.getBoundingClientRect();
    const footX = rootRect.left + rootRect.width / 2;
    const footY = rootRect.bottom;

    return (
      Array.from(document.querySelectorAll(rule.selector)).find((element) => {
        const rect = element.getBoundingClientRect();
        return (
          isVisibleElement(element, rect) &&
          footX >= rect.left &&
          footX <= rect.right &&
          Math.abs(footY - rect.top) <= Math.max(16, rootRect.height * 0.08)
        );
      }) ?? null
    );
  }

  private triggerTip(rule: TipsRule, _target?: Element): void {
    const now = Date.now();
    const lastTriggeredAt = this.tipCooldowns.get(rule) ?? 0;

    if (now - lastTriggeredAt < (rule.cooldownMs ?? DEFAULT_TIPS_COOLDOWN_MS)) {
      return;
    }

    this.tipCooldowns.set(rule, now);
    const text = rule.text[Math.floor(Math.random() * rule.text.length)];

    if (text) {
      this.context.showBubble(text, this.options.bubbleDurationMs);
    }

    if (rule.action) {
      this.playTipAction(rule.action);
    }
  }

  private playTipAction(action: string): void {
    if (action === "sit") {
      this.enterSit();
      return;
    }

    if (action === "sleep") {
      this.enterSleep();
      return;
    }

    if (action === "relax" || action === "idle") {
      this.currentBaseAction = action;
      this.sitting = false;
      this.clearActionTimers();
      this.context.play(action, { loop: true });
      if (action === "relax") {
        this.armRelaxBranch();
      }
      return;
    }

    this.playTemporary(action);
  }

  private hasSettleTips(): boolean {
    return Boolean(this.options.tips?.rules.some((rule) => rule.event === "settle" && rule.selector));
  }
}

export async function loadDialogueManifest(url: string): Promise<DialogueManifest> {
  const response = await fetch(url, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Failed to load dialogue "${url}": ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as DialogueManifest;
}

function normalizeSelectors(selectors: string | string[] | undefined): string[] {
  if (!selectors) {
    return [];
  }

  if (Array.isArray(selectors)) {
    return selectors.map((selector) => selector.trim()).filter(Boolean);
  }

  return selectors
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
}

function isVisibleElement(element: Element, rect: DOMRect): boolean {
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
}
