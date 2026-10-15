package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 农场合规检查记录（运营端「农场监管」）。
 *
 * <p>字段按页面契约 {@code ComplianceCheck}（@agri/shared/types/approval）定：
 * {@code checkId / farmId / farmName / checkItem / result / problem / rectifyRequirement /
 * rectifyDeadline / checkerName / checkedAt}。注意契约里"检查结果"叫 {@code result}、
 * "问题描述"叫 {@code problem}，而库列是 {@code check_result / problem_desc} —— 出参名按契约。</p>
 */
@Data
@TableName("agri_prod_farm_compliance_check")
public class FarmComplianceCheck {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 检查编号（业务键）：出参名对齐契约的 checkId */
    @JsonProperty("checkId")
    @TableField("check_code")
    private String checkCode;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_name")
    private String farmName;

    @TableField("check_type")
    private String checkType;

    @TableField("check_item")
    private String checkItem;

    /** 1 合规 / 2 限期整改 / 3 严重违规：出参名对齐契约的 result */
    @JsonProperty("result")
    @TableField("check_result")
    private Integer checkResult;

    /** 出参名对齐契约的 problem */
    @JsonProperty("problem")
    @TableField("problem_desc")
    private String problemDesc;

    @TableField("rectify_requirement")
    private String rectifyRequirement;

    @TableField("rectify_deadline")
    private LocalDate rectifyDeadline;

    @TableField("checker_name")
    private String checkerName;

    @TableField("checked_at")
    private LocalDateTime checkedAt;

    /** none / pending / processing / rectified / overdue */
    @TableField("rectify_status")
    private String rectifyStatus;

    @TableField("rectify_remark")
    private String rectifyRemark;

    @TableField("rectified_at")
    private LocalDateTime rectifiedAt;

    @TableField("tenant_id")
    private String tenantId;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
