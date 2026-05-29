# Claude Code Post-Install Scripts

一键配置 Claude Code 插件和偏好。重装系统后跑一次即可。

## 前置条件

1. 已安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
2. 已运行 [cc-switch](https://github.com/farion1231/cc-switch) 配置 API key

## 使用

```bash
# 克隆
git clone git@github.com:ChHsiching/cc-post-install-scripts.git
cd cc-post-install-scripts

# 预览（不执行任何操作）
node setup.js --dry-run

# 正式安装
node setup.js
```

## 脚本做了什么

1. 注册 6 个插件仓库（marketplace）
2. 安装 31 个插件
3. 部署 ECC common 规则到 `~/.claude/rules/`
4. 合并行为偏好到 `~/.claude/settings.json`（不覆盖已有配置）

## 自定义

编辑 `config.json`：

- `marketplaces` — 插件仓库（`"显示名": "GitHub仓库"`）
- `plugins` — 要安装的插件（`"插件名@仓库名"`）
- `settings` — 写入 settings.json 的偏好

增减插件后重新运行 `node setup.js` 即可，已安装的插件会自动跳过。

## 跨平台

Linux 和 Windows 通用。脚本不依赖 bash/powershell 特性。
