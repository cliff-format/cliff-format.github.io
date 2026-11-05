# 样式规范

页面只有一套字体、一套字号、一套间距；背景装饰字符是唯一的例外。新增界面时用这里的角色，不要写新的数值。

## 字体

| 用途 | 字族 | 字重 |
|---|---|---|
| 全部文案与界面 | Smiley Sans（得意黑） | 400 |
| 文件内容、安装命令 | JetBrains Mono | 400 |
| 背景装饰字符 | Field Sans（Noto Sans + Noto Sans KR 合并） | 400，合成到 600 |

得意黑只有一个字重，层级靠字号和颜色区分。`typography.css` 的 `font-synthesis: none` 阻止浏览器合成粗体，所以 `strong`、`b` 与正文同重。

等宽字族里没有中文，代码中的中文字符串回退到得意黑，避免落到系统宋体。

字体子集由三个脚本生成，产物都提交：

| 脚本 | 输出 | 用途 |
|---|---|---|
| `scripts/subset-font.py` | `SmileySans-subset.woff2`（约 66 KB） | 收集 `src/` 的字符，含十种语言文案 |
| `scripts/subset-field-font.py` | `FieldSans.woff2`（约 11 KB） | 背景 126 字合并字体；来自 Noto Sans KR 与 Noto Sans，固定 1em advance |
| `scripts/subset-code-font.py` | `JetBrainsMono-400.woff2`（约 5 KB） | 代码用的静态 400 字重 |

新增文案或语言后重跑 `subset-font.py`；改 `BackgroundText.astro` 的字符池后重跑 `subset-field-font.py`。子集之外的正文字符会回退到 Noto Sans SC。该字体的 `unicode-range` 必须与 `NotoSansSC-subset.woff2` 的 cmap 同步；否则缺字会触发整个文件下载，即使字体并不能画出该字。换子集后跑 `python scripts/noto-unicode-range.py`。

背景字体 `FieldSans.woff2` 是一份合并的 OFL 字体：Noto Sans 提供全部拉丁与西里尔（含 4 个拉丁扩展字符），Noto Sans KR 提供 CJK、日文假名与韩文；126 个背景字符在同一个字体文件、同一字重和同一套度量内，背景不再使用 Smiley。严格说这是同一 Noto Sans 设计体系的两个切面，不是完全同一套字形；若要求绝对单源，只能去掉 Noto CJK 不支持的 4 个拉丁扩展字符。字体文件自托管并预载，页面不请求 MiSans、Google Fonts 或任何第三方字体 CDN；许可文本见 `public/fonts/OFL.txt`。

得意黑没有韩文与阿拉伯文字形，这两个脚本各自用一份 Noto 子集，并靠 `unicode-range` 限定在自身脚本内，不会抢其他文字：

| 脚本 | 字族 | 文件 | 体积 |
|---|---|---|---|
| 한글 | Noto Sans KR 400 | `NotoSansKR-subset.woff2` | 约 91 KB |
| العربية | Noto Sans Arabic 400 | `NotoSansArabic-subset.woff2` | 约 13 KB |

页面只在对应语言预载自己的脚本子集（`BaseLayout` 按 locale 输出 preload）。

## 字号

| 角色 | Token | 尺寸 | 行高 | 用于 |
|---|---|---|---|---|
| display | `--fs-display` | 40 → 72 | 1.06 | 首屏标题 |
| heading | `--fs-heading` | 30 → 40 | 1.18 | 区块标题 |
| stat | `--fs-stat` | 32 → 40 | 1 | 实测数值 |
| title | `--fs-title` | 20 | 1.4 | 特性卡片、步骤标题 |
| lead | `--fs-lead` | 18 | 1.7 | 首屏与区块导语 |
| body | `--fs-body` | 16 | 1.75 | 正文 |
| ui | `--fs-ui` | 14 | 1.5 | 导航、按钮、链接、代码 |
| meta | `--fs-meta` | 13 | 1.5 | 说明、标签、证据行 |

尺寸均为 rem，随读者字号缩放。13px 是下限。

## 布局

- 容器 `--wrap` 75rem，左右留白 `--gutter`；页面只用这一条栅格。
- 每个区块以 1px 分隔线开头，纵向节奏统一为 `--section-y`。
- 区块头是两列：标题在左，说明在右，末行对齐。
- 首屏两列：文案在左，文件示例在右；窄屏堆叠。
- 页头、页脚与正文同容器、同字号角色；两者都是一整块玻璃面板，页头吸顶浮在内容之上。

## 液态玻璃

