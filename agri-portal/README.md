# agri-portal 官网门户

丰链云对外门面（匿名可浏览）。前端 React + hash 路由，构建产物由 nginx 发布在 `:8098/portal/`，
静态资源在 `ops/gateway/bucket/portal/versions/<版本>/`，入口指针 `bucket/portal/index.html`。

## 公开数据源地图

门户没有自己的库，页面上每一个业务数字都必须能追到一个公开只读接口。

| 首页区块 | 接口 | 归属模块 | 口径 |
| --- | --- | --- | --- |
| 在售商品（热销优选） | `GET /api/trade/public/products?limit=8` | agri-trade | 已发布、未删除商品，按发布时间倒序，最多 24 |
| 大盘四项 | `GET /api/trade/public/summary` | agri-trade | `PlatformSummaryService.platformStat()`：累计成交额（元）、成交笔数、参与主体数、在架货源数；**已取消订单不计入** |
| 价格指数 | `GET /api/v1/info/public/markets` | agri-info | `info_quote` 中 `status='online'` 的品种，含涨跌/产地/来源/更新日期 |
| 产业资讯 tab | `GET /api/v1/info/public/channels` | agri-info | `info_channel` 中启用的栏目；**篇数按已发布内容实查**，不读 `article_count` 列 |
| 产业资讯列表 | `GET /api/v1/info/public/articles?channel=<栏目名>` | agri-info | 服务端按栏目过滤，条目链到 `#/info/news/{id}` |
| 平台公告 | `GET /api/master-data/public/announcements` | agri-master-data | 已发布且未到期的公告；草稿/已下线不对外；点击标题展开正文 |

登录/注册不在门户内实现：门户只发起统一认证（PKCE `state` + `code_challenge`），由认证中心 `:8090` 接管。

## 本轮（2026-11-02）下线的假数据

首页原先的四块内容都与后端无关，且"看起来一切正常"：

1. **大盘**：`1268 亿 / 42 万笔 / 186 万个 / 38 万家`，以及首屏 `12.6 万台设备 / 覆盖 3860 个基地`，全是前端常量。
   现在只保留交易域能实查的四项；**设备数与基地数没有公开数据源，直接下线而不是继续挂着**。
2. **资讯与公告**：读的是 core-platform 遗留表 `agri_core.svc_news`（**0 行**，且没有任何写入方）。
   资讯运营端发布再多内容，首页也永远显示"暂无" —— 接口是通的、数据是真的、页面说的是另一件事。
3. **行情**：读 `agri_core.svc_quote`，库里只剩建库种子那 1 条（红富士苹果 6.48）。
4. **死链**：每条资讯无论指向哪篇文章，链接都统一是 `#/certify`（认证说明页）。
5. `src/data/portal.ts` 里的 `PRODUCTS / NEWS / ANNOUNCEMENTS / PRICE_COMMODITIES` 演示列表已删除，
   只保留认证文案。留着它们就会有人继续当成"数据源"接回去。
   产业链分类与省份字典已随「产业链」页并入交易大厅，统一由交易端 `pages/hall/taxonomy.ts` 维护。

## 供应链金融页的利率与时效（2026-11-03）

产品卡早在上一轮就读 `/open/finance/products`（资金方端在架配置），但 **Hero 仍写死「年化利率低至 4.5%」
和「审批最快 1 天」** —— 在架最低其实是 5.68%，页面顶部在替资金方报一个没人承诺过的价。

- Hero 的最低价改为由在架产品实算（`Math.min(rate)`），**读不到产品就不说这句话**（不编一个保底数字）。
- 「审批最快 1 天」删除：时效没有任何数据源，而同一屏的 Hero 指标卡自己就标着「示例 1.2 天」，两句话互相打脸。
- 示例口径文案改成分层表述：产品名称/利率/额度/期限来自资金方在架配置；时效/风控指标/机构名称仍是原型示例。
- 申请入口跳资金方端申请页并带产品编码：`:8081/finance/#/borrower/loan-apply?product=<code>`。
- 回归：`scripts/e2e-portal-finance.mjs` 的期望值逐条取自 `/open/finance/products`（卡数、名称、利率、链接），
  不再钉死产品名与利率。

## 账号中心 · 绑定手机号（2026-11-03 重构）

