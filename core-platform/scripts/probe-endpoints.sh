#!/usr/bin/env bash
# =============================================================================
# 端点可用性探测脚本（只读）
#
# 用途：一键起 core-app → 登录 → 批量调端点 → 输出「HTTP / 业务码 / 返回体」对照表 → 关停。
#       用于判定「某个页面的示例数据是不是真的在被展示」，把静态审计结论落成实测结论。
#
# 用法：
#   bash core-platform/scripts/probe-endpoints.sh
#   bash core-platform/scripts/probe-endpoints.sh "/admin/tenants" "/admin/sop"
#   EP_FILE=/tmp/my_eps.txt bash core-platform/scripts/probe-endpoints.sh
#
# 可覆盖的环境变量：
#   JAR               core-app jar 路径
#   MYSQL_PASSWORD    MySQL 口令（不传则按 root → root123 依次尝试）
#   PORT_RANGE        "8091 8099" 端口探测区间
#   EP_FILE           每行一个端点（相对 /api/v1/production）的文件
#   SHOW_BODY         返回体预览字符数，默认 300
# =============================================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

JAR="${JAR:-core-platform/core-app/target/core-app-1.0.0.jar}"
PW_SRC="core-platform/mod-platform/src/main/java/com/agri/platform/internal/auth/AdminUserInitializer.java"
API_PREFIX="/api/v1/production"
SHOW_BODY="${SHOW_BODY:-300}"
PORT_RANGE="${PORT_RANGE:-8091 8099}"

# ---------------------------------------------------------------------------
# 0. 前置检查
# ---------------------------------------------------------------------------
if [ ! -f "$JAR" ]; then
  echo "!! jar 不存在: $JAR"; exit 1
fi

# 体积稳定性检查：并发 mvn 会在你读取的当下把 jar 写一半。
# 连续两次采样（间隔 3s）体积一致才认为写完了，否则拿到的是正在被覆盖的半成品。
JAR_SIZE=$(wc -c <"$JAR")
sleep 3
JAR_SIZE2=$(wc -c <"$JAR")
if [ "$JAR_SIZE" != "$JAR_SIZE2" ]; then
  echo "!! jar 体积在 3s 内从 ${JAR_SIZE} 变成 ${JAR_SIZE2}，说明正被并发构建覆盖写入"
  echo "!! 现在跑出来的任何结论都不可信。请等构建方（当前是 se-harvest2 独占重建）报告完成后再跑。"
  exit 1
fi
echo "jar: $JAR (${JAR_SIZE} bytes，体积稳定)"
# 完整包约 63MB；明显偏小说明是半成品包，跑出来的 500 会误导判断
if [ "$JAR_SIZE" -lt 20000000 ]; then
  echo "!! jar 体积异常（完整包约 63,000,000 字节），疑似未构建完成"
  echo "   实测案例：某次并发构建把 jar 冲成 30,485 字节的无 BOOT-INF 裸包，"
  echo "   java -jar 起不来，报出来的 500/连不上会被误判成「后端端点不存在」。"
  echo ""
  echo "   重建（必须 cd 到 core-platform/ 再跑，原因见下）："
  echo "     cd core-platform && mvn -o -pl core-app -am install -DskipTests"
  echo ""
  echo "   ⚠️ 不要从仓库根跑 mvn -pl core-platform/core-app：根 pom.xml 的 <modules>"
  echo "   里没有 core-platform，会报 Could not find the selected project in the"
  echo "   reactor: core-platform/core-app。"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. 口令：必须从源码动态提取，禁止写死字面量
# ---------------------------------------------------------------------------
ADMIN_PW=$(grep -o 'AGRI_ADMIN_PASSWORD", "[^"]*"' "$PW_SRC" 2>/dev/null | sed 's/.*, "//; s/"$//')
if [ -z "$ADMIN_PW" ]; then
  echo "!! 未能从 $PW_SRC 提取管理员口令"; exit 1
fi
echo "admin 口令已提取（长度 ${#ADMIN_PW}，不回显）"

# ---------------------------------------------------------------------------
# 2. 端口：动态探测，不用静态清单
#    教训：并发环境下静态清单在广播那一刻就过期了
# ---------------------------------------------------------------------------
pick_port() {
  local lo hi p
  lo=$(echo "$PORT_RANGE" | awk '{print $1}')
  hi=$(echo "$PORT_RANGE" | awk '{print $2}')
  for ((p = lo; p <= hi; p++)); do
    # \b 避免 18095 误匹配 8095
    if ! netstat -ano 2>/dev/null | grep LISTENING | grep -qE ":$p\b"; then
      echo "$p"; return 0
    fi
  done
  return 1
}

PORT=$(pick_port)
if [ -z "${PORT:-}" ]; then
  echo "!! $PORT_RANGE 区间无空闲端口"; exit 1
fi
echo "使用端口: $PORT"

