# Ark-Waifu

一个面向网页场景的轻量看板娘组件，当前聚焦 Ark-Models 风格的 Spine 3.8 资源加载与渲染。

Ark-Waifu 提供两种使用方式：

- 作为 npm 库按需集成（ESM）
- 通过 CDN 一行脚本自动挂载（IIFE）

## Features

- 支持 Ark-Models 常见的 Spine manifest 资源描述
- 支持 skel/json 骨骼文件 + atlas + textures 组合
- 内置拖拽、点击动作、动作定时调度、基础交互状态机
- 支持 relax 默认待机、可选 CSS 盒子坐下检测、独立气泡台词 JSON
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
  actionSchedule: [{ action: "special", intervalMs: 30000 }],
  defaultAction: "auto",
  sitTargets: ".ark-waifu-sit-target",
  tipsUrl: "/registry/waifu-tips.sample.json"
});

mounted.ready.catch((error) => {
  console.error("Ark-Waifu mount failed", error);
});
```

### CDN（推荐给静态页面）

```html
<script
    src="https://cdn.jsdelivr.net/npm/ark-waifu@0.1.7/dist/ark-waifu.iife.js"
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
- data-default-action: 默认循环动作，默认 auto；auto 会优先 relax，其次 idle
- data-sit-targets: 允许坐下的 CSS selector，多个 selector 用英文逗号分隔
- data-sit-options: JSON 字符串，可配置 hoverMs、durationMs、cooldownMs、minOverlapRatio
- data-dialogue-url: 气泡台词 JSON 地址
- data-tips-url: Spine 版 waifu-tips JSON 地址，用于根据网页 DOM 事件显示气泡并触发动作
- data-bubble-duration-ms: 气泡显示时长（数字，毫秒）

### Tips JSON

Tips JSON 可以同时包含模型状态台词和网页 DOM 事件规则，不写入模型 manifest。示例：

```json
{
  "version": 1,
  "lines": {
    "load": ["博士，我准备好了。"],
    "relax": ["先在这里休息一下。"],
    "sit": ["这个位置看起来不错。"],
    "stand": ["休息结束，继续工作吧。"],
    "click": ["嗯？博士有什么安排吗？"],
    "error": ["资源好像没有加载成功。"]
  },
  "rules": [
    {
      "event": "load",
      "text": ["欢迎来到这个博客页面。"]
    },
    {
      "selector": "a",
      "event": "mouseenter",
      "text": ["要打开这个链接吗？"],
      "action": "touch"
    },
    {
      "selector": ".ark-waifu-sit-target",
      "event": "settle",
      "text": ["这里可以坐一会儿。"],
      "action": "sit",
      "delayMs": 3000,
      "cooldownMs": 6000
    }
  ]
}
```

如果只需要状态台词，也可以继续使用 `data-dialogue-url` 指向只包含 `lines` 的 JSON。缺少某个事件的台词时会静默跳过，不影响模型加载。

`event` 当前支持 `load`、`click`、`mouseenter`、`mouseleave`、`focus`、`blur`、`settle`。动作不存在时只显示文本并跳过动作。

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

当前 `index.html` 是本地 CDN 预览页。要用 `pnpm dev` 测试 IIFE，需要先构建一次：

```bash
pnpm build
pnpm dev
```

此时首页会从 `dist/ark-waifu.iife.js` 读取真实 IIFE 产物。也可以用 `pnpm preview` 测试完整 `dist` 静态站：

```bash
pnpm build
pnpm preview
```

外部测试页可引用本地构建产物，例如：

```html
<script
  src="http://127.0.0.1:4173/ark-waifu.iife.js"
  data-registry="http://127.0.0.1:4173/registry/operators.json"
  data-model="models-358-lisa-build-char-358-lisa"
  data-cdn="osyb"
  data-default-action="auto"
  data-tips-url="http://127.0.0.1:4173/registry/waifu-tips.sample.json"
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
- CSS 盒子坐下检测只扫描显式配置的 selector，不会自动识别整页布局
- 坐下姿态会重新计算模型 transform，但个别资源的动画边界如果本身不完整，仍可能需要单独调整 manifest scale/position

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
