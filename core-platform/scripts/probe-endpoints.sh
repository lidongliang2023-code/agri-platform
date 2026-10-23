#!/usr/bin/env bash
# =============================================================================
# 端点可用性探测脚本（只读）
#
# 用途：一键起 core-app → 登录 → 批量调端点 → 输出「HTTP / 业务码 / 返回体」对照表 → 关停。
#       用于判定「某个页面的示例数据是不是真的在被展示」，把静态审计结论落成实测结论。
#
# 用法：
#   MYSQL_PWD=<本机 mysql 口令> bash core-platform/scripts/probe-endpoints.sh
#   MYSQL_PWD=... bash core-platform/scripts/probe-endpoints.sh "/admin/tenants" "/admin/sop"
#   MYSQL_PWD=... EP_FILE=/tmp/my_eps.txt bash core-platform/scripts/probe-endpoints.sh
#
# 可覆盖的环境变量：
#   JAR               core-app jar 路径
#   MYSQL_PWD         MySQL 口令（必传，脚本内不写任何字面量——见第 4 节说明）
#   PORT_RANGE        "8091 8099" 端口探测区间
#   EP_FILE           每行一个端点（相对 /api/v1/production）的文件
#   SHOW_BODY         返回体预览字符数，默认 300
# =============================================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

# jar 取值优先级：显式 JAR= > 共享仓库成品包 > target/ 构建产物
#
# 默认优先取仓库里的成品包，而不是 target/：target/ 是并发 mvn 的重灾区，会被反复
# 冲成 30KB 无 BOOT-INF 的半成品包（实测过多次），导致体积守卫误判、全队被阻塞。
# 仓库包是 install 产物，不参与 target 的覆写竞争，相对稳定。
# 仓库包万一被清理时，回落到 target/，而不是直接报「jar 不存在」。
REPO_JAR="/c/maven/repository/com/agri/core-app/1.0.0/core-app-1.0.0.jar"
TARGET_JAR="core-platform/core-app/target/core-app-1.0.0.jar"
if [ -n "${JAR:-}" ]; then
  :  # 调用方显式指定，一律尊重
elif [ -f "$REPO_JAR" ]; then
  JAR="$REPO_JAR"
else
  JAR="$TARGET_JAR"
fi
PW_SRC="core-platform/mod-platform/src/main/java/com/agri/platform/internal/auth/AdminUserInitializer.java"
API_PREFIX="/api/v1/production"
SHOW_BODY="${SHOW_BODY:-300}"
PORT_RANGE="${PORT_RANGE:-8091 8099}"
# 就绪预算（秒）。默认 300：高负载时（本机实测同时跑着十几个 java.exe）
# core-app 冷启动远超 120s，给少了会超时退出，而超时会被误报成「口令错」。
READY_TIMEOUT="${READY_TIMEOUT:-300}"

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
  echo "!! 现在跑出来的任何结论都不可信。"
  echo "!! 处置：确认没有人在跑 maven 后重试（当前团队纪律：禁止并发 mvn）。"
  echo "!!       不要空等某个特定的人——构建方随时会换，‘等谁报告’这类文案当天就会过期。"
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
# 4. 启动
#
# 口令一律从环境变量取，脚本里不写任何字面量。
#   团队纪律：口令一旦进 git 就是永久泄露（reset 也清不掉历史），
#   而收益只是少打几个字符。本脚本早期版本内联过候选口令，现已移除。
#
# 另一条踩过的坑（仍要靠人来注意，脚本帮不上）：
#   docker-compose 里配的口令和本机直连常常不是同一个，
#   所以「mysql 客户端自检通过」≠「应用能连」。口令来源要自己确认。
# ---------------------------------------------------------------------------
CANDIDATES=()
if [ -n "${MYSQL_PWD:-}" ]; then CANDIDATES+=("$MYSQL_PWD"); fi
if [ -n "${MYSQL_PASSWORD:-}" ] && [ "${MYSQL_PASSWORD:-}" != "${MYSQL_PWD:-}" ]; then
  CANDIDATES+=("$MYSQL_PASSWORD")
