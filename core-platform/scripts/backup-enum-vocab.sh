#!/usr/bin/env bash
# =============================================================================
# 枚举词表迁移 —— 原值备份 dump（只读，产出「反向 UPDATE」回滚文件）
# =============================================================================
#
# 【这是什么】
#   把三张表在迁移**之前**的枚举原值逐行导成
#       UPDATE <表> SET <列>='<原值>' WHERE <主键>='<xxx>';
#   存成一个 .sql 文件留档。迁移出问题时，执行该文件即可按主键把原值写回去，
#   不需要整库 restore。
#
# 【为什么必须留这份档】
#   团队纪律：任何不可复原的写操作之前先留档。词表迁移属于「按规则批量改写」，
#   一旦映射写错（比如 WARN 该变 normal 却写成了 important），没有原值就只能用
#   备份库恢复，代价远比一份 dump 大。
#
# 【它不做的事】
#   * 不执行任何 UPDATE / DELETE / ALTER —— 全程只有 SELECT 和写本地文件。
#   * 不改动任何被 dump 的行。
#
# 【用法】
#   MYSQL_PWD=<本机 mysql 口令> bash core-platform/scripts/backup-enum-vocab.sh
#   OUT=/path/to/rollback.sql MYSQL_PWD=... bash core-platform/scripts/backup-enum-vocab.sh
#
# 【口令纪律】
#   口令一律从环境变量取，脚本内不写任何字面量（口令一旦进 git 就是永久泄露，
#   reset 也清不掉历史）。取值参考 core-platform 各模块 application*.yml 的
#   spring.datasource.password；注意 docker-compose 的值与本机直连常不一致。
#
# 【回滚顺序依赖 —— 必读，错了会静默截断】
#   ⚠️ 必须先执行本脚本产出的回滚文件（把新值改回旧值），**再**回滚列宽 V17。
#      原因：目标词表里 `important` 是 9 个字符，而当前列宽是 varchar(8)。
#      如果先把列宽缩回 8，回滚文件里的 'important' 会被**静默截断**成
#      'importan' —— 既丢了原值、又不报错，正是本项目反复在治的那类静默错误。
#
# 【2026-10-10 修复：本脚本曾经是「静默假成功」】
#   两个 bug，性质都是「退出码 0、文件生成了、头写得像模像样，但内容是空的」：
#     1. MYSQL_ARGS 数组漏了 "MYSQL"，数组第一个元素是 -N，bash 把 -N 当命令执行
#        → 三处 heredoc 全部报 `-N: command not found`，产物 0 条 UPDATE。
#     2. REPO_ROOT 只上溯一级（到 core-platform），而 OUT 默认值带 core-platform/
#        前缀 → 产物写进 core-platform/core-platform/scripts/generated/ 嵌套目录。
#   教训（已固化为下面第 130 行起的产物自检）：**备份脚本自己就是最容易假成功的
#   那类程序**——它不写业务数据，没人会去核对它的产物。因此必须以退出码 1 拦死，
#   不允许「生成了但可能是空的」这种中间态继续往下走。
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 脚本位于 <repo>/core-platform/scripts/，仓库根需上溯两级（到 agri-platform）。
# 只上溯一级的话 REPO_ROOT 会是 core-platform，而 OUT 默认值带 core-platform/ 前缀，
# 于是产物落进 core-platform/core-platform/scripts/generated/ 嵌套目录。
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

MYSQL="${MYSQL_BIN:-/c/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DB="${MYSQL_DB:-agri_core}"

STAMP="$(date +%Y%m%d%H%M%S)"
OUT="${OUT:-core-platform/scripts/generated/rollback-enum-vocab-${STAMP}.sql}"

if [ -z "${MYSQL_PWD:-}" ]; then
  echo "!! 未提供 MySQL 口令。脚本内不写字面量（团队纪律），请从环境变量传入："
  echo "     MYSQL_PWD=<本机 mysql 口令> bash $0"
  exit 1
fi

