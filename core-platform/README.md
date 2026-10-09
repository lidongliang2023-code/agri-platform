# core-platform · 农业产业互联网平台核心工程

依据《农业产业互联网平台_总体架构设计与发展规划 v1.0》重写的**全新代码基座**：
**1 个模块化单体（core-app）+ 4 个卫星服务**，架构决策严格对应 ADR-001 ~ ADR-008。

> 本工程为独立 Maven 工程（不依赖旧根 pom），与旧模块并行存放、零风险共存。

## 一、架构形态 → 代码映射

```
core-platform/
├── pom.xml                    父工程（Java 17 + Spring Boot 3.2.5）
├── shared-kernel/             共享内核：零业务语义、零框架依赖（ApiResponse/PageResult/ErrorCode/BusinessException）
├── core-infra/                基础设施（全部署单元复用）：
│   ├── event/                 本地消息表 + 事件总线（ADR-003）：
│   │   ├── OutboxService      与业务同事务写入 platform_outbox_message
│   │   ├── OutboxRelay        轮询投递：指数退避重试 → 死信（status=2）
│   │   ├── EventTransport     三通道：local（进程内，默认）｜ http（开发跨进程）｜ rocketmq（生产）
│   │   └── TopicListener      消费 SPI；消费端幂等表 platform_consumed_event（DDL 已备）
│   ├── security/              JWT 短时效访问令牌 + Redis 服务端刷新令牌（旋转、可吊销）
│   ├── web/                   MarketContext（market_id 线程上下文）/ RequestIdFilter / 全局异常 / 内部事件入口
│   └── data/                  BaseEntity（market_id Day1 内建 + tenant_id 预留，ADR-005）
│                              MybatisPlusConfig：market_id 行级隔离拦截器（系统模式旁路）
├── mod-platform/              平台域（platform_ 前缀）：统一用户/权限/商品/客商/消息 + 认证（ADR-004 第一优先级）
├── mod-trade/                 交易域（trade_ 前缀）：挂牌撮合 B2B MVP / 订单 / T+1 结算任务
├── mod-produce/               生产域（prod_ 前缀）：批次 / 溯源一物一码 / 质检 / 地块 / 设备档案 / IoT 预警台账
├── mod-service/               服务域（svc_ 前缀）：行情资讯 v1
├── core-app/                  单一部署单元 :8080 —— Flyway 迁移 + application.yml + 【ArchUnit CI 门禁】
├── satellite-iot/             卫星 · IoT 接入 :8081 —— MQTT(EMQX)/REST 双通道 + 阈值预警 → 事件回传（ADR-002）
├── satellite-ai-gateway/      卫星 · AI 推理网关 :8082 —— 供应商路由 / 限流 / 降级 / 成本核算（ADR-008）
├── satellite-quote-push/      卫星 · 行情推送 :8083 —— WebSocket 长连接（无状态最小依赖面）
├── satellite-gov-exchange/    卫星 · 政务交换前置 :8084 —— 单向导出 + 审计（ADR-006，部署政务云专区）
└── deploy/docker-compose.yml  MySQL8 / Redis7 / EMQX（profile iot）
```

## 二、模块化单体四纪律的落地方式（决定演进成败）

| 纪律（架构文档 3.3） | 落地 |
|---|---|
| 1. 模块间只经 API 与事件通信 | 每模块 `api` 包承载 DTO/Facade/事件契约；ArchUnit 规则 `ArchitectureTest` 禁止触达任何其他模块的 `internal..` |
| 2. 表归属唯一 | 表前缀 platform_/trade_/prod_/svc_；`TablePrefixTest` 校验每个 `@TableName` 前缀，物理上写不出跨模块 JOIN |
| 3. 事件先行 | `DomainEventPublisher` → 本地消息表（同事务）→ OutboxRelay → MQ/进程内投递；消费端幂等 |
| 4. CI 门禁强制 | `mvn test` 即门禁：12 组跨模块 internal 禁入规则 + 共享内核纯净性规则 + 表前缀规则，违规即构建失败 |

## 三、领域事件契约（即拆分预案）

| 事件 TOPIC | 生产方 | 消费方 | 契约类 |
|---|---|---|---|
| `order.deal.done` | 交易域 | 结算/统计/通知 | `TradeEvents.OrderDealDone` |
| `payment.settled` | 交易域 | 供应链金融 | `TradeEvents.PaymentSettled` |
| `batch.harvested` | 生产域 | 交易域（商品挂溯源码） | `ProduceEvents.BatchHarvested` |
| `quality.test.passed` | 生产域 | 交易域/政务报送 | `ProduceEvents.QualityTestPassed` |
| `iot.alert.raised` | 卫星 satellite-iot | 生产域（预警台账） | `ProduceEvents.IotAlertRaised` |
| `quote.updated` | 服务域 | 撮合/金融/推送 | `ServiceEvents.QuoteUpdated` |

切换 `agri.event.transport`（local/http/rocketmq）**不改任何业务代码**；某域未来拆微服务时，仅把进程内调用改为远程调用，事件链路原样保留。

## 四、快速开始

```bash
# 1. 启动依赖（MySQL/Redis 必需）
cd deploy && docker compose up -d mysql redis

# 2. 建库（首启前）
#    MySQL 中执行：CREATE DATABASE agri_core DEFAULT CHARSET utf8mb4;
#    联调卫星时再建：agri_iot / agri_ai / agri_gov

# 3. 构建并验证（含 ArchUnit 门禁）
mvn clean verify

# 4. 启动核心单体
cd core-app && mvn spring-boot:run

# 5. 冒烟
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123","marketId":1}'
# → 取 accessToken，后续请求携带 Authorization: Bearer <token>
```

卫星服务（可选，独立进程）：

```bash
mvn -pl satellite-iot spring-boot:run            # :8081（transport=http → 投递事件给 :8080）
mvn -pl satellite-ai-gateway spring-boot:run     # :8082（默认 AI_ENABLED=false，规则模式降级）
mvn -pl satellite-quote-push spring-boot:run     # :8083（ws://localhost:8083/ws/quote）
mvn -pl satellite-gov-exchange spring-boot:run   # :8084
```

IoT 端到端演示：登录核心 → `POST :8081/api/v1/ingest {"deviceNo":"WS001","metric":"temperature","value":45,"marketId":1}`
→ 阈值告警 → 事件回传核心 → `GET :8080/api/v1/produce/alerts` 可见台账。

交易闭环演示（同一市场上下文）：
`POST /api/v1/trade/orders {"listingId":"7001","buyerMerchantId":2001...}` → `POST /api/v1/trade/orders/{id}/pay {"payNo":"P001"}`
→ 库存扣减 + `order.deal.done` 事件 → `POST .../{id}/settle` → `payment.settled`。
生产侧：`POST /api/v1/produce/batches/6001/harvest` → `batch.harvested` → 交易商品自动挂载溯源码（`platform_product.trace_code`）。

## 五、关键端点速查

| 域 | 端点 |
|---|---|
| 认证 | POST /api/v1/auth/login · /refresh · /logout · GET /me |
| 平台域 | /api/v1/markets · /api/v1/products · /api/v1/admin/products|users|merchants|roles · /api/v1/messages |
| 交易域 | /api/v1/trade/listings · /api/v1/trade/orders（create/pay/settle/cancel） |
| 生产域 | /api/v1/produce/plots|devices|batches（harvest、trace-code）|quality-reports|alerts |
| 服务域 | /api/v1/quotes · /api/v1/news · POST /api/v1/admin/quotes |
| 卫星 | :8081 /api/v1/ingest · :8082 /api/v1/ai/chat、/ai/vision/pest · :8083 /ws/quote · :8084 /api/v1/gov/submit |
| 可观测 | GET :8080/actuator/health · Swagger UI :8080/swagger-ui.html |

## 六、MVP 边界与下一步（对照 36 个月路线图）

已落地（P1 骨架级）：
主数据四统一、撮合交易闭环（订单/支付/结算 MVP）、行情 v1、批次溯源事件链、IoT 阈值告警链、AI 网关降级桩、
market_id 隔离、等保基线动作（traceId 贯穿、审计表、显式 CORS、密钥环境变量化）。

P1 收尾待办：支付网关对接（回调验签/幂等表）、S2B2C 商城（复用商品/客商 OHS）、AI 种养助手前端（uni-app）、
BFF 三端聚合层、APISIX 网关路由（deploy 附 compose）。
P2 待办：结算三方对账、供应链金融一期、政务云专区实部署（gov-exchange + 网闸）、ES 检索接入、等保测评。

## 七、遗留说明

- 开发态免鉴权口径：行情查询 / 内部事件入口 / 卫星服务接口 —— 生产环境收口到 APISIX + 内网段。
- 刷新令牌依赖 Redis；消费者幂等表已建，各 TopicListener 接入时应补 event_key 幂等校验。
- rocketmq-client 4.9.7 直连（未用 spring starter），topic 中 `.` 映射为 `_`，原主题保留为消息 Tag。