fi

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "!! 未提供 MySQL 口令。脚本内不写字面量（团队纪律），请从环境变量传入："
  echo "     MYSQL_PWD=<本机 mysql 口令> bash $0 [端点...]"
  echo "   取值参考 core-platform 各模块的 application*.yml 里 spring.datasource.password，"
  echo "   注意 docker-compose 的值与本机直连常不一致，两者都要试。"
  exit 1
fi

LOG="/tmp/probe_ep_${PORT}.log"
BGPID=""

# ⚠️ trap 必须在「启动 java」之前注册。
#    曾出过事故：java 起来了、脚本在往后几行炸掉（那时是被人改坏多了一个 }），
#    而 trap 还排在后面没执行到 → java 成孤儿、端点一个没探。
#    bash 是在信号发生时才按名字找函数，所以这里可以先注册、函数定义在后面。
trap cleanup EXIT INT TERM PIPE

# jar 快照：并发 mvn 会原地重写 target/ 与共享仓库里的 jar，直接 java -jar
# 会在 JVM 运行途中读到被覆盖的字节（实测 30,485 字节残片）。
# 先 cp 一份到自己的临时目录锁住，全程只对快照操作。
# （注意：core-app-1.0.0.jar.original 恒为 30,485 字节是 repackage 的正常产物，
#   跟包好坏无关，别拿它当判据。）
SNAP=""
snapshot_jar() {
  SNAP="/tmp/probe_ep_snap_${PORT}.jar"
  rm -f "$SNAP" 2>/dev/null
  cp "$JAR" "$SNAP" 2>/dev/null || { echo "!! jar 快照失败: $JAR"; return 1; }
  local s
  s=$(wc -c <"$SNAP" 2>/dev/null)
  if [ "$s" != "$JAR_SIZE" ]; then
    echo "!! 快照体积 ${s} 与采样体积 ${JAR_SIZE} 不一致（cp 期间源文件被改写），中止"
    return 1
  fi
  echo "jar 快照: $SNAP (${s} bytes)"
  return 0
}

start_app() {
  local pw="$1"
  # 只打印长度，不回显口令
  echo "--- 启动（MySQL 口令来自环境变量，长度 ${#pw}）"
  # 走 SPRING_DATASOURCE_PASSWORD 环境变量而不是 --spring.datasource.password=，
  # 后者会把口令暴露在进程命令行里（tasklist / wmic 能直接看到）。
  SPRING_DATASOURCE_PASSWORD="$pw" java -jar "$SNAP" \
    --server.port="$PORT" \
    --spring.flyway.enabled=false >"$LOG" 2>&1 &
  BGPID=$!

  local i code
  for ((i = 1; i <= READY_TIMEOUT; i++)); do
    # 判据 1（主）：本项目启动完成标志。
    #   ⚠️ 不能 grep 标准的 "Tomcat started on port(s): N (http)" —— 本项目实际
    #   文案是 "Tomcat started on port N (http)"，没有 (s)。匹配标准版会永远
    #   等不到，空转到超时，表现成「登录无响应 / TOKEN 长度 0」，极易被误判成
    #   口令错或端点错（se-ai 卡死就是这条）。
    if grep -q "Started CorePlatformApplication" "$LOG" 2>/dev/null; then
      echo "    服务已就绪（${i}s，日志标志 Started CorePlatformApplication）"
      return 0
    fi
    # 判据 2（兜底）：curl 探活。日志文案万一再变也不至于空等满预算。
    code=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' -m 3 \
      "http://127.0.0.1:${PORT}/api/v1/auth/login" \
      -X POST -H 'Content-Type: application/json' -d '{}')
    if [ "$code" != "000" ]; then
      echo "    服务已就绪（${i}s，curl 探活 HTTP=${code}）"
      return 0
    fi
    # 真·口令问题：立即失败，不用等满预算
    if grep -q "Access denied" "$LOG" 2>/dev/null; then
      echo "    数据源认证失败（日志含 Access denied）——这是口令问题"
      return 1
    fi
    if grep -q "APPLICATION FAILED TO START" "$LOG" 2>/dev/null; then
      echo "    应用启动失败（日志含 APPLICATION FAILED TO START）"
      return 1
    fi
    sleep 1
  done
  echo "    启动超时（预算 ${READY_TIMEOUT}s 耗尽）——这不是口令问题"
  echo "    高负载时 core-app 冷启动实测可超过 120s。调大预算："
  echo "      READY_TIMEOUT=600 MYSQL_PWD=... bash $0 ..."
  return 1
}

