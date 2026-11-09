#!/usr/bin/env bash
# 单后端启动器：把「切目录 + 找 java + 传参」收敛到一处，避免后台任务里路径/引号问题。
# 用法：bash scripts/run-backend.sh <模块目录> <jar相对模块路径> <端口> [附加参数...]
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOD="$1"; JAR="$2"; PORT="$3"; shift 3
JAVA="${JAVA_HOME_BIN:-/c/Program Files/Amazon Corretto/jdk17.0.20_12/bin/java}"
NAME="${LOG_NAME:-$(basename "$JAR" | sed -E "s/-[0-9]+\.[0-9]+.*$//")}"
LOG="$ROOT/__tmpout/logs/$NAME.log"
mkdir -p "$ROOT/__tmpout/logs"
cd "$ROOT/$MOD" || exit 1
exec "$JAVA" -jar "$JAR" --server.port="$PORT" "$@" > "$LOG" 2>&1
