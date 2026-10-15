package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.Approval;
import com.agri.production.vo.AdminApprovalFlowVO;

import java.util.List;
import java.util.Map;

/**
 * 运营端审批管理（/api/v1/production/admin/approvals）。
 *
 * <p>同一口径：不做租户过滤、不调 TenantContextService（理由见 {@link IAdminTraceService}）。</p>
 */
public interface IAdminApprovalService {

    /**
     * 待审/全部审批分页。
     *
     * @param status 页面传的是**数字编码**（1 待审 / 2 通过 / 3 驳回 / 4 撤回），库里是字符串枚举，
     *               由实现按两套词表换算后再查（传数字永远筛不中是本仓库踩过的坑）
     */
    PageResult<Approval> pageApprovals(int pageNum, int pageSize, String keyword, Integer status, String bizType);

    /** 审批历史（已通过 / 已驳回）。 */
    PageResult<Approval> pageHistory(int pageNum, int pageSize, String keyword);

    /** 审批通过：status → APPROVED，落审批意见与审批时间。 */
    Approval approve(String approvalId, String remark);

    /** 批量审批通过。 */
    Map<String, Object> batchApprove(List<String> approvalIds, String remark);

    /** 流程配置分页。 */
    PageResult<AdminApprovalFlowVO> pageFlows(int pageNum, int pageSize);

    /** 新建流程配置。 */
    AdminApprovalFlowVO createFlow(Map<String, Object> payload);

    /** 更新流程配置（只改传了的字段）。 */
    AdminApprovalFlowVO updateFlow(String flowId, Map<String, Object> payload);
}
