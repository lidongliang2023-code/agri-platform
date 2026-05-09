package com.agri.admin.vo;

import lombok.Data;

@Data
public class TenantActivityVO {

    private Integer rank;
    private String tenantId;
    private String tenantName;
    private Long userCount;
    private Double qualityScore;
    private Long dataUpdateCount;
    private String tenantType;
}