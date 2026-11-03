package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 数据标准变更申请。审批只记录决策，不自动改写目标。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_standard_change")
public class StandardChange extends BaseEntity {

    /** format / dict / code_rule */
    private String targetType;

    private String targetId;

    private String targetName;

    /** CREATE / UPDATE / DISABLE */
    private String changeType;

    private String beforeValue;

    private String afterValue;

    /** PENDING / APPROVED / REJECTED */
    private String status;

    private String applicant;

    private LocalDateTime applyTime;

    private String reviewer;

    private LocalDateTime reviewTime;

    private String reviewRemark;
}
