package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.Approval;
import com.agri.production.service.IAdminApprovalService;
import com.agri.production.vo.AdminApprovalFlowVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 运营端：审批管理（{@code /api/v1/production/admin/approvals}）。
 *
 * <p>按页面契约 {@code api/admin/approvals.ts} 实现页面真的会调的七条：
 * 待审分页 / 审批通过 / 批量审批 / 流程配置分页 / 新建流程 / 更新流程 / 审批历史。</p>
 *
 * <p><b>审批动作用的是 PATCH</b>（页面就是这么发的），而平台侧实现的是 POST ——
 * 也就是说页面上那个"审批通过"按钮在平台侧一直不匹配（405/404）。
 * 这里按页面契约实现，不再有自己的另一套方法。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/approvals")
public class AdminApprovalController {

    private final IAdminApprovalService adminApprovalService;

    public AdminApprovalController(IAdminApprovalService adminApprovalService) {
        this.adminApprovalService = adminApprovalService;
    }

    /** 审批台账分页。 */
    @GetMapping
    public ApiResponse<PageResult<Approval>> page(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String approvalType) {
        return ApiResponse.success(adminApprovalService.pageApprovals(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                keyword, status, approvalType));
    }

    /** 审批通过（页面传 body {remark}）。 */
    @PatchMapping("/{approvalId}/approve")
    public ApiResponse<Approval> approve(@PathVariable String approvalId,
                                        @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(adminApprovalService.approve(approvalId, remarkOf(body)));
    }

    /** 批量审批通过（页面传 body {approvalIds, remark}）。 */
    @PatchMapping("/batch-approve")
    public ApiResponse<Map<String, Object>> batchApprove(@RequestBody(required = false) Map<String, Object> body) {
        List<String> ids = new ArrayList<>();
        if (body != null && body.get("approvalIds") instanceof List<?> list) {
            list.forEach(item -> {
                if (item != null) {
                    ids.add(String.valueOf(item));
                }
            });
        }
        return ApiResponse.success(adminApprovalService.batchApprove(ids, remarkOf(body)));
    }

    /** 审批历史（已通过 / 已驳回）。 */
    @GetMapping("/history")
    public ApiResponse<PageResult<Approval>> history(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminApprovalService.pageHistory(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword));
    }

    /** 流程配置分页。 */
    @GetMapping("/config")
    public ApiResponse<PageResult<AdminApprovalFlowVO>> flows(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.success(adminApprovalService.pageFlows(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10)));
    }

    /** 新建流程配置。 */
    @PostMapping("/config")
    public ApiResponse<AdminApprovalFlowVO> createFlow(@RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminApprovalService.createFlow(payload));
    }

    /** 更新流程配置。 */
    @PutMapping("/config/{flowId}")
    public ApiResponse<AdminApprovalFlowVO> updateFlow(@PathVariable String flowId,
                                                      @RequestBody(required = false) Map<String, Object> payload) {
        return ApiResponse.success(adminApprovalService.updateFlow(flowId, payload));
    }

    private static String remarkOf(Map<String, Object> body) {
        if (body == null || body.get("remark") == null) {
            return null;
        }
        return String.valueOf(body.get("remark"));
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
