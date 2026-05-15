# Ark-Waifu

Ark-Waifu is a lightweight web widget for Ark-Models style Spine 3.8 chibi models. It is an MVP replacement path for heavy `live2d-widget` setups, but this first stage intentionally focuses on Spine, not Live2D.

当前版本是 Ark-Models Spine 小人的网页渲染 MVP：用 TypeScript + Vite + PixiJS + `@pixi-spine/all-3.8` 加载模型，支持右下角挂载、拖拽、点击动作、动作面板、动作调度，以及从 Ark-Models 目录批量扫描生成 registry。

## Why Spine First

Ark-Models 解包资源的核心是 Spine 小人，不是 Live2D。第一阶段优先打通 Ark Spine 3.8 的加载、动作播放、路径编码和 CDN 接入链路，避免引入 PHP 后端或一次性加载全量模型。Live2D 可以后续通过新的 adapter 接入。

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
```

`pnpm dev` 会打开 registry preview demo。若还没有生成 `/registry/operators.json`，页面会回退到内置 sample 模型并显示提示。

## Scan Ark-Models

把 Ark-Models 仓库放在本地后，执行：

```bash
pnpm ark-waifu scan ./Ark-Models --out registry/operators.json
```

常用参数：

- `--out`: 写出的 registry 文件，默认 `registry/operators.json`
- `--base-url`: 浏览器访问 Ark-Models 静态资源时使用的基础 URL，默认从目录名推导，例如 `/Ark-Models`
- `--public-out`: 同步写给 Vite demo 读取的 registry 路径
- `--no-public-copy`: 只写 `--out`，不额外写到 `public/`

示例：

```bash
pnpm ark-waifu scan ./Ark-Models --out registry/operators.json --base-url /Ark-Models
```

扫描器会做这些事：

- 扫描 `models`、`models_enemies`，默认排除 `models_illust` 动态立绘目录
- 按目录匹配 `.skel` / Spine `.json`、`.atlas`、`.png`
- 优先根据 atlas page 名称匹配贴图
- 尝试解析 Spine 3.8 skel/json 动画名，并生成 `idle/touch/walk/...` actions
- 处理中文、空格、`#` 等 URL 路径编码
- 尝试从 `models_data.json` 读取名称映射，失败则使用文件名回退
- 对缺失贴图或动作解析失败写入 `warnings`，不直接中断整个扫描

## Registry Demo

扫描完成后运行：

```bash
pnpm dev
```

demo 页面提供：

- 角色列表
- 搜索
- 模型预览
- 动作按钮
- 复制 CDN 配置

当前仓库临时打包了一个 sample 模型，方便验证加载链路。正式接入时仍建议通过 manifest/registry 指向你自己托管的 Ark-Models 资源，不要把官方素材塞进库包。

## Manifest Format

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

约束：

- `type` 当前只支持 `ark-spine`
- `files.skel` 和 `files.json` 至少提供一个
- `files.atlas` 必填
- `files.textures` 必须是非空数组
- `actions` 至少要有一个动作映射

## CDN Usage

最短一行引入：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.1/dist/ark-waifu.iife.js" data-manifest="/models/sample/manifest.json" data-action-panel="true"></script>
```

如果你使用 registry demo 的 “Copy CDN config”，它会复制一段包含当前模型 manifest 的 CDN 配置，适合静态页面快速测试。

可用 `data-*`：

- `data-auto`: 是否自动挂载，默认 `true`
- `data-manifest`: manifest 地址
- `data-width`: 挂件宽度
- `data-height`: 挂件高度
- `data-z-index`: 层级
- `data-draggable`: 是否可拖拽，默认 `true`
- `data-hit-test`: 是否启用命中检测，默认 `true`
- `data-click-action`: 点击触发动作名，默认 `touch`；传 `false` 可关闭
- `data-action-panel`: 是否渲染动作按钮面板
- `data-action-schedule`: JSON 字符串，格式为 `ActionScheduleItem[]`

## ESM Usage

```ts
import { mountArkWaifu } from "ark-waifu";

const mounted = mountArkWaifu({
  manifestUrl: "/models/sample/manifest.json",
  draggable: true,
  clickAction: "touch",
  actionPanel: true,
  actionSchedule: [{ action: "special", intervalMs: 30000 }]
});

mounted.ready.catch((error) => {
  console.error("Ark-Waifu mount failed", error);
});
```

## API

- `loadManifest(manifestUrl)`: 加载 manifest，并基于 manifest URL 解析资源路径
- `mountArkWaifu(options)`: 创建并挂载 widget，返回 `{ widget, ready, actionPanel? }`
- `resolveManifestAssetUrls(manifest, manifestUrl)`: 解析相对资源路径，处理 `#` 与空格
- `ArkWaifuWidget`: 手动实例化，支持 `load`、`play`、`schedule`、`clearSchedule`、`destroy`

## Current Limits

- 当前是 MVP，不宣称完整支持所有 Ark-Models 资源
- 只支持 Spine 3.8 runtime；其他 Spine 版本需要额外 adapter 或兼容层
- Live2D 尚未实现
- 名称映射依赖 `models_data.json` 的实际结构，无法匹配时会回退文件名
- skel 动画解析依赖 `@pixi-spine/all-3.8`，解析失败会生成 warning
- registry 只引用资源路径，不复制完整 Ark-Models

## Known Issues

- Pixi Spine 3.x 在 Node 扫描时会输出 PixiJS deprecation warning，这是上游 runtime 注册 loader 的提示，不影响 registry 生成
- 浏览器侧必须能以正确 MIME 返回 `.skel`、`.atlas`、`.png`；如果服务器把 `.skel` 返回成 HTML，会出现 “Spine data was not parsed”
- 路径里有 `#`、空格或中文时必须使用扫描器生成的编码 URL，手写路径容易被浏览器截断

## Publish to CDN

发布 npm 包：

```bash
pnpm build
npm pack --dry-run
npm publish --access public
```

发布后可以通过 jsDelivr 或 unpkg 引入：

```html
<script src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.1/dist/ark-waifu.iife.js"></script>
```

模型资源需要你自己托管，例如把 Ark-Models 静态目录部署到 `/Ark-Models`，再用扫描器生成：

```bash
pnpm ark-waifu scan ./Ark-Models --out registry/operators.json --base-url /Ark-Models
```

把生成的 registry 和 Ark-Models 静态资源一起发布，demo 或业务页面即可读取这些 manifest 路径。

## Next Steps

- 为扫描器补更多 Ark-Models 目录结构样本测试
- 增加可导出的单模型 manifest 文件，方便 CDN `data-manifest` 一行接入
- 增加动作别名配置，让不同模型的动作命名更稳定
- 增加 Spine runtime 版本探测和多版本 adapter
- 后续再考虑 Live2D adapter，而不是混在当前 Spine MVP 里

## License

MIT
