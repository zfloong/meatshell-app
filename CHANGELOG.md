# Changelog

## v1.0.3 — Hotfix: 修复 SSH 断连后残留进程 (2026-06-23)

- **关键修复**: 关闭 SSH 会话时显式向 monitor exec channel 发送 EOF + Close
- 修复前: mon_channel 仅靠 Drop 释放，可能与 disconnect 竞态导致服务器端遗留监控脚本
- 遗留的 while :; do ... done 脚本会持续占用 CPU（已知案例: 4 天消耗 3天15小时 CPU）
- 服务器端建议配合 swap + 定时重启作为纵深防护


## v0.5.0 鈥?UI Redesign (2026-06-21)

- Complete UI overhaul with custom Design Token system
- Glassmorphism sidebar with backdrop-filter blur
- Compact 36px TitleBar with tabbed sessions
- New xterm.js theme matching the design tokens
- 24px compact StatusBar with connection state indicators
- All dialogs unified with glass blur + spring animations
- Light theme support via `[data-theme="light"]`
- Development error log added (DEVLOG.md)

## v0.4.12 鈥?Upstream base

Forked from [jeff141/meatshell](https://github.com/jeff141/meatshell) v0.4.12.
