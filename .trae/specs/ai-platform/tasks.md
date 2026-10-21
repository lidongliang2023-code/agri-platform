# AI 中台实现任务清单

## 任务分组与依赖

| ID | 任务 | 优先级 | 依赖 | 验收要点 |
|---|---|---|---|---|
| T1 | 创建 `ai/index.html` AI 总览页 | high | 无 | 10 大 Agent 卡片按 P0/P1/P2 分组；KPI 看板；实时调用趋势；侧边栏导航 |
| T2 | 实现 `ai/credit.html` 信用评估 | high | T1 | 对话式交互 + 多源数据融合状态 + 信用评分仪表盘 + 雷达图 + 预授信额度 |
| T3 | 实现 `ai/risk.html` 风控 Agent 集群 | high | T1 | 贷前/贷中/贷后阶段切换 + Agent 状态总览 + D-S 决策链路可视化 + 风险评分分布 |
| T4 | 实现 `ai/iot-warning.html` 贷后预警 | high | T1 | 四级预警概览 + IoT 设备状态 + 预警事件流 + 风险预测 + 处置中心 |
| T5 | 实现 `ai/product-match.html` 产品匹配 | high | T1 | 对话需求输入 + Top3 推荐卡片 + 方案对比表 + 需求画像 + 历史记录 |
| T6 | 实现 `ai/aigc-doc.html` AIGC 文档 | high | T1 | 文档类型选择 + 参数表单 + 实时预览 + 合规建议 + 模板推荐 |
| T7 | 实现 `ai/pledge-rate.html` 动态质押率 | high | T1 | 质押概览 + 实时曲线（警戒/平仓线）+ 品类分布 + 补货追保 + 调整规则 |
| T8 | 更新入口链接 | medium | T1-T7 | `index.html` 矩阵与卡片、`ops/finance.html` 侧边栏增加 AI 中台入口 |
| T9 | 全链路验证 | medium | T1-T8 | curl 全页 HTTP 200；链接无 404；控制台无报错 |

## 每页 Test Requirements

### T1 ai/index.html
- rule：侧边栏包含 10 大场景导航，P0/P1 页面链接可点击跳转，P2 显示"规划中"角标。
- rule：KPI 区展示今日调用量、活跃 Agent 数、模型精度、平均响应、节省人力。
- rubric：10 大 Agent 卡片按优先级分组，显示运行状态、调用量、延迟、精度。

### T2 ai/credit.html
- rule：左侧对话区有示例对话流，底部有输入框与"开始评估"按钮。
- rule：右侧展示 5 个数据源调用状态（政务/产业链/卫星/IoT/软信息）含进度条。
- rubric：信用评分仪表盘展示总分与等级，雷达图展示 5 维度评分。

### T3 ai/risk.html
- rule：贷前/贷中/贷后三阶段 Tab 可切换。
- rule：决策链路图展示 融资申请→征信→订单确权→物流/仓储/反欺诈→D-S融合→通过/转人工。
- rubric：Agent 状态总览显示在线/等待/异常数量。

### T4 ai/iot-warning.html
- rule：四级预警概览（正常/关注/警告/紧急）。
- rule：IoT 设备网格显示温度/湿度等实时数据与在线状态。
- rule：预警事件流支持"忽略/关注/立即处置"操作按钮。

### T5 ai/product-match.html
- rule：对话区展示自然语言需求与 AI 推荐。
- rule：Top3 产品卡片含匹配度、额度、利率、期限。
- rule：方案对比表横向对比多产品指标。

### T6 ai/aigc-doc.html
- rule：文档类型选择（融资合同/担保协议/质押合同/风控报告/合规证明/通知函）。
- rule：融资方案参数表单含借款人/金额/期限/利率/还款方式/担保方式。
- rule：合规建议区列出 AI 识别的风险条款。

### T7 ai/pledge-rate.html
- rule：质押概览展示在押存货价值、质押余额、平均质押率。
- rule：质押率曲线标注警戒线 75% 与平仓线 80%。
- rule：调整规则展示基础质押率 + 各因子调整（价格波动/存储风险/主体信用）。
