import * as PIXI from "pixi.js";
import {
  AtlasAttachmentLoader,
  SkeletonBinary,
  type TrackEntry,
  SkeletonJson,
  Spine,
  TextureAtlas
} from "@pixi-spine/all-3.8";
import type { AdapterContext, CharacterAdapter, ModelManifest, PlayOptions } from "../../core/types";

export class SpineAdapter implements CharacterAdapter {
  private app: PIXI.Application | null = null;
  private spine: Spine | null = null;
  private atlas: TextureAtlas | null = null;
  private readonly baseTextures: PIXI.BaseTexture[] = [];
  private manifest: ModelManifest | null = null;
  private currentAction: string | null = null;
  private readonly context: AdapterContext;

  constructor(context: AdapterContext) {
    this.context = context;
  }

  async load(manifest: ModelManifest): Promise<void> {
    this.destroy();
    this.manifest = manifest;

    this.app = new PIXI.Application({
      width: this.context.width,
      height: this.context.height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    this.app.view.className = "ark-waifu-canvas";
    this.context.container.appendChild(this.app.view);

    const skeletonUrl = manifest.files.skel ?? manifest.files.json;
    if (!skeletonUrl) {
      throw new Error(`Manifest "${manifest.id}" has no skeleton file.`);
    }

    try {
      const spineData = await this.loadSpineData(manifest, skeletonUrl);
      this.spine = new Spine(spineData);
      this.spine.autoUpdate = true;
      this.app.stage.addChild(this.spine);
      this.play("idle", { loop: true });
      this.spine.update(0);
      this.applyTransform();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  play(action: string, options: PlayOptions = {}): boolean {
    if (!this.spine || !this.manifest) {
      console.warn(`[Ark-waifu] Cannot play "${action}" before Spine data is ready.`);
      return false;
    }

    const animationName = this.manifest.actions[action];
    if (!animationName) {
      console.warn(
        `[Ark-waifu] Action "${action}" is not defined in manifest "${this.manifest.id}".`
      );
      return false;
    }

    if (!this.hasAnimation(animationName)) {
      console.warn(
        `[Ark-waifu] Animation "${animationName}" for action "${action}" was not found in model "${this.manifest.id}".`
      );
      return false;
    }

    const loop = options.loop ?? (action === "idle" || action === "walk" || action === "relax");
    const entry = this.spine.state.setAnimation(0, animationName, loop);
    this.currentAction = action;

    if (options.onComplete) {
      entry.listener = createCompleteListener(options.onComplete);
    }

    this.spine.update(0);
    this.applyTransform();
    window.requestAnimationFrame(() => {
      this.applyTransform();
    });

    return true;
  }

  resize(width: number, height: number): void {
    if (!this.app) {
      return;
    }

    this.app.renderer.resize(width, height);
    this.applyTransform();
  }

  hitTest(x: number, y: number): boolean {
    if (!this.spine) {
      return false;
    }

    const bounds = this.spine.getBounds(false);
    return bounds.contains(x, y);
  }

  destroy(): void {
    this.spine = null;
    this.currentAction = null;

    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: false,
        baseTexture: false
      });
      this.app = null;
    }

    this.atlas?.dispose();
    this.atlas = null;

    while (this.baseTextures.length > 0) {
      this.baseTextures.pop()?.destroy();
    }
  }

  private async loadSpineData(
    manifest: ModelManifest,
    skeletonUrl: string
  ): Promise<ConstructorParameters<typeof Spine>[0]> {
    const encodedSkeletonUrl = encodeAssetUrl(skeletonUrl);
    const isBinary = encodedSkeletonUrl.toLowerCase().endsWith(".skel");
    const atlasText = await fetchText(manifest.files.atlas, "atlas", manifest.id);
    const atlas = await this.createTextureAtlas(manifest, skeletonUrl, atlasText);
    const attachmentLoader = new AtlasAttachmentLoader(atlas);

    try {
      if (isBinary) {
        const buffer = await fetchArrayBuffer(encodedSkeletonUrl, "skeleton", manifest.id);
        return new SkeletonBinary(attachmentLoader).readSkeletonData(new Uint8Array(buffer));
      }

      const skeletonText = await fetchText(encodedSkeletonUrl, "skeleton", manifest.id);
      const skeletonJson = JSON.parse(skeletonText) as unknown;
      return new SkeletonJson(attachmentLoader).readSkeletonData(skeletonJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse Spine data for "${manifest.id}". Current runtime expects Spine 3.8 assets. ${message}`
      );
    }
  }

  private async createTextureAtlas(
    manifest: ModelManifest,
    skeletonUrl: string,
    atlasText: string
  ): Promise<TextureAtlas> {
    const atlas = await new Promise<TextureAtlas>((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown): void => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      const textureLoader = (line: string, callback: (baseTexture: PIXI.BaseTexture) => void): void => {
        const textureUrl = resolveTextureUrl(
          manifest.files.textures,
          line,
          getBaseUrl(skeletonUrl) ?? globalThis.location.href,
          manifest.files.atlas
        );

        loadBaseTexture(textureUrl)
          .then((baseTexture) => {
            this.baseTextures.push(baseTexture);
            callback(baseTexture);
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            fail(
              new Error(
                `Failed to load atlas texture page "${line}" from "${textureUrl}" for "${manifest.id}": ${message}`
              )
            );
          });
      };

      new TextureAtlas(atlasText, textureLoader, (loadedAtlas) => {
        if (!settled) {
          settled = true;
          resolve(loadedAtlas);
        }
      });
    });

    this.atlas = atlas;
    return atlas;
  }

  private applyTransform(): void {
    if (!this.app || !this.spine || !this.manifest) {
      return;
    }

    const { width, height } = this.app.screen;
    const configuredScale = this.manifest.scale ?? 1;
    const position = this.manifest.position ?? { x: 0.5, y: 1 };
    const bounds = this.spine.getLocalBounds();
    const bottomSafety = this.currentAction === "sit" ? Math.max(20, height * 0.08) : 0;
    const fitScale =
      bounds.width > 0 && bounds.height > 0
        ? Math.min(width / bounds.width, (height - bottomSafety) / bounds.height, 1)
        : 1;
    const scale = configuredScale * fitScale;
    const targetX = width * position.x;
    const targetY = height * position.y - bottomSafety;

    this.spine.scale.set(scale);
    this.spine.position.set(
      targetX - (bounds.x + bounds.width / 2) * scale,
      targetY - (bounds.y + bounds.height) * scale
    );
  }

  private hasAnimation(animationName: string): boolean {
    return this.spine?.state.hasAnimation(animationName) ?? false;
  }

  hasAction(action: string): boolean {
    const animationName = this.manifest?.actions[action];
    return Boolean(animationName && this.hasAnimation(animationName));
  }
}

function createCompleteListener(onComplete: () => void): TrackEntry["listener"] {
  let called = false;

  return {
    complete: () => {
      if (called) {
        return;
      }

      called = true;
      onComplete();
    }
  };
}

function resolveTextureUrl(
  textureUrls: string[],
  atlasPageName: string,
  skeletonBaseUrl: string,
  atlasUrl: string
): string {
  const normalizedAtlasPageName = normalizeAssetPath(atlasPageName);
  const matchedTexture = textureUrls.find((textureUrl) => {
    const normalizedTextureUrl = normalizeAssetPath(textureUrl);
    return (
      normalizedTextureUrl === normalizedAtlasPageName ||
      getDecodedFileName(normalizedTextureUrl) === getDecodedFileName(normalizedAtlasPageName)
    );
  });

  if (matchedTexture) {
    return encodeAssetUrl(matchedTexture);
  }

  const atlasBaseUrl = getBaseUrl(atlasUrl);
  if (atlasBaseUrl) {
    return resolveAgainstBase(normalizedAtlasPageName, atlasBaseUrl);
  }

  const normalizedBaseUrl = skeletonBaseUrl.endsWith("/") ? skeletonBaseUrl : `${skeletonBaseUrl}/`;
  return resolveAgainstBase(normalizedAtlasPageName, normalizedBaseUrl);
}

function getDecodedFileName(url: string): string {
  const path = stripQueryAndHash(normalizeAssetPath(url));
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  return decodeURIComponent(fileName);
}

function getBaseUrl(url: string): string | null {
  try {
    return new URL(".", encodeAssetUrl(url)).href;
  } catch {
    const normalizedUrl = normalizeAssetPath(url);
    const slashIndex = normalizedUrl.lastIndexOf("/");
    return slashIndex >= 0 ? normalizedUrl.slice(0, slashIndex + 1) : null;
  }
}

function normalizeAssetPath(url: string): string {
  return url.replace(/\\/g, "/");
}

function stripQueryAndHash(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

function resolveAgainstBase(assetUrl: string, baseUrl: string): string {
  const encodedAssetUrl = encodeAssetUrl(assetUrl);
  const encodedBaseUrl = encodeAssetUrl(baseUrl);

  try {
    return new URL(encodedAssetUrl, encodedBaseUrl).href;
  } catch {
    const normalizedBaseUrl = encodedBaseUrl.endsWith("/") ? encodedBaseUrl : `${encodedBaseUrl}/`;
    return `${normalizedBaseUrl}${encodedAssetUrl}`;
  }
}

function encodeAssetUrl(url: string): string {
  return url.replace(/#/g, "%23").replace(/ /g, "%20");
}

async function fetchText(url: string, label: string, manifestId: string): Promise<string> {
  const encodedUrl = encodeAssetUrl(url);
  const response = await fetch(encodedUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to load ${label} "${encodedUrl}" for "${manifestId}": ${response.status} ${response.statusText}.`
    );
  }

  const text = await response.text();

  if (looksLikeHtml(text)) {
    throw new Error(
      `Loaded ${label} "${encodedUrl}" for "${manifestId}" as HTML. Check static routing, baseUrl, and MIME handling.`
    );
  }

  return text;
}

async function fetchArrayBuffer(
  url: string,
  label: string,
  manifestId: string
): Promise<ArrayBuffer> {
  const encodedUrl = encodeAssetUrl(url);
  const response = await fetch(encodedUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to load ${label} "${encodedUrl}" for "${manifestId}": ${response.status} ${response.statusText}.`
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    throw new Error(
      `Loaded ${label} "${encodedUrl}" for "${manifestId}" as HTML. Check static routing, baseUrl, and MIME handling.`
    );
  }

  return response.arrayBuffer();
}

function loadBaseTexture(url: string): Promise<PIXI.BaseTexture> {
  const encodedUrl = encodeAssetUrl(url);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      resolve(PIXI.BaseTexture.from(image));
    };
    image.onerror = () => {
      reject(new Error(`Image load failed: ${encodedUrl}`));
    };
    image.src = encodedUrl;
  });
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype html|^\s*<html[\s>]/i.test(text);
}
