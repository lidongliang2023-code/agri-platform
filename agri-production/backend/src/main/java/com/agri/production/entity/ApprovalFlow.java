package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 审批流程配置。
 *
 * <p>平台侧**没有这张表** —— core 的 {@code /admin/approvals/config} 返回三个硬编码骨架，
 * 而页面（ApprovalConfig.tsx）是带完整增删改的。这里按页面契约建表，
 * 节点列表以 JSON 存在 {@code nodes_json}（节点字段见前端 {@code ApprovalNodeConfig}），
 * 出参由 {@code AdminApprovalFlowVO} 解析成数组。</p>
 */
@Data
@TableName("agri_prod_approval_flow")
public class ApprovalFlow {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("flow_code")
    private String flowCode;

    @TableField("flow_name")
    private String flowName;

    @TableField("approval_type")
    private String approvalType;

    @TableField("nodes_json")
    private String nodesJson;

    /** 1 启用 / 0 停用 */
    @TableField("status")
    private Integer status;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
