#!/usr/bin/env bash
# 本地全栈一键启动 / 巡检（幂等：已在跑的服务不会重复启动）
#
# 为什么需要这个脚本：这台机器上的环境会整体重启，MySQL / Redis / nginx / 十个 Java 后端
# 一起没掉是常态。每次手工敲十几条命令既慢又容易漏，所以固化下来。
#
# 用法：
#   bash scripts/start-local-stack.sh            # 启动缺的组件（已在跑的跳过）
#   bash scripts/start-local-stack.sh --status   # 只巡检，不启动任何东西
#   bash scripts/start-local-stack.sh --force    # 先杀掉已知后端端口上的进程再重起
#
# 三个坑（写在最前面，省得下次再踩）：
#   1. 判断服务死活**不要只看 netstat** —— 沙箱会限制它，静默返回空，
#      看起来"全都没起"，其实 MySQL/Redis/nginx 活得好好的。
#      能用客户端直连判断就别用端口：mysql -e / redis-cli ping / curl。
#   2. 后台 shell 里 `java` 可能不在 PATH（exit 127），所以统一用 JAVA_HOME 拼绝对路径。
#   3. curl 必须带 `--noproxy '*'`：本机有 HTTP_PROXY，否则所有本地请求都走代理返回 502，
#      看起来像"服务全挂"，其实是请求根本没到本机。
#   4. nginx 进程在跑 ≠ 配置是最新的。只 reload 不 start：多加了 vhost 但没 reload 时，
#      老端口照常服务、新端口一个都不通（实测踩过：28 个端口只有 3 个在听）。

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAVA="${JAVA_HOME:-/c/Program Files/Amazon Corretto/jdk17.0.20_12}/bin/java"
JAVA="${JAVA//\\//}"                     # Windows 路径转 POSIX
MYSQL_BIN="/c/Program Files/MySQL/MySQL Server 8.4/bin"
MYSQL_DATA_INI="C:/ProgramData/MySQL/MySQL Server 8.4/my.ini"
REDIS_BIN="/c/Redis"
NGINX_BIN="/c/nginx/nginx.exe"
NGINX_PREFIX="C:/Users/71502/agri-gw"    # 指向 ops/gateway 的 ASCII junction
LOG_DIR="$ROOT/__tmpout/logs"

MODE="${1:-}"
mkdir -p "$LOG_DIR"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }
skip() { printf '  \033[90m·\033[0m %s\n' "$1"; }

# 必须绕开本机代理，否则本地请求会被 HTTP_PROXY 吃掉
http_code() { curl -s --noproxy '*' -o /dev/null -m 4 -w '%{http_code}' "$1" 2>/dev/null || echo 000; }

mysql_alive() { "$MYSQL_BIN/mysql.exe" -uroot -proot -e "SELECT 1" >/dev/null 2>&1; }
redis_alive() { "$REDIS_BIN/redis-cli.exe" -p 6379 ping 2>/dev/null | grep -q PONG; }
port_listen() { netstat -ano 2>/dev/null | awk -v p=":$1 " '$0 ~ p && /LISTENING/ {found=1} END {exit !found}'; }

# ---------- 0. 强制清理 ----------
if [ "$MODE" = "--force" ]; then
  echo "[0/4] 强制模式：停掉后端占用端口上的进程"
  for port in 8093 8083 8087 8088 8089 8091 8092 8094 8095 8096; do
    pid=$(netstat -ano 2>/dev/null | awk -v p=":$port " '$0 ~ p && /LISTENING/ {print $NF; exit}')
    if [ -n "${pid:-}" ]; then
      taskkill //PID "$pid" //F >/dev/null 2>&1 && warn "已停止端口 $port (PID $pid)"
    fi
  done
fi

# ---------- 1. MySQL ----------
echo "[1/4] MySQL"
if mysql_alive; then
  ok "已在运行"
elif [ "$MODE" = "--status" ]; then
  bad "未运行"
