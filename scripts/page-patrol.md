# 页面运行时巡检台（page-patrol）

用真实 Chromium 浏览器逐条打开生产管理模块的页面并记录运行时表现。
路由清单从 `agri-production/frontend/src/router/routes.tsx` **自动解析**，不手写路径清单。

## 前置条件

1. **浏览器驱动**（不进 package.json，务必 `--no-save`）：

   ```bash
   cd agri-production/frontend
   npm i puppeteer --no-save
   # 默认源失败时：
   npm i puppeteer --no-save --registry=https://registry.npmmirror.com
   ```

   首次安装会下载 Chrome 到 `~/.cache/puppeteer`（约 190MB，本仓库网络实测约 30 分钟）。

2. **后端**（前端 dev 代理 `/api` → `http://localhost:8099`，见 `vite.config.ts`）：

   ```bash
   # 先把 target 里的 jar 复制一份快照再跑，避免并发构建覆盖
   SPRING_DATASOURCE_USERNAME=root SPRING_DATASOURCE_PASSWORD=root \
     java -jar core-app-1.0.0.jar --server.port=8099
   ```

   就绪判据：日志出现 `Started CorePlatformApplication`。

3. **前端**：

   ```bash
   cd agri-production/frontend
   npx vite --port 5199
   ```

## 登录态

巡检台自己调 `POST /api/v1/auth/login` 换取 `accessToken`，再在页面脚本执行前
按 `src/store/auth.ts` 的键（`agri_token` / `agri_user_info` / `agri_permissions` …）
注入 localStorage，注入形状与 `src/api/auth.ts` 的 `persistSession` 完全同构。

口令优先级：`--pass` > 环境变量 `AGRI_ADMIN_PASSWORD` > 源码默认值。
不要把口令写进 shell 历史，用环境变量。

## 用法

```bash
# 全量 96 条轻量巡检（goto + console error + pageerror）
node scripts/page-patrol.mjs --mode light

# 深度巡检前 N 条（额外截图 + 白屏判定 + 演示数据横幅判定）
node scripts/page-patrol.mjs --mode deep --limit 10

# 精确指定若干页做深检（`=` 前缀=全路径精确匹配，路径可省略开头的 /）
node scripts/page-patrol.mjs --mode deep \
  --filter "=production/dashboard,=admin/production/knowledge"

# 其它常用项
#   --base http://localhost:5199   前端基址
#   --api   http://localhost:8099  后端基址
#   --only-user / --only-admin     只跑用户端 / 运营端
#   --no-login                     以未登录态巡检
#   --filter farms                 子串过滤
#   --out /tmp/report.json         JSON 报告路径
#   --shots /tmp/shots             截图目录（默认 /tmp，绝不写进仓库）
```

> **Git Bash / MSYS 用户注意**：以 `/` 开头的过滤参数会被 MSYS 强制转换成本地盘路径
> （实测 `=/production/dashboard` 被改成 `=D:/Program Files/.../dashboard`），
> 所以精确匹配时**请省略开头的 `/`**：`"=production/dashboard"`。

## 输出

- 控制台：逐页进度 + 汇总 + Markdown 明细表
- `--out` 指定的 JSON 报告（含全部记录与 summary）
- `--shots` 目录下的截图（仅 `--mode deep`）

每条记录字段：`路径 / 是否白屏 / console错误数（含真实错误数，剥离 antd 弃用告警等
框架噪声，原始值同样保留）/ 首条错误文本 / 是否出现演示数据横幅 / 截图路径`。

## 关于崩溃栈里的行号（重要）

`firstPageErrorStack` 里的 `xxx.tsx:406:83` 是 **Vite 下发模块**的行号，
不是仓库里原始文件的行号——esbuild 的 JSX 转译会整体偏移行号（实测
DisasterReview.tsx 偏移约 96 行）。引用堆栈时必须回原始文件核对，或一并说明这是转译后行号。

