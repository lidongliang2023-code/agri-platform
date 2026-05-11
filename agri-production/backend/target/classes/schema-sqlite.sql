CREATE TABLE IF NOT EXISTS agri_prod_farm_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_code TEXT NOT NULL UNIQUE,
    farm_name TEXT NOT NULL,
    farm_type TEXT,
    legal_person TEXT,
    contact_phone TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    address TEXT,
    longitude DECIMAL(12,8),
    latitude DECIMAL(12,8),
    total_area DECIMAL(12,4),
    plot_count INTEGER DEFAULT 0,
    farm_type_detail TEXT,
    main_products TEXT,
    certifications TEXT,
    certification_expire_date DATE,
    certifications_json TEXT,
    logo_url TEXT,
    intro TEXT,
    register_date DATE,
    audit_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'active',
    tenant_id TEXT NOT NULL,
    farm_id TEXT,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_farm_tenant_id ON agri_prod_farm_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_farm_farm_code ON agri_prod_farm_info(farm_code);

CREATE TABLE IF NOT EXISTS agri_prod_plot_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_code TEXT NOT NULL UNIQUE,
    plot_name TEXT NOT NULL,
    farm_id INTEGER,
    area DECIMAL(12,4),
    shape TEXT,
    soil_type TEXT,
    terrain TEXT,
    drainage TEXT,
    irrigation_type TEXT,
    current_crop TEXT,
    planting_date DATE,
    expected_harvest_date DATE,
    status TEXT DEFAULT 'active',
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_plot_tenant_id ON agri_prod_plot_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plot_plot_code ON agri_prod_plot_info(plot_code);
CREATE INDEX IF NOT EXISTS idx_plot_farm_id ON agri_prod_plot_info(farm_id);

