-- 独立于AI卫星成本表及核心平台迁移历史。
CREATE TABLE ai_hub_configuration_guard(id INT PRIMARY KEY);
INSERT INTO ai_hub_configuration_guard(id) VALUES(1);
CREATE TABLE ai_hub_configuration(
 config_key VARCHAR(64) PRIMARY KEY, revision BIGINT NOT NULL, body LONGTEXT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ai_hub_configuration_history(
 id BIGINT AUTO_INCREMENT PRIMARY KEY, config_key VARCHAR(64) NOT NULL, revision BIGINT NOT NULL,
 body LONGTEXT NOT NULL, action VARCHAR(32) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uk_ai_config_revision(config_key,revision)
);
