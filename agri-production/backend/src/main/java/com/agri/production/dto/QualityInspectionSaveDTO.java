package com.agri.production.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class QualityInspectionSaveDTO {

    private Long id;

    private Long harvestId;

    private Long farmId;

    private Long plotId;

    private String productName;

    private String batchNo;

    private String inspectionType;

    private LocalDateTime inspectionDate;

    private String inspector;

    private String inspectionItems;

    private String inspectionResult;

    private String qualityGrade;

    private Integer isQualified;

    private String unqualifiedReason;

    private String suggestion;

    private String certificateNo;

    private String attachmentUrls;

    private String status;
}