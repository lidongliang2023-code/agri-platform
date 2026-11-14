-- 语音记录是采集凭证，库存/采收事实仍归原业务域；音频仅通过鉴权接口读取。
CREATE TABLE IF NOT EXISTS agri_prod_voice_record (
 id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL, farm_id BIGINT NOT NULL,
 request_id VARCHAR(64) NOT NULL, request_hash VARCHAR(64) NOT NULL, revision INT NOT NULL DEFAULT 1,
 state VARCHAR(24) NOT NULL, transcript TEXT NULL, asr_json LONGTEXT NULL, extraction_json LONGTEXT NULL,
 draft_json LONGTEXT NOT NULL, risks_json LONGTEXT NOT NULL, audio LONGBLOB NULL,
 audio_sha VARCHAR(64) NULL, audio_type VARCHAR(80) NULL, audio_expires_at DATETIME NULL,
 created_by VARCHAR(191) NOT NULL, created_user VARCHAR(191) NOT NULL, reviewed_by VARCHAR(191) NULL,
 reviewed_revision INT NULL, review_note TEXT NULL, confirmed_by VARCHAR(191) NULL,
 plot_id BIGINT NULL, batch_id BIGINT NULL, operation_date DATE NULL, operation_type VARCHAR(32) NULL,
 archive_group VARCHAR(36) NULL, usage_id BIGINT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_voice_request(tenant_id,request_id), KEY idx_voice_farm(tenant_id,farm_id,state,created_at),
 KEY idx_voice_archive(tenant_id,plot_id,batch_id,operation_date), KEY idx_voice_expiry(audio_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS agri_prod_voice_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(191) NOT NULL, record_id VARCHAR(36) NOT NULL,
 event_type VARCHAR(32) NOT NULL, payload_json LONGTEXT NOT NULL, operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL, KEY idx_voice_event(tenant_id,record_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
