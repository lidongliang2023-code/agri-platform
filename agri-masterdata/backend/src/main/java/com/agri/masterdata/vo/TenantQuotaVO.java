package com.agri.masterdata.vo;

import lombok.Data;

@Data
public class TenantQuotaVO {

    private Long id;

    private Long tenantId;

    private String quotaType;

    private String quotaTypeName;

    private Integer maxValue;

    private Integer currentValue;

    private Integer status;
}