-- ------------------------------------------------ V57 平台角色管理字段
--
-- 运营端「角色管理」需要维护说明、启停状态与更新时间，但 platform_role 原先只有
-- code/name/permissions/created_at 四列，前端只能做"假表单"。
-- 同时 permissions 原为 VARCHAR(1000)，权限矩阵（12 域 × 6 动作）序列化后约 1300 字符，
-- 勾满会直接触发"权限码过多"导致落库失败，这里一并放宽为 TEXT。
--
-- 说明：角色层级不新增列。platform_role 本身就是平台级角色表；组织级角色归
-- agri_master_data 的 agri_md_role（tenant_id 维度），两者不混用，详见
-- docs/admin-role-permission-model.md。

ALTER TABLE `platform_role`
  ADD COLUMN `description` VARCHAR(255) NULL COMMENT '角色说明' AFTER `name`,
  ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'enabled' COMMENT 'enabled/disabled' AFTER `description`,
  ADD COLUMN `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间' AFTER `created_at`,
  MODIFY COLUMN `permissions` TEXT NULL COMMENT '权限码 JSON 数组';

UPDATE `platform_role` SET `status` = 'enabled' WHERE `status` IS NULL OR `status` = '';
UPDATE `platform_role` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;
