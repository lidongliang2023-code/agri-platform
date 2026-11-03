# 信息资讯模块（agri-info）

行情、政策、资讯内容、供需大厅、课程与问答的独立子系统，数据库 `agri_info`（28 张表），
后端 `agri-info/src/main/java/com/agri/info/`，端口 **8096**。

## 访问地址

| 端 | 地址 | 登录 |
| --- | --- | --- |
| 用户端（PC 门户） | http://localhost:8104/info/ | SSO `client_id=info`，权限码 `info:consumer` |
| 运营端 | http://localhost:8113/info-ops/ | SSO `client_id=info-ops`，权限码 `info:admin` |
| 移动端（uni-app H5） | http://localhost:8114/info-mobile/ | `/api/v1/sso/login-standalone` 直连换令牌 |
| 后端 | http://localhost:8096 | 网关按 vhost 反代 `/api` |

三端都不维护独立登录页，账号来自 `agri_core.platform_user`（演示密码见
`docs/本地全栈_访问地址与账号_2026-11-02.md`）。

## 鉴权分层

- **RBAC（agri-common）**：`platform.rbac.operator-paths: [/api/**]`、`read: info:read`、`write: info:write`，
  `require-auth: true`。控制器上的 `@OperatorOnly("info:consumer" / "info:admin" / "info:expert")` 是这一层。
- **公开白名单**：只有 `/api/v1/info/public/**`（门户匿名浏览）。
  新增匿名接口必须显式挂到这个前缀下，**不要把写接口挂进来**。
  注意白名单里的 GET 有副作用（`read_count` / `view_count` / `downloads` 自增），
  匿名可无限刷 —— 属于已知限制，未做频控。
- **私域归属**：`X-Agri-User` 请求头（前端注入昵称，后端 `InfoSupport.owner()` 解码）。
  ⚠️ 这一层**目前不是身份**：头是客户端自报的，改一下就能冒充别人。
  改成从 Bearer 令牌解析是下一轮的事（涉及 55 处调用点），本轮只修了"参数被完全忽略"的那种泄漏。

## 内容状态机（2026-11-02 收口）

唯一口径在 `repository/InfoContentStatus.java`：词表、中文文案、允许的流转、新建可落的状态。

| 当前 | 可以变成 |
| --- | --- |
| 新建 | `draft` / `pending`（**不能直接建成 published**） |
| `draft` 草稿 | `pending`（提交审核） |
| `pending` 待审核 | `published`（通过并发布）/ `rejected`（驳回）/ `draft`（退回修改） |
| `published` 已发布 | `offline`（下架，必须写原因） |
| `rejected` 未通过 | `draft` / `pending` |
| `offline` 已下架 | `pending`（**重新上线必须再走一次审核**） |

三条被修掉的绕过路径：

1. `POST /api/v1/info/ops/contents` 的 `status` 直接取请求体 → 传 `published` 就跳过整段审核；
   现在新建只接受 `draft/pending`，其它值 400 并说明原因。
2. **编辑（带 id）不再写 status**：改标题/正文不能把已下架的稿子悄悄改回线上，
   返回消息会写明「状态仍为「草稿」，要上线或退回请用审核动作」。
3. 审核 `UPDATE ... WHERE id=?` 原先不看当前状态：已发布可被重复 approve（刷新 `published_at`）、
   已下架/已驳回可被直接 approve 上线，未知 action 落到 default 分支当成"通过并发布"。
   现在全部按流转表校验，拒绝时回「内容「已下架」不能变成「已发布」：只有待审核的内容可以通过审核上线」。

「退回修改」写入 `draft`，而页签与计数原先都没有 draft —— 点一次这条稿子就从四个页签里**全部消失**。
现在 `contents.counts.draft` 有数、运营端有「草稿 N」页签，新建表单也能选「存为草稿 / 提交审核」。

## 内容存证归属

`GET /api/v1/info/attestations` 原先是 `SELECT * FROM info_attestation ORDER BY id DESC` ——
形参 `user` **根本没进 SQL**，「内容存证」页把别人单位、别人作者的存证编号与哈希全量列出。
表上本来就有 `owner` 列（4 行 / 3 个 owner），现在按 `WHERE owner=?` 过滤。
`POST /api/v1/info/attestations/verify` 仍是公开的（凭编号验真、只回哈希不回原文，这是设计如此）。

## 发布

```powershell
node ops/gateway/scripts/publish.mjs --app info        --version <版本号> --build   # 用户端 :8104
node ops/gateway/scripts/publish.mjs --app info-ops    --version <版本号> --build   # 运营端 :8113
node ops/gateway/scripts/publish.mjs --app info-mobile --version <版本号> --build   # 移动端 :8114
```

版本目录不可变：改了前端**必须换版本号**，同版本号重发不会替换资源。

## 端到端脚本

| 脚本 | 覆盖 |
| --- | --- |
| `scripts/e2e-info-content-status.mjs` | 内容状态机全部绕过路径 + 草稿可见性 + 存证归属（35 项） |
| `scripts/e2e-info-audit-loop.mjs` | 供需信息发布→审核闭环 |
| `scripts/e2e-info-ops-audit-page.mjs` | 运营端审核页 |
| `scripts/e2e-info-mine-drawer.mjs` | 用户端「我的发布」抽屉 |
| `scripts/e2e-info-publish-link.mjs` | 发布入口跳转链路 |
| `scripts/e2e-info-sd-detail-contact.mjs` | 供需详情与联系 |
| `scripts/e2e-info-stats-source.mjs` | 统计口径来源 |
| `scripts/e2e-info-trade-data-closure.mjs` | 与交易端数据闭环 |

## 栏目/作者篇数（2026-11-02 收口）

`info_channel.article_count` 与 `info_author.article_count` 是**建库种子写死的列**
（政策法规 1286、生产技术 3864、作者 486/1268…），库里真实只有 8 篇已发布内容，运营发布或下架都不会改这两列。
现在三处读取统一按 `info_article` 里 `status='published'` 实查：

- `InfoRepository.channels()` —— 门户与用户端栏目 tab；
- `InfoRepository.authors()` —— 用户端作者清单；
- `InfoOpsRepository.channelsAdmin()` —— 运营端「栏目与作者」页（含「栏目内容量」合计卡）。

列本身没有删（历史数据不动），只是不再作为出参来源。作者 `followers` 仍来自种子，
本模块没有关注关系表，因此**没有真实出处**，仍是假数。

## 已知限制 / 未收口的部分

- `X-Agri-User` 仍是客户端自报身份（见上），要改成从令牌解析；
- 点赞（`likeArticle`）无去重、付费报告没有购买表（"收藏一下"就进「我的报告」）、
  `info_report` 无 owner 列；
- 公开 GET 的浏览/下载计数无频控；
- 运营端 `/ops/forecast-config`、`/ops/quality` 后端有接口但前端无入口；
- 用户端首页与培训页的 tab 筛选只筛当前已加载的一页（`Home.tsx:24`、`TrainingPage.tsx:53`）。
