/**
 * 库存四态纯函数验证：resolveStockState / buildExpireMap
 *
 * 背景：仓库当前未引入测试框架（package.json 无 vitest / jest），且这两个函数是
 * 投入品档案页与出入库页共用的判定核心，一旦漂移就会出现「库存页显示临期、
 * 档案页显示预警」这类不一致。因此这里用零依赖自检脚本锁住行为。
 *
 * 设计取舍：
 * - **不引入任何新依赖**，手写断言，避免为了跑测试而改动工程依赖树
 * - **放在 src 下**（而非独立脚本目录），这样 `tsc --noEmit` 会一并类型检查本文件。
 *   一旦有人改动这两个函数的签名或返回值类型，类型层会先报错——这才是「锁」的意义
 * - **不被任何业务代码 import**，因此 `vite build` 不会把它打进产物
 *
 * 运行方式（复用已有 esbuild，无需安装依赖）：
 * ```
 * npx esbuild src/pages/user/inputs/stockState.check.ts \
 *   --bundle --platform=node --format=cjs --packages=external \
 *   --outfile=node_modules/.cache/stockState.check.cjs
 * node node_modules/.cache/stockState.check.cjs
 * ```
 * 全部通过时输出 ✓ 清单并正常退出；存在失败时打印差异并抛错（退出码非 0）。
 */
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { EXPIRING_DAYS, buildExpireMap, resolveStockState } from './shared'

/** 单条断言结果 */
interface CheckCase {
  /** 用例名 */
  name: string
  /** 实际值 */
  actual: unknown
  /** 期望值 */
  expected: unknown
  /** 是否通过 */
  passed: boolean
}

const cases: CheckCase[] = []

/**
 * 记录一条相等断言
 * @param name 用例名
 * @param actual 实际值
 * @param expected 期望值
 */
function expectEq(name: string, actual: unknown, expected: unknown): void {
  cases.push({ name, actual, expected, passed: Object.is(actual, expected) })
}

/** 以今天为基准生成 YYYY-MM-DD 日期串 */
const today: Dayjs = dayjs()
const fmt = (d: Dayjs): string => d.format('YYYY-MM-DD')
const plus = (days: number): string => fmt(today.add(days, 'day'))

/**
 * 把效期映射转为可稳定比较的普通对象（键排序后序列化）
 * @param map 效期映射
 * @returns 序列化字符串
 */
function serializeMap(map: Map<string, string>): string {
  const plain: Record<string, string> = {}
  Array.from(map.keys())
    .sort()
    .forEach((key) => {
      plain[key] = map.get(key) ?? ''
    })
  return JSON.stringify(plain)
}

/* ------------------------------------------------------------------ *
 * resolveStockState：四态与优先级
 * ------------------------------------------------------------------ */

// 1. 不足：库存不高于安全下限（预警阈值）
expectEq('不足：库存低于预警阈值', resolveStockState(5, 10), 'shortage')
// 2. 不足：恰好等于阈值（边界含等号）
expectEq('不足：库存恰好等于阈值', resolveStockState(10, 10), 'shortage')
// 3. 预警：高于阈值但不超过 1.5 倍
expectEq('预警：介于阈值与 1.5 倍之间', resolveStockState(12, 10), 'warning')
// 4. 预警：恰好等于 1.5 倍（边界含等号）
expectEq('预警：恰好 1.5 倍', resolveStockState(15, 10), 'warning')
// 5. 正常：超过 1.5 倍
expectEq('正常：高于 1.5 倍阈值', resolveStockState(16, 10), 'normal')

// 6. 临期：效期在 30 天内，即使库存充足也必须判为临期（临期 > 预警 > 正常）
expectEq('临期压制正常：库存充足但效期近', resolveStockState(100, 10, plus(10)), 'expiring')
// 7. 临期边界：恰好 30 天仍算临期（<=）
expectEq(
  `临期边界：恰好 ${EXPIRING_DAYS} 天`,
  resolveStockState(100, 10, plus(EXPIRING_DAYS)),
  'expiring',
)
// 8. 临期边界：31 天不算临期，回落正常
expectEq(
  '临期边界：第 31 天不再算临期',
  resolveStockState(100, 10, plus(EXPIRING_DAYS + 1)),
  'normal',
)
// 9. 已过期批次：天数差为负，同样落在 30 天窗口内 → 临期
expectEq('临期：批次已过期', resolveStockState(100, 10, plus(-5)), 'expiring')

// 10. 优先级：不足 > 临期（既有库存不足又临期时，报更紧急的「不足」）
expectEq('优先级：不足压制临期', resolveStockState(5, 10, plus(3)), 'shortage')
// 11. 优先级：临期 > 预警（库存处于预警区间且临期时，报「临期」）
expectEq('优先级：临期压制预警', resolveStockState(12, 10, plus(3)), 'expiring')

