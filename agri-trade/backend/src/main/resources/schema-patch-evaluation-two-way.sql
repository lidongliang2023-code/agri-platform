-- 一次性补丁：把评价表的唯一键从「一单一条」改成「一单每方一条」。
--
-- 为什么：uk_order_id(order_id) 让先评价的那一方把整张订单的评价位置占掉，
-- 另一方（通常是卖家）再也评不了 —— 卖家的信用分永远只有买家给的那一半。
-- 接口侧本来就已经按「评价人 = 我自己那一方」推导，只有这条表约束挡着。
--
-- 什么时候要跑：2026-10-13 之前建的库。新建的库不用跑，schema.sql 已经是新键。
-- 有重复数据的库要先处理：同一订单同一个评价人存在多条时，加唯一键会失败
--   （可以先 SELECT order_id, evaluator_id, COUNT(*) FROM agri_trade_evaluation
--     GROUP BY order_id, evaluator_id HAVING COUNT(*) > 1 看有没有）。
--
-- 跑法：
--   mysql -uroot -p agri_trade < schema-patch-evaluation-two-way.sql

ALTER TABLE agri_trade_evaluation
    DROP INDEX uk_order_id,
    ADD UNIQUE KEY uk_order_evaluator (order_id, evaluator_id);

-- 注意：agri_trade_settlement 上也有一个同名的 uk_order_id（一单一次结算），
-- 那是另一个业务约束，这条补丁只动评价表。