页面：`#/account/security/phone`（`src/pages/AccountCenter.tsx` 的 `.account-phone-form`）。两步走，
**没证明新号码收得到短信就不改库**：

| 步骤 | 端点 | 拒绝条件（都是服务端判的，页面只是提前拦住） |
|---|---|---|
| 发码 | `POST /api/v1/sso/account/phone/code`（要 SSO 会话） | 号码非法；与当前绑定号码相同；已被别的账号绑定；60 秒内重发；当日条数超 `captcha.sms.daily.limit` |
| 提交 | `POST /api/v1/sso/account/phone` | 6 位码缺失/过期/错满 5 次作废；验码通过后再查一次占用（发码与提交之间可能被别人抢走） |

三条设计口径：

- **换绑的发码不在公开端点**：`POST /api/v1/sso/sms/code` 只接受 `login / register / reset_password`，
  传 `change_phone` 会被拒（未登录就能对任意号码发码 = 谁都能替别人触发短信、把对方刚收到的码顶掉）。
- **冲突判定放在发码时**：让页面填完 6 位码才被拒，等于白烧一条验证码还要干等 60 秒冷却。
  代价是登录用户能探到"某号码已注册"，所以真正生效的占用判定仍在提交时**验码之后**再查一遍。
- **登录名可能跟着手机号走**：手机号兼作登录名（`username`）的账号换绑后，`username` 一起变成新号码。
  接口回 `loginNameChanged`，页面把这句话写进提示 —— 否则用户会拿旧号登录失败、以为账号丢了。

页面状态不是装饰：号码非法/与当前相同/倒计时未结束时「获取验证码」不可点，没填码时「确认变更」不可点，
错误与"开发通道验证码见后端日志"都用页面自己的提示条说清（不静默、不弹通用"操作失败"）。

## 故障口径

任一块数据读不到时：大盘显示 `—` 并在下方给"交易服务暂时读不到（原因）"，其余区块显示同样的说明条。
**不允许**静默退回空列表（会被理解成"平台没有内容"），也不允许回落到旧常量。

## 验证

- `node scripts/e2e-portal-home-datasource.mjs`：57 项，含接口与 SQL 独立核对、真实点击（栏目切换、资讯详情、行情详情、公告展开）、
  草稿不可见/发布可见/下线不可见、503 故障分支、零残留。
- `node scripts/e2e-portal.mjs`：门户整站回归（首页/搜索/筛选/认证表单）。已迁到 `playwright-core`。
- `node scripts/check-portal-smoke.mjs`：11 条一级路由逐个进入，断言无 JS 异常、无 5xx、关键区块在位。
- `node scripts/e2e-account-center.mjs`：**91 条通过 / 2 条失败**（2026-11-03）。失败的两条是"切主体后生产数据落位"
  与"新成员写在切换后主体的租户号下"，改动前的基线（`git show HEAD:` 跑同一脚本）同样红 —— 归 #151/#152 红项队列，
  不是本轮引入。本轮覆盖：换绑手机 18 条（4 条负分支 + 页面禁用态 + 落库与还原 + Redis 键清理）、
  资料/密码/地址/主体切换/成员与证照链路。

### 本轮查出但没修的产品缺口

`POST /api/v1/auth/refresh` **在浏览器里必然失败**：刷新已按子系统分令牌
（`AuthController#clientIdOf` 用 `Referer/Origin` 推断 client → 要 `agri_refresh_token_<clientId>`），
而 `/api/v1/sso/login-standalone` 只写全局 `agri_refresh_token` → 门户（client `portal`）拿到 5003
「刷新凭证无效或已过期」，访问令牌 2 小时后过期就只能重新登录。同一套 cookie 在脚本里（不带 Origin/Referer）是通的，
所以这条只有真浏览器会撞。修法属于"刷新令牌按子系统分开"那笔在途改造（要么独立登录也写 client 令牌，
要么全局会话换票时允许回退全局刷新令牌），本轮没有替它改，脚本改成"refresh 拿不到就退回脚本侧登录取令牌"
并把两条路径都打出来 —— 没有把这条断言改松。

浏览器点检依赖 `C:/Users/71502/.workbuddy-ai/binaries/node/workspace` 里的 `playwright-core` + 本机 Chrome/Edge；
仓库内不再有 `puppeteer`，仍写 `require2('puppeteer')` 的脚本会直接 `MODULE_NOT_FOUND`。
