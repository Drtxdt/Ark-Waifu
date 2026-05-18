export type ModelType = "ark-spine";

export type ModelFiles = {
  skel?: string;
  json?: string;
  atlas: string;
  textures: string[];
};

export type ModelPosition = {
  x: number;
  y: number;
};

export type ModelManifest = {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  files: ModelFiles;
  actions: Record<string, string>;
  scale?: number;
  position?: ModelPosition;
};

export type ScannedModelManifest = ModelManifest & {
  category?: string;
  relativeDir: string;
  sourceFiles: {
    skeleton: string;
    atlas: string;
    textures: string[];
  };
  displayName?: string;
  searchText?: string;
  warnings?: string[];
};

export type ModelRegistry = {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  operators: ScannedModelManifest[];
};

export type AssetCdnSource = {
  id: string;
  label: string;
  baseUrl: string;
  description?: string;
  recommended?: boolean;
};

export type ActionScheduleItem = {
  action: string;
  delayMs?: number;
  intervalMs?: number;
};

export type PlayOptions = {
  loop?: boolean;
  onComplete?: () => void;
};

export type DialogueEvent = "load" | "relax" | "sit" | "stand" | "click" | "error";

export type DialogueManifest = {
  version: 1;
  lines: Partial<Record<DialogueEvent, string[]>>;
};

export type TipsEvent =
  | "click"
  | "mouseenter"
  | "mouseleave"
  | "focus"
  | "blur"
  | "settle"
  | "load";

export type TipsRule = {
  selector?: string;
  event: TipsEvent;
  text: string[];
  action?: string;
  delayMs?: number;
  cooldownMs?: number;
};

export type TipsManifest = {
  version: 1;
  lines?: Partial<Record<DialogueEvent, string[]>>;
  rules: TipsRule[];
};

export type SitOptions = {
  hoverMs?: number;
  durationMs?: number;
  cooldownMs?: number;
  minOverlapRatio?: number;
  scanIntervalMs?: number;
};

export type InteractionOptions = {
  defaultAction?: string | "auto";
  sitTargets?: string | string[];
  sitOptions?: SitOptions;
  dialogue?: DialogueManifest;
  dialogueUrl?: string;
  tips?: TipsManifest;
  tipsUrl?: string;
  bubbleDurationMs?: number;
  maxDpr?: number;
  fpsLimit?: number;
  pauseWhenHidden?: boolean;
  pauseWhenOffscreen?: boolean;
};

export type ActionPanelOptions = {
  container?: HTMLElement;
  className?: string;
};

export type WidgetOptions = {
  container?: HTMLElement;
  width?: number;
  height?: number;
  zIndex?: number;
  className?: string;
  draggable?: boolean;
  clickAction?: string | false;
  hitTest?: boolean;
  actionSchedule?: ActionScheduleItem[];
  interaction?: InteractionOptions;
  defaultAction?: string | "auto";
  sitTargets?: string | string[];
  sitOptions?: SitOptions;
  dialogue?: DialogueManifest;
  dialogueUrl?: string;
  tips?: TipsManifest;
  tipsUrl?: string;
  bubbleDurationMs?: number;
  maxDpr?: number;
  fpsLimit?: number;
  pauseWhenHidden?: boolean;
  pauseWhenOffscreen?: boolean;
};

export type MountArkWaifuOptions = WidgetOptions & {
  manifest?: ModelManifest;
  manifestUrl?: string;
  registryUrl?: string;
  modelId?: string;
  assetBaseUrl?: string;
  actionPanel?: boolean | ActionPanelOptions;
};

export type MountedArkWaifu = {
  widget: import("./Widget").ArkWaifuWidget;
  ready: Promise<void>;
  actionPanel?: HTMLElement;
};

export type AdapterContext = {
  container: HTMLElement;
  width: number;
  height: number;
  maxDpr?: number;
  fpsLimit?: number;
};

export interface CharacterAdapter {
  load(manifest: ModelManifest): Promise<void>;
  play(action: string, options?: PlayOptions): boolean;
  resize(width: number, height: number): void;
  hitTest?(x: number, y: number): boolean;
  hasAction?(action: string): boolean;
  pause?(): void;
  resume?(): void;
  destroy(): void;
}
