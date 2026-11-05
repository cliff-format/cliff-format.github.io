# cliff-format.github.io

CLIFF 官网：<https://cliff-format.github.io>。站点用 Astro 构建，产物是纯静态文件，由 GitHub Pages 托管。

## 结构

```text
src/
├─ components/          页面组件；sections/ 放营销页的五个区块
├─ i18n.ts              本地化入口：读取 src/locales/*.cliff，按语言渲染
├─ layouts/             BaseLayout：主题解析、字体预载、hreflang、全局样式入口
├─ locales/             站点文案；一个目标语言一个文件
├─ pages/               路由：index.astro 是中文页，[lang]/index.astro 承载其余语言
├─ scripts/             客户端行为：主题切换、玻璃光学、语言菜单、复制
└─ styles/
   ├─ app.css           Tailwind + 设计系统的唯一入口
   ├─ tokens.css        字体、字号角色、间距、形状、动效 token
   ├─ field-font.css    背景 Field Sans 字体的 @font-face
   ├─ graphite.css      Material 3 色彩角色与玻璃材质
   ├─ base.css          结构与组件；不声明任何字体属性
   ├─ typography.css    字号、字重、行高的唯一来源
   └─ site.css          站点级一次性修正
```

正文只用两族：Smiley Sans（得意黑）承担全部文案与界面，JetBrains Mono 只用于文件内容与安装命令。背景装饰字符例外：使用一份合并的 OFL **Field Sans**——Noto Sans 提供全部拉丁与西里尔（含 4 个拉丁扩展字符），Noto Sans KR 提供 CJK、日文假名与韩文；共 126 字，合并为一个字体文件，背景不再使用 Smiley。Field Sans 的每个字形固定 1em advance，背景字重由 400 合成到 600。正文的字重只有 400。

