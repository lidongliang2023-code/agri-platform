-- ------------------------------------------------ V23 十月演示农事任务
--
-- 缺口（实测）：用户端首页看板的「本月任务总数 / 本月已完成任务数 / 本月任务完成率」按**自然月**统计，
--   而演示任务的 plan_start_date 全在 2026-02-01 ~ 2026-09-20，2026 年 10 月一条没有
--   （SQL 实测 oct=0）→ 分母为 0 → 完成率按"无分母不填 0"返回 null，页面显示「—」，
--   并被前端横幅误归为"后端未接入项"。本迁移补 6 条十月任务使这三个指标真实非零。
--
-- 口径：6 条 = 4 条已完成（status='done' + accept_status=1 + completed_at 有值）
--       + 2 条待执行（status='pending' + accept_status=0 + completed_at 为空）。
--       → 本月任务总数 6、已完成 4、完成率 66.7%。
--
-- 归属：全部挂在 **DEMO-FARM-002** 的地块上 —— 用户端看板已按当前农场下钻，
--   而 prod_task_info 只有 plot_id、没有 farm_id，故 plot_id 用子查询取该农场真实存在的地块；
--   plan_id 同样从既有任务里取一个真实存在的值（不硬编码、不造外键）。
--
-- 幂等：task_id 用 DEMO-TASK-OCT- 前缀，先按前缀 DELETE 再插入；
--   只动演示行，不触碰任何既有任务。

DELETE FROM prod_task_info WHERE task_id LIKE 'DEMO-TASK-OCT-%';

INSERT INTO prod_task_info
    (task_id, market_id, tenant_id, task_no, plan_id, plot_id, task_type, task_name,
     plan_start_date, plan_end_date, assignee_id, status, priority, accept_status,
     completed_at, create_at, update_at, deleted)
VALUES
('DEMO-TASK-OCT-01', 1, 0, 'DEMO-TASKN-OCT-01',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '施肥', '水稻分蘖期追肥', '2026-10-02', '2026-10-06', 'DEMO-MEM-003', 'done', 2, 1,
 '2026-10-06 16:20:00', NOW(), NOW(), 0),
('DEMO-TASK-OCT-02', 1, 0, 'DEMO-TASKN-OCT-02',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '植保', '稻飞虱统防统治', '2026-10-05', '2026-10-09', 'DEMO-MEM-002', 'done', 1, 1,
 '2026-10-09 11:05:00', NOW(), NOW(), 0),
('DEMO-TASK-OCT-03', 1, 0, 'DEMO-TASKN-OCT-03',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '灌溉', '灌浆期浅水勤灌', '2026-10-07', '2026-10-11', 'DEMO-MEM-003', 'done', 2, 1,
 '2026-10-11 09:40:00', NOW(), NOW(), 0),
('DEMO-TASK-OCT-04', 1, 0, 'DEMO-TASKN-OCT-04',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '田间管理', '田间杂草清除', '2026-10-08', '2026-10-12', 'DEMO-MEM-002', 'done', 3, 1,
 '2026-10-12 17:15:00', NOW(), NOW(), 0),
('DEMO-TASK-OCT-05', 1, 0, 'DEMO-TASKN-OCT-05',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '采收', '稻田水分管理待收', '2026-10-14', '2026-10-20', 'DEMO-MEM-003', 'pending', 2, 0,
 NULL, NOW(), NOW(), 0),
('DEMO-TASK-OCT-06', 1, 0, 'DEMO-TASKN-OCT-06',
 (SELECT plan_id FROM prod_plan_info WHERE deleted = 0 ORDER BY plan_id LIMIT 1),
 (SELECT plot_id FROM prod_plot_info WHERE farm_id = 'DEMO-FARM-002' AND deleted = 0 ORDER BY plot_id LIMIT 1),
 '整地', '秋播前整地备耕', '2026-10-18', '2026-10-25', 'DEMO-MEM-002', 'pending', 1, 0,
 NULL, NOW(), NOW(), 0);
