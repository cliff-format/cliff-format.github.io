# cliff-format.github.io

CLIFF 官网：<https://cliff-format.github.io>。站点用 Astro 构建，产物是纯静态文件，由 GitHub Pages 托管。

## 结构

```text
src/
├─ components/          页面组件；sections/ 放营销页的五个区块
├─ i18n.ts              本地化入口：读取 src/locales/*.cliff，按语言渲染
├─ layouts/             BaseLayout：主题解析、字体预载、hreflang、全局样式入口
├─ locales/             站点文案；一个目标语言一个文件
├─ lib/liquid-glass/    LiquidGlass 组件：库的副本、位移图、挂载
├─ pages/               路由：index.astro 是中文页，[lang]/index.astro 承载其余语言
├─ scripts/             客户端行为：主题切换、语言菜单、复制
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

玻璃用 [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) 的 `LiquidGlass`：`src/lib/liquid-glass/` 是它的副本，位移图、三通道色散、rim 和层序都由库生成，`mount.ts` 只负责挂载和尺寸。面板沿用 40px 的 G2 圆角（`corner-shape: squircle`）、胶囊按钮 999px，二者通过 `radius` 同步给位移图，位移图再按计算出的 `corner-shape` 画同一条超椭圆；底板色由主题的 `--lg-tint` 提供，材质是 `blur 3` 的轻磨砂加一层 `--glass-frost` 的浅白染色。结构约定见 [docs/style.md](docs/style.md)，许可声明见 [THIRD-PARTY.md](THIRD-PARTY.md)。

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

首屏约 890 个 DOM 节点：每块玻璃两个空 div（滤镜层、磨砂层），外加文档里一份共享的 `<svg><defs>`。滤镜按几何签名缓存并共享：14 个带滤镜的 `.glass-box` 只用 8 个 `<filter>`（六张特性卡共用一个），旧实现为每块玻璃克隆一份背景，挂载后约 5,000 个节点。本地基础字体是 3 个（Smiley、JetBrains 400、Field Sans，合计约 84 KB），韩语和阿拉伯语页面再加自己的正文字体。背景是纯文本行 + 固定方格 Field Sans，CSS 只用 transform 做循环；没有 Canvas、运行时字形测量或第三方字体请求。不要恢复逐字 `<span>`。

背景漂移按 20 Hz 采样：`text-track` 仍是同一条 transform 循环，但 `steps()` 每 50ms 才前进一步。最快可见行每步小于 1.5px，读起来仍是连续漂移；线性 60fps 漂移会让每块玻璃的 backdrop 每帧重算。玻璃的光学参数与滤镜面积不变。

滚动时每块玻璃原地切换成单通道位移滤镜（同一个 `<filter>`，只替换图元）：位移、`blur`、tint、frost 都保留，只有 R/B 色散暂停；停止滚动 1s 后换回三通道。背景文字照常漂移。2560×1440 实测滚动阶段约 40–130fps（headless Edge；首轮滚动换滤镜时较低，稳定后 100+），不再掉到 20–30fps；静止画面与三通道版本逐字节一致。

玻璃滤镜是增强项：`load` 后由 `requestIdleCallback` 逐块生成（每次最多一块，100ms 超时兜底），不要改回首屏同步初始化或一次生成全部。`backdrop-filter: url()` 在 backdrop 移动时由软件栅格化，代价与滤镜面积成正比；试过把面板拆成“中心模糊 + 四条边缘条做位移”来缩小面积，但位移最多要拉 `strength` 像素的背景，比它窄的条带会露出深色硬边，所以维持整块滤镜。

```bash
CPU=4 node scripts/perf-probe.mjs        # 节点数、DCL、LCP、字体与长任务
CPU=4 ROUTE="/?t=dark" node scripts/perf-probe.mjs
PORT=4174 node scripts/perf-idle.mjs     # 静置 CPU；需要已运行 preview
```

静置 CPU（1440×900，headless Edge）：约 1.2 → 0.5 核。主要来源是漂移采样；滤镜共享把 `<filter>` 从 14 个降到 8 个。

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
- 新的面板写成 `<LiquidGlass class="pane …" radius={40}>` > `.pane-surface`；不要写 `backdrop-filter`、filter 或位移图，也不要给 `.pane` 加背景——它会把折射盖掉。圆角是 G2：`corner-shape: squircle`（`superellipse(2)`），面板统一 40px，折射层用 `corner-shape: inherit` 跟随，位移图按计算值生成同一条超椭圆；`radius` 必须与 CSS 一致。`.pane-surface` 只放内容。
- 背景是 `BackgroundText.astro` 的随机多语言字符行：整体 -20°，奇偶行反向；不要改回点阵背景。每行是纯文本，1.636em 方格由固定 advance 字体加 `letter-spacing` 形成，禁止逐字包裹 `<span>`。
- 页头吸顶：`body` 只能 `overflow-x: clip`（`hidden` 会造出滚动容器、让 sticky 失效）；下拉菜单走 Popover API 进顶层，避免被页头的圆角与层叠顺序裁掉。
- 按钮用 `<GlassButton>` 包住 `.btn`：它是 `LiquidGlass` 的站点默认值（胶囊、`depth 8`、`strength 80`、与面板同亮度/饱和度）。`brand` 换成绿色叠层，`btn-primary` 自己不再画底色；`.btn` 只负责排版与图标。不要再加硬边框或另写一层玻璃。
- 规范、风格指南与设计取舍的正文不在本仓库维护，页脚直接链接到 `cliff-format/cliff`；本站只负责导航与呈现。
- 提交与分支规则见 [docs/version-control.md](docs/version-control.md)。