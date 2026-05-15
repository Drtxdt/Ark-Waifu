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

export type ActionScheduleItem = {
  action: string;
  delayMs?: number;
  intervalMs?: number;
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
};

export type MountArkWaifuOptions = WidgetOptions & {
  manifest?: ModelManifest;
  manifestUrl?: string;
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
};

export interface CharacterAdapter {
  load(manifest: ModelManifest): Promise<void>;
  play(action: string): void;
  resize(width: number, height: number): void;
  hitTest?(x: number, y: number): boolean;
  destroy(): void;
}
