# Post-Install Script — Design Spec

## Overview

跨平台（Linux + Windows）的 Claude Code 后安装脚本。在干净系统上运行一次，完成 Claude Code 插件和偏好的完整配置。

## Prerequisites

- 全新系统，已安装 Claude Code CLI
- 已运行 cc-switch 配置好 API key 和 provider
- Node.js 可用（Claude Code 依赖）

## Execution Order

```
1. 安装 Claude Code（用户手动）
2. 运行 cc-switch 配置 API key / provider（用户手动）
3. 运行本脚本（node setup.js）
```

## Responsibilities

### In Scope

| 职责 | 说明 |
|---|---|
| 添加 Marketplace | 5 个 GitHub 仓库 |
| 安装插件 | 32 个，通过 `claude plugin install` |
| 部署 ECC 规则 | 运行 ECC install-apply.js，部署 common 规则到 `~/.claude/rules/` |
| 合并偏好设置 | 非破坏性地将行为偏好写入 `~/.claude/settings.json` |

### Out of Scope

| 职责 | 由谁处理 |
|---|---|
| API Key / Provider 配置 | cc-switch |
| MCP Server 配置 | cc-switch |
| Claude Code 安装 | 用户手动 |

## Marketplaces (5)

| Name | GitHub Repo |
|---|---|
| claude-plugins-official | `anthropics/claude-plugins-official` |
| superpowers-marketplace | `obra/superpowers-marketplace` |
| pua-skills | `tanweai/pua` |
| karpathy-skills | `forrestchang/andrej-karpathy-skills` |
| claude-mem | `thedotmack/claude-mem` |

## Plugins (32)

### claude-plugins-official (26)

superpowers, context7, code-review, code-simplifier, coderabbit, commit-commands, feature-dev, firecrawl, frontend-design, hookify, playwright, pr-review-toolkit, pyright-lsp, qodo-skills, ralph-loop, remember, rust-analyzer-lsp, security-guidance, sentry, skill-creator, sonatype-guide, supabase, telegram, typescript-lsp, claude-code-setup, claude-md-management

### everything-claude-code (1)

everything-claude-code

### github / chrome-devtools-mcp (2, previously disabled)

github, chrome-devtools-mcp

### Third-party (3)

- pua@pua-skills
- andrej-karpathy-skills@karpathy-skills
- claude-mem@thedotmack

## ECC Rules

Plugin: `everything-claude-code`
Command: `node <cache_path>/scripts/install-apply.js common`
Result: 9 个 common 规则文件部署到 `~/.claude/rules/`

## Settings Merge

写入 `~/.claude/settings.json`，merge 策略：不覆盖 cc-switch 已写入的字段。

```json
{
  "skipDangerousModePermissionPrompt": true,
  "verbose": true,
  "attribution": { "commit": "", "pr": "" },
  "env": {
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "DISABLE_AUTOUPDATER": "1",
    "ENABLE_TOOL_SEARCH": "true",
    "API_TIMEOUT_MS": "3000000"
  }
}
```

## Error Handling

- 插件安装失败 → 重试 1 次 → 再失败则跳过
- 所有失败汇总到最终报告，包含失败原因
- 脚本天然幂等（`claude plugin install` 对已安装插件返回成功）

## Cross-Platform

- 路径：`os.homedir()` + `path.join()`
- 命令：`claude` CLI 跨平台一致
- ECC 规则部署：统一用 `node install-apply.js common`，两个平台都适用
- 不依赖 bash/pwsh 特性

## File Structure

```
post-install-scripts/
├── config.json     # 声明式配置
├── setup.js        # 主脚本
└── README.md       # 使用说明
```
