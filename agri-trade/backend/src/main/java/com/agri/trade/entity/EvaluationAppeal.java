package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("agri_trade_evaluation_appeal")
public class EvaluationAppeal {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("appeal_no")
    private String appealNo;

    @TableField("evaluation_id")
    private Long evaluationId;

    @TableField("appeal_type")
    private String appealType;

    @TableField("appeal_reason")
    private String appealReason;

    @TableField("appeal_evidence")
    private String appealEvidence;

    @TableField("appellant_type")
    private String appellantType;

    @TableField("appellant_id")
    private Long appellantId;

    @TableField("appellant_name")
    private String appellantName;

    @TableField("appeal_status")
    private String appealStatus;

    @TableField("reviewer")
    private String reviewer;

    @TableField("review_time")
    private Date reviewTime;

    @TableField("review_result")
    private String reviewResult;

    @TableField("review_remark")
    private String reviewRemark;

    @TableField("del_flag")
    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_by")
    private String createBy;

    @TableField("create_time")
    private Date createTime;

    @TableField("update_by")
    private String updateBy;

    @TableField("update_time")
    private Date updateTime;
}