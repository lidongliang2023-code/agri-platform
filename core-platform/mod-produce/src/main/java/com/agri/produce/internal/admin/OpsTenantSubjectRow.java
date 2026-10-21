package com.agri.produce.internal.admin;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 运营端租户行：经营主体主档 + 可选的配额配置。
 */
@Data
public class OpsTenantSubjectRow {

    private Long tenantId;
    private String tenantCode;
    private String tenantName;
    private String memberType;
    private String industry;
    private String businessType;
    private String contactName;
    private String contactPhone;
    private Integer status;
    private String verifyStatus;
    private LocalDateTime createdAt;

    private String quotaId;
    private boolean quotaRegistered;
    private Integer farmLimit;
    private Integer usedFarmCount;
    private Integer traceCodeLimit;
    private BigDecimal storageLimitGb;
    private Integer apiCallLimit;
}
