package com.agri.masterdata.dto;

import lombok.Data;

@Data
public class TenantQuotaDTO {

    private String quotaType;

    private Integer maxValue;
}