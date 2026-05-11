package com.agri.production.dto;

import lombok.Data;

@Data
public class QualityInspectionQueryDTO {

    private String productName;

    private String batchNo;

    private String inspectionType;

    private String status;

    private Integer isQualified;

    private Long farmId;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}