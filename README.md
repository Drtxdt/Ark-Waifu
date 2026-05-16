# Ark-Waifu

一个面向网页场景的轻量看板娘组件，当前聚焦 Ark-Models 风格的 Spine 3.8 资源加载与渲染。

Ark-Waifu 提供两种使用方式：

- 作为 npm 库按需集成（ESM）
- 通过 CDN 一行脚本自动挂载（IIFE）

## Features

- 支持 Ark-Models 常见的 Spine manifest 资源描述
- 支持 skel/json 骨骼文件 + atlas + textures 组合
- 内置拖拽、点击动作、动作定时调度
- 提供可选动作面板
- 提供全局 API 与模块化 API
- 内置 sample 模型，开箱可验证链路

## Install

```bash
pnpm install
```

## Quick Start

### 1) 本地开发

```bash
pnpm dev
```

启动后访问 Vite 本地地址，组件会在页面右下角挂载示例模型。

### 2) 构建

```bash
pnpm build
```

构建会生成：

- ESM 库产物：dist/ark-waifu.es.js
- IIFE 浏览器产物：dist/ark-waifu.iife.js
- 类型声明：dist/index.d.ts

## Usage

### ESM（推荐给工程项目）

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

### CDN（推荐给静态页面）

```html
<script
    src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.6/dist/ark-waifu.iife.js"
    data-registry="/registry/operators.json"
    data-model="models-358-lisa-build-char-358-lisa"
    data-cdn="osyb"
  ></script>
```

如果不传 data-manifest，脚本会默认尝试加载同目录下的 ./models/sample/manifest.json。

## CDN Dataset Options

- data-auto: 是否自动挂载，默认 true；传 false 可关闭自动挂载
- data-manifest: manifest 地址
- data-width: 挂件宽度（数字）
- data-height: 挂件高度（数字）
- data-z-index: 层级（数字）
- data-draggable: 是否可拖拽，默认 true
- data-hit-test: 是否启用命中检测，默认 true
- data-click-action: 点击触发动作名，默认 touch；传 false 可关闭
- data-action-panel: 是否渲染动作面板，默认 false
- data-action-schedule: JSON 字符串，格式为 ActionScheduleItem[]

## Manifest Spec

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

字段约束：

- type 当前仅支持 ark-spine
- files 至少包含 skel 或 json 二者之一
- files.atlas 必填
- files.textures 必须为非空数组
- actions 必须至少包含一个动作映射

## API

### loadManifest(manifestUrl)

- 加载远程 manifest JSON
- 返回 Promise<ModelManifest>
- 自动将资源路径解析为绝对 URL

### mountArkWaifu(options)

- 创建并挂载组件实例
- 返回 { widget, ready, actionPanel? }
- ready 为加载完成 Promise

### resolveManifestAssetUrls(manifest, manifestUrl)

- 基于 manifestUrl 解析 files 下的相对路径
- 处理 # 与空格的 URL 编码

### ArkWaifuWidget

可直接 new ArkWaifuWidget(options) 并手动调用：

- load(manifest)
- play(action)
- schedule(items)
- clearSchedule()
- destroy()

## Development

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
```

### 本地测试 CDN/IIFE 版本

`pnpm dev` 测的是源码入口，不等同于 npm CDN 的 `dist/ark-waifu.iife.js`。本地测试 CDN 版本按下面做：

```bash
pnpm build
pnpm preview
```

然后在测试页里引用本地构建产物，例如：

```html
<script
  src="http://127.0.0.1:4173/ark-waifu.iife.js"
  data-registry="http://127.0.0.1:4173/registry/operators.json"
  data-model="models-358-lisa-build-char-358-lisa"
  data-cdn="osyb"
></script>
```

如果要测试 npm 包内容，先执行：

```bash
npm pack --dry-run
```

确认 tarball 里包含 `dist/ark-waifu.iife.js` 和 `dist/registry/operators.json` 后再发布。

## Compatibility Notes

- 当前定位 MVP，仅支持 type: ark-spine
- 暂不支持 Live2D
- 依赖 PixiJS 6 + @pixi-spine/all-3.8 3.x
- 动画名由模型决定，manifest 映射不存在时会告警而非崩溃

## Project Structure

```text
src/
  adapters/spine/      # Spine 适配层
  core/                # Widget、类型、manifest 校验
  registry/            # 示例 manifest
  cdn.ts               # IIFE 入口（window.ArkWaifu）
  index.ts             # ESM 入口
public/models/sample/  # 示例模型资源
```

## Publish

```bash
pnpm build
npm pack --dry-run
npm publish --access public
```

发布后可通过 jsDelivr 或 unpkg 引入 dist/ark-waifu.iife.js。

## Contributing

欢迎提交 Issue 与 Pull Request。提交前建议先执行：

```bash
pnpm typecheck
pnpm build
```

## Thanks

感谢以下仓库或者开发人员

灵感来源：[stevenjoezhang/live2d-widget: 把萌萌哒的看板娘抱回家 (ノ≧∇≦)ノ | Live2D widget for web platform](https://github.com/stevenjoezhang/live2d-widget)

模型来源：[isHarryh/Ark-Models: Arknights Spine Models (Excerpt) | 明日方舟Spine动画小人模型(节选)](https://github.com/isHarryh/Ark-Models)

## License

MIT
