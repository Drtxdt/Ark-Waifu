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

export type WidgetOptions = {
  container?: HTMLElement;
  width?: number;
  height?: number;
  zIndex?: number;
  className?: string;
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
  destroy(): void;
}