核对办法：

```bash
curl -s --noproxy '*' "http://localhost:5199/src/pages/admin/alerts/DisasterReview.tsx" -o /tmp/served.js
sed -n '406p' /tmp/served.js   # 看这一行是什么，再回原文件 grep 定位真实行号
```

## 渲染断言 harness 的三个坑（jsdom + react-dom/client + act + Vite SSR）

浏览器巡检之外，若要在 **Node 里真实挂载页面并断言渲染产物**（`renderToString` 不跑
`useEffect`，凡是请求写在 `useEffect` 里的页面都验不到东西，必须上 jsdom + `act`），
下面三个坑会直接导致**假红 / 假绿**，踩过一遍，记在这里免得重复排查。

### 1. `echarts-for-react` 在 SSR 里会被解析成对象，不是组件

现象：`Element type is invalid: expected a string ... but got: object`，崩溃栈指向用
`<ReactECharts />` 的那一行。

原因：该包是 CJS，`require()` 得到 `{ default: fn }`；Vite SSR 把 node_modules 依赖
externalize，interop 没兜住。**浏览器端由 Vite 打包处理，完全正常** —— 所以这是
harness 侧问题，**不是页面 bug**，不要去改页面。

处理：把 `echarts-for-react` alias 成一个桩组件，把 `option.series[0].data` 以文本渲染
出来，这样饼图/柱图的**真实数据**仍然可以断言。

⚠️ alias 必须写进 `resolve.alias`，**写在自定义插件的 `resolveId` 里不生效** ——
`vite:alias` 先跑，会把裸包名解析成 node_modules 路径并 externalize。

### 2. Modal / message / Tooltip 走 portal，只读 `container.innerHTML` 会漏掉内容

现象：交互明明执行了（弹窗都开了），断言却说结果不存在，误判成"功能没生效"。

原因：antd 的弹窗类组件挂在 `document.body` 上，不在挂载容器里。批量验真结果弹窗、
`message` toast 全都会漏掉。

处理：挂载前记录 `document.body.children` 快照作为基线，断言时取"基线之外的 body 子节点"。
**记得把容器自身也排除掉**，否则 HTML 会整份重复一倍。

### 3. 用例隔离不能靠 `document.body.innerHTML = ''`

现象：跑批随机崩在某个用例，报
`NotFoundError: The node to be removed is not a child of this node`。

原因：清空 body 后，上一个用例残留的 in-flight 请求 resolve，React 去更新一棵**已 detach**
的树，rc-motion 退场动画移除节点时抛错。打真实后端时必现（比替身慢），打替身时偶现。

处理：**不要清空 body，也不要在下一个用例开始时 `root.unmount()`**（unmount 同样会触发）。
改为「不清空 + 按基线过滤」，并在每个用例开始前留约 300ms 让上一个用例的请求 settle。

### 附：两条同源的小经验

- `process.env` 必须在**调用时**读取，不能在替身模块的顶层读 —— Vite SSR 模块只求值一次，
  顶层读会让后续用例一直沿用第一个用例的值，制造**假通过**（live 用例实际打的是替身）。
- 断言文案若包含被 `<strong>` 等标签包裹的文字，HTML 去标签时**不要插空格**替换
  （`replace(/<[^>]*>/g, '')`），否则「是推导值」会变成「是 推导值」，断言不上。

## 端点实测：404 / 500 的三种成因（看代码判定会全判错）

后端 **HTTP 恒为 200**，一切成败都在 body 的 `code` 里（`request.ts` 的 SUCCESS_CODE=0）。
因此"这个接口是不是不存在"只能靠**实测 body**，不能靠看 URL 像不像、也不能靠看有没有 404 页。
下面三种成因的表现完全不同，混为一谈会得出完全错误的结论（实测自 core-app :8098）。

### 1. 「404 资源不存在」很可能不是"没数据"，而是 URL 被通配 `/{id}` 吞了

