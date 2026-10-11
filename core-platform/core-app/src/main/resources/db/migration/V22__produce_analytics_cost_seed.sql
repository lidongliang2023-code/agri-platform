-- ------------------------------------------------ V22 指标快照种子补齐：亩均生产成本（COST）
--
-- 缺口（实测）：prod_analytics_snapshot 全表仅 6 行 ——
--   COST 只有 DEMO-FARM-001 / 005，PASS_RATE 只有 001 / 003，YIELD 只有 001 / 002。
--   用户端首页看板是**按当前农场过滤快照**的（AnalyticsSnapshotService#overview 的 farmId 条件），
--   选到未覆盖的农场时该农场只剩 0~1 个指标，页面只能把「亩均成本」等渲染成「—」。
--   实测现场：当前农场 DEMO-FARM-002 只有 YIELD 一行，故合格率与亩均成本双双为空。
--
-- 本迁移**只补 COST**，三处刻意的取舍：
--   1) COST 是唯一「没有第二条数据源」的缺口 —— 补齐后页面即可按当前农场显示真实数字；
--   2) YIELD 已有 001/002 两行、页面累计产量正常，不动它 —— 新增 YIELD 行会改变
--      /analytics/trend?metricCode=YIELD 的取数集合，可能连带影响趋势图，超出本次范围；
--   3) PASS_RATE 不补 —— 接口现在优先返回由 prod_inspection 实时算出的 passRate，
--      补了也不会被页面消费，属无效种子。
--
-- 字段约定：unit / metric_name / status / market_id / tenant_id / biz_date 全部**继承既有 COST 行**，
--   不猜任何约定；仅 metric_value 按农场类型给量级合理的**演示基线值**（元/亩）：
--   大田粮油 690~880、果园 1580~1950、设施果蔬 2600~4200、水产 2250、牧场 1150。
--   这些是演示数据，不是真实经营数据。
--
-- 幂等：NOT EXISTS 去重；只增不删，不触碰既有 6 行，也不触碰任何非演示农场。

INSERT INTO prod_analytics_snapshot
    (snapshot_id, market_id, tenant_id, farm_id, biz_date, metric_code, metric_name,
     metric_value, unit, status)
SELECT CONCAT('DEMO-ANLS-COST-', SUBSTRING(f.farm_id, 11)) AS snapshot_id,
       s.market_id,
       s.tenant_id,
       f.farm_id,
       s.biz_date,
       s.metric_code,
       s.metric_name,
       CASE f.farm_id
           WHEN 'DEMO-FARM-002' THEN 880.0000
           WHEN 'DEMO-FARM-003' THEN 3200.0000
           WHEN 'DEMO-FARM-004' THEN 1150.0000
           WHEN 'DEMO-FARM-006' THEN 2600.0000
           WHEN 'DEMO-FARM-007' THEN 720.0000
           WHEN 'DEMO-FARM-008' THEN 810.0000
           WHEN 'DEMO-FARM-009' THEN 1860.0000
           WHEN 'DEMO-FARM-010' THEN 4200.0000
           WHEN 'DEMO-FARM-011' THEN 1720.0000
           WHEN 'DEMO-FARM-012' THEN 2250.0000
           WHEN 'DEMO-FARM-013' THEN 690.0000
           WHEN 'DEMO-FARM-014' THEN 1580.0000
           WHEN 'DEMO-FARM-015' THEN 1950.0000
           WHEN 'DEMO-FARM-016' THEN 3400.0000
       END,
       s.unit,
       s.status
  FROM prod_farm_info f
 CROSS JOIN (SELECT market_id, tenant_id, metric_code, metric_name, unit, status, biz_date
               FROM prod_analytics_snapshot
              WHERE metric_code = 'COST'
              ORDER BY biz_date DESC, snapshot_id
              LIMIT 1) s
 WHERE f.deleted = 0
   AND f.farm_id IN ('DEMO-FARM-002', 'DEMO-FARM-003', 'DEMO-FARM-004', 'DEMO-FARM-006',
                     'DEMO-FARM-007', 'DEMO-FARM-008', 'DEMO-FARM-009', 'DEMO-FARM-010',
                     'DEMO-FARM-011', 'DEMO-FARM-012', 'DEMO-FARM-013', 'DEMO-FARM-014',
                     'DEMO-FARM-015', 'DEMO-FARM-016')
   AND NOT EXISTS (SELECT 1
                     FROM prod_analytics_snapshot x
                    WHERE x.metric_code = 'COST'
                      AND x.farm_id = f.farm_id
                      AND x.deleted = 0);