snapshot_jar || exit 1

STARTED=0
for pw in "${CANDIDATES[@]}"; do
  if start_app "$pw"; then STARTED=1; break; fi
  [ -n "$BGPID" ] && kill "$BGPID" 2>/dev/null
  sleep 1
done

if [ "$STARTED" -ne 1 ]; then
  # 超时和口令失败必须分开报。共用一句「数据源连不上」会让人以为口令错了，
  # 然后去改口令、往脚本里塞候选口令——正好违背「口令一律走环境变量」的纪律。
  echo "!! 启动失败。判读："
  if grep -q "Access denied" "$LOG" 2>/dev/null; then
    echo "   日志含 Access denied  → 是 MySQL 口令问题，确认 MYSQL_PWD 后重试"
  else
    echo "   日志无 Access denied  → 不是口令问题，多半是启动超时或应用自身失败"
    echo "   重试（加大预算）：READY_TIMEOUT=600 MYSQL_PWD=... bash $0 ..."
  fi
  echo "   日志尾部:"; tail -20 "$LOG" 2>/dev/null
  exit 1
fi

# 无论正常结束还是异常退出，只回收本脚本自己起的这个 PID
CLEANUP_DONE=0
cleanup() {
  # 重入保护：cleanup 里的 echo 写向已被关闭的管道会再次触发 SIGPIPE，
  # 若 trap 里挂了 PIPE 就会无限递归（实测跑飞 10 分钟不退出）。
  # 有了这个闸门就可以同时挂 PIPE（保证 SIGPIPE 打断时也回收）而不递归。
  [ "$CLEANUP_DONE" = "1" ] && return 0
  CLEANUP_DONE=1

  # 快照必须在所有 return 之前删，否则函数提前返回就漏删。
  # 留着会占 /tmp，且握着 jar 副本不放会加重 Windows 文件锁竞争。
  rm -f "$SNAP" 2>/dev/null

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
  return 0
}

#
# trap 挂 PIPE 是必要的（SIGPIPE 打断时也要回收 java，否则留僵尸进程握着 jar
# 触发 Windows 文件锁，全队 mvn 报 Unable to rename ... to ...jar.original）。
# 但必须配上面的 CLEANUP_DONE 重入闸门：cleanup 自己 echo 到已关闭的管道会
# 再次触发 SIGPIPE，无闸门时直接无限递归（实测跑飞 10 分钟不退出）。
#
# 注册点在「启动 java」之前（见第 4 节开头），这里不再重复注册。
# 仍然建议：直接跑，或重定向到文件，别管道给 head/less。

# ---------------------------------------------------------------------------
# 5. 登录 —— token 字段名是 accessToken，不是 token
# ---------------------------------------------------------------------------
# 重试 3 次：实测在整机高负载（同机跑着 Nacos 和其他项目）时，
# 「服务已就绪」之后登录仍可能因为 -m 10 超时拿到空响应，
# 空响应会被误判成「token 字段名写错」，把人引到错误的排查方向。
LOGIN=""
LOGIN_HTTP=""
for i in 1 2 3; do
  # -w 参数不能以 @ 开头，否则会被当成「从文件读取格式」而静默失败
  RAW_LOGIN=$(curl -s --noproxy '*' -m 25 -w $'\n__HTTP__%{http_code}' -X POST \
    "http://127.0.0.1:${PORT}/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PW}\"}")
  LOGIN_HTTP=$(echo "$RAW_LOGIN" | grep -o '__HTTP__[0-9]*' | sed 's/.*__HTTP__//')
  LOGIN=$(echo "$RAW_LOGIN" | sed 's/__HTTP__[0-9]*$//')
  [ -n "$LOGIN" ] && break
  echo "    登录无响应（第 ${i} 次，HTTP=${LOGIN_HTTP:-空}），等待重试"
  sleep 5
