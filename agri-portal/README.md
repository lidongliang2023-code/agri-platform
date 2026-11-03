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
   只保留产业链与省份字典、认证文案。留着它们就会有人继续当成"数据源"接回去。

## 供应链金融页的利率与时效（2026-11-03）

产品卡早在上一轮就读 `/open/finance/products`（资金方端在架配置），但 **Hero 仍写死「年化利率低至 4.5%」
和「审批最快 1 天」** —— 在架最低其实是 5.68%，页面顶部在替资金方报一个没人承诺过的价。

- Hero 的最低价改为由在架产品实算（`Math.min(rate)`），**读不到产品就不说这句话**（不编一个保底数字）。
- 「审批最快 1 天」删除：时效没有任何数据源，而同一屏的 Hero 指标卡自己就标着「示例 1.2 天」，两句话互相打脸。
- 示例口径文案改成分层表述：产品名称/利率/额度/期限来自资金方在架配置；时效/风控指标/机构名称仍是原型示例。
- 申请入口跳资金方端申请页并带产品编码：`:8081/finance/#/borrower/loan-apply?product=<code>`。
- 回归：`scripts/e2e-portal-finance.mjs` 的期望值逐条取自 `/open/finance/products`（卡数、名称、利率、链接），
  不再钉死产品名与利率。

## 故障口径

任一块数据读不到时：大盘显示 `—` 并在下方给"交易服务暂时读不到（原因）"，其余区块显示同样的说明条。
**不允许**静默退回空列表（会被理解成"平台没有内容"），也不允许回落到旧常量。

## 验证

- `node scripts/e2e-portal-home-datasource.mjs`：57 项，含接口与 SQL 独立核对、真实点击（栏目切换、资讯详情、行情详情、公告展开）、
  草稿不可见/发布可见/下线不可见、503 故障分支、零残留。
- `node scripts/e2e-portal.mjs`：门户整站回归（首页/搜索/筛选/认证表单）。已迁到 `playwright-core`。
- `node scripts/check-portal-smoke.mjs`：11 条一级路由逐个进入，断言无 JS 异常、无 5xx、关键区块在位。

浏览器点检依赖 `C:/Users/71502/.workbuddy-ai/binaries/node/workspace` 里的 `playwright-core` + 本机 Chrome/Edge；
仓库内不再有 `puppeteer`，仍写 `require2('puppeteer')` 的脚本会直接 `MODULE_NOT_FOUND`。