CREATE TABLE IF NOT EXISTS agri_prod_task_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_code TEXT NOT NULL UNIQUE,
    task_name TEXT NOT NULL,
    task_type TEXT,
    description TEXT,
    farm_id INTEGER,
    plot_id INTEGER,
    executor_id INTEGER,
    executor_name TEXT,
    plan_start_time DATETIME,
    plan_end_time DATETIME,
    actual_start_time DATETIME,
    actual_end_time DATETIME,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    task_data TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_tenant_id ON agri_prod_task_info(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_task_code ON agri_prod_task_info(task_code);

CREATE TABLE IF NOT EXISTS agri_prod_input_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_code TEXT NOT NULL UNIQUE,
    material_name TEXT NOT NULL,
    material_type TEXT,
    specification TEXT,
    unit TEXT,
    manufacturer TEXT,
    batch_number TEXT,
    production_date DATE,
    expire_date DATE,
    shelf_life INTEGER,
    storage_conditions TEXT,
    safety_level TEXT,
    toxicity_level TEXT,
    usage_instructions TEXT,
    dosage TEXT,
    warning_threshold INTEGER DEFAULT 100,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_input_tenant_id ON agri_prod_input_material(tenant_id);
CREATE INDEX IF NOT EXISTS idx_input_material_code ON agri_prod_input_material(material_code);

CREATE TABLE IF NOT EXISTS agri_prod_input_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER,
    warehouse_id INTEGER,
    quantity DECIMAL(12,4) DEFAULT 0,
    location TEXT,
    batch_number TEXT,
    expire_date DATE,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON agri_prod_input_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_material_id ON agri_prod_input_inventory(material_id);

CREATE TABLE IF NOT EXISTS agri_prod_harvest_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    harvest_code TEXT NOT NULL UNIQUE,
    crop_name TEXT NOT NULL,
    farm_id INTEGER,
    plot_id INTEGER,
    harvest_date DATE,
    quantity DECIMAL(12,4),
    unit TEXT,
    quality_grade TEXT,
    moisture_content DECIMAL(5,2),
    weight_net DECIMAL(12,4),
    weight_gross DECIMAL(12,4),
    storage_location TEXT,
    transporter TEXT,
    vehicle_number TEXT,
    harvest_method TEXT,
    status TEXT DEFAULT 'pending',
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_harvest_tenant_id ON agri_prod_harvest_record(tenant_id);
CREATE INDEX IF NOT EXISTS idx_harvest_harvest_code ON agri_prod_harvest_record(harvest_code);

CREATE TABLE IF NOT EXISTS agri_prod_harvest_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    harvest_id INTEGER,
    location TEXT,
    quantity DECIMAL(12,4),
    quality_grade TEXT,
    storage_conditions TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_harvest_inv_tenant_id ON agri_prod_harvest_inventory(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_trace_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_code TEXT NOT NULL UNIQUE,
    harvest_id INTEGER,
    product_name TEXT,
    product_spec TEXT,
    batch_code TEXT,
    production_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT 'inactive',
    qr_code_url TEXT,
    trace_data TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_trace_tenant_id ON agri_prod_trace_code(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trace_trace_code ON agri_prod_trace_code(trace_code);

CREATE TABLE IF NOT EXISTS agri_prod_alert_rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code TEXT NOT NULL UNIQUE,
    rule_name TEXT NOT NULL,
    alert_type TEXT,
    level TEXT,
    source_type TEXT,
    source_id INTEGER,
    condition_expression TEXT,
    threshold_min DECIMAL(12,4),
    threshold_max DECIMAL(12,4),
    unit TEXT,
    description TEXT,
    is_enabled INTEGER DEFAULT 1,
    notify_users TEXT,
    notify_methods TEXT,
    remind_interval INTEGER DEFAULT 60,
    auto_handle INTEGER DEFAULT 0,
    handle_script TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_rule_tenant_id ON agri_prod_alert_rule(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_alert_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_code TEXT NOT NULL UNIQUE,
    rule_id INTEGER,
    title TEXT,
    level TEXT,
    source_type TEXT,
    source_id INTEGER,
    source_name TEXT,
    content TEXT,
    value DECIMAL(12,4),
    threshold_min DECIMAL(12,4),
    threshold_max DECIMAL(12,4),
    status TEXT DEFAULT 'unhandled',
    handle_time DATETIME,
    handle_user TEXT,
    handle_result TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_alert_record_tenant_id ON agri_prod_alert_record(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_emergency_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_code TEXT NOT NULL UNIQUE,
    plan_name TEXT NOT NULL,
    plan_type TEXT,
    level TEXT,
    description TEXT,
    trigger_conditions TEXT,
    response_steps TEXT,
    responsible_person TEXT,
    contact_info TEXT,
    resources_required TEXT,
    execute_script TEXT,
    is_enabled INTEGER DEFAULT 1,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_emergency_tenant_id ON agri_prod_emergency_plan(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_quality_inspection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_code TEXT NOT NULL UNIQUE,
    harvest_id INTEGER,
    sample_code TEXT,
    inspect_date DATE,
    inspect_items TEXT,
    results TEXT,
    conclusion TEXT,
    inspector TEXT,
    audit_status TEXT DEFAULT 'pending',
    audit_time DATETIME,
    auditor TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_quality_tenant_id ON agri_prod_quality_inspection(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_inspection_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    item_type TEXT,
    standard_value TEXT,
    unit TEXT,
    method TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_inspection_item_tenant_id ON agri_prod_inspection_item(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_iot_device (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_code TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL,
    device_type TEXT,
    device_model TEXT,
    manufacturer TEXT,
    install_location TEXT,
    farm_id INTEGER,
    plot_id INTEGER,
    status TEXT DEFAULT 'offline',
    last_connect_time DATETIME,
    ip_address TEXT,
    protocol TEXT,
    data_interval INTEGER DEFAULT 60,
    is_enabled INTEGER DEFAULT 1,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_iot_device_tenant_id ON agri_prod_iot_device(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    sensor_type TEXT,
    value DECIMAL(12,4),
    unit TEXT,
    collect_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    quality TEXT DEFAULT 'good',
    tenant_id TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensor_tenant_id ON agri_prod_sensor_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sensor_device_id ON agri_prod_sensor_data(device_id);

CREATE TABLE IF NOT EXISTS agri_prod_sop_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    crop_type TEXT,
    task_type TEXT,
    description TEXT,
    steps TEXT,
    duration INTEGER,
    required_tools TEXT,
    safety_notes TEXT,
    is_enabled INTEGER DEFAULT 1,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_sop_template_tenant_id ON agri_prod_sop_template(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_sop_execution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_code TEXT NOT NULL UNIQUE,
    template_id INTEGER,
    template_name TEXT,
    farm_id INTEGER,
    plot_id INTEGER,
    executor_id INTEGER,
    executor_name TEXT,
    start_time DATETIME,
    end_time DATETIME,
    status TEXT DEFAULT 'pending',
    current_step INTEGER DEFAULT 0,
    execution_log TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_sop_execution_tenant_id ON agri_prod_sop_execution(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_soil_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id INTEGER,
    sample_date DATE,
    ph_value DECIMAL(4,2),
    organic_matter DECIMAL(5,2),
    nitrogen DECIMAL(10,4),
    phosphorus DECIMAL(10,4),
    potassium DECIMAL(10,4),
    moisture_content DECIMAL(5,2),
    temperature DECIMAL(5,2),
    recommendations TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_soil_tenant_id ON agri_prod_soil_record(tenant_id);

CREATE TABLE IF NOT EXISTS agri_prod_planting_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_code TEXT NOT NULL UNIQUE,
    plan_name TEXT NOT NULL,
    crop_type TEXT,
    variety TEXT,
    farm_id INTEGER,
    plot_id INTEGER,
    planned_area DECIMAL(12,4),
    actual_area DECIMAL(12,4),
    planting_date DATE,
    expected_harvest_date DATE,
    target_yield DECIMAL(12,4),
    status TEXT DEFAULT 'pending',
    tasks TEXT,
    inputs TEXT,
    tenant_id TEXT NOT NULL,
    create_by TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_by TEXT,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_planting_plan_tenant_id ON agri_prod_planting_plan(tenant_id);

INSERT INTO agri_prod_farm_info (farm_code, farm_name, tenant_id) VALUES ('F001', '示范农场', 'T001');
INSERT INTO agri_prod_farm_info (farm_code, farm_name, tenant_id) VALUES ('F002', '绿色生态园', 'T001');

INSERT INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P001', 'A区-地块1', 1, 'T001');
INSERT INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P002', 'A区-地块2', 1, 'T001');
INSERT INTO agri_prod_plot_info (plot_code, plot_name, farm_id, tenant_id) VALUES ('P003', 'B区-地块1', 2, 'T001');

INSERT INTO agri_prod_task_info (task_code, task_name, task_type, farm_id, plot_id, tenant_id) VALUES ('T001', '春季施肥', '施肥', 1, 1, 'T001');
INSERT INTO agri_prod_task_info (task_code, task_name, task_type, farm_id, plot_id, tenant_id) VALUES ('T002', '病虫害防治', '防治', 1, 2, 'T001');

INSERT INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M001', '有机肥料', '肥料', 'kg', 'T001');
INSERT INTO agri_prod_input_material (material_code, material_name, material_type, unit, tenant_id) VALUES ('M002', '生物农药', '农药', 'L', 'T001');

INSERT INTO agri_prod_input_inventory (material_id, quantity, tenant_id) VALUES (1, 5000, 'T001');
INSERT INTO agri_prod_input_inventory (material_id, quantity, tenant_id) VALUES (2, 200, 'T001');

INSERT INTO agri_prod_harvest_record (harvest_code, crop_name, farm_id, plot_id, harvest_date, quantity, unit, tenant_id) VALUES ('H001', '西红柿', 1, 1, '2024-01-15', 2500, 'kg', 'T001');

INSERT INTO agri_prod_alert_rule (rule_code, rule_name, alert_type, level, tenant_id) VALUES ('R001', '土壤湿度异常', 'soil', 'warning', 'T001');
INSERT INTO agri_prod_alert_rule (rule_code, rule_name, alert_type, level, tenant_id) VALUES ('R002', '温度超限', 'temperature', 'error', 'T001');