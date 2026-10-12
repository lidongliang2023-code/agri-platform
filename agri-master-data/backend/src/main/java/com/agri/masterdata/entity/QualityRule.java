package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * 数据质量规则。
 *
 * <p>规则类型用 completeness / accuracy / consistency / uniqueness / timeliness，
 * 与问题表的 issue_type 同口径 —— 规则检出的问题会带上对应类型。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_quality_rule")
public class QualityRule extends BaseEntity {

    private String ruleCode;
    private String ruleName;
    private String ruleType;
    private String description;
    private String targetDomain;
    private String targetTable;
    private String targetField;
    private String expression;
    private Integer threshold;
    private String severity;
    private Integer status;
    private Integer delFlag;
}
