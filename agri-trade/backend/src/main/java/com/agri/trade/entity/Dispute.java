package com.agri.iot.entity.trade;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
@TableName("agri_trade_dispute")
public class Dispute {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("dispute_no")
    private String disputeNo;

    @TableField("order_id")
    private Long orderId;

    @TableField("order_no")
    private String orderNo;

    @TableField("complainant_type")
    private String complainantType;

    @TableField("complainant_id")
    private Long complainantId;

    @TableField("complainant_name")
    private String complainantName;

    @TableField("respondent_id")
    private Long respondentId;

    @TableField("respondent_name")
    private String respondentName;

    @TableField("dispute_type")
    private String disputeType;

    @TableField("dispute_reason")
    private String disputeReason;

    @TableField("dispute_description")
    private String disputeDescription;

    @TableField("claim_amount")
    private BigDecimal claimAmount;

    @TableField("evidence_json")
    private String evidenceJson;

    @TableField("dispute_status")
    private String disputeStatus;

    @TableField("process_stage")
    private String processStage;

    @TableField("mediator")
    private String mediator;

    @TableField("mediation_time")
    private Date mediationTime;

    @TableField("mediation_result")
    private String mediationResult;

    @TableField("arbitrator")
    private String arbitrator;

    @TableField("arbitration_time")
    private Date arbitrationTime;

    @TableField("arbitration_result")
    private String arbitrationResult;

    @TableField("arbitration_doc_url")
    private String arbitrationDocUrl;

    @TableField("compensation_amount")
    private BigDecimal compensationAmount;

    @TableField("compensation_time")
    private Date compensationTime;

    @TableField("close_time")
    private Date closeTime;

    @TableField("close_reason")
    private String closeReason;

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

    @TableField("remark")
    private String remark;
}