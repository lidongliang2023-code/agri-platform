-- 农事智能编排属于生产域；计划/阶段/任务仍复用原表。
CREATE TABLE IF NOT EXISTS agri_prod_calendar_arrangement (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 week_start DATE NOT NULL,
 request_id VARCHAR(64) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 input_json LONGTEXT NOT NULL,
 result_json LONGTEXT NOT NULL,
 ai_json LONGTEXT NULL,
 approved_by VARCHAR(191),
 cross_month_by VARCHAR(191),
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_calendar_request(tenant_id,request_id),
 KEY idx_calendar_farm(tenant_id,farm_id,week_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_calendar_item (
 arrangement_id VARCHAR(36) NOT NULL,
 item_key VARCHAR(64) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plot_id BIGINT NOT NULL,
 plan_id BIGINT NOT NULL,
 stage_id BIGINT NOT NULL,
 member_id BIGINT NOT NULL,
 scheduled_date DATE NOT NULL,
 people INT NOT NULL,
 machine_slots INT NOT NULL,
 task_id BIGINT NOT NULL,
 PRIMARY KEY(arrangement_id,item_key),
 UNIQUE KEY uk_calendar_task(task_id),
 UNIQUE KEY uk_calendar_stage_day(tenant_id,stage_id,scheduled_date,item_key),
 KEY idx_calendar_occupation(tenant_id,farm_id,scheduled_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_calendar_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 arrangement_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 payload_json LONGTEXT NOT NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_calendar_event(tenant_id,arrangement_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_calendar_intervention (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NOT NULL,
 plot_id BIGINT NOT NULL,
 week_start DATE NOT NULL,
 state VARCHAR(20) NOT NULL,
 task_ids_json LONGTEXT NOT NULL,
 note TEXT,
 resolved_by VARCHAR(191),
 created_at DATETIME NOT NULL,
 resolved_at DATETIME,
 UNIQUE KEY uk_calendar_intervention(tenant_id,farm_id,plot_id,week_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
