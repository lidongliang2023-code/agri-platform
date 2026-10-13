-- ------------------------------------------------ V24 用户与经营主体绑定关系
--
-- 缺口（实测，见 agri-trade/docs/用户与经营主体绑定方案_2026-10-13.md）：
--   platform_merchant 里**没有任何指向用户的字段**，platform_user 也没有商户字段，
--   主数据 agri_md_user.id 与平台 user id 又不是同一套。
--   于是"这个登录用户是哪个买家/卖家"这个问题今天无解 ——
--   用户端只能退化成"必须由前端自报参与方"，而自报就等于谁都能看别人的单据。
--
-- 本迁移做三件事（均为可重复执行）：
--   ① 建 platform_user_merchant：用户-主体**多对多** + 主体内角色。
--      不给 platform_user 加单个 merchant_id 字段 —— 一个用户属于多家主体是常态
--      （合作社采购员同时在加工厂任职），加单字段很快要推倒重来。
--   ② 补齐 platform_merchant 缺失的经营主体（2002-2006）。
--      交易模块的 seller_id 本来就是按 platform_merchant.id 编的（2001 已在表中），
--      缺的是其余五家 —— 补上之后"货源里的 seller_id"才真的能指回一个主体。
--   ③ 落两条演示绑定：admin 与 farmer 都挂在 2001 上（角色 owner），
--      用来打通"当前用户 → 我的主体 → 我的单据"这条链路。
--      **这是演示数据，不是业务事实**；真实绑定应由运营端录入（下一步做录入页）。
--
-- 说明：本迁移用手写 id 区间 9001+，与业务自增数据分开，便于单独清理。

CREATE TABLE IF NOT EXISTS `platform_user_merchant` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` BIGINT NOT NULL COMMENT '平台用户ID（platform_user.id）',
  `merchant_id` BIGINT NOT NULL COMMENT '经营主体ID（platform_merchant.id）',
  `role_in_merchant` VARCHAR(32) NOT NULL COMMENT '主体内角色：owner负责人 / buyer采购 / seller销售 / finance财务',
  `status` INT NOT NULL DEFAULT 1 COMMENT '1生效 0停用',
  `created_at` DATETIME NOT NULL COMMENT '创建时间',
  `updated_at` DATETIME NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_merchant` (`user_id`, `merchant_id`),
  KEY `idx_merchant` (`merchant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户与经营主体绑定表';

-- ② 补齐经营主体：名称取自交易模块演示数据里的供应商，编码沿用 M+年份+序号 的口径
INSERT IGNORE INTO `platform_merchant` (`id`, `market_id`, `tenant_id`, `code`, `name`, `type`, `status`, `created_at`)
VALUES
  (2002, 1, 'TENANT001', 'M20260002', '山东寿光绿源', 'SELLER', 1, NOW()),
  (2003, 1, 'TENANT001', 'M20260003', '陕西洛川果业', 'SELLER', 1, NOW()),
  (2004, 1, 'TENANT001', 'M20260004', '内蒙古草原牧业', 'SELLER', 1, NOW()),
  (2005, 1, 'TENANT001', 'M20260005', '江苏江南水产', 'SELLER', 1, NOW()),
  (2006, 1, 'TENANT001', 'M20260006', '云南云岭药材', 'SELLER', 1, NOW());

-- ③ 演示绑定（id 固定在 9001+，便于清理）
INSERT IGNORE INTO `platform_user_merchant` (`id`, `user_id`, `merchant_id`, `role_in_merchant`, `status`, `created_at`)
VALUES
  (9001, 2108130996492058625, 2001, 'owner', 1, NOW()),
  (9002, 2108366282836844546, 2001, 'owner', 1, NOW());

-- 清理语句（默认注释）：只删本迁移造的演示绑定
-- DELETE FROM `platform_user_merchant` WHERE `id` BETWEEN 9001 AND 9099;