if [ ! -x "$MYSQL" ] && [ ! -f "$MYSQL" ]; then
  echo "!! 找不到 mysql 客户端: $MYSQL"
  echo "   可用 MYSQL_BIN=/path/to/mysql 覆盖。"
  exit 1
fi

mkdir -p "$(dirname "$OUT")" || { echo "!! 无法创建输出目录: $(dirname "$OUT")"; exit 1; }

# -N 不输出列名，-B 制表符分隔（避免 ASCII 表格边框混进产物）
# ⚠️ 第一个元素必须是 "$MYSQL" 本身；漏掉它 bash 会把 -N 当命令执行，
#    三处 heredoc 静默失败、产物变空文件（本脚本 2026-10-10 修的就是这个）。
MYSQL_ARGS=("$MYSQL" -N -B -u"$MYSQL_USER" -h"$MYSQL_HOST" "$MYSQL_DB" --default-character-set=utf8mb4)

count_rows() { # $1=表名 -> 行数（查不到表时输出 0，不让 set -u 把脚本打死）
  local n
  n="$("${MYSQL_ARGS[@]}" -e "SELECT COUNT(*) FROM $1;" 2>/dev/null | tr -d '\r' | tail -1)"
  case "$n" in
    ''|*[!0-9]*) echo 0 ;;
    *) echo "$n" ;;
  esac
}

EXP_TASKS=$(count_rows prod_task_info)
EXP_ALERTS=$(count_rows prod_alert_info)
EXP_RULES=$(count_rows prod_alert_rule)
EXP_TOTAL=$((EXP_TASKS + EXP_ALERTS + EXP_RULES))

{
  echo "-- ============================================================================="
  echo "-- 枚举词表迁移回滚文件"
  echo "-- 生成时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "-- 生成脚本: core-platform/scripts/backup-enum-vocab.sh"
  echo "-- 来源库:   ${MYSQL_DB}@${MYSQL_HOST}"
  echo "--"
  echo "-- 【回滚顺序依赖 —— 必读】"
  echo "--   ⚠️ 必须先执行本文件（把新值改回旧值），**再**回滚列宽 V17。"
  echo "--      目标词表里 important 是 9 字符，当前列宽是 varchar(8)；"
  echo "--      若先缩列宽，本文件里的 'important' 会被静默截断成 'importan'，"
  echo "--      原值丢失且不报错。"
  echo "--"
  echo "-- 【执行方式】"
  echo "--   MYSQL_PWD=<口令> mysql -uroot -h127.0.0.1 agri_core --default-character-set=utf8mb4 < 本文件"
  echo "--"
  echo "-- 【覆盖范围与预期条数】"
  echo "--   prod_task_info.status          （任务状态，8.1.1）        预期 ${EXP_TASKS} 条"
  echo "--   prod_alert_info.alert_level    （告警级别，告警表，8.1.2）预期 ${EXP_ALERTS} 条"
  echo "--   prod_alert_rule.alert_level    （告警级别，规则表）       预期 ${EXP_RULES} 条"
  echo "--   合计预期 ${EXP_TOTAL} 条"
  echo "-- ============================================================================="
  echo ""
  echo "SET NAMES utf8mb4;"
  echo ""

  echo "-- ---------------------------------------------------------------- 1. 任务状态"
  "${MYSQL_ARGS[@]}" <<'SQL' 2>&1 | grep -v "^mysql: \[Warning\]"
SELECT CONCAT('UPDATE prod_task_info SET status=', v, ' WHERE task_id=''', task_id, ''';')
  FROM (SELECT task_id,
               IF(status IS NULL, 'NULL',
                  CONCAT('''', REPLACE(status, '''', ''''''), '''')) AS v
          FROM prod_task_info) t
 ORDER BY task_id;
SQL

  echo ""
  echo "-- ---------------------------------------------------------------- 2. 告警级别（告警表）"
  "${MYSQL_ARGS[@]}" <<'SQL' 2>&1 | grep -v "^mysql: \[Warning\]"
SELECT CONCAT('UPDATE prod_alert_info SET alert_level=', v, ' WHERE alert_id=''', alert_id, ''';')
  FROM (SELECT alert_id,
               IF(alert_level IS NULL, 'NULL',
                  CONCAT('''', REPLACE(alert_level, '''', ''''''), '''')) AS v
          FROM prod_alert_info) t
 ORDER BY alert_id;
SQL

  echo ""
  echo "-- ---------------------------------------------------------------- 3. 告警级别（规则表）"
  echo "-- 注：本表可能含他人探针残留（deleted=1，rule_name 形如 __probe__ / __secrash2d-*）。"
  echo "--     本文件**一并原样备份**，不清理、不改写 —— 它们不属于本次迁移范围，"
  echo "--     保持原样是既定处置（断言一律限定 deleted=0）。"
  "${MYSQL_ARGS[@]}" <<'SQL' 2>&1 | grep -v "^mysql: \[Warning\]"
SELECT CONCAT('UPDATE prod_alert_rule SET alert_level=', v, ' WHERE rule_id=''', rule_id, ''';')
  FROM (SELECT rule_id,
               IF(alert_level IS NULL, 'NULL',
                  CONCAT('''', REPLACE(alert_level, '''', ''''''), '''')) AS v
          FROM prod_alert_rule) t
 ORDER BY rule_id;
SQL

  echo ""
  echo "-- ============================================================================="
  echo "-- 回滚后自检（执行完上面所有 UPDATE 后跑一遍，应与迁移前的分布完全一致）"
  echo "--   SELECT status, COUNT(*) FROM prod_task_info GROUP BY status;"
  echo "--   SELECT alert_level, COUNT(*) FROM prod_alert_info GROUP BY alert_level;"
  echo "--   SELECT alert_level, COUNT(*) FROM prod_alert_rule GROUP BY alert_level;"
  echo "-- ============================================================================="
} >"$OUT"

