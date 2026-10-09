package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * 审批单（认证/召回/配额变更等）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_approval")
public class ApprovalEntity extends ProduceBaseEntity {

    @TableId(value = "approval_id", type = IdType.INPUT)
    private String approvalId;

    /** 业务类型 CERT/RECALL/QUOTA */
    private String bizType;

    /** 业务ID */
    private String bizId;

    /** 审批标题 */
    private String title;

    /** 申请人 */
    private String applicantId;

    /** 申请人姓名 */
    private String applicantName;

    /** 审批层级 */
    private Integer approveLevel;

    /** 当前审批人 */
    private String currentApproverId;

    /** 审批意见 */
    private String approveOpinion;

    /** 提交时间 */
    private LocalDateTime submitAt;

    /** 审批时间 */
    private LocalDateTime approveAt;

    /** 状态 PENDING/APPROVED/REJECTED */
    private String status;
}