// 12. 边界：未设置预警阈值时跳过库存维度，无临期即正常
expectEq('边界：无阈值无效期', resolveStockState(5, undefined), 'normal')
// 13. 边界：阈值为 null 同样跳过库存维度
expectEq('边界：阈值为 null', resolveStockState(5, null), 'normal')
// 14. 边界：三个入参全空
expectEq('边界：全空入参', resolveStockState(), 'normal')
// 15. 边界：库存为 0 且阈值为 0 → 0 <= 0 判不足
expectEq('边界：库存与阈值同为 0', resolveStockState(0, 0), 'shortage')
// 16. 边界：效期为 null（后端无流水时返回 null）不触发临期
expectEq('边界：效期为 null', resolveStockState(100, 10, null), 'normal')
// 17. 边界：效期为空串不触发临期（dayjs 解析为 Invalid Date，被 isValid 拦下）
expectEq('边界：效期为空串', resolveStockState(100, 10, ''), 'normal')
// 18. 边界：效期为非法字符串同样不触发临期
expectEq('边界：效期为非法日期', resolveStockState(100, 10, 'not-a-date'), 'normal')

/* ------------------------------------------------------------------ *
 * buildExpireMap：批次效期归集
 * ------------------------------------------------------------------ */

// 19. 空数组 → 空映射
expectEq('buildExpireMap：空数组', serializeMap(buildExpireMap([])), '{}')
// 20. 流水缺 expireDate → 忽略
expectEq(
  'buildExpireMap：缺效期字段',
  serializeMap(buildExpireMap([{ inputId: 'A' }])),
  '{}',
)
// 21. 流水缺 inputId → 忽略
expectEq(
  'buildExpireMap：缺投入品 ID',
  serializeMap(buildExpireMap([{ expireDate: plus(5) }])),
  '{}',
)
// 22. 效期为非法日期 → 忽略
expectEq(
  'buildExpireMap：非法日期',
  serializeMap(buildExpireMap([{ inputId: 'A', expireDate: 'bad' }])),
  '{}',
)

// 23. 多个未过期批次 → 取最早的未过期效期
expectEq(
  'buildExpireMap：多个未来效期取最早',
  serializeMap(
    buildExpireMap([
      { inputId: 'A', expireDate: plus(20) },
      { inputId: 'A', expireDate: plus(5) },
      { inputId: 'A', expireDate: plus(40) },
    ]),
  ),
  JSON.stringify({ A: plus(5) }),
)

// 24. 混合（有未来有已过期）→ 取未来的，忽略已过期的
expectEq(
  'buildExpireMap：已过期批次让位于未过期批次',
  serializeMap(
    buildExpireMap([
      { inputId: 'A', expireDate: plus(-30) },
      { inputId: 'A', expireDate: plus(15) },
    ]),
  ),
  JSON.stringify({ A: plus(15) }),
)

// 25. 全部已过期 → 取最接近今天（最晚）的那个，避免陈年旧批次误判整批临期
expectEq(
  'buildExpireMap：全部过期取最接近今天',
  serializeMap(
    buildExpireMap([
      { inputId: 'A', expireDate: plus(-300) },
      { inputId: 'A', expireDate: plus(-3) },
      { inputId: 'A', expireDate: plus(-60) },
    ]),
  ),
  JSON.stringify({ A: plus(-3) }),
)

// 26. 多个投入品 → 按 inputId 分组互不影响
expectEq(
  'buildExpireMap：多投入品分组',
  serializeMap(
    buildExpireMap([
      { inputId: 'A', expireDate: plus(8) },
      { inputId: 'B', expireDate: plus(2) },
      { inputId: 'A', expireDate: plus(30) },
    ]),
  ),
  JSON.stringify({ A: plus(8), B: plus(2) }),
)

// 27. 与 resolveStockState 串联：映射结果喂给判定能得到临期
const linked = buildExpireMap([{ inputId: 'A', expireDate: plus(7) }])
expectEq('串联：映射结果喂给四态判定', resolveStockState(100, 10, linked.get('A')), 'expiring')
// 28. 与 resolveStockState 串联：无对应批次时 get 返回 undefined，判定回落正常
expectEq('串联：无批次时回落正常', resolveStockState(100, 10, linked.get('B')), 'normal')

/* ------------------------------------------------------------------ *
 * 执行与输出
 * ------------------------------------------------------------------ */

const failed = cases.filter((item) => !item.passed)

cases.forEach((item) => {
  const flag = item.passed ? '✓' : '✗'
  const line = `${flag} ${item.name}`
  if (item.passed) {
    console.log(line)
  } else {
    console.log(`${line}\n    期望: ${String(item.expected)}\n    实际: ${String(item.actual)}`)
  }
})

console.log(
  `\n库存四态自检：共 ${cases.length} 条，通过 ${cases.length - failed.length} 条，失败 ${failed.length} 条`,
)

if (failed.length > 0) {
  throw new Error(`库存四态自检失败 ${failed.length} 条：${failed.map((f) => f.name).join(' / ')}`)
}

export {}
