# Ark-waifu

English | [中文](#中文说明)

Ark-waifu is a lightweight TypeScript widget experiment for rendering small character models on web pages. The first MVP targets Ark-Models style Spine 3.8 assets and places a chibi model in the bottom-right corner of the page.

The npm/CDN build includes one temporary sample model for out-of-the-box testing. Production use should still load user-owned model files through a manifest.

## CDN One-Liner

After publishing to npm, the browser IIFE bundle can be used with one script tag:

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js"></script>
```

That line auto-loads the packaged sample manifest. To use your own model:

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/my-operator/manifest.json"></script>
```

The script also exposes `window.ArkWaifu` with `ArkWaifuWidget`, `mountArkWaifu`, and `loadManifest`.

Optional CDN attributes:

```html
<script
  src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js"
  data-action-panel="true"
  data-click-action="touch"
  data-draggable="true"
  data-action-schedule='[{"action":"special","intervalMs":30000}]'
></script>
```

- `data-action-panel="true"` renders a small action button panel from manifest actions.
- `data-click-action="touch"` plays an action when the user clicks the visible model bounds. Use `"false"` to disable.
- `data-draggable="true"` lets the user drag the widget.
- `data-action-schedule` accepts JSON action timers, for example recurring `special` every 30 seconds.

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
pnpm build:demo
pnpm build:lib
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

For Ark-Models folders, texture pages are resolved in this order: exact manifest texture path, matching texture filename, atlas-relative fallback, then skeleton-relative fallback.

## Ark-Models Integration

1. Export or locate the operator Spine files from your local Ark-Models copy.
2. Serve those files from your site or Vite public directory, for example `public/models/amiya/`. During local Vite development, `/src/models/...` also works for quick testing through the local model dev server in `vite.config.ts`.
3. Update the manifest paths to point at the `.skel` or `.json`, `.atlas`, and texture `.png` files.
4. Map widget actions to animation names that exist in that model.

The demo manifest points at `/models/sample/`, which is copied from `public/models/sample/` into `dist/models/sample/` during build. The old `/src/models/...` dev path is still supported by local middleware for quick experiments, but production manifests should use static assets or a remote CDN.

## Current Limits

- MVP supports only `type: "ark-spine"`.
- No Live2D support yet.
- No PHP backend or remote model index is included.
- One temporary sample model is included for out-of-the-box testing.
- Only one widget/model is managed at a time.
- Texture paths inside `.atlas` are resolved from manifest texture paths, atlas-relative paths, or skeleton-relative paths, but files still need to be served with valid browser CORS rules.
- File names containing `#` must be URL-encoded by the loader as `%23`; the adapter handles this for manifest paths and atlas page names.

## Known Issues

- This project pins PixiJS 6 with `@pixi-spine/all-3.8` 3.x because pixi-spine's compatibility guidance maps PixiJS v5/v6 to pixi-spine v3.x and PixiJS v7 to v4.x.
- Binary `.skel` loading depends on the pixi-spine 3.8 loader being able to parse the exported asset. If a specific Ark-Models file fails, the next step is to add a custom Spine 3.8 binary loader path and atlas resolver instead of relying only on Pixi Loader metadata.
- Spine animation names differ by model. Missing action mappings warn in the console rather than crashing.

## How To Publish For CDN

Recommended path:

1. Run `pnpm build`.
2. Check the package contents:

```bash
npm pack --dry-run
```

3. Publish to npm:

```bash
npm login
npm publish --access public
```

4. Use jsDelivr or unpkg:

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

The package currently includes a sample model under `dist/models/sample/` for first-run testing. Real model files should normally be hosted by the site owner and referenced by `data-manifest`.

## Next Steps

- Add a small model picker/registry API for multiple user-provided manifests.
- Improve hit testing from rectangular bounds to actual Spine slot/attachment picking.
- Add Live2D as a separate adapter after the Spine MVP is stable.

---

# 中文说明

Ark-waifu 是一个轻量网页看板娘框架实验项目。第一阶段 MVP 只面向 Ark-Models 风格的 Spine 3.8 小人，在网页右下角显示模型并支持基础动作切换。

当前 npm/CDN 构建会临时包含一个测试模型，方便开箱即用。正式使用时仍建议通过 manifest 加载使用者自己托管的模型资源。

## 一句话 CDN 引入

如果你是新手小白，可以直接在 HTML 文件的 `body` 末尾加入下面这一句话：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js"></script>
```

这会自动加载包内置 sample 模型。使用你自己的模型时写：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/my-operator/manifest.json"></script>
```

脚本会挂载全局对象 `window.ArkWaifu`，提供 `ArkWaifuWidget`、`mountArkWaifu` 和 `loadManifest`。

可选 CDN 属性：

```html
<script
  src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js"
  data-action-panel="true"
  data-click-action="touch"
  data-draggable="true"
  data-action-schedule='[{"action":"special","intervalMs":30000}]'
></script>
```

- `data-action-panel="true"` 会根据 manifest actions 生成动作按钮面板。
- `data-click-action="touch"` 点击模型可见区域时播放指定动作；设为 `"false"` 可关闭。
- `data-draggable="true"` 允许拖拽看板娘。
- `data-action-schedule` 接收 JSON 动作定时配置，例如每 30 秒播放一次 `special`。

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
pnpm build:demo
pnpm build:lib
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

针对 Ark-Models 目录，纹理页按以下顺序解析：manifest 中的完整纹理路径、同名文件匹配、相对 atlas 路径、相对 skeleton 路径。

## 接入 Ark-Models

1. 从你本地的 Ark-Models 资源中找到或导出某个角色的 Spine 文件。
2. 将 `.skel` 或 `.json`、`.atlas`、`.png` 放到你自己的网站静态目录、CDN 或 Vite `public/models/...` 下。本地开发时也可以临时放到 `/src/models/...`，当前 `vite.config.ts` 已提供本地 dev middleware。
3. 修改 manifest 中的资源路径。
4. 将 `actions` 映射到这个模型真实存在的动画名。

demo manifest 当前指向 `/models/sample/`，对应 `public/models/sample/`，构建后会复制到 `dist/models/sample/`。`/src/models/...` 仍可用于本地临时测试，但生产环境应使用静态目录、远程 CDN 或其他资源服务。

## 当前限制

- MVP 只支持 `type: "ark-spine"`。
- 暂不支持 Live2D。
- 不包含 PHP 后端或远程模型索引。
- 当前临时包含一个测试模型，用于开箱即用。
- 当前只管理一个 widget/model。
- `.atlas` 里的纹理页会按 manifest、atlas 相对路径、skeleton 相对路径解析，但资源服务仍需满足浏览器 CORS 要求。
- 文件名包含 `#` 时需要按 URL 语义编码为 `%23`；当前 adapter 会处理 manifest 路径和 atlas 页名。

## 已知问题

- 当前固定使用 PixiJS 6 + `@pixi-spine/all-3.8` 3.x，因为 pixi-spine 兼容表中 PixiJS v5/v6 对应 pixi-spine v3.x。
- 二进制 `.skel` 是否能加载取决于 pixi-spine 3.8 runtime 是否能解析该资源。如果某些 Ark-Models 文件失败，下一步应补自定义 Spine 3.8 binary loader 和 atlas resolver。
- 不同模型动画名不同。manifest 里配置了不存在的动画时只 warning，不会让页面崩溃。

## 如何发布为 CDN

推荐发布路径：

1. 执行构建：

```bash
pnpm build
```

2. 检查 npm 包内容：

```bash
npm pack --dry-run
```

3. 发布到 npm：

```bash
npm login
npm publish --access public
```

4. 发布后即可通过 jsDelivr 或 unpkg 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.0/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json"></script>
```

当前包内置 sample 模型用于首次测试。真实模型文件建议由站点使用者自行托管，并通过 `data-manifest` 指定。

## 下一步

- 增加多个 manifest 的注册表加载器或模型选择器。
- 将点击命中从矩形边界升级为 Spine slot/attachment 级命中。
- 优化 Ark-Models 目录结构下的 atlas 纹理解析。
- 增加拖拽、点击命中和动作调度。
- Spine MVP 稳定后，再增加 Live2D adapter。
