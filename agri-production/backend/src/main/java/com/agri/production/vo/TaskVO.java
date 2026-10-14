package com.agri.production.vo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 农事任务出参。
 *
 * <p><b>JSON 字段名以前端契约为准</b>（{@code @agri/shared/types/task} 的 Task 接口；
 * 页面读的是 task.taskId / taskNo / assigneeName / planStartDate / acceptStatus …）。
 * 实体侧的列名保持不动（executor_id / plan_start_time / task_code 这些表里本来就有），
 * 这里用 {@link JsonProperty} 把出参名字对上 —— 既不动物理列，也不用改前端适配。</p>
 *
 * <p>反过来改前端不在考虑范围：那套类型是九大前台共享的（@agri/shared），
 * 动它要牵动其它子系统；而且"接口少字段"本来就是后端这一侧的历史欠账。</p>
 */
@Data
public class TaskVO {

    @JsonProperty("taskId")
    private Long id;

    @JsonProperty("taskNo")
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

    @JsonProperty("description")
    private String taskDesc;

    @JsonProperty("assigneeId")
    private Long executorId;

    @JsonProperty("assigneeName")
    private String executorName;

    @JsonProperty("planStartDate")
    private LocalDateTime planStartTime;

    @JsonProperty("planEndDate")
    private LocalDateTime planEndTime;

    @JsonProperty("actualStartDate")
    private LocalDateTime actualStartTime;

    @JsonProperty("actualEndDate")
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

    private Long templateId;

    private String remark;

    private String tenantId;

    @JsonProperty("createdAt")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    private LocalDateTime updateTime;

    /** 派发人（前端 assignerId / assignerName）。 */
    private Long assignerId;

    private String assignerName;

    /** 验收状态：0 待验收 1 通过 2 驳回（前端 acceptStatus）。 */
    private Integer acceptStatus;

    private String acceptRemark;

    private Integer rejectCount;

    /**
     * 完成时间（前端 completedAt）。
     *
     * <p>任务的"实际结束时间"就是完成时刻，不再单开一列；BeanCopy 不认只读属性，
     * 所以这里从 actualEndTime 现算，避免库里存两份同样的值。</p>
     */
    @JsonProperty("completedAt")
    public LocalDateTime getCompletedAt() {
        return actualEndTime;
    }

    /*
     * 实体上原有的 approvalStatus / approvalComment 已按"接口为准"的口径换成
     * acceptStatus / acceptRemark —— 前端读的是后者，前者既不在表里、也没有任何消费方。
     */
}