# ---------------------------------------------------------------------------
# 3. 端点清单
# ---------------------------------------------------------------------------
DEFAULT_EPS=(
  "/admin/tenants?pageNum=1&pageSize=3"
  "/admin/tenants/quota-overview"
  "/admin/tenants/segment-summary"
  "/admin/tenants/profiles"
  "/admin/dashboard"
  "/admin/dashboard/screen"
  "/admin/dashboard/trend"
  "/admin/dashboard/region-distribution"
  "/admin/dashboard/alert-trend"
  "/analytics/overview"
  "/harvests?pageNum=1&pageSize=3"
  "/harvests/plan?pageNum=1&pageSize=3"
  "/harvests/inventory?pageNum=1&pageSize=3"
  "/plots?pageNum=1&pageSize=3"
  "/admin/sop?pageNum=1&pageSize=3"
  "/admin/quality/labs?pageNum=1&pageSize=3"
  "/admin/trace/overview"
  "/admin/trace/code-stats"
  "/admin/trace/codes?pageNum=1&pageSize=3"
  "/admin/food-safety/metrics"
  "/admin/food-safety/risk"
  "/admin/food-safety/alerts"
  "/admin/food-safety/circulation?pageNum=1&pageSize=3"
  "/admin/food-safety/compliance/inputs?pageNum=1&pageSize=3"
  "/admin/food-safety/trust-label/stats"
  "/admin/food-safety/cold-chain/stats"
)

EPS=()
if [ -n "${EP_FILE:-}" ] && [ -f "$EP_FILE" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && EPS+=("$line")
  done <"$EP_FILE"
elif [ "$#" -gt 0 ]; then
  EPS=("$@")
else
  EPS=("${DEFAULT_EPS[@]}")
fi

# ---------------------------------------------------------------------------
# 4. 启动（MySQL 口令逐个尝试）
#    教训：yml 默认 root123 是 Docker 容器的，本机直连要 root。
#          「mysql 客户端自检通过」≠「应用能连」，两者口令来源不同。
# ---------------------------------------------------------------------------
CANDIDATES=(${MYSQL_PASSWORD:-root root123})
LOG="/tmp/probe_ep_${PORT}.log"
BGPID=""

start_app() {
  local pw="$1"
  echo "--- 启动（MySQL 口令候选: ${pw}）"
  java -jar "$JAR" --server.port="$PORT" \
    --spring.flyway.enabled=false \
    --spring.datasource.password="$pw" >"$LOG" 2>&1 &
  BGPID=$!

  local i code
  for ((i = 1; i <= 120; i++)); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -m 3 \
      "http://127.0.0.1:${PORT}/api/v1/auth/login" \
      -X POST -H 'Content-Type: application/json' -d '{}')
    if [ "$code" != "000" ]; then
      echo "    服务已就绪（${i}s）"
      return 0
    fi
    # 启动期就因数据源失败退出的话，别白等
    if grep -q "Access denied\|APPLICATION FAILED TO START" "$LOG" 2>/dev/null; then
      return 1
    fi
    sleep 1
  done
  return 1
}

STARTED=0
for pw in "${CANDIDATES[@]}"; do
  if start_app "$pw"; then STARTED=1; break; fi
  echo "    数据源连不上，换下一个口令"
  [ -n "$BGPID" ] && kill "$BGPID" 2>/dev/null
  sleep 1
done

if [ "$STARTED" -ne 1 ]; then
  echo "!! 启动失败，日志尾部:"; tail -20 "$LOG" 2>/dev/null
  exit 1
fi

# 无论正常结束还是异常退出，只回收本脚本自己起的这个 PID
cleanup() {
  [ -z "$BGPID" ] && return 0
  kill "$BGPID" 2>/dev/null
  sleep 2
  kill -9 "$BGPID" 2>/dev/null

  # 端口释放比进程退出慢（实测：脚本退出后 3s 端口仍显示 LISTENING）。
  # 必须等到真正释放并明确报出来——端口挂着不报，下一个人看到占用很可能
  # 按「回收孤儿进程」的直觉去 kill，而按项目规则那是必须先确认归属的。
  local i
  for ((i = 1; i <= 30; i++)); do
    if ! netstat -ano 2>/dev/null | grep LISTENING | grep -qE ":$PORT\b"; then
      echo "端口 ${PORT} 已释放（PID ${BGPID} 已回收，未触碰其他进程）"
      return 0
    fi
    sleep 1
  done
  echo "!! 端口 ${PORT} 在 30s 内未释放，可能残留 PID ${BGPID}"
  echo "!! 请先用 tasklist /FI \"PID eq ${BGPID}\" 确认归属再处理，不要凭端口占用直接 kill"
}
#
# 为什么是「忽略 PIPE」而不是「trap PIPE」：
#   实测 `| head -12` 时 head 读满就关管道，脚本写 stdout 触发 SIGPIPE。
#   方案 A（trap cleanup PIPE）会递归——cleanup 自己 echo 又写向已关闭的管道，
#   再次触发 SIGPIPE 再进 cleanup，实测直接跑飞 10 分钟不退出。
#   方案 B（忽略 SIGPIPE）才对：echo 只是返回失败，脚本正常走到结尾，
#   EXIT trap 必定执行，java 必定被回收。代价是管道下游关闭后脚本会空转跑完。
#
# 仍然建议：直接跑，或重定向到文件，别管道给 head/less。
trap '' PIPE
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# 5. 登录 —— token 字段名是 accessToken，不是 token
# ---------------------------------------------------------------------------
# 重试 3 次：实测在整机高负载（同机跑着 Nacos 和其他项目）时，
# 「服务已就绪」之后登录仍可能因为 -m 10 超时拿到空响应，
# 空响应会被误判成「token 字段名写错」，把人引到错误的排查方向。
LOGIN=""
for i in 1 2 3; do
  LOGIN=$(curl -s --noproxy '*' -m 25 -X POST \
    "http://127.0.0.1:${PORT}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PW}\"}")
  [ -n "$LOGIN" ] && break
  echo "    登录无响应（第 ${i} 次），等待重试"
  sleep 5