玻璃用 [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) 的 data-URI SVG 位移滤镜：`glass.ts` 逐个面板生成 `feImage` 法线图和 `feDisplacementMap`，把 `blur(0) url('data:…') blur(0) brightness() saturate()` 写进 `backdrop-filter`。滤镜直接折弯真实背景，X 轴、Y 轴和滚动后的内容一起更新；没有场景复制、canvas 或 WebGL。许可声明见 [THIRD-PARTY.md](../THIRD-PARTY.md)。

结构：

```html
<div class="pane">
  <div class="pane-surface">…</div>
</div>
```

`.pane` 负责 G2 圆角、tint、透明 fallback、sheen 和阴影；`.pane-surface` 只放内容，不写底色、边框或阴影。`glass.ts` 只改写内联 `backdrop-filter`，不注入子层。`.btn-ghost` 用同一套小尺寸滤镜；主按钮是实色，不挂滤镜。

- 圆角统一 `--r-card: 40px`；页头 80px 高，保留同一个 40px 半径，不用高度截断它。`corner-shape: squircle`（G2），不支持时退回 `border-radius`。
- `depth` 是边缘厚度，`strength` 是位移强度；参数在 `glass-panes.ts` 和 `glass-buttons.ts`，不要在 `base.css` 里另写一套滤镜。
- 玻璃默认 **不模糊**（`blur: 0`）；tint 很薄，随机字符行在玻璃下保持可见。旧版的重磨砂已移除。
- 没有手写描边或绿色边缘；边缘是实际被折弯的背景、tint、顶部光和阴影。品牌绿只留在背景光和强调色里。
- Chromium 渲染 data-URI 滤镜；Safari、Firefox 和 Chrome iOS 保留透明 tint、顶部光和阴影的 fallback。禁用 JS 时面板仍然完整。
- 主题、tint、阴影在 `graphite.css`；结构在 `base.css`。

| 层 | 作用 |
|---|---|
| `background` | 冷灰或乳白的半透明底色 |
| `backdrop-filter` | data-URI 位移滤镜；Chromium 折弯真实背景 |
| `.pane::after` | 中性顶部高光与底边暗部 |
| `box-shadow` | 外部阴影与顶部内光 |

特性区是六张独立卡片，卡片之间留有间距。图标 chip 是平底色 + 1px 中性描边。

## 背景文字

背景不是点阵图。`BackgroundText.astro` 生成 80 行随机多语言字符，奇偶行反向，整体旋转 **-20°**。字符池是拉丁与数字、CJK、日文假名、韩文、西里尔；每行 44–62 个字符，接续四份，渲染两份拷贝供 `-50%` 循环。

背景是纯文本行，没有 Canvas、运行时测量或第三方字体请求。`FieldSans` 由构建脚本把 126 个字形（Latin Extended、西里尔、CJK、假名、韩文）统一缩放并居中到 `1em` advance，再用 `.text-copy` 的 `0.636em` 字距形成 `1.636em` 方格。所有字符来自同一份 `FieldSans` 文件：拉丁/西里尔取自 Noto Sans，CJK/假名/韩文取自 Noto Sans KR。两个 Noto 切面合成同一个家族，不再使用 Smiley；若要求绝对单源，需要从字符池去掉 4 个 Noto CJK 不支持的拉丁扩展字符。

字号 `1.375rem`（22px），行高 `1.15`，行高网格 `1.673em`，行距 `0.5rem`；字重 `600`，由 Field Sans 的 400 字面合成。场层 `inset: -70% -15%` 容纳 80 行，视口只看到一段。颜色 `--field-text`（约 0.06 不透明度）。

- 只有 text-track 的 transform 动画，无限循环；`prefers-reduced-motion` 与 `?static=1` 会停下。不要加 `will-change`，否则 80 条行会各自成为大图层。
- Field Sans 只有约 10.6 KB，构建时预载并以 `font-display: block` 显示；没有远程字体等待或 fallback 换字。
- 文本行位于玻璃后方，由 data-URI 位移滤镜折弯；不要再加回点阵。

## 动效

只有两类，其余一律不加：

1. **首屏入场**：文案逐行上浮，间隔 40–320ms，700ms 结束；文件卡片滞后 160ms。纯 CSS，不依赖 JS，不产生布局位移。
2. **操作反馈**：按钮与链接的颜色/边框、复制成功的图标切换、主题切换的圆形揭示。

`prefers-reduced-motion: reduce` 关闭全部动效，`?static=1` 供截图使用。滚动不触发任何动画。