#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import * as PIXI from "pixi.js";
import { AtlasAttachmentLoader, SkeletonBinary, TextureAtlas } from "@pixi-spine/all-3.8";
import type { BaseTexture } from "pixi.js";

type ModelManifest = {
  id: string;
  name: string;
  type: "ark-spine";
  version: string;
  files: {
    skel?: string;
    json?: string;
    atlas: string;
    textures: string[];
  };
  actions: Record<string, string>;
  scale?: number;
  position?: {
    x: number;
    y: number;
  };
};

type ScannedModelManifest = ModelManifest & {
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

type ModelRegistry = {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  operators: ScannedModelManifest[];
};

type ModelRegistryIndexEntry = {
  id: string;
  name: string;
  type: "ark-spine";
  version: string;
  category?: string;
  relativeDir: string;
  displayName?: string;
  searchText?: string;
  manifest: string;
};

type ModelRegistryIndex = {
  version: 1;
  generatedAt: string;
  baseUrl: string;
  defaultModelId?: string;
  models: ModelRegistryIndexEntry[];
};

type ScanOptions = {
  root: string;
  out: string;
  baseUrl: string;
  publicOut?: string;
  publicCopy: boolean;
  splitRegistry: boolean;
  splitOut?: string;
  defaultModelId?: string;
};

type AssetGroup = {
  directory: string;
  skeletons: string[];
  atlases: string[];
  textures: string[];
};

type CandidateModel = {
  skeleton: string;
  atlas: string;
  textures: string[];
  warnings: string[];
};

type NameResolver = (relativeDir: string, stem: string) => string | undefined;

const ACTION_ALIASES: Record<string, string> = {
  Default: "idle",
  Idle: "idle",
  Interact: "touch",
  Touch: "touch",
  Move: "walk",
  Walk: "walk",
  Relax: "relax",
  Sit: "sit",
  Sleep: "sleep",
  Special: "special"
};

const MODEL_ROOTS = ["models"];

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const registry = await scanArkModels(options);

  await writeJson(options.out, registry);

  if (options.publicCopy && options.publicOut) {
    await writeJson(options.publicOut, registry);
  }

  if (options.splitRegistry) {
    await writeSplitRegistry(options.splitOut ?? path.dirname(options.out), registry, options.defaultModelId);

    if (options.publicCopy && options.publicOut) {
      await writeSplitRegistry(
        options.splitOut ? path.join("public", options.splitOut) : path.dirname(options.publicOut),
        registry,
        options.defaultModelId
      );
    }
  }

  const warningCount = registry.operators.reduce(
    (count, model) => count + (model.warnings?.length ?? 0),
    0
  );

  console.log(
    `[ark-waifu] scanned ${registry.operators.length} model(s), ${warningCount} warning(s).`
  );
  console.log(`[ark-waifu] wrote ${path.resolve(options.out)}`);

  if (options.publicCopy && options.publicOut) {
    console.log(`[ark-waifu] wrote ${path.resolve(options.publicOut)}`);
  }
}

async function writeSplitRegistry(
  outputDir: string,
  registry: ModelRegistry,
  defaultModelId: string | undefined
): Promise<void> {
  const modelsDir = path.join(outputDir, "models");
  const defaultModel =
    registry.operators.find((operator) => operator.id === defaultModelId) ?? registry.operators[0];
  const index: ModelRegistryIndex = {
    version: 1,
    generatedAt: registry.generatedAt,
    baseUrl: registry.baseUrl,
    defaultModelId: defaultModel?.id,
    models: registry.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      type: operator.type,
      version: operator.version,
      category: operator.category,
      relativeDir: operator.relativeDir,
      displayName: operator.displayName,
      searchText: operator.searchText,
      manifest: `models/${operator.id}.json`
    }))
  };

  await writeJson(path.join(outputDir, "index.json"), index);

  for (const operator of registry.operators) {
    await writeJson(path.join(modelsDir, `${operator.id}.json`), operator);
  }

  if (defaultModel) {
    await writeJson(path.join(outputDir, "default-model.json"), defaultModel);
  }
}

