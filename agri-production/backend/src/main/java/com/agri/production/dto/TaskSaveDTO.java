package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TaskSaveDTO {

    private Long id;

    @NotBlank(message = "任务名称不能为空")
    private String taskName;

    @NotBlank(message = "任务类型不能为空")
    private String taskType;

    private String taskTypeDetail;

    @NotNull(message = "农场ID不能为空")
    private Long farmId;

    private String farmCode;

    private Long plotId;

    private String plotCode;

    private String cropName;

    private String taskDesc;

    private Long executorId;

    private String executorName;

    private java.time.LocalDateTime planStartTime;

    private java.time.LocalDateTime planEndTime;

    private String priority;

    private String inputMaterials;

    private String inputMaterialsJson;

    private BigDecimal expectedOutput;

    private String qualityRequirement;

    private Long templateId;

    private String remark;
}