-- 真实天气预报快照属于生产域天气适配层；编排只引用标准化结果，不直接依赖外部响应。
CREATE TABLE IF NOT EXISTS agri_prod_calendar_weather_snapshot (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 latitude DECIMAL(10,7) NULL,
 longitude DECIMAL(10,7) NULL,
 week_start DATE NOT NULL,
 issued_at DATETIME NULL,
 provider VARCHAR(64) NOT NULL,
 source_url VARCHAR(1000) NULL,
 status VARCHAR(20) NOT NULL,
 raw_json LONGTEXT NULL,
 normalized_json LONGTEXT NOT NULL,
 error_message VARCHAR(1000) NULL,
 created_at DATETIME NOT NULL,
 KEY idx_calendar_weather_farm(tenant_id,farm_id,week_start,created_at),
 KEY idx_calendar_weather_status(tenant_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 缺少农场坐标也是需留痕的获取失败，不得填入虚构坐标。
ALTER TABLE agri_prod_calendar_weather_snapshot
 MODIFY COLUMN latitude DECIMAL(10,7) NULL,
 MODIFY COLUMN longitude DECIMAL(10,7) NULL;