玻璃用 [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) 的 data-URI SVG 位移滤镜：每个面板生成 `feImage` 法线图和 `feDisplacementMap`，通过 `backdrop-filter` 直接折弯真实背景；没有场景复制、canvas 或 WebGL。Chromium 渲染滤镜，Safari 与 Firefox 保留透明 tint、顶部光和阴影的 fallback。玻璃默认不模糊（blur 0），圆角与页头统一 40px。结构约定见 [docs/style.md](docs/style.md)，许可声明见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 命令

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm check      # astro check
pnpm build      # 输出到 dist/
pnpm preview
```

字体子集在文案变化后重建，产物需要提交：

```bash
python -m pip install fonttools brotli
python scripts/subset-font.py path/to/SmileySans-Oblique.ttf.woff2
python scripts/subset-field-font.py      # 背景字符；用 ../.tools/noto 的 KR VF 与拉丁 Noto Sans
python scripts/subset-code-font.py       # JetBrains Mono 400
python scripts/noto-unicode-range.py     # 同步 Noto Sans SC 的 unicode-range
```

所有字体都从 `public/fonts/` 同源提供；页面不请求 Google Fonts 或任何第三方字体 CDN。背景与正文都不需要运行时字体下载。

## 性能

首屏保持约 1,000 个 DOM 节点。本地基础字体是 3 个（Smiley、JetBrains 400、Field Sans，合计约 84 KB），韩语和阿拉伯语页面再加自己的正文字体。背景是纯文本行 + 固定方格 Field Sans，CSS 只用 transform 做循环；没有 Canvas、运行时字形测量或第三方字体请求。不要恢复逐字 `<span>`。玻璃滤镜是增强项，在 `load` 后才生成，不要改回首屏同步初始化。

```bash
CPU=4 node scripts/perf-probe.mjs        # 节点数、DCL、LCP、字体与长任务
CPU=4 ROUTE="/?t=dark" node scripts/perf-probe.mjs
```

## 本地化

十种语言，文案全部在 `src/locales/<locale>/site.cliff` 里，由 `@cliff-format/i18n` 在构建时渲染：

| 语言 | 路由 | 目录 |
|---|---|---|
| 中文 | `/` | `zh-CN/` |
| English | `/en/` | `en-US/` |
| 日本語 | `/ja/` | `ja-JP/` |
| 한국어 | `/ko/` | `ko-KR/` |
| العربية | `/ar/` | `ar/` |
| Español | `/es/` | `es-ES/` |
| Français | `/fr/` | `fr-FR/` |
| Português | `/pt/` | `pt-BR/` |
| Русский | `/ru/` | `ru-RU/` |
| Deutsch | `/de/` | `de-DE/` |

- 布局按规范推荐（§11.1）：每种目标语言一个目录，一个 clan 一个文件。
- 一个文件 = 一个目标语言。`zh-CN/site.cliff` 是源文件，只有 `source`、不带 `target`（运行时回退到 source），其余九份是它的译文；每份都声明 `source-language: zh-CN` 与自己的 `target-language`。
- 阿拉伯语是 RTL：`<html dir="rtl">`，布局靠逻辑属性镜像，代码块与命令保持 LTR。
- 条目 ID 在文件内全局唯一，所以带上分组前缀：`<hero-title-1>`、`<footer-legal>`。分组仍是 `[hero]`、`[footer]`，负责类型继承与作用域。
- `source` 可以带 ICU 占位符（`{year}`、`{type}`），调用处传参；值原样插入，含 HTML 时用 `set:html`。
- 页头语言菜单列出全部语言；`BaseLayout` 为每种语言输出 `hreflang` 与 `og:locale:alternate`，sitemap 覆盖全部路由。
- `missing: "throw"`：条目 ID 写错或漏译，构建直接失败。

改完文案跑审计；新增语言用 `add-locale`（读 zh-CN 的 source，按 JSON 映射写入译文）：

```bash
node scripts/check-locales.mjs                       # 校验 + 逐语言统计 + 渲染样例
node scripts/add-locale.mjs ja-JP path/to/ja.json    # {"entry-id": "译文"}
```

## 截图与检查

截图与审计脚本用本机 Edge，复用同级 `cliff-js` 的 Playwright 安装；用 `PLAYWRIGHT_PATH` 指向别处，用 `PORT` 指向运行中的服务。

```bash
node scripts/capture.mjs "/?t=dark&static=1" shots/hero-dark.png 1440 950 0 1
node scripts/audit.mjs                  # 字号、字重、字族统计与溢出检查
node scripts/filmstrip.mjs shots/film   # 首屏入场逐帧
```

`?static=1` 关闭入场动画与过渡，`?t=light|dark` 强制主题。

## 约定

- 主题默认深色，选择保存在 `cliff-theme`；`?t=` 可以强制指定。
- 文案与界面用 Smiley Sans 400，代码用 JetBrains Mono 400；韩语与阿拉伯语用 Noto Sans KR / Noto Sans Arabic 的子集（得意黑没有这两套字符），由 `unicode-range` 限定在各自脚本内。背景装饰字符用 Field Sans（Noto Sans + Noto Sans KR 合并），400 合成到 600；这是唯一例外。不要新增其它字号或字重，改用 [docs/style.md](docs/style.md) 里的角色。
- 页面动效只有两类：首屏一次性入场、用户操作后的反馈。不要用滚动触发。
- 新的面板用 `.pane` > `.pane-surface`；`src/scripts/glass.ts` 只写入内联 `backdrop-filter`，不注入子层。`.pane-surface` 只放内容，不要写底色、边框或阴影。不要给玻璃加手写描边；圆角用 `corner-shape: squircle`，面板统一 40px。
- 背景是 `BackgroundText.astro` 的随机多语言字符行：整体 -20°，奇偶行反向；不要改回点阵背景。每行是纯文本，1.636em 方格由固定 advance 字体加 `letter-spacing` 形成，禁止逐字包裹 `<span>`。
- 页头吸顶：`body` 只能 `overflow-x: clip`（`hidden` 会造出滚动容器、让 sticky 失效）；下拉菜单走 Popover API 进顶层，避免被页头的圆角与层叠顺序裁掉。
- 按钮直接加 `.btn`；`.btn-ghost` 会得到小尺寸位移滤镜，主按钮是品牌绿实色。不要再包玻璃层，也不要加硬边框。
- 规范、风格指南与设计取舍的正文不在本仓库维护，页脚直接链接到 `cliff-format/cliff`；本站只负责导航与呈现。
- 提交与分支规则见 [docs/version-control.md](docs/version-control.md)。