done

TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 自检：静默拿着空 token 往下跑会得出一堆假 401
if [ "${#TOKEN}" -lt 100 ]; then
  echo "!! TOKEN 未取到（长度 ${#TOKEN}），终止。登录响应: ${LOGIN:0:200}"
  tail -20 "$LOG" 2>/dev/null
  exit 1
fi
echo "TOKEN_LEN=${#TOKEN} ✓"

# ---------------------------------------------------------------------------
# 6. 逐个探测
# ---------------------------------------------------------------------------
echo
printf "%-52s %-6s %-8s %s\n" "端点" "HTTP" "业务码" "返回体预览"
printf '%s\n' "------------------------------------------------------------------------------------------------"

for ep in "${EPS[@]}"; do
  # 注意：curl 的 -w 参数不能以 @ 开头，否则会被当成「从文件读取格式」而静默失败
  RAW=$(curl -s --noproxy '*' -m 20 -w $'\n__HTTP__%{http_code}' \
    -H "Authorization: Bearer ${TOKEN}" \
    "http://127.0.0.1:${PORT}${API_PREFIX}${ep}")

  # __HTTP__200 按 "_" 切分第 5 段才是数字，别用 cut -d_ -f4
  HTTP_CODE=$(echo "$RAW" | grep -o '__HTTP__[0-9]*' | sed 's/.*__HTTP__//')
  BODY=$(echo "$RAW" | sed 's/__HTTP__[0-9]*$//')
  BIZ_CODE=$(echo "$BODY" | grep -o '"code":[0-9]*' | head -1 | cut -d: -f2)

  [ -z "$BIZ_CODE" ] && BIZ_CODE="-"
  PREVIEW=$(echo "$BODY" | tr -d '\n' | head -c "$SHOW_BODY")

  printf "%-52s %-6s %-8s %s\n" "$ep" "$HTTP_CODE" "$BIZ_CODE" "$PREVIEW"
done

# ---------------------------------------------------------------------------
# 7. 判读提示（脚本只给数据，结论由人下）
# ---------------------------------------------------------------------------
cat <<'NOTE'

=============================================================================
判读口径（本项目 utils/request.ts：code !== 0 时 reject）
-----------------------------------------------------------------------------
  业务码 0 且 data 非空  → 端点有数据，页面上的示例数据是死代码，可删
  业务码 500            → 前端 catch → 落入 mock 兜底 → 用户正在看假数据（P0）
  业务码 404            → 端点不存在 → 同上（P0），且补端点前要确认底层有没有数据源
  HTTP 非 200           → 网络/路由层问题，与业务码分开看

⚠️ 最重要的一条陷阱
-----------------------------------------------------------------------------
  「HTTP 200 + 业务码 0」≠ 对接成功。必须再核一步：
  **返回体的键名，和前端实际读取的键名是否一致。**

  本项目 /analytics/overview 就栽在这：返回 {"YIELD":..,"PASS_RATE":..,"COST":..}
  全大写，而前端 mergeOverview 读的是 farmCount / passRate 等小写驼峰，
  一个都读不到 → 15 个字段 100% 回落 PROTOTYPE_SAMPLE；
  又因为 code=0 不触发 isError，页面的「示例数据」Alert 永远不会出现。
  表面接口通了、界面正常，数字全是原型值。

  所以对「业务码 0」的端点，请人工比对键名后再下 P3 结论。
=============================================================================
NOTE

echo "日志: $LOG"
echo "端口 ${PORT} 将于脚本退出时随本进程 PID ${BGPID} 一起回收（不触碰其他进程）"
