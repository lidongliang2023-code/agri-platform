package com.agri.produce.internal.trace;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 溯源码（一物一码 MVP：一批一码起步，扩展为一件一码）。
 *
 * <p>PRD 11.2 补齐字段：激活信息、扫码统计、有效期（对应 V2 迁移脚本 ALTER prod_trace_code）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_trace_code")
public class TraceCodeEntity extends BaseEntity {

    private Long batchId;

    /** 批次号（冗余，便于按批次号检索） */
    private String batchNo;

    private String code;

    /** generated=已生成 active=已激活 scanned=已扫码 revoked=已作废 */
    private String status;

    /** 激活时间 */
    private LocalDateTime activatedAt;

    /** 激活人 */
    private String activatedBy;

    /** 扫码次数 */
    private Integer scanCount;

    /** 最后一次扫码时间 */
    private LocalDateTime lastScanAt;

    /** 有效期至 */
    private LocalDate expireDate;
}
