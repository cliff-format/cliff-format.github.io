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

玻璃由 [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) 渲染。`src/lib/liquid-glass/` 是它的副本：位移图、三通道色散、rim 与层序都照原样，本地只加了几处接线——`radius` 把圆角写进渲染器读取的 inline style，`tint` 与 `frost` 让主题提供染色，挂载推迟到 load 后的空闲时间。不要在这里手写 `backdrop-filter`、filter 或位移图。

结构是 `<LiquidGlass class="… pane" radius={40}>` 包住 `.pane-surface`：

| 层 | 作用 |
|---|---|
| `.lg-overlay-bg` | 主题叠层，色值取 `.pane` 的 `--lg-tint` |
| `.lg-filter-layer > .glass-box` | 整块玻璃：`blur(1.5px) url(#位移图) blur(3px) brightness() saturate()` |
| `.lg-frost` | 很浅的白色磨砂染色，色值取 `--glass-frost`，压在折射层之上 |
| `.lg-content > .pane-surface` | 内容，压在玻璃之上 |
| `box-shadow` | 面板投影，只有 elevation，不做镜面高光 |

- **圆角是 G2**：`.pane` 的 `corner-shape: squircle` 计算为 `superellipse(2)`；`.lg-filter-layer` 与 `.glass-box` 用 `corner-shape: inherit` 继承同一形状，位移图再按计算值画同一条超椭圆（指数 `2^k`，squircle 即 4）。圆角只写一处，`radius` 只把半径数值告诉位移图；胶囊按钮传 `999`，脚本按盒子高度夹紧。不支持 `corner-shape` 的浏览器退回圆形圆角，位移图同步退回 `rx/ry`。
- **不给 `.pane` 加背景**：面板背景会画在折射层之上，把效果盖掉。底板色由库的叠层提供，面板色调在 `graphite.css` 的 `--glass-*-tint`。
- `depth` 是边缘厚度，`strength` 是位移强度，`chromaticAberration` 是 R/B 分离；面板用 `depth 10 / strength 100 / cab 2`（库默认厚度，再厚边缘就像一圈厚玻璃），按钮用 `depth 8 / strength 80 / cab 2`。
- `blur` 是磨砂量，面板和按钮都是 `3`：滤镜链是 `blur(1.5px)` → 位移 → `blur(3px)`，背景字符糊成雾面但仍认得出结构。再往上（5 以上）只剩毛玻璃，折射边缘也一起糊掉。
- **滤镜整块盖住面板**：位移最多要从面板里侧拉 `strength` 像素的背景。试过把面板拆成“中心只模糊 + 四条 `depth` 宽的边缘条做位移”来省栅格化面积，边缘条窄于位移距离，没有可拉的背景，每条边都会露出一道深色硬边，所以退回了整块滤镜。
- 磨砂之上还有一层 `.lg-frost`：很浅的白色染色，深色主题 `rgba(255,255,255,.045)`、浅色 `0.12`，让材质读起来是“乳白玻璃”而不是纯折射。它压在滤镜层之上，所以只会提亮，不会盖住弯折。
- 面积越小，透镜要越弱：语言菜单是 `depth 6 / strength 40`。菜单只有 380px 高，`strength 100` 会把上方页头的高光拉进三分之一的面板，成一块发亮的斑。
- 玻璃可以嵌套：CTA 面板里就放着两块玻璃按钮。挂载用 `:scope > .lg-filter-layer > .glass-box` 只找自己的层；写成普通 `querySelector` 会先命中内层，面板自己就永远没有滤镜。
- 滤镜挂在文档里的一个 `<svg><defs>` 上，用 `url(#lg-filter-n)` 引用：data-URI 每次采样都要重新解析，文档内滤镜只解析一次。滤镜按几何签名（尺寸、半径、深度、色散、圆角指数）缓存并共享；六张特性卡共用一个，尺寸变化时才重建。每个滤镜同时保存三通道静止图元与单通道滚动图元，滚动时原地替换，不换 id。
- 滤镜在 load 后由 `requestIdleCallback` 逐块挂载（每次最多一块，100ms 超时兜底）：首屏只有叠层和 rim，避免一次生成全部滤镜的长任务。
- **滚动只暂停色散**：滚动事件让已挂载的滤镜换成单通道位移图元，折射、`blur`、tint、frost 不变，R/B 色散暂停；停止滚动 1s 后，三个位移 scale 在约 0.48s 内从 cab 0 渐入到 cab 2。cab 0 的三通道帧与单通道逐像素一致，所以恢复没有跳变。背景漂移不暂停。这样滚动时不会逐帧软件栅格化三次 `feDisplacementMap`，2560×1440 从 20–30fps 回到 40–130fps（首轮换滤镜后 100+）。
- 禁用 JS 时面板退回 `--m3-surface-container` 实色 + 1px 描边；`prefers-reduced-transparency: reduce` 隐藏滤镜层并同样退回实色。
- 按钮统一走 `src/components/GlassButton.astro`：同一个 `LiquidGlass`、同一套光学参数，`brand` 只是把中性叠层换成绿色叠层，链接本身不再画底色。`--glass-brand-tint` 故意接近不透明：绿色一旦调透，浅色主题会洗成薄荷绿，深色主题的标签对比也会掉。
- JavaScript 在 `src/lib/liquid-glass/mount.ts`；主题、阴影与每块玻璃的色调在 `graphite.css`，结构在 `base.css`。

