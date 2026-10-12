package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * 质量问题处置记录。
 *
 * <p>每次处置追加一条，构成质量详情的"处置历史"。
 * 只记最后一次结果会丢掉过程，出问题时回溯不了。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_quality_issue_handle")
public class QualityIssueHandle extends BaseEntity {

    private Long issueId;
    private String action;
    private String operator;
    private String remark;
    private Integer status;
    private Integer delFlag;
}
