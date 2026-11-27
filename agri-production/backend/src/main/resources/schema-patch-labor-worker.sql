-- 劳务人员库（采收窗口决策域）
-- 职责边界：维护临时/季节性劳务人员及可到岗能力；团队成员表仍负责长期组织成员与角色权限。
-- 采收批次、农事任务和工资结算不在本表落库。
CREATE TABLE IF NOT EXISTS agri_prod_labor_worker (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL,
    farm_id BIGINT NOT NULL,
    worker_no VARCHAR(64) NOT NULL,
    worker_name VARCHAR(64) NOT NULL,
    phone VARCHAR(32),
    source_type VARCHAR(32) NOT NULL DEFAULT 'VILLAGE',
    source_name VARCHAR(128),
    skill_type VARCHAR(32) NOT NULL DEFAULT 'HARVEST',
    daily_wage DECIMAL(10,2) NOT NULL DEFAULT 180.00,
    availability_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    daily_capacity INT NOT NULL DEFAULT 1,
    max_hours DECIMAL(4,1) NOT NULL DEFAULT 8.0,
    available_weekdays VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5,6,7',
    available_from DATE,
    available_to DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    note VARCHAR(500),
    created_by VARCHAR(191) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_labor_worker_no (tenant_id, farm_id, worker_no),
    KEY idx_labor_worker_farm (tenant_id, farm_id, status),
    KEY idx_labor_worker_availability (tenant_id, farm_id, available_from, available_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='采收域劳务人员库';

-- 当前演示农场的少量真实粒度样例；可重复执行。
INSERT IGNORE INTO agri_prod_labor_worker
(id, tenant_id, farm_id, worker_no, worker_name, phone, source_type, source_name, skill_type,
 daily_wage, availability_rate, daily_capacity, max_hours, available_weekdays, available_from, available_to,
 status, note, created_by, created_at, updated_at)
VALUES
('DEMO-LABOR-001','2001',1,'LW-001','张海林','13900001001','VILLAGE','本村劳务队','HARVEST',180,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','熟练采收工','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-002','2001',1,'LW-002','李秀梅','13900001002','VILLAGE','本村劳务队','HARVEST',180,90,1,8.0,'1,2,3,4,5,6',NULL,NULL,'ACTIVE','可承担分拣','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-003','2001',1,'LW-003','王建军','13900001003','VILLAGE','本村劳务队','MACHINE',220,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','采收机协作','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-004','2001',1,'LW-004','赵春兰','13900001004','VILLAGE','本村劳务队','HARVEST',180,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','熟练采收工','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-005','2001',1,'LW-005','刘大勇','13900001005','NEIGHBORING','邻村劳务队','DRIVER',240,80,1,8.0,'1,2,3,4,5,6',NULL,NULL,'ACTIVE','运输车司机','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-006','2001',1,'LW-006','孙桂芳','13900001006','NEIGHBORING','邻村劳务队','HARVEST',190,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','邻村调剂人员','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-007','2001',1,'LW-007','陈文斌','13900001007','AGENCY','丰收劳务合作社','MIXED',200,70,1,8.0,'1,2,3,4,5',NULL,NULL,'ACTIVE','可按需调剂','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-008','2001',1,'LW-008','高秀云','13900001008','VILLAGE','本村劳务队','HARVEST',180,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','熟练采收工','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-009','2001',1,'LW-009','周明远','13900001009','VILLAGE','本村劳务队','MIXED',200,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','采收与装车','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-010','2001',1,'LW-010','韩素琴','13900001010','NEIGHBORING','邻村劳务队','HARVEST',190,90,1,8.0,'1,2,3,4,5,6',NULL,NULL,'ACTIVE','邻村调剂人员','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-011','2001',1,'LW-011','郭庆华','13900001011','AGENCY','丰收劳务合作社','HARVEST',200,60,1,8.0,'1,2,3,4,5',NULL,NULL,'ACTIVE','临时备用','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('DEMO-LABOR-012','2001',1,'LW-012','何志刚','13900001012','VILLAGE','本村劳务队','DRIVER',240,100,1,8.0,'1,2,3,4,5,6,7',NULL,NULL,'ACTIVE','运输车司机','system',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