## 背景文字

背景不是点阵图。`BackgroundText.astro` 生成 80 行随机多语言字符，整体旋转 **-20°**。字符池是拉丁与数字、CJK、日文假名、韩文、西里尔；每行 44–62 个字符，接续四份。

背景是纯文本行，没有 Canvas、运行时测量或第三方字体请求。`FieldSans` 由构建脚本把 126 个字形（Latin Extended、西里尔、CJK、假名、韩文）统一缩放并居中到 `1em` advance，再用 `.text-copy` 的 `0.636em` 字距形成 `1.636em` 方格。所有字符来自同一份 `FieldSans` 文件：拉丁/西里尔取自 Noto Sans，CJK/假名/韩文取自 Noto Sans KR。两个 Noto 切面合成同一个家族，不再使用 Smiley；若要求绝对单源，需要从字符池去掉 4 个 Noto CJK 不支持的拉丁扩展字符。

字号 `1.375rem`（22px），行高 `1.15`，行高网格 `1.673em`，行距 `0.5rem`；字重 `600`，由 Field Sans 的 400 字面合成。场层 `inset: -70% -15%` 容纳 80 行，视口只看到一段。颜色 `--field-text`（约 0.06 不透明度）。

- 背景漂移保留：`text-track` 的 transform 循环，`prefers-reduced-motion` 与 `?static=1` 会停下。它是玻璃的 backdrop，线性 60fps 漂移会让每块玻璃每帧重算；因此用 `steps()` 按 20 Hz 采样，最快可见行每步小于 1.5px，光学参数不变。`DRIFT_FPS` 在 `BackgroundText.astro`，`--drift-steps` 在 `graphite.css`。
- 每行宽度是 `max-content`，`.bd-text` 不裁切横向溢出；旋转后的场层比 `inset` 盒更宽，由 `.backdrop` 在视口裁切。这样窄屏和竖屏的右侧不会出现行尾断层。
- 不要加 `will-change`，否则 80 条行会各自成为大图层。
- Field Sans 只有约 10.6 KB，构建时预载并以 `font-display: block` 显示；没有远程字体等待或 fallback 换字。
- 文本行位于玻璃后方，在滤镜层被折弯、被磨砂糊掉；不要再加回点阵。

## 动效

只有两类，其余一律不加：

1. **首屏入场**：文案逐行上浮，间隔 40–320ms，700ms 结束；文件卡片滞后 160ms。纯 CSS，不依赖 JS，不产生布局位移。
2. **操作反馈**：按钮与链接的颜色/边框、复制成功的图标切换、主题切换的圆形揭示。

`prefers-reduced-motion: reduce` 关闭全部动效，`?static=1` 供截图使用。滚动不触发任何动画。