-- =====================================================================
-- core-platform V3 生产域 IoT 扩展（指令下发 / 维修记录 / 设备绑定关系）
-- 纪律：生产模块表一律 prod_ 前缀（ArchUnit TablePrefixTest 门禁）；
--       每张表保留 market_id 行级隔离列（ADR-005，TenantLineInnerInterceptor 注入）；
--       审计列 create_by / update_by / create_at / update_at / deleted 齐全；
--       本脚本只做新增，不改动 V2__produce_domain.sql（V2 已定稿）。
--
-- 说明：三张表均为 V2 之后前端联调暴露的能力缺口，属于 prod_iot_device 的从属表，
--       业务主键沿用 varchar(32) 体系（ProduceIds 生成），与 V2 新建表口径一致。
-- =====================================================================

-- ------------------------------------------------ IoT 指令下发与回执

CREATE TABLE prod_iot_command (
    command_id     VARCHAR(32)   NOT NULL COMMENT 'commandId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    device_id      VARCHAR(32)   NOT NULL COMMENT '设备ID',
    device_code    VARCHAR(32)   COMMENT '设备编码（冗余，便于检索）',
    command_type   VARCHAR(32)   NOT NULL COMMENT '指令类型 VALVE_SWITCH/IRRIGATE/FERTIGATE/REBOOT/READING 等',
    params         VARCHAR(1000) COMMENT '指令参数（JSON 文本）',
    operator       VARCHAR(64)   COMMENT '操作人',
    status         VARCHAR(20)   NOT NULL DEFAULT 'PENDING' COMMENT '状态 PENDING/SUCCESS/FAILED',
    receipt        VARCHAR(500)  COMMENT '回执内容',
    send_at        DATETIME      COMMENT '下发时间',
    receipt_at     DATETIME      COMMENT '回执时间',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (command_id),
    KEY idx_iot_command_market (market_id),
    KEY idx_iot_command_device (device_id),
    KEY idx_iot_command_status (status),
    KEY idx_iot_command_send_at (send_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 设备指令下发与回执';

-- ------------------------------------------------ IoT 设备维修记录

CREATE TABLE prod_iot_maintenance (
    maintain_id    VARCHAR(32)   NOT NULL COMMENT 'maintainId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    device_id      VARCHAR(32)   NOT NULL COMMENT '设备ID',
    device_code    VARCHAR(32)   COMMENT '设备编码（冗余，便于检索）',
    maintain_type  VARCHAR(32)   COMMENT '维修类型 INSPECT/REPAIR/REPLACE/CALIBRATE/UPGRADE',
    content        VARCHAR(1000) COMMENT '维修内容',
    operator       VARCHAR(64)   COMMENT '操作人',
    maintain_at    DATETIME      COMMENT '维修时间',
    result         VARCHAR(500)  COMMENT '维修结果',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (maintain_id),
    KEY idx_iot_maintenance_market (market_id),
    KEY idx_iot_maintenance_device (device_id),
    KEY idx_iot_maintenance_at (maintain_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 设备维修记录';

-- ------------------------------------------------ IoT 设备绑定关系
-- 绑定对象：PLOT=地块 / GREENHOUSE=大棚 / FARM=农场。
-- metrics 采集指标以逗号分隔存放（如 "temperature,humidity,soil_moisture"），
-- 服务层统一转换为数组对外暴露（IotBindingVO.metrics）。

CREATE TABLE prod_iot_binding (
    binding_id     VARCHAR(32)   NOT NULL COMMENT 'bindingId（业务主键）',
    market_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '市场维度（ADR-005 行级隔离）',
    tenant_id      BIGINT        NOT NULL DEFAULT 0 COMMENT '租户ID（SaaS 预留）',
    device_id      VARCHAR(32)   NOT NULL COMMENT '设备ID',
    device_code    VARCHAR(32)   COMMENT '设备编码（冗余，便于检索）',
    device_name    VARCHAR(100)  COMMENT '设备名称（冗余，便于列表展示）',
    bind_type      VARCHAR(20)   NOT NULL DEFAULT 'PLOT' COMMENT '绑定对象类型 PLOT/GREENHOUSE/FARM',
    bind_target_id VARCHAR(32)   NOT NULL COMMENT '绑定对象ID（地块ID/大棚ID/农场ID）',
    bind_target_name VARCHAR(100) COMMENT '绑定对象名称（冗余，便于列表展示）',
    metrics        VARCHAR(255)  COMMENT '采集指标（逗号分隔，如 temperature,humidity）',
    frequency      INT           COMMENT '采集频率（分钟）',
    status         VARCHAR(20)   NOT NULL DEFAULT 'BOUND' COMMENT '状态 BOUND/UNBOUND/PAUSED',
    bound_at       DATETIME      COMMENT '绑定时间',
    create_by      BIGINT        COMMENT '创建人',
    update_by      BIGINT        COMMENT '更新人',
    create_at      DATETIME      DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除 0否 1是',
    PRIMARY KEY (binding_id),
    KEY idx_iot_binding_market (market_id),
    KEY idx_iot_binding_device (device_id),
    KEY idx_iot_binding_target (bind_type, bind_target_id),
    KEY idx_iot_binding_status (status),
    -- 唯一键带上 deleted：解绑/删除后重新绑定同一对象不会撞唯一键冲突
    UNIQUE KEY uk_iot_binding_device_target (device_id, bind_type, bind_target_id, deleted)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT = 'IoT 设备绑定关系（设备 × 地块/大棚/农场）';

-- ------------------------------------------------ 投入品使用记录：补投入品批号
-- 事件 prod.input.usage.recorded 的载荷需要 batchNo（投入品自身的农药/肥料批号，
-- 与采收批次号 prod_harvest_batch.batch_no 不是同一语义），故为 V2 的 prod_input_usage 补列。

ALTER TABLE prod_input_usage
    ADD COLUMN batch_no VARCHAR(64) NULL COMMENT '投入品批次号（农药/肥料批号，溯源关键）';
