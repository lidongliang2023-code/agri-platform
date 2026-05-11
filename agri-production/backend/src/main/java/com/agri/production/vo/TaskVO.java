package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class TaskVO {

    private Long id;

    private String taskCode;

    private String taskName;

    private String taskType;

    private String taskTypeDetail;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private Long plotId;

    private String plotCode;

    private String plotName;

    private String cropName;

    private String taskDesc;

    private Long executorId;

    private String executorName;

    private LocalDateTime planStartTime;

    private LocalDateTime planEndTime;

    private LocalDateTime actualStartTime;

    private LocalDateTime actualEndTime;

    private String status;

    private String priority;

    private String inputMaterials;

    private String inputMaterialsJson;

    private BigDecimal expectedOutput;

    private BigDecimal actualOutput;

    private String qualityRequirement;

    private String resultPhotoUrls;

    private String resultDesc;

    private String approvalStatus;

    private String approvalComment;

    private Long templateId;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}