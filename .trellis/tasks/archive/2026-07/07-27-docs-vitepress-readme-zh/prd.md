# 创建中文README和基于VitePress的中英文文档教程

## Goal

创建完整的中文 README（`README_zh.md`），并在 `docs/` 目录搭建基于 VitePress 的双语（中英文）介绍文档与使用教程。

## Requirements

1. **中文 README (`README_zh.md`)**：
   - 提取并丰富原 `README.md` 中的中文说明，形成独立、高可读性、格式规范的 `README_zh.md`。
   - 在 `README.md` 与 `README_zh.md` 头部增加互相跳转链接。

2. **VitePress 双语文档站点 (`docs/`)**：
   - 在 `docs/` 目录下建立基于 VitePress 的双语文档结构，配置 `docs/.vitepress/config.mjs`。
   - 支持英文（`/`）和中文（`/zh/`）语言切换。
   - 包含首页 (`index.md` / `zh/index.md`)、介绍 (`introduction.md` / `zh/guide/introduction.md`)、快速开始 (`getting-started.md` / `zh/guide/getting-started.md`)、使用教程与工具流程 (`usage.md` / `zh/guide/usage.md`)、配置说明 (`configuration.md` / `zh/guide/configuration.md`)、故障排查与常见问题 (`troubleshooting.md` / `zh/guide/troubleshooting.md`)、迁移与高级指南（整合现有 `migration-from-global-plugin.md` 和 `project-local-install.md`）。
   - 在 `docs/package.json` 或项目级 package.json 配置 VitePress 脚本 (`npm run docs:dev`, `npm run docs:build`)，保证 VitePress 配置完备可直接构建。

## Acceptance Criteria

- [x] 创建 `README_zh.md` 并更新 `README.md` 跳转链接。
- [x] 在 `docs/` 目录下完成 VitePress 配置 (`docs/.vitepress/config.mjs`)。
- [x] 编写完整的英文及中文 VitePress 介绍与使用教程文档。
- [x] 确保 VitePress 项目语法无误，具备完美的导航栏与侧边栏。

