import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-3.8";
import type { AdapterContext, CharacterAdapter, ModelManifest } from "../../core/types";

type SpineLoaderResource = PIXI.LoaderResource & {
  spineData?: ConstructorParameters<typeof Spine>[0];
};

export class SpineAdapter implements CharacterAdapter {
  private app: PIXI.Application | null = null;
  private spine: Spine | null = null;
  private manifest: ModelManifest | null = null;
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

    const spineData = await this.loadSpineData(manifest, skeletonUrl);
    this.spine = new Spine(spineData);
    this.spine.autoUpdate = true;
    this.app.stage.addChild(this.spine);
    this.play("idle");
    this.spine.update(0);
    this.applyTransform();
  }

  play(action: string): void {
    if (!this.spine || !this.manifest) {
      console.warn(`[Ark-waifu] Cannot play "${action}" before Spine data is ready.`);
      return;
    }

    const animationName = this.manifest.actions[action];
    if (!animationName) {
      console.warn(
        `[Ark-waifu] Action "${action}" is not defined in manifest "${this.manifest.id}".`
      );
      return;
    }

    if (!this.hasAnimation(animationName)) {
      console.warn(
        `[Ark-waifu] Animation "${animationName}" for action "${action}" was not found in model "${this.manifest.id}".`
      );
      return;
    }

    const loop = action === "idle" || action === "walk";
    const entry = this.spine.state.setAnimation(0, animationName, loop);

    if (!loop && action !== "idle" && this.manifest.actions.idle) {
      entry.listener = {
        complete: () => {
          this.play("idle");
        }
      };
    }
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

    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: false,
        baseTexture: false
      });
      this.app = null;
    }
  }

  private async loadSpineData(
    manifest: ModelManifest,
    skeletonUrl: string
  ): Promise<ConstructorParameters<typeof Spine>[0]> {
    const loader = new PIXI.Loader();
    const encodedSkeletonUrl = encodeAssetUrl(skeletonUrl);
    const isBinary = encodedSkeletonUrl.toLowerCase().endsWith(".skel");
    const addOptions: PIXI.IAddOptions = {
      crossOrigin: "anonymous",
      metadata: {
        spineAtlasFile: encodeAssetUrl(manifest.files.atlas),
        imageLoader: createManifestImageLoader(manifest.files.textures, manifest.files.atlas)
      }
    };

    if (isBinary) {
      addOptions.xhrType = PIXI.LoaderResource.XHR_RESPONSE_TYPE.BUFFER;
    }

    loader.add(manifest.id, encodedSkeletonUrl, addOptions);

    const resources = await new Promise<Record<string, PIXI.LoaderResource>>((resolve, reject) => {
      loader.onError.once((_error, _loader, resource) => {
        reject(
          new Error(
            `Failed to load Spine resource "${resource?.url ?? skeletonUrl}". Check manifest paths and CORS settings.`
          )
        );
      });

      loader.load((_loader, resourcesByName) => {
        resolve(resourcesByName);
      });
    });

    const resource = resources[manifest.id] as SpineLoaderResource | undefined;
    if (!resource?.spineData) {
      throw new Error(
        `Spine data was not parsed for "${manifest.id}". Current MVP expects Spine 3.8 assets loadable by @pixi-spine/all-3.8.`
      );
    }

    return resource.spineData;
  }

  private applyTransform(): void {
    if (!this.app || !this.spine || !this.manifest) {
      return;
    }

    const { width, height } = this.app.screen;
    const configuredScale = this.manifest.scale ?? 1;
    const position = this.manifest.position ?? { x: 0.5, y: 1 };
    const bounds = this.spine.getLocalBounds();
    const fitScale =
      bounds.width > 0 && bounds.height > 0
        ? Math.min(width / bounds.width, height / bounds.height, 1)
        : 1;
    const scale = configuredScale * fitScale;
    const targetX = width * position.x;
    const targetY = height * position.y;

    this.spine.scale.set(scale);
    this.spine.position.set(
      targetX - (bounds.x + bounds.width / 2) * scale,
      targetY - (bounds.y + bounds.height) * scale
    );
  }

  private hasAnimation(animationName: string): boolean {
    return this.spine?.state.hasAnimation(animationName) ?? false;
  }
}

function createManifestImageLoader(textureUrls: string[], atlasUrl: string) {
  return (
    loader: PIXI.Loader,
    namePrefix: string,
    baseUrl: string,
    imageOptions: PIXI.IAddOptions
  ) => {
    return (line: string, callback: (baseTexture: PIXI.BaseTexture | null) => void): void => {
      const textureUrl = resolveTextureUrl(textureUrls, line, baseUrl, atlasUrl);
      const resourceName = `${namePrefix}${line}`;
      const cachedResource = loader.resources[resourceName];

      if (cachedResource?.texture?.baseTexture) {
        callback(cachedResource.texture.baseTexture);
        return;
      }

      loader.add(resourceName, textureUrl, imageOptions, (resource) => {
        if (resource.error || !resource.texture?.baseTexture) {
          console.warn(
            `[Ark-waifu] Failed to load texture page "${line}" from "${textureUrl}".`
          );
          callback(null);
          return;
        }

        callback(resource.texture.baseTexture);
      });
    };
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
  const path = normalizeAssetPath(url).split(/[?#]/)[0] ?? url;
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
