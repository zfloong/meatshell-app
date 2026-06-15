# Project Rules

## Git Sync Check
每次回答用户问题之前，先执行 `git fetch origin 2>&1; git status` 检查本地与 GitHub 的同步状态。如果发现分歧，先告知用户再继续工作。
