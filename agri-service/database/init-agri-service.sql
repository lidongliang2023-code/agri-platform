-- 综合服务模块 MySQL 初始化脚本。
-- 应用默认启用 createDatabaseIfNotExist=true；如需由 DBA 建库，可先执行：
CREATE DATABASE IF NOT EXISTS `agri_service`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- 表结构与种子数据由应用启动时执行：
-- classpath:schema.sql、classpath:data.sql。
