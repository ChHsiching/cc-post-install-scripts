# Implementation Plan

## Phase 1: config.json

生成声明式配置文件，包含 marketplace、插件列表、ECC 规则配置、settings 偏好。

**Steps:**
1. 创建 `config.json`，包含 5 个 marketplace、32 个插件、ECC 配置、settings 偏好

## Phase 2: setup.js — Core

主脚本的核心逻辑。

**Steps:**
1. 读取 `config.json`
2. 实现前置检查（`claude` CLI 可用、`settings.json` 存在）
3. 实现 marketplace 添加逻辑（`claude plugin marketplace add <repo>`）
4. 实现插件批量安装逻辑（`claude plugin install <name>@<marketplace>`，含重试）
5. 实现 ECC 规则部署（定位缓存路径，运行 `node install-apply.js common`）
6. 实现 settings.json merge（读取现有 → 合并偏好 → 写回）
7. 实现最终报告输出（成功数、失败数、失败清单+原因）

## Phase 3: README.md

使用说明文档。

**Steps:**
1. 写 README：前置条件、使用方法、配置说明、故障排除

## Phase 4: Verify

在当前环境验证。

**Steps:**
1. 检查 config.json 格式正确
2. 检查 setup.js 语法无误
3. 确认跨平台路径处理正确