done

TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# 自检：静默拿着空 token 往下跑会得出一堆假 401
if [ "${#TOKEN}" -lt 100 ]; then
  # 失败可读性：把 HTTP 状态码与响应体原文打印出来，
  # 让下一个卡住的人一眼区分「端口没起 / 口令错 / 端点路径错」，
  # 而不是像以前那样只看到一个空的登录响应、无从下手。
  echo "!! TOKEN 未取到（长度 ${#TOKEN}），终止"
  echo "   HTTP 状态码        : ${LOGIN_HTTP:-（无响应）}"
  echo "   登录响应体(前300字) : ${LOGIN:0:300}"
  echo "   管理员口令长度      : ${#ADMIN_PW}（不回显内容）"
  echo "   登录端点            : http://127.0.0.1:${PORT}/api/v1/auth/login"
  echo "   判读提示            : 本项目 GlobalExceptionHandler 的 catch-all 无 @ResponseStatus，"
  echo "                         HTTP 恒为 200，成败只能看返回体里的 code 字段。"
  echo "                         端点须为 /api/v1/auth/login（不是 /api/v1/platform/auth/login）。"
  tail -20 "$LOG" 2>/dev/null
  exit 1
fi
echo "TOKEN_LEN=${#TOKEN} ✓"

# ---------------------------------------------------------------------------
# 6. 逐个探测
# ---------------------------------------------------------------------------
echo
printf "%-52s %-6s %-8s %-26s %s\n" "端点" "HTTP" "业务码" "初判" "返回体预览"
printf '%s\n' "----------------------------------------------------------------------------------------------------------------"

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

  # 初判只覆盖「删兜底三条件」里的第①条：端点存在且返回真行。
  # 第②条键名、第③条形状必须人工比对，脚本给不了 —— 所以业务码 0 一律标
  # 「P3候选」而不是「可删」。标成「可删」会让人照着脚本输出直接删兜底，
  # 得到静默空白或空壳行，比留着兜底更难发现。
  case "$BIZ_CODE" in
    0)
      if echo "$BODY" | grep -q '"data":null\|"data":\[\]\|"data":""'; then
        VERDICT="P0(条件①未过:无数据)"
      else
        VERDICT="P3候选(待验键名/形状)"
      fi
      ;;
    404) VERDICT="P0(条件①未过:端点不存在)" ;;
    500) VERDICT="P0(条件①未过:端点报错)" ;;
    *) VERDICT="-" ;;
  esac

  printf "%-52s %-6s %-8s %-26s %s\n" "$ep" "$HTTP_CODE" "$BIZ_CODE" "$VERDICT" "$PREVIEW"
done

# ---------------------------------------------------------------------------
# 7. 判读提示（脚本只给数据，结论由人下）
# ---------------------------------------------------------------------------
cat <<'NOTE'

=============================================================================
判读口径（本项目 utils/request.ts：code !== 0 时 reject）
-----------------------------------------------------------------------------
  本项目的 HTTP 恒为 200（catch-all 无 @ResponseStatus），
  成败只能看返回体里的 code：0 成功 / 404 记录不存在 / 500 端点不存在或真异常。

  删兜底必须三条同时满足（脚本只负责验第①条）：
    ① 端点存在且返回真行   ← 「初判」列：P3候选 = 这条过了
    ② 键名对得上           ← 后端 Entity 字段 vs 前端 type 字段，人工比对
    ③ 形状对得上           ← 前端按 PageResult 解构的，后端就得返回 PageResult，
                              不能是裸 List（实测 /admin/approvals/config、
                              /admin/reports/quality、/analytics/reports 都是裸数组）

  只凭①就删兜底，会得到两种比保留兜底更难发现的结果：
    - 静默空白：形状不对，list/total 全 undefined → 空表
    - 空壳行  ：键名不对，行能渲染但关键列全空，只剩 ID 和类型

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
