# 版本控制规范

本仓库沿用 [cliff-js](https://github.com/cliff-format/cliff-js/blob/main/docs/version-control.md) 的约定：English Conventional Commits、保护分支、英文提交与标签。

## 提交

```text
[AI] type(scope)!: English description

English body explaining why and what changed.

Refs: #123
```

- `type`：`feat`、`fix`、`docs`、`test`、`refactor`、`perf`、`style`、`chore`、`build`、`ci`、`revert`。
- `scope`：小写，例如 `site`、`docs`、`blog`、`search`、`i18n`、`ci`、`deps`。
- 描述用祈使句英文，不超过 72 字符，不加句号。
- AI 生成或自动化提交必须带 `[AI]` 前缀。
- 提交正文说明为什么改、影响什么。一个提交一个逻辑变更。

## 分支

- `main` 是发布分支，受保护，只能由 `dev` 合入。
- `dev` 是集成分支，工作分支从 `dev` 切出：`feature/<slug>`、`fix/<slug>`、`docs/<slug>` 等。
- 分支名是小写 ASCII，连字符分词。
- 工作分支合并后删除。

## 版本与标签

- 站点版本跟随 CLIFF 规范版本：发布 1.2 时才复制 `src/content/docs/1.2` 并打 `vX.Y.Z` 标签。
- 标签只打在 `main` 上，注释标签，消息为 `cliff-site X.Y.Z`。
- 已发布的 `/docs/<version>/` 路径不再变更。

## 发布

`main` 的每次推送由 `.github/workflows/deploy.yml` 构建并发布到 GitHub Pages。发布前本地必须跑通：

```bash
pnpm check && pnpm build
```
