#!/usr/bin/env bash
# lead 的端到端验证脚本 —— 只读探测，不改业务数据。
#
# 用法（口令必须显式传，脚本内不写任何字面量）：
#   MYSQL_PWD=<本机 mysql 口令> bash scripts/lead-e2e-probe.sh [端点...]
#
# 今天踩坑后的固定做法：
#   1) 口令走环境变量，绝不落命令行（tasklist/wmic 能看见）
#   2) jar 先 cp 成快照再跑，绝不直接跑 target/ 或 m2 里的包
#      （并发 mvn install 会原地重写，跑到一半包就变 30KB 瘦 jar）
#   3) 快照做 3s 间隔双采样，体积一致且 >20MB 才准启动
#   4) 就绪判据匹配 Started CorePlatformApplication
#      （本项目日志不是标准的 "Tomcat started on port(s): X"）
#   5) 日志文件名带 PID+时间戳，避免复用旧日志造成"1 秒就绪"误判
#   6) trap 保证退出时只 kill 自己起的 PID；端口只用 8091-8150

set -uo pipefail
trap '' PIPE

REPO="D:/02研发项目（李栋梁）/2026农业产业互联网/agri-platform"
cd "$REPO" || exit 1

: "${MYSQL_PWD:?必须显式传 MYSQL_PWD}"

PORT=""
for p in $(seq "${PORT_START:-8141}" "${PORT_END:-8148}"); do
  if ! netstat -ano 2>/dev/null | grep LISTENING | grep -qE ":$p\b"; then PORT=$p; break; fi
done
[ -z "$PORT" ] && { echo "!! 8091-8150 内无空闲端口"; exit 1; }

STAMP="${PORT}-$$-$(date +%s)"
SNAPDIR="/tmp/lead-e2e"
LOG="$SNAPDIR/app_${STAMP}.log"
SNAP="$SNAPDIR/snap_${STAMP}.jar"
mkdir -p "$SNAPDIR"

REPO_JAR="C:/maven/repository/com/agri/core-app/1.0.0/core-app-1.0.0.jar"
TARGET_JAR="core-platform/core-app/target/core-app-1.0.0.jar"
if [ -n "${JAR:-}" ]; then SRC="$JAR"; elif [ -f "$REPO_JAR" ]; then SRC="$REPO_JAR"; else SRC="$TARGET_JAR"; fi

cp -f "$SRC" "$SNAP" || { echo "!! jar 快照失败"; exit 1; }
S1=$(wc -c < "$SNAP"); sleep 3; S2=$(wc -c < "$SNAP")
if [ "$S1" != "$S2" ]; then echo "!! jar 体积 3s 内变化（${S1}→${S2}），有并发构建在写。中止。"; exit 1; fi
if [ "$S1" -lt 20000000 ]; then echo "!! jar 体积 ${S1} < 20MB，是坏包。重建: cd core-platform && mvn -o -pl core-app -am install -DskipTests"; exit 1; fi
echo "jar 快照: $SNAP (${S1} B，双采样稳定 ✅)"
echo "使用端口: $PORT"

PW_SRC="core-platform/mod-platform/src/main/java/com/agri/platform/internal/auth/AdminUserInitializer.java"
PW=$(sed -n '46p' "$PW_SRC" | grep -o '"[^"]*"' | sed -n '2p' | tr -d '"')
echo "口令长度: ${#PW}"

BGPID=""
cleanup() {
  [ -z "$BGPID" ] && return 0
  kill "$BGPID" 2>/dev/null; sleep 2; kill -9 "$BGPID" 2>/dev/null
  echo "[cleanup] 只回收自己起的 PID $BGPID"
}
trap cleanup EXIT INT TERM

JARW=$(cygpath -w "$SNAP")
SPRING_DATASOURCE_PASSWORD="$MYSQL_PWD" java -jar "$JARW" \
  --server.port="$PORT" --spring.flyway.enabled=false >"$LOG" 2>&1 &
BGPID=$!

READY=0
for i in $(seq 1 240); do
  grep -q "Started CorePlatformApplication" "$LOG" 2>/dev/null && { echo "服务已就绪（${i}s）✅"; READY=1; break; }
  grep -q "APPLICATION FAILED TO START\|Access denied" "$LOG" 2>/dev/null && { echo "!! 启动失败"; tail -25 "$LOG"; exit 1; }
  sleep 1
done
[ "$READY" -eq 0 ] && { echo "!! 240s 未就绪"; tail -25 "$LOG"; exit 1; }

echo "=== 登录 ==="
RAW=$(curl -s --noproxy '*' -m 30 -w $'\n__HTTP__%{http_code}' -X POST \
  "http://127.0.0.1:${PORT}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"${PW}\"}")
echo "login HTTP=$(echo "$RAW" | grep -o '__HTTP__[0-9]*' | sed 's/.*__HTTP__//')"
TOKEN=$(echo "$RAW" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "TOKEN_LEN=${#TOKEN}"

if [ "${#TOKEN}" -lt 100 ]; then
  echo "!! 登录失败，响应体前300字:"
  echo "${RAW:0:300}"
  echo "--- 应用日志尾部 ---"
  tail -25 "$LOG"
  exit 1
fi

B="http://127.0.0.1:${PORT}/api/v1/production"
printf "\n%-58s %-6s %-6s %s\n" "端点" "HTTP" "码" "返回体预览"
printf '%s\n' "--------------------------------------------------------------------------------"
EP_FILE="${EP_FILE:-}"
if [ -n "$EP_FILE" ] && [ -f "$EP_FILE" ]; then mapfile -t EPS < "$EP_FILE"; else EPS=("$@"); fi
for ep in "${EPS[@]}"; do
  [ -z "$ep" ] && continue
  R=$(curl -s --noproxy '*' -m 30 -w $'\n__HTTP__%{http_code}' -H "Authorization: Bearer ${TOKEN}" "${B}${ep}")
  HC=$(echo "$R" | grep -o '__HTTP__[0-9]*' | sed 's/.*__HTTP__//'); BD=$(echo "$R" | sed 's/__HTTP__[0-9]*$//')
  BC=$(echo "$BD" | grep -o '"code":[0-9]*' | head -1 | cut -d: -f2); [ -z "$BC" ] && BC="-"
  printf "%-58s %-6s %-6s %s\n" "$ep" "$HC" "$BC" "$(echo "$BD" | tr -d '\n' | head -c 230)"
done

echo; echo "=== 应用日志 ERROR 数 ==="; grep -c "ERROR" "$LOG" 2>/dev/null
echo "=== 日志尾部 ==="; tail -8 "$LOG"
