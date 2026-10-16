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

    /* ==================== 页面口径的别名（2026-10-16 补） ==================== */

    /**
     * 任务描述（前端 {@code description}）—— 实体列是 {@code task_desc}。

     *
     * <p>为什么要补这一段：出参 {@code TaskVO} 早就用 {@code @JsonProperty} 把列名映射成页面名了
     * （{@code taskDesc→description}、{@code executorId→assigneeId}、{@code planStartTime→planStartDate}），
     * 而入参没有 —— 于是页面提交时这几个字段**被静默丢掉**：任务建出来了，但没有执行人、没有时段、没有描述。</p>
     */
    private String description;

    /**
     * 执行人（前端 {@code assigneeId}）。

     *
     * <p>类型是 String 而不是 Long：页面这个下拉的 value 是成员的**业务标识**
     * （{@code DEMO-MEM-001} 这种），不是成员主键。服务层按"能不能解析成数字"分流，
     * 再回成员台账换出主键与真实姓名（同计划负责人 / 地块作物的做法）。</p>
     */
    private String assigneeId;

    /** 计划开始（前端 {@code planStartDate}；接受 {@code yyyy-MM-dd} 或 {@code yyyy-MM-dd HH:mm[:ss]}） */
    private String planStartDate;

    /** 计划结束（前端 {@code planEndDate}；同上） */
    private String planEndDate;
}