现象：`GET /settings/tenant`、`GET /analytics/dimension` 都返回 `code=404 资源不存在`，
看起来像"这个租户/这个维度没有数据"。

真相：控制器里有 `@GetMapping("/{id}")` 的**详情端点**，这些子路径被它当成 id 匹配走了，
`detail("tenant")` 查不到就抛 NOT_FOUND。判定方法（很硬，建议照抄）：

```
GET /analytics/dimension        → 404 资源不存在
GET /analytics/zzz-not-exist    → 404 资源不存在   ← 与上面**完全一致**
GET /analytics/DEMO-SNAP-001    → 200 有数据
```

**与一个确定不存在的 id 返回完全一致 = 端点缺失**，不是数据缺失。

⚠️ 危害：诊断时会把"资源不存在"误读成数据问题，于是去补数据、加兜底、造示例数据，
而实际上那个端点从来没有过。同一个 `/{id}` 也会吞掉**写**请求——
`PUT /settings/tenant`、`PUT /settings/batch` 都走 `@PutMapping("/{id}")`。

### 2. 端点完全不存在时是 **500**，不是 404 —— 看 `NoResourceFoundException`

没有任何 handler 匹配 → Spring 把它当静态资源找 → 找不到 → 抛
`org.springframework.web.servlet.resource.NoResourceFoundException: No static resource api/v1/production/analytics/reports/subscriptions.`
→ 全局异常处理 → `code=500 系统繁忙，请稍后重试`。

所以 **500 未必是路径漏了一个段，也未必是后端 bug**。日志原文里出现
`NoResourceFoundException: No static resource ...` 就是**端点根本不存在**。

### 3. 端点存在但参数名不匹配，同样是 500

`GET /settings/by-key` 要的参数名是 `settingKey`：

```
?settingKey=xxx → 200
?configKey=xxx  → 500，日志：MissingServletRequestParameterException:
                  Required request parameter 'settingKey' for method parameter type String is not present
```

### → 排障顺序：先排路径、再排参数名

看到 500 时按这个顺序走，不要直接判"端点不存在"或"后端 bug"：

1. 日志里有没有 `NoResourceFoundException` → 有 = 端点不存在
2. 日志里有没有 `MissingServletRequestParameterException` → 有 = 端点存在，参数名不对
3. 都没有 → 才是真的后端异常

同理，看到 404 时先怀疑"是不是被 `/{id}` 吞了"，用"与不存在的 id 对比"验证。

### 4. 同一 id 成对探测：判别"端点存在 / 不存在"的标准动作

前面三条靠"看响应判成因"，但对**写端点**（POST / PUT / DELETE）常常判不出来：
端点不存在是 500、id 无效是 404，可 404 也可能只是"这个 id 查不到"，
而换个真 id 去试又会**同时改变两个变量**（路径变了、id 也变有效了），结论不干净。

标准动作：拿**同一个不存在的 id**，打**两条路径**，让"id 无效"恒定：

```
POST   /admin/tenants/NOPE/reset-usage        → 404（有 handler 接住，id 查不到）
POST   /admin/tenants/NOPE/quota-usage/reset  → 500（无 handler → NoResourceFoundException）
DELETE /analytics/reports/NOPE                → 500（两段，无 handler）
DELETE /analytics/NOPE                        → 404（一段，进 @DeleteMapping("/{id}")）
GET    /analytics/NOPE                        → 404（同上，进 @GetMapping("/{id}")）
GET    /analytics/zzz-not-exist               → 404（对照组）
```

**同一个 id、两种响应 = 干净排除了"id 无效"这个干扰项。**
比"换个真 id 试试"严谨——真 id 会同时改变路径与 id 有效性两个变量。

判读：

| 结果 | 结论 |
| --- | --- |
| 404 | 该路径**确实有 handler** 接收（多半是通配 `/{id}`），只是 id 查不到 → **端点存在**，别去"补端点" |
| 500（日志 `NoResourceFoundException: No static resource ...`） | 该路径**根本没有 handler** → 端点不存在 |
| 两条都是 404 / 都是 500 | 没形成对照，换差一个路径段的写法再试一次 |

⚠️ 顺带一条：成对探测还能炸出**静默无操作**——`DELETE /analytics/NOPE` 返回
`code=0 / success`，可 NOPE 压根不存在、一行没删（源码 `deleteById(id)` 丢弃了受影响行数）。
所以"端点存在"之后还要按下一节的回读标准验一次，别停在"有响应就算通"。

### 5. 改前 / 改后成对实测：怎么让证据站得住

前面第 4 条是"端点层"的成对，这条是"页面行为层"的成对——
给一条 fake-usable 定性（改前什么样、改后什么样）时用它。

**四个必须同时满足的条件**，缺一个结论就不干净：

1. **唯一变量是前端代码**：改前用 `git show HEAD:<相对路径>` 导出旧源码，
   在 Vite 插件里按模块 id 替换掉（`load(id)` 里判断路径后缀返回 HEAD 源码），
   **绝不改工作区文件**。这样改前 / 改后跑在**同一个后端状态**下。
   ⚠️ Node 里 `execFileSync('git', …)` 在 ESM loader 下会 `EBUSY`——
   改成外部命令先 `git show` 落快照文件，脚本只读文件。
2. **连真实后端**，只替换传输层（`@/utils/request`），断言读**渲染结果**。
   后端要挂掉过一次才知道：后端挂 → 页面 `usingFallback` → 16 条示例数据铺满，
   改前 / 改后的行数基线都不一样，两张表根本没法对比（我第一版就栽在这）。
3. **toast 必须按 portal 作用域查**：`message` / `Modal` 挂在 `document.body` 上，
   `container.querySelectorAll('.ant-message-notice-content')` **永远返回 0**。
   用第 2 坑那套 `nodesOf(container)`（容器 + 本次新增的 portal）。
4. **toast 要周期性采样，不能单点拍照**：antd message 默认 **3s 自动消失**。
   只在点击后 3.2s 取一次的话，改后的错误 toast（0.2s 就弹了）**已经没了**，
   而断言却会因为"弹窗 DOM 关闭后仍残留"而命中提示条文案——
   于是你会拿着**弹窗里的横幅**当成**toast 证据**，结论是假的。
   做法：每 200ms 采一次，采 3.2s，把时间轴记下来。

成对的观测表建议长这样（BT-25 实测）：

| 观测点 | 改前（HEAD） | 改后 |
| --- | --- | --- |
| 0.2s 的 toast | （无） | `生成失败：后端返回业务码 500…报表生成服务未接入…未生成任何文件` |
| 2.2s 的 toast | `…生成完成` | （无） |
| 点击后表格行数 | **1**（凭空多一行） | **0** |
| 首行文本 | `…｜156.0 KB｜已完成｜导出 打印 删除` | `(无数据行)` |

改前"2.2s 才弹成功"本身就是证据——那正好是代码里 `setTimeout(…, 2500)` 的定时器。

### 附：写操作的「假成功」比读操作危险，且只在后端失败时才暴露

判据：**成功才 `message.success`；失败必须 `message.error` 并带上真实失败原因**，
不许 catch 里留一句注释（如「后端骨架阶段保存失败，保留本地生效」）然后无条件 success。

- 验收必须**成对**：后端可用时验一次、**后端停掉时验一次**（第二种才是重点）。
- 若产品确实需要"后端不可用时本地暂存"，必须明确告诉用户**「仅保存在本地，未同步服务端」**，
  并常驻一条横幅——只弹 toast 的话，3 秒后表格里仍是一套服务端并不存在的配置值。
- 正确模板：`api/settings.ts` 的 `listOperationLogs`，它把 `unavailableReason` 透传给页面。
  ⚠️ **引它的写法，不要以为它接口是通的**：实测 `GET /settings/logs` 端点**不存在**（404），
  所以它当前同样永远返回 `unavailableReason`、拿不到一条真实日志
  （全后端 grep `OperationLog` / `SysLog` 零命中，见 `docs/backend-tickets.md` BT-20）。
  模板的价值在**结构**（失败带原因、不回落示例数据），不在"它自己有数据"。
- 注意别让 `absent` 断言撞上自己的文案（横幅里引用了成功提示原文，会让"没有成功提示"的断言误判）。

### 附 2：两种"HTTP 200 + code 0 但其实没干活"的静默失败

前面那节的"假成功"是**前端自己骗自己**（catch 里无条件 success）。下面两种更隐蔽：
后端真的回了 `{"code":0,"message":"success"}`，前端也真的没撒谎，但**事情并没办成**。
只验"返回 200 / 没有报错"会全部漏掉。

#### 类型一：静默写空（写进去了，但字段是 null）

现象：`POST /settings`（旧实现）返回 200 + `settingId`，**回读却发现
`setting_key=null`、`setting_value=null`** —— 一行空记录被写进了库。

成因：前端字段名与后端 DTO 不一致（前端 `configKey/configValue`，
后端要 `settingKey/settingValue`），后端没有校验、直接落库。

判定：`INSERT` 类操作**必须回读**刚写进去的那条记录，逐字段比对非空。

#### 类型二：静默无操作（返回成功，但没有任何一行被改/删）

现象：`DELETE /settings/{不存在的 id}` 返回 `{"code":0,"message":"success"}`，
**但该 id 的记录压根不存在，一行也没删掉**；再按 key 回读，记录仍在。

判定：`UPDATE` / `DELETE` 类操作必须**回读校验"目标状态确实达成了"**，
而不是只看返回值。

#### 共同判据：写操作必须「回读」才算验过

统一标准（团队约定）：

> **写操作的验收 = 调用 → 回读 → 比对。只看到 200 / code 0 不算数。**

标准动作模板就是 `api/settings.ts` 的 `deleteSetting`：

1. 先 `GET` 拿到目标记录的**真实 id**（不要自己拼 id）；
2. 执行写操作；
3. **再 `GET` 一次**：
   - 删除类 → 记录必须查不到；查得到就抛「删除未生效：后端返回成功但记录仍在」；
   - 新增/修改类 → 关键字段必须非空且等于写入值；是 null 就抛「写入未生效」。

实测样例（本轮 core-app :8098）：

| 操作 | 返回 | 回读结果 | 结论 |
| --- | --- | --- | --- |
| `POST /settings/save`（字段名映射正确） | 200 / code 0 | 10 个配置键全部非空、值正确 | 真生效 |
| `POST /settings`（旧实现，字段名不对） | 200 / code 0 + settingId | `setting_key=null` | **静默写空** |
| `DELETE /settings/{不存在 id}` | 200 / code 0 | 记录仍在 | **静默无操作** |
| `DELETE /analytics/NOPE`（同样的不存在的 id） | 200 / code 0 | 一行没删；源码 `deleteById(id)` 丢弃受影响行数 | **静默无操作**（同上，第二例 → 是通用模板问题，不是单个实体的 bug） |
| `POST /harvests/inventory/{batchId}/out` | 200 / code 0 + flowId | `prod_inventory_flow` 多一行、按 batchId 回读查得到 | 真生效 |
| `POST /harvests/inventory/in` 等 4 个 | 200 / **code 500**（`NoResourceFoundException` / `HttpRequestMethodNotSupportedException`） | — | 端点不存在 |

#### 排障提示：别把"端点不存在"报成"接口建设中"

后端 `NoResourceFoundException` 与**方法不被允许**（`HttpRequestMethodNotSupportedException`，
例如只有 `GET /harvests/inventory` 却发了 POST）都表现为 **HTTP 200 + code 500**，
与"服务端真异常"无法从响应体区分 —— 必须翻日志看异常类名。

同理，演示兜底横幅不能写「接口建设中」：`queryInventoryFlows` 曾把路径写错
（`/harvests/inventory/{batchId}/flows`），实测返回 code 500，兜底既不触发、页面也不报错，
只剩一张**空表**，看上去像"这段时间没有流水"，排障方向被彻底带偏。
现在兜底结果带 `demoReason`，失败态也会原样显示后端原因。

### 附 3：三条必带的回读断言 —— A4 数值对、A5 改对行、A2 行数不变

「回读」不是一个动作，是**三条互相独立的断言**。只做第一条会把两类造假全放过去。

| # | 断言 | 堵住的造假 | 不做会怎样 |
| --- | --- | --- | --- |
| **A4** | 响应里返回的值 == 库里回读的值 | 响应体是拼出来的、库里根本没改 | 页面显示 120，库里还是 100 |
| **A5** | **改的那条记录的主键 == 预期主键** | **改对了数，但改错了行** | 见下 |
| **A2** | 这次操作**没有新增行**（行数不变） | 说是 upsert，其实每次都 INSERT 一条 | 台账越滚越多，重复行 |

**A5 是这一轮才补上的，也是最容易被漏的一条。**

反例（BT-02 入库）：只断言 `currentQty` 从 100 → 120、增量 20，全部成立，**PASS**。
但库里其实存在两条 `(batch_id, warehouse_name, location_code)` 相同的台账，
被改的是**另一条**（新插入的那条从 0 → 20），真正该改的那条仍停在 100。
数值断言全绿，功能全错 —— 这就是「改对了数但改错了行」。

所以任何写操作验收，**除了"数值对不对"，必须再加一条"改的是不是该改的那条"**：

```
A5: response.inventoryId === 预期主键
    （预期主键 = 操作前回读到的那一条的 id，不是"操作后能查到的任意一条"）
```

配套要求：

- **预期主键要在写操作之前取**，不能写完再取（写完再取等于 A4，退化）。
- 涉及「目标侧」的写操作（调拨 / 转移），**两侧各做一遍 A5**，
  只验源侧会漏掉"目标侧建了条新行"。
- 逻辑删除 + 唯一索引的场景额外验一条：**结果行数 == 1，不是 2**
  （墓碑 + 新行 = 2 说明复活没生效，详见 `V16__produce_inventory_slot_unique.sql`）。

### 附 4：判 jar 版本看字节码，不看 mtime

多人共用同一份 fat jar 时，「这个 jar 里有没有我刚改的代码」不能用文件时间推断：

- **mtime 不可信**：先 `mvn install` 再 `git commit`，jar 的 mtime 会**早于** commit 时间，
  于是「jar.mtime < commit.time」推不出「jar 不含该 commit」。
- **路径不可信**：多个人用同一条 `java -jar` 路径起进程，按路径 kill 会杀到别人。
  判归属要按**端口**（启动前先确认端口空闲），不要按 PID、也不要按路径。

正确做法：解 fat jar 到 `BOOT-INF/lib/<module>-1.0.0.jar` 这层**嵌套** jar，
再解它读目标 `.class` 字节码，用字符串/`javap` 找新加的符号。
交接时 jar 按 **commit hash** 命名，不按时间命名。

### 附 5：字节码判据的两处实操细节（嵌套层 vs 外层 / 现成脚本）

两次实测：同一个端口上的实例先后被回收两次，都是**干净关闭不是崩溃**。

- 不要假设"我起的实例还活着"，**PID 会失效，而且会被系统复用给别的进程**
  （同一 PID 先后是不同进程，按 PID 判归属一定会认错）。
- 验收实例生命周期应**跟着单次验收走**：起实例 → 跑验收 → 停实例，同一条 bash 调用内完成。
- 还原步骤**只依赖数据库直连，不依赖后端活着**。

### 附 6：带「还原」步骤的脚本，绝不能接 `| head`

**① 业务 `.class` 在嵌套层，资源文件在外层 —— 只翻嵌套层会漏掉迁移和 yml**

fat jar 是两层结构，两类东西不在同一层：

| 内容 | 位置 | 例子 |
|---|---|---|
| 各模块的业务 `.class` | **嵌套层** `BOOT-INF/lib/<module>-1.0.0.jar` | `BOOT-INF/lib/mod-produce-1.0.0.jar` 里的 `.../AdminTraceService.class` |
| 资源文件（Flyway 迁移、配置） | **外层** `BOOT-INF/classes/` | `BOOT-INF/classes/db/migration/V17__produce_alert_level_width.sql` |

所以「把嵌套层展开来找」只适用于 `.class`。**查迁移文件、查 yml 必须看外层的
`BOOT-INF/classes/`**，否则会得出「jar 里没有这个迁移」的错误结论。

**② 新增迁移必须重新打 jar，Flyway 才看得见**

Flyway 的 `locations: classpath:db/migration` 读的是 **jar 内的资源**，不是源码目录。
写完 `Vxx__*.sql` 直接 `java -jar` 旧 jar，Flyway 根本看不到新版本——
表现为「启动了、日志里没报错、但迁移没应用」，又是一处静默无效。

→ 判据：**启动前先在 jar 里 grep 到该迁移文件**，grep 不到就先 `mvn -o install` 再起。
（我踩过：写完 V17 直接起 17:31 那支 jar，白等 18 秒才发现 jar 里没有 V17。）

**③ 现成脚本**（本机没有 `jar` / `unzip`，用 Python）：

```python
# 用法: python jarfind.py core-app-1.0.0.jar V17
import io, sys, zipfile

path, needle = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(path)
names = list(z.namelist())                       # 外层：含 BOOT-INF/classes/**
for n in z.namelist():
    if n.startswith("BOOT-INF/lib/") and n.endswith(".jar"):
        names += zipfile.ZipFile(io.BytesIO(z.read(n))).namelist()   # 嵌套层：业务 .class
print([n for n in names if needle in n])
```

注意 Windows 下要传**盘符形式**的路径（`C:/...`），Git Bash 的 `/c/...` 形式 Python 不认。

### 附 7：长时间运行的 java 后台进程会被系统回收

`python verify.py | head -22` 看前几行输出是常见动作，但在这里是**险情**：

管道被 `head` 关闭后，写端进程会收到 SIGPIPE / BrokenPipe 而**中断**。
如果中断发生在「已写入、未还原」之间，就会留下脏数据（数量停在中间值、多行流水）。
这一轮已经两次栽在还原没跑完上（BT-57 只验应用层留下墓碑；这次差点被管道截断）。

规矩：

- **任何带还原步骤的脚本都不能接 `| head` / `| tail`**。要看输出就让它跑完，
  或重定向到文件再读（`python verify.py > /tmp/v.log 2>&1; tail -40 /tmp/v.log`）。
- 脚本第 0 步先做**存活预检**，连不上就直接退出并打印重启命令，不要往下走。
  否则测到的会是「连不上」而不是真实业务结果 —— **"后端没起来"被记成"接口失败"，
  本身就是一种假证据**，在以"不许谎报"为纪律的项目里一样要杜绝。
- 还原完成后**再查一次库确认**（数值 / 行数 / tombstone 计数），不能只信脚本自己的退出码。

### 附 8：JWT token 只有 2 小时（`expiresIn: 7200`）

实例跑久了，所有请求会突然一律 `401 未认证或凭证已失效`。

> **遇到 401，第一动作是重新 login。不要判定"后端坏了 / 鉴权被改了 / jar 有问题"。**

已经有一次差点这么误判：token 恰好 16:07 取、18:07 过期，与进程被系统清扫的时间重合，
两个原因叠加，看起来完全像"后端挂了"。

