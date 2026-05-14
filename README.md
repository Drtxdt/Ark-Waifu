# Ark-waifu

English | [中文](#中文说明)

Ark-waifu is a lightweight TypeScript widget experiment for rendering small character models on web pages. The first MVP targets Ark-Models style Spine 3.8 assets and places a chibi model in the bottom-right corner of the page.

This project does not bundle Arknights official assets. Model files are loaded only from paths supplied by a user-owned manifest.

## CDN One-Liner

Planned CDN usage after publishing:

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

The current repo is still an MVP app/demo. To make this CDN line work, publish a browser bundle that exposes a global initializer and load model resources from your own manifest path.

## Why Spine First

Traditional `live2d-widget` style projects focus on Live2D and often pair the widget with heavier resource APIs. Ark-Models exports are mainly Spine resources, and many operator chibi assets are Spine 3.8 era files. The first milestone therefore avoids Live2D and PHP backends and proves a minimal browser-side Spine pipeline first.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
```

## Manifest Format

Models are described by JSON manifests:

```json
{
  "id": "sample-ark-operator",
  "name": "Sample Ark Operator",
  "type": "ark-spine",
  "version": "spine-3.8",
  "files": {
    "skel": "/models/sample/model.skel",
    "atlas": "/models/sample/model.atlas",
    "textures": ["/models/sample/model.png"]
  },
  "actions": {
    "idle": "Default",
    "touch": "Interact",
    "walk": "Move"
  },
  "scale": 0.5,
  "position": {
    "x": 0.5,
    "y": 1.0
  }
}
```

`files.skel` is preferred for Ark-Models style binary skeletons. `files.json` can be used for JSON skeletons when the runtime can parse the export. `actions` maps widget-level action names to real Spine animation names.

## Ark-Models Integration

1. Export or locate the operator Spine files from your local Ark-Models copy.
2. Serve those files from your site or Vite public directory, for example `public/models/amiya/`. During local Vite development, `/src/models/...` also works for quick testing through the local model dev server in `vite.config.ts`.
3. Update the manifest paths to point at the `.skel` or `.json`, `.atlas`, and texture `.png` files.
4. Map widget actions to animation names that exist in that model.

The demo manifest points at `/src/models/sample/` for local testing. The Vite dev middleware serves that folder directly so `.skel`, `.atlas`, and file names containing `#` are not rewritten to `index.html`. For production builds, prefer `public/models/...` or a remote asset host because `src` files are normally part of the application source pipeline.

## Current Limits

- MVP supports only `type: "ark-spine"`.
- No Live2D support yet.
- No PHP backend or remote model index is included.
- No official game assets are included.
- Only one widget/model is managed at a time.
- Texture paths inside `.atlas` still need to be compatible with the served files and browser CORS rules.
- File names containing `#` must be URL-encoded by the loader as `%23`; the adapter handles this for manifest paths and atlas page names.

## Known Issues

- This project pins PixiJS 6 with `@pixi-spine/all-3.8` 3.x because pixi-spine's compatibility guidance maps PixiJS v5/v6 to pixi-spine v3.x and PixiJS v7 to v4.x.
- Binary `.skel` loading depends on the pixi-spine 3.8 loader being able to parse the exported asset. If a specific Ark-Models file fails, the next step is to add a custom Spine 3.8 binary loader path and atlas resolver instead of relying only on Pixi Loader metadata.
- Spine animation names differ by model. Missing action mappings warn in the console rather than crashing.

## How To Publish For CDN

Recommended path:

1. Add a library entry such as `src/index.ts` that exports `ChibiDockWidget` and a small `mountArkWaifu(options)` helper.
2. Add a Vite library build that emits ESM and IIFE bundles, for example `dist/ark-waifu.es.js` and `dist/ark-waifu.iife.js`.
3. Add package metadata:
   - `main`: `dist/ark-waifu.iife.js`
   - `module`: `dist/ark-waifu.es.js`
   - `types`: `dist/index.d.ts`
   - `files`: `["dist", "README.md", "LICENSE"]`
4. Run `pnpm build`, then publish to npm with `npm publish --access public`.
5. Use jsDelivr or unpkg:

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

Model files should be hosted by the site owner, not bundled into the npm package.

## Next Steps

- Add a small manifest registry loader for multiple user-provided manifests.
- Add the library/IIFE build needed for real one-line CDN usage.
- Improve atlas texture resolution for Ark-Models folder layouts.
- Add optional drag, click hit testing, and action scheduling.
- Add Live2D as a separate adapter after the Spine MVP is stable.

---

# 中文说明

Ark-waifu 是一个轻量网页看板娘框架实验项目。第一阶段 MVP 只面向 Ark-Models 风格的 Spine 3.8 小人，在网页右下角显示模型并支持基础动作切换。

本项目不内置任何明日方舟官方素材。模型文件必须由使用者通过 manifest 指定本地或远程资源路径。

## 一句话 CDN 引入

发布为 npm 包后，目标用法如下：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

当前仓库还是 MVP demo。要让这行 CDN 引入真正可用，需要增加浏览器 IIFE 包，并让它读取 `data-manifest` 后自动创建 widget。

## 为什么先做 Spine

传统 `live2d-widget` 主要围绕 Live2D，并且常常配套较重的资源 API。Ark-Models 的重点资源是 Spine，小人资源也多是 Spine 3.8 时代文件。因此第一阶段先不做 Live2D，也不接 PHP 后端，只把浏览器端 Spine 加载和渲染链路跑通。

## 安装

```bash
pnpm install
```

## 运行

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
```

## Manifest 格式

模型通过 JSON manifest 描述：

```json
{
  "id": "sample-ark-operator",
  "name": "Sample Ark Operator",
  "type": "ark-spine",
  "version": "spine-3.8",
  "files": {
    "skel": "/models/sample/model.skel",
    "atlas": "/models/sample/model.atlas",
    "textures": ["/models/sample/model.png"]
  },
  "actions": {
    "idle": "Default",
    "touch": "Interact",
    "walk": "Move"
  },
  "scale": 0.5,
  "position": {
    "x": 0.5,
    "y": 1.0
  }
}
```

`files.skel` 优先用于 Ark-Models 常见的二进制骨骼文件。`files.json` 可用于 JSON 骨骼文件。`actions` 用来把 widget 层动作名映射到真实 Spine 动画名。

## 接入 Ark-Models

1. 从你本地的 Ark-Models 资源中找到或导出某个角色的 Spine 文件。
2. 将 `.skel` 或 `.json`、`.atlas`、`.png` 放到你自己的网站静态目录、CDN 或 Vite `public/models/...` 下。本地开发时也可以临时放到 `/src/models/...`，当前 `vite.config.ts` 已提供本地 dev middleware。
3. 修改 manifest 中的资源路径。
4. 将 `actions` 映射到这个模型真实存在的动画名。

demo manifest 当前指向 `/src/models/sample/`，方便本地测试。生产环境建议改为 `/models/...`、远程 CDN 或其他静态资源服务，不建议依赖 `src` 目录。

## 当前限制

- MVP 只支持 `type: "ark-spine"`。
- 暂不支持 Live2D。
- 不包含 PHP 后端或远程模型索引。
- 不包含任何官方游戏素材。
- 当前只管理一个 widget/model。
- `.atlas` 里的纹理页名称必须能和 manifest 中的纹理路径匹配。
- 文件名包含 `#` 时需要按 URL 语义编码为 `%23`；当前 adapter 会处理 manifest 路径和 atlas 页名。

## 已知问题

- 当前固定使用 PixiJS 6 + `@pixi-spine/all-3.8` 3.x，因为 pixi-spine 兼容表中 PixiJS v5/v6 对应 pixi-spine v3.x。
- 二进制 `.skel` 是否能加载取决于 pixi-spine 3.8 runtime 是否能解析该资源。如果某些 Ark-Models 文件失败，下一步应补自定义 Spine 3.8 binary loader 和 atlas resolver。
- 不同模型动画名不同。manifest 里配置了不存在的动画时只 warning，不会让页面崩溃。

## 如何发布为 CDN

推荐发布路径：

1. 新增 `src/index.ts`，导出 `ChibiDockWidget`，并提供一个 `mountArkWaifu(options)` 便捷函数。
2. 配置 Vite library build，输出：
   - `dist/ark-waifu.es.js`
   - `dist/ark-waifu.iife.js`
3. 在 `package.json` 增加：
   - `main`: `dist/ark-waifu.iife.js`
   - `module`: `dist/ark-waifu.es.js`
   - `types`: `dist/index.d.ts`
   - `files`: `["dist", "README.md", "LICENSE"]`
4. 执行 `pnpm build`。
5. 发布到 npm：

```bash
npm login
npm publish --access public
```

6. 发布后即可通过 jsDelivr 或 unpkg 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

模型文件不要随 npm 包发布，应由站点使用者自行托管。

## 下一步

- 增加多个 manifest 的注册表加载器。
- 增加真正面向 CDN 的 library/IIFE 构建。
- 优化 Ark-Models 目录结构下的 atlas 纹理解析。
- 增加拖拽、点击命中和动作调度。
- Spine MVP 稳定后，再增加 Live2D adapter。