async function scanArkModels(options: ScanOptions): Promise<ModelRegistry> {
  const root = path.resolve(options.root);
  const rootStats = await fs.stat(root).catch(() => null);

  if (!rootStats?.isDirectory()) {
    throw new Error(`Scan root does not exist or is not a directory: ${root}`);
  }

  const scanRoots = await resolveScanRoots(root);
  const groups = new Map<string, AssetGroup>();

  for (const scanRoot of scanRoots) {
    await collectAssets(scanRoot, groups);
  }

  const nameResolver = await createNameResolver(root);
  const operators: ScannedModelManifest[] = [];

  for (const group of [...groups.values()].sort((a, b) => a.directory.localeCompare(b.directory))) {
    const candidates = await createCandidates(group);

    for (const candidate of candidates) {
      operators.push(await createManifest(root, candidate, nameResolver));
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    operators: operators.map((operator) => rewriteManifestUrls(operator, options.baseUrl))
  };
}

async function resolveScanRoots(root: string): Promise<string[]> {
  const roots: string[] = [];

  for (const modelRoot of MODEL_ROOTS) {
    const candidate = path.join(root, modelRoot);
    const stats = await fs.stat(candidate).catch(() => null);

    if (stats?.isDirectory()) {
      roots.push(candidate);
    }
  }

  return roots.length > 0 ? roots : [root];
}

async function collectAssets(directory: string, groups: Map<string, AssetGroup>): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectAssets(fullPath, groups);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (![".skel", ".json", ".atlas", ".png"].includes(extension)) {
      continue;
    }

    const group = getOrCreateGroup(groups, directory);

    if (extension === ".skel" || (extension === ".json" && (await isLikelySpineJson(fullPath)))) {
      group.skeletons.push(fullPath);
    } else if (extension === ".atlas") {
      group.atlases.push(fullPath);
    } else {
      group.textures.push(fullPath);
    }
  }
}

async function isLikelySpineJson(filePath: string): Promise<boolean> {
  if (path.basename(filePath).toLowerCase() === "manifest.json") {
    return false;
  }

  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return isRecord(parsed) && (isRecord(parsed.skeleton) || isRecord(parsed.animations));
  } catch {
    return false;
  }
}

function getOrCreateGroup(groups: Map<string, AssetGroup>, directory: string): AssetGroup {
  const existing = groups.get(directory);

  if (existing) {
    return existing;
  }

  const group: AssetGroup = {
    directory,
    skeletons: [],
    atlases: [],
    textures: []
  };
  groups.set(directory, group);
  return group;
}

async function createCandidates(group: AssetGroup): Promise<CandidateModel[]> {
  const candidates: CandidateModel[] = [];

  for (const skeleton of group.skeletons.sort()) {
    const stem = basenameWithoutExtension(skeleton);
    const warnings: string[] = [];
    const atlas = pickByStem(group.atlases, stem) ?? group.atlases[0];

    if (!atlas) {
      warnings.push(`No atlas file matched skeleton "${path.basename(skeleton)}".`);
      continue;
    }

    const textures = await resolveAtlasTextures(atlas, group.textures, warnings);

    if (textures.length === 0) {
      const fallback = pickByStem(group.textures, stem);

      if (fallback) {
        textures.push(fallback);
      } else {
        warnings.push(`No png texture matched atlas "${path.basename(atlas)}".`);
      }
    }

    candidates.push({ skeleton, atlas, textures, warnings });
  }

  return candidates;
}

async function resolveAtlasTextures(
  atlasPath: string,
  textureCandidates: string[],
  warnings: string[]
): Promise<string[]> {
  const atlasText = await fs.readFile(atlasPath, "utf8");
  const pageNames = getAtlasPageNames(atlasText);
  const textures: string[] = [];

  for (const pageName of pageNames) {
    const pageBaseName = path.basename(pageName).toLowerCase();
    const exact = textureCandidates.find((texture) => path.basename(texture).toLowerCase() === pageBaseName);

    if (exact) {
      textures.push(exact);
      continue;
    }

    const relative = path.resolve(path.dirname(atlasPath), pageName);
    const exists = await fileExists(relative);

    if (exists) {
      textures.push(relative);
      continue;
    }

    warnings.push(`Atlas page "${pageName}" has no matching png file.`);
  }

  return unique(textures);
}

function getAtlasPageNames(atlasText: string): string[] {
  const lines = atlasText.split(/\r?\n/);
  const pageNames: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    const nextLine = lines[index + 1]?.trim();

    if (!line || line.includes(":")) {
      continue;
    }

    if (nextLine?.startsWith("size:") || nextLine?.startsWith("format:")) {
      pageNames.push(line);
    }
  }

  return unique(pageNames);
}

async function createManifest(
  root: string,
  candidate: CandidateModel,
  nameResolver: NameResolver
): Promise<ScannedModelManifest> {
  const extension = path.extname(candidate.skeleton).toLowerCase();
  const stem = basenameWithoutExtension(candidate.skeleton);
  const relativeDir = toPosixPath(path.relative(root, path.dirname(candidate.skeleton)));
  const category = relativeDir.split("/")[0] || undefined;
  const displayName = nameResolver(relativeDir, stem);
  const name = displayName ?? fallbackName(stem);
  const warnings = [...candidate.warnings];
  const animations = await readAnimationNames(candidate.skeleton, candidate.atlas, warnings);
  const actions = createActions(animations, warnings);
  const skeletonRelativePath = toPosixPath(path.relative(root, candidate.skeleton));
  const atlasRelativePath = toPosixPath(path.relative(root, candidate.atlas));
  const textureRelativePaths = candidate.textures.map((texture) =>
    toPosixPath(path.relative(root, texture))
  );

  return {
    id: createId(relativeDir, stem),
    name,
    type: "ark-spine",
    version: "spine-3.8",
    files: {
      skel: extension === ".skel" ? skeletonRelativePath : undefined,
      json: extension === ".json" ? skeletonRelativePath : undefined,
      atlas: atlasRelativePath,
      textures: textureRelativePaths
    },
    actions,
    scale: 0.5,
    position: {
      x: 0.5,
      y: 1
    },
    category,
    relativeDir,
    sourceFiles: {
      skeleton: skeletonRelativePath,
      atlas: atlasRelativePath,
      textures: textureRelativePaths
    },
    displayName,
    searchText: [name, stem, relativeDir, Object.values(actions).join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    warnings: warnings.length > 0 ? unique(warnings) : undefined
  };
}

async function readAnimationNames(
  skeletonPath: string,
  atlasPath: string,
  warnings: string[]
): Promise<string[]> {
  const extension = path.extname(skeletonPath).toLowerCase();

  try {
    if (extension === ".json") {
      return readJsonAnimationNames(await fs.readFile(skeletonPath, "utf8"));
    }

    return await readBinaryAnimationNames(skeletonPath, atlasPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Failed to parse animation names from "${path.basename(skeletonPath)}": ${message}`);
    return [];
  }
}

function readJsonAnimationNames(jsonText: string): string[] {
  const parsed = JSON.parse(jsonText) as unknown;

  if (!isRecord(parsed) || !isRecord(parsed.animations)) {
    return [];
  }

  return Object.keys(parsed.animations);
}

async function readBinaryAnimationNames(skeletonPath: string, atlasPath: string): Promise<string[]> {
  const [atlasText, skeletonBuffer] = await Promise.all([
    fs.readFile(atlasPath, "utf8"),
    fs.readFile(skeletonPath)
  ]);
  const baseTextures: BaseTexture[] = [];
  const atlas = new TextureAtlas(atlasText, (_pageName, done) => {
    const texture = PIXI.BaseTexture.fromBuffer(new Uint8Array(4), 1, 1);
    texture.setSize(2048, 2048);
    baseTextures.push(texture);
    done(texture);
  });

  try {
    const loader = new AtlasAttachmentLoader(atlas);
    const binary = new SkeletonBinary(loader);
    const skeletonData = binary.readSkeletonData(new Uint8Array(skeletonBuffer));
    return skeletonData.animations.map((animation) => animation.name);
  } finally {
    atlas.dispose();
    baseTextures.forEach((texture) => texture.destroy());
  }
}

function createActions(animationNames: string[], warnings: string[]): Record<string, string> {
  const actions: Record<string, string> = {};

  for (const animationName of animationNames) {
    const action = ACTION_ALIASES[animationName] ?? toActionKey(animationName);

    if (!actions[action]) {
      actions[action] = animationName;
    }
  }

  if (Object.keys(actions).length === 0) {
    warnings.push("No animations were parsed; generated a placeholder idle -> Default mapping.");
    actions.idle = "Default";
  }

  return actions;
}

async function createNameResolver(root: string): Promise<NameResolver> {
  const metadataPath = path.join(root, "models_data.json");
  const exists = await fileExists(metadataPath);

  if (!exists) {
    return () => undefined;
  }

  const text = await fs.readFile(metadataPath, "utf8");
  const parsed = JSON.parse(text) as unknown;
  const mappings = new Map<string, string>();
  collectNameMappings(parsed, mappings);

  return (relativeDir, stem) => {
    const keys = [
      stem,
      basenameWithoutExtension(stem),
      path.basename(relativeDir),
      relativeDir,
      `${relativeDir}/${stem}`
    ];

    for (const key of keys) {
      const match = mappings.get(normalizeLookupKey(key));

      if (match) {
        return match;
      }
    }

    return undefined;
  };
}

function collectNameMappings(value: unknown, mappings: Map<string, string>, parentKey?: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectNameMappings(item, mappings, parentKey));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const strings = new Map<string, string>();

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string") {
      strings.set(key, child);
    }
  }

  const preferredName = pickPreferredName(strings);
  const lookupKeys = pickLookupKeys(strings, parentKey);

  if (preferredName) {
    lookupKeys.forEach((lookupKey) => mappings.set(normalizeLookupKey(lookupKey), preferredName));
  }

  for (const [key, child] of Object.entries(value)) {
    collectNameMappings(child, mappings, key);
  }
}

function pickPreferredName(strings: Map<string, string>): string | undefined {
  const preferredKeys = [
    "name",
    "name_cn",
    "cn",
    "chinese",
    "displayName",
    "display_name",
    "appellation"
  ];

  for (const key of preferredKeys) {
    const exact = strings.get(key);

    if (exact && isHumanReadableName(exact)) {
      return exact;
    }
  }

  return [...strings.values()].find(isHumanReadableName);
}

function pickLookupKeys(strings: Map<string, string>, parentKey?: string): string[] {
  const keys = parentKey ? [parentKey] : [];
  const preferredKeys = ["id", "charId", "char_id", "modelId", "model_id", "skinId", "skin_id", "prefab"];

  for (const key of preferredKeys) {
    const value = strings.get(key);

    if (value) {
      keys.push(value);
    }
  }

  for (const value of strings.values()) {
    if (looksLikeIdentifier(value)) {
      keys.push(value);
    }
  }

  return unique(keys);
}

function isHumanReadableName(value: string): boolean {
  return value.length > 0 && value.length <= 80 && !/[\\/]/.test(value) && !/\.(skel|json|atlas|png)$/i.test(value);
}

function looksLikeIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_#.-]+$/.test(value) || value.includes("/");
}

function rewriteManifestUrls(
  manifest: ScannedModelManifest,
  baseUrl: string
): ScannedModelManifest {
  return {
    ...manifest,
    files: {
      skel: manifest.files.skel ? joinUrl(baseUrl, manifest.files.skel) : undefined,
      json: manifest.files.json ? joinUrl(baseUrl, manifest.files.json) : undefined,
      atlas: joinUrl(baseUrl, manifest.files.atlas),
      textures: manifest.files.textures.map((texture) => joinUrl(baseUrl, texture))
    }
  };
}

function joinUrl(baseUrl: string, relativePath: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/${encodePath(relativePath)}`;
}

function encodePath(relativePath: string): string {
  return relativePath
    .split("/")
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join("/");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseArgs(args: string[]): ScanOptions {
  if (args[0] !== "scan") {
    throw new Error(usage());
  }

  const root = args[1];

  if (!root || root.startsWith("-")) {
    throw new Error(usage());
  }

  let out = "registry/operators.json";
  let baseUrl: string | undefined;
  let publicOut: string | undefined;
  let publicCopy = true;
  let splitRegistry = false;
  let splitOut: string | undefined;
  let defaultModelId: string | undefined;

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--out") {
      out = readOptionValue(args, index, "--out");
      index += 1;
    } else if (arg === "--base-url") {
      baseUrl = readOptionValue(args, index, "--base-url");
      index += 1;
    } else if (arg === "--public-out") {
      publicOut = readOptionValue(args, index, "--public-out");
      index += 1;
    } else if (arg === "--no-public-copy") {
      publicCopy = false;
    } else if (arg === "--split-registry") {
      splitRegistry = true;
    } else if (arg === "--split-out") {
      splitOut = readOptionValue(args, index, "--split-out");
      index += 1;
    } else if (arg === "--default-model") {
      defaultModelId = readOptionValue(args, index, "--default-model");
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    } else {
      throw new Error(`Unknown option: ${arg}\n${usage()}`);
    }
  }

  const derivedBaseUrl = baseUrl ?? `/${path.basename(path.resolve(root))}`;

  if (!publicOut && publicCopy) {
    const normalizedOut = toPosixPath(out);
    publicOut = normalizedOut.startsWith("public/")
      ? undefined
      : path.join("public", normalizedOut);
  }

  return {
    root,
    out,
    baseUrl: derivedBaseUrl,
    publicOut,
    publicCopy,
    splitRegistry,
    splitOut,
    defaultModelId
  };
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value.\n${usage()}`);
  }

  return value;
}

function usage(): string {
  return [
    "Usage:",
    "  ark-waifu scan <Ark-Models-dir> --out <registry.json> [--base-url <url>] [--split-registry]",
    "",
    "Notes:",
    "  The scanner only includes Ark-Models/models and intentionally skips models_enemies.",
    "",
    "Example:",
    "  pnpm ark-waifu scan ./Ark-Models --out registry/operators.json --base-url /Ark-Models --split-registry"
  ].join("\n");
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function fileExists(filePath: string): Promise<boolean> {
  const stats = await fs.stat(filePath).catch(() => null);
  return Boolean(stats?.isFile());
}

function pickByStem(files: string[], stem: string): string | undefined {
  const normalizedStem = stem.toLowerCase();
  return files.find((file) => basenameWithoutExtension(file).toLowerCase() === normalizedStem);
}

function basenameWithoutExtension(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function fallbackName(stem: string): string {
  return stem.replace(/^build_/, "").replace(/[_-]+/g, " ").replace(/\s+#/g, "#");
}

function createId(relativeDir: string, stem: string): string {
  const source = `${relativeDir}/${stem}`;
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `model-${Date.now()}`;
}

function toActionKey(animationName: string): string {
  const key = animationName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return key || "action";
}

function normalizeLookupKey(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase() ?? value.toLowerCase();
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ark-waifu] ${message}`);
  process.exitCode = 1;
});

export { scanArkModels };