# ---------------------------------------------------------------------------
# 产物自检：备份脚本是最容易「静默假成功」的程序（不写业务数据，没人核对产物）。
# 因此这里必须拦死——条数为 0 或与三表实际行数对不上，一律 exit 1，禁止继续迁移。
# ---------------------------------------------------------------------------
# 注意：grep -c 在无匹配时输出 0 且退出码为 1，若写成 `|| echo 0` 会把两个 0 都塞进
# 变量（变成 "0\n0"），后续整数比较报 "integer expected"。故用 `|| true` 兜住退出码。
ROWS="$(grep -c '^UPDATE ' "$OUT" 2>/dev/null || true)"
ROWS="$(printf '%s' "$ROWS" | tr -cd '0-9')"
ROWS="${ROWS:-0}"

echo "回滚文件已生成: $OUT"
echo "  UPDATE 条数: ${ROWS} / 预期 ${EXP_TOTAL}"
echo "    明细预期: prod_task_info ${EXP_TASKS} + prod_alert_info ${EXP_ALERTS} + prod_alert_rule ${EXP_RULES}"

FAIL=0
if [ "$ROWS" -eq 0 ]; then
  echo "  !! 产物 0 条 UPDATE —— 备份失败，禁止继续迁移（未生成有效回滚路径，等于裸奔）"
  FAIL=1
elif [ "$ROWS" -ne "$EXP_TOTAL" ]; then
  echo "  !! 条数 ${ROWS} != 预期 ${EXP_TOTAL}，dump 不完整或被并发写入干扰，请重跑后再迁移"
  FAIL=1
fi
if [ "$EXP_TOTAL" -eq 0 ]; then
  echo "  !! 三张表行数合计为 0，连不上库或表名不对（口令/库名/主机请核对）"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "备份未通过自检，脚本以退出码 1 结束。请先修复再迁移。"
  exit 1
fi

echo "  ✓ 自检通过：条数与三表实际行数一致"
echo ""
echo "（本脚本全程只读，未执行任何 UPDATE / DELETE / ALTER）"
