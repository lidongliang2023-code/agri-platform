package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 数据分发任务。
 *
 * <p>一条记录 = 一次"把某类主数据推送到某个目标系统"的执行。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_distribution_task")
public class DistributionTask extends BaseEntity {

    private String taskCode;
    private String taskName;
    private String targetSystem;
    private String targetSystemName;
    private String dataType;
    private String dataTypeName;
    private String triggerType;
    private String status;
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer progress;
    private Double delay;
    private String tenantName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String errorMessage;
    private Integer delFlag;
}
