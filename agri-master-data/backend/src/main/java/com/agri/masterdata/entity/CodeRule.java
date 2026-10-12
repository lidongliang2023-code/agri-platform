package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * 编码规则。
 *
 * <p>字段与 {@code agri_md_code_rule} 一一对应；公共字段（id / tenantId / 审计字段 / remark）
 * 来自 {@link BaseEntity}，因此表结构里必须有对应列，否则 MyBatis-Plus 生成的 SELECT 会报
 * Unknown column —— 这正是之前 29 张表字段漂移的同一类问题，新增表时一并保持一致。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_code_rule")
public class CodeRule extends BaseEntity {

    /** 规则编码，唯一 */
    private String ruleCode;

    /** 规则名称 */
    private String ruleName;

    /** 规则类型：auto 自动生成 / manual 手动输入 */
    private String ruleType;

    /** 编码格式示例，如 PRD{yyyyMMdd}{seq} */
    private String rulePattern;

    /** 规则说明 */
    private String description;

    /** 序号段长度（不足补零） */
    private Integer seqLength;

    /** 日期段格式，如 yyyyMMdd；为空表示不含日期 */
    private String dateFormat;

    /** 前缀 */
    private String prefix;

    /** 后缀 */
    private String suffix;

    /** 状态：1 启用 / 0 禁用 */
    private Integer status;

    /** 删除标志：0 未删除 / 1 已删除 */
    private Integer delFlag;
}