else
  warn "未运行，正在启动…"
  "$MYSQL_BIN/mysqld.exe" --defaults-file="$MYSQL_DATA_INI" --console \
    > "$LOG_DIR/mysql.log" 2>&1 &
  for _ in $(seq 1 40); do sleep 1; mysql_alive && break; done
  if mysql_alive; then ok "已启动"; else
    bad "启动失败，看 $LOG_DIR/mysql.log"
    echo "     常见原因：另一个 mysqld 已占用数据文件（报 ibdata1 must be writable）"
    echo "     → 说明它其实在跑，只是 mysql 客户端连不上，检查 3306 是否被别的实例占用"
  fi
fi

# ---------- 2. Redis ----------
echo "[2/4] Redis"
if redis_alive; then
  ok "已在运行"
elif [ "$MODE" = "--status" ]; then
  bad "未运行"
else
  warn "未运行，正在启动…"
  (cd "$REDIS_BIN" && ./redis-server.exe --port 6379 --save "" --appendonly no \
    > "$LOG_DIR/redis.log" 2>&1 &)
  for _ in $(seq 1 15); do sleep 1; redis_alive && break; done
  if redis_alive; then ok "已启动"; else bad "启动失败，看 $LOG_DIR/redis.log"; fi
fi

# ---------- 3. nginx 网关 ----------
GATEWAY_PORTS="80 8080 8081 8082 8084 8085 8086 8090 8098 8101 8102 8103 8104 8105 8106 8107 8108 8109 8110 8111 8113 8114 8115 8180 8181 8182 8183 8184 8190"
echo "[3/4] nginx 网关（ops/gateway，$(echo $GATEWAY_PORTS | wc -w) 个端口）"
nginx_pid=$(netstat -ano 2>/dev/null | awk '$2 ~ /:8090$/ && /LISTENING/ {print $NF; exit}')
missing_ports=""
for p in $GATEWAY_PORTS; do port_listen "$p" || missing_ports="$missing_ports $p"; done

if [ -n "$nginx_pid" ] && [ -z "$missing_ports" ]; then
  ok "已在运行，且 $(echo $GATEWAY_PORTS | wc -w) 个端口全在听"
elif [ "$MODE" = "--status" ]; then
  bad "nginx 未运行或配置落后；缺端口:$missing_ports"
elif [ -n "$nginx_pid" ]; then
  warn "进程在跑但配置落后（缺端口:$missing_ports），执行 reload"
  "$NGINX_BIN" -p "$NGINX_PREFIX" -c conf/nginx.conf -s reload >/dev/null 2>&1
  sleep 3
  still=""
  for p in $GATEWAY_PORTS; do port_listen "$p" || still="$still $p"; done
  if [ -z "$still" ]; then ok "已重载，$(echo $GATEWAY_PORTS | wc -w) 个端口齐全"; else bad "仍缺端口:$still（看 $NGINX_PREFIX/logs/error.log）"; fi
else
  warn "未运行，正在启动…"
  "$NGINX_BIN" -p "$NGINX_PREFIX" -c conf/nginx.conf >/dev/null 2>&1
  sleep 3
  if port_listen 8115; then ok "已启动"; else
    bad "启动失败：检查 $NGINX_PREFIX/conf/nginx.conf，或 temp/* 五个子目录是否齐全"
  fi
fi

# ---------- 4. 后端 ----------
start_backend() {
  local name="$1" dir="$2" jar="$3" port="$4" probe="$5" extra="${6:-}" envp="${7:-}"
  printf '  %-18s ' "$name"
  if [ "$(http_code "$probe")" != "000" ]; then
    ok "已在运行（:$port）"
    return
  fi
  if [ "$MODE" = "--status" ]; then
    bad "未运行（:$port）"
    return
  fi
  (
    cd "$ROOT/$dir" || exit 1
    # shellcheck disable=SC2086
    if [ -n "$envp" ]; then
      env $envp "$JAVA" -jar "$jar" --server.port="$port" $extra > "$LOG_DIR/$name.log" 2>&1 &
    else
      "$JAVA" -jar "$jar" --server.port="$port" $extra > "$LOG_DIR/$name.log" 2>&1 &
    fi
  )
  for _ in $(seq 1 90); do sleep 1; [ "$(http_code "$probe")" != "000" ] && break; done
  if [ "$(http_code "$probe")" != "000" ]; then ok "已启动（:$port）"; else
    bad "启动失败，看 $LOG_DIR/$name.log"
  fi
}