重新登录：`POST /api/v1/auth/login`，用户名 `admin`，口令**动态 grep** 自
`mod-platform/.../auth/AdminUserInitializer.java:46` 的 `AGRI_ADMIN_PASSWORD` 默认值
（可用同名环境变量覆盖）。**口令不写字面量**——写进文档后会变成一份"看起来正确、
其实在口令被覆盖后是错的"凭据，那正是我们要剿的假证据。

### 附 9：java 进程不可归属时的清理纪律

`wmic` 取不到 CommandLine 时（本机实测 16 个 java 进程全部返回空），
**没有任何可靠手段确认某个进程是谁的**。

- **宁可漏杀，不可误杀**。判不了归属的，一个都不要动。
- 各人**自报**：端口 + 日志文件名 + PID。清理前按自报表核对。
- **8080–8090 是另一个项目的 Nacos 集群，绝对禁区**，我们只用 8091–8099。
- 改完模块不 `mvn install` 就启动，会从 `C:/maven/repository` 取旧包 → 出现"改了没生效"
  的假失败。**不要靠注入环境变量绕过配置问题**——那等于在验一个不是仓库里的配置。

### 附 10：解析后端数字一律 `readNumberOrNull`，禁用 `readNumber`

`readNumber` 的缺省值是 `0`，而 **0 是一个结论**（"统计过，结果是 0"），
它无法表达"没拿到"。后端返回字符串数字（Long → ToStringSerializer）时尤其容易踩：
`passCount + failCount` 在字符串下是拼接 `"3"+"1"="31"`。

> **缺失值必须一路传到 UI 显示为「—」。中途任何一处兜 0 / 兜原型数字都是伪造。**

同理，`passRate ?? 95.2` 这类兜底更危险：配上「≥95 显示绿色」的配色规则，
会让**接口一失败、合格率恰好 95.2、指标卡变绿**——把故障伪装成"状态良好"。

### 附 11：无条件触发的成功提示 = 假成功

一类通病：**`message.success` 出现在 mutation 回调之外**。
例如点完按钮、请求还没回来就无条件弹「已通知渠道方启动召回」。

它比"后端返 0 前端说成功"更隐蔽——**前端根本没等后端**。

排查动作：grep 所有 `message.success`，确认每一处都挂在 mutation 的 `onSuccess`
且**先校验了返回值的语义**（是"作废了 N 张"还是"作废了 0 张"，后者必须报"未生效"而不是成功）。

### 附 12：puppeteer 断言的两个 antd 陷阱

1. **按钮文案会自动在两中文字间插空格**（`保 存` / `取 消`）。
   按文案找按钮**必须先去空白再比较**，否则按钮点不中，看起来像"保存没触发"。
2. **`message` 默认 3s 自动消失**。固定 sleep 3.5s 再去读 `.ant-message` 会读到空字符串，
   必须**轮询早读**。

两者都是"看起来像功能坏了、实际是断言写法错"的坑，排障时先排除断言再怀疑业务。

### 附 13：文件级归属锁（统一 git 身份下的必然要求）

提交身份统一为 `agri-platform-dev <agri-platform-dev@local>` 之后，
**提交归属在 git 元数据里永久不可分辨**，"这次是谁提交的"追不出来，追了也是猜。

所以改用**前置约束**而不是事后追责：

- 同一时刻，**一个文件只归一个人**。
- 动任何文件前先 `git status -- <路径>`，看到别人的在途改动就**停手不动**。
- 提交前 `git diff -- <路径>` 逐处确认内容是你自己的，再用 pathspec 提交。
- 提交 message **禁用反引号**（bash 会当命令替换执行、内容被吃掉）；
  带代码片段用单引号包整段或 `git commit -F`。
- **不能确定的归属就说"不确定"，不要猜一个人名填上**——
  我们出过"把 A 的成果记成 B 的实测、据此派单"的事故。
