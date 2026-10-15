package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 审批单（运营端「审批管理」）。
 *
 * <p>字段名按前端契约 {@code Approval} 的**后端真实口径**那一段
 * （{@code bizType / title / submitAt / approveAt / approveOpinion / currentApproverId / approveLevel}），
 * 而不是"理想口径"（approvalNo / submittedAt / approverName 那些字段后端从来不返回）。</p>
 */
@Data
@TableName("agri_prod_approval")
public class Approval {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 审批单号（业务键）：出参名对齐契约的 approvalId */
    @JsonProperty("approvalId")
    @TableField("approval_code")
    private String approvalCode;

    /** CERT 认证 / RECALL 召回 / QUOTA 配额 */
    @TableField("biz_type")
    private String bizType;

    @TableField("biz_id")
    private String bizId;

    @TableField("title")
    private String title;

    @TableField("applicant_id")
    private String applicantId;

    @TableField("applicant_name")
    private String applicantName;

    @TableField("approve_level")
    private Integer approveLevel;

    @TableField("current_approver_id")
    private String currentApproverId;

    @TableField("approve_opinion")
    private String approveOpinion;

    @JsonProperty("submitAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("submit_at")
    private LocalDateTime submitAt;

    @JsonProperty("approveAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("approve_at")
    private LocalDateTime approveAt;

    /** PENDING / APPROVED / REJECTED（**字符串**枚举，页面按字符串比较） */
    @TableField("status")
    private String status;

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
