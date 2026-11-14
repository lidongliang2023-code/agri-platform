CREATE TABLE IF NOT EXISTS agri_prod_yield_forecast (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 tenant_id VARCHAR(191) NOT NULL,
 farm_id BIGINT NULL,
 plot_id BIGINT NULL,
 crop_name VARCHAR(128) NOT NULL,
 crop_variety VARCHAR(128) NULL,
 forecast_date DATE NOT NULL,
 harvest_start DATE NOT NULL,
 harvest_end DATE NOT NULL,
 data_cutoff DATE NOT NULL,
 valid_until DATE NOT NULL,
 status VARCHAR(24) NOT NULL,
 source_version VARCHAR(64) NOT NULL,
 input_json LONGTEXT NOT NULL,
 result_json LONGTEXT NOT NULL,
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 UNIQUE KEY uk_yield_request(tenant_id, id),
 KEY idx_yield_forecast(tenant_id, crop_name, forecast_date),
 KEY idx_yield_plot(tenant_id, plot_id, forecast_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_yield_forecast_event (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 forecast_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 payload_json LONGTEXT NOT NULL,
 operator VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_yield_event(tenant_id, forecast_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agri_prod_yield_forecast_feedback (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 forecast_id VARCHAR(36) NOT NULL,
 tenant_id VARCHAR(191) NOT NULL,
 actual_quantity DECIMAL(18,3) NOT NULL,
 unit VARCHAR(16) NOT NULL,
 actual_date DATE NOT NULL,
 note VARCHAR(500) NULL,
 created_by VARCHAR(191) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_yield_feedback(tenant_id, forecast_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