echo "[4/4] 后端服务（10 个）"
# 核心平台必须显式传库口令：yml 默认 root123，本机是 root
start_backend "core-platform"   "core-platform"            "core-app/target/core-app-1.0.0.jar"              8093 "/api/v1/sso/account/modules"          "" "MYSQL_PASSWORD=root"
# 主数据后端 yml 里写的是历史库口令（Agri@2024），本机 MySQL 实际是 root；不带覆盖会启动即挂（Access denied）
start_backend "agri-master-data" "agri-master-data/backend" "target/agri-master-data-1.0.0.jar"              8083 "/"                                     "--spring.datasource.password=root" ""
start_backend "agri-finance"    "agri-finance/backend"     "target/agri-finance-1.0.0-SNAPSHOT.jar"         8087 "/"                                     "" ""
start_backend "agri-s2b2c"      "agri-s2b2c"               "target/agri-s2b2c-1.0.0.jar"                    8088 "/api/consumer/products"                "" ""
start_backend "agri-trade"      "agri-trade/backend"       "target/agri-trade-1.0.0-SNAPSHOT.jar"           8089 "/api/trade/public/categories"          "" ""
start_backend "agri-iot"        "agri-iot/backend"         "target/agri-iot-platform-1.0.0.jar"             8091 "/"                                     "" ""
start_backend "agri-production" "agri-production/backend"  "target/agri-production-1.0.0-SNAPSHOT.jar"      8092 "/"                                     "--spring.profiles.active=dev" ""
start_backend "agri-service"    "agri-service"             "target/agri-service-1.0.0.jar"                  8094 "/"                                     "" ""
start_backend "agri-government" "agri-government"          "target/agri-government-1.0.0.jar"               8095 "/api/v1/government/identity"           "" ""
start_backend "agri-info"       "agri-info"                "target/agri-info-1.0.0.jar"                     8096 "/api/v1/info/public/overview"           "" ""

# ---------- 汇总 ----------
echo
echo "子系统入口（HTTP 200 才算通）："
print_front() {
  code="$(http_code "http://127.0.0.1:$1/")"
  if [ "$code" = "200" ] || [ "$code" = "302" ]; then
    printf '  %-3s %-22s %s\n' "$code" "$1" "$2"
  else
    printf '  \033[31m%-3s\033[0m %-22s %s\n' "$code" "$1" "$2"
  fi
}
print_front 80   "生产管理（用户端）"
print_front 8190 "生产管理（运营端入口）"
print_front 8080 "主数据管理平台"
print_front 8081 "供应链金融"
print_front 8082 "S2B2C 消费者商城"
print_front 8084 "S2B2C 供应商工作台"
print_front 8085 "S2B2C 渠道商工作台"
print_front 8103 "S2B2C 平台运营端"
print_front 8086 "交易与会员中心"
print_front 8181 "交易撮合移动端"
print_front 8101 "物联网（用户端）"
print_front 8102 "物联网（运营端）"
print_front 8111 "物联网（移动端）"
print_front 8105 "综合服务（用户端）"
print_front 8107 "综合服务（运营端）"
print_front 8106 "综合服务（移动端）"
print_front 8108 "政府监管（用户端）"
print_front 8110 "政府监管（运营端）"
print_front 8109 "政府监管（移动端）"
print_front 8104 "信息资讯"
print_front 8113 "信息资讯运营端"
print_front 8114 "信息资讯移动端"
print_front 8182 "S2B2C 商城移动端"
print_front 8183 "S2B2C 供应商移动端"
print_front 8184 "S2B2C 渠道商移动端"
print_front 8180 "用户统一入口（→ 生产移动端）"
print_front 8090 "统一认证中心 SSO"
print_front 8098 "官网门户"
print_front 8115 "用户中心运营端"
echo
echo "日志：$LOG_DIR"
echo "提示：后台进程可能随会话结束被回收，重新执行本脚本即可（幂等）；只巡检加 --status。"
