#!/usr/bin/env bash
# 一键全量生成所有人物图像（默认断点续跑：已生成的自动跳过，只补缺的）。
# 用法：
#   ./comfyui/generate-all.sh                # 全量
#   ./comfyui/generate-all.sh --case jade-pavilion
#   ./comfyui/generate-all.sh --force        # 强制全部重出
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p comfyui/logs
LOG="comfyui/logs/generate-$(date +%Y%m%d-%H%M%S).log"
echo "日志：$LOG"
node comfyui/generate.mjs "$@" 2>&1 | tee "$LOG"
