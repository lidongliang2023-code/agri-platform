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
 * 数据质量检测任务。
 *
 * <p>任务与规则是多对多（一条规则可被多个任务引用），关联放在
 * {@link QualityTaskRule} 表里。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_quality_task")
public class QualityTask extends BaseEntity {

    private String taskCode;
    private String taskName;
    private String taskType;
    private String cronExpression;
    private String status;
    private LocalDateTime lastRunTime;
    private LocalDateTime nextRunTime;
    private Integer lastSuccessCount;
    private Integer lastFailCount;
    private Double successRate;
    private Integer runCount;
    private Integer delFlag;
}
