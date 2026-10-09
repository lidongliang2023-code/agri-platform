-- ------------------------------------------------ 投入品使用记录：补农场维度
-- 由「前端传 farmId、后端方法签名里没有该参数」的缺口驱动：GET /api/v1/production/inputs/usages
-- 收到的 farmId 被 Spring 静默丢弃，运营端农场监管详情（FarmSupervisionDetail）的
-- 「投入品使用记录」Tab 因此显示的是全局数据而非本农场数据。
--
-- 选择「加列」而非「按 plot_id 子查询推导」的理由：子查询会让**没有关联地块**
-- 的使用记录在按农场筛选时被静默排除——运营看到的是「这条记录凭空消失了」，
-- 比「历史数据暂时筛不到」更隐蔽、更难排查。加真实列则不丢数据：
-- 未挂地块（或地块已逻辑删除）的记录 farm_id 保持 NULL，前端显示「—」。
--
-- 纪律：列可空，回填不到的保持 NULL，绝不填默认值占位。

ALTER TABLE prod_input_usage
    ADD COLUMN farm_id VARCHAR(32) NULL COMMENT '所属农场ID' AFTER plot_id;

-- 回填：不回填的话，加列前已有的全部使用记录在按农场筛选时会一起消失
-- （不报错、不提示，属于静默数据丢失）。按记录上已有的 plot_id 反查所属农场补上。
UPDATE prod_input_usage u
    JOIN prod_plot_info p ON u.plot_id = p.plot_id
SET u.farm_id = p.farm_id
WHERE u.farm_id IS NULL
  AND p.deleted = 0;

ALTER TABLE prod_input_usage
    ADD KEY idx_input_usage_farm (farm_id);
