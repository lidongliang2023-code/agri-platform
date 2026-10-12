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
 * 数据质量问题。
 *
 * <p>严重程度统一用 high / medium / low（与 QualityStatisticsVO 的
 * highSeverityCount / mediumSeverityCount / lowSeverityCount 同口径）；
 * 处理状态用 pending / processing / resolved / ignored。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_quality_issue")
public class QualityIssue extends BaseEntity {

    private String issueCode;
    private String issueType;
    private String severity;
    private String domainCode;
    private String domainName;
    private String description;
    private String affectedData;
    private Integer affectedRecords;
    private String status;
    private String handler;
    private String resolveRemark;
    private LocalDateTime detectTime;
    private LocalDateTime resolveTime;
    private Integer delFlag;
}
