package com.agri.produce.internal.admin;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 运营端：审批流程。
 */
@RestController
@RequestMapping("/api/v1/production/admin/approvals")
@RequiredArgsConstructor
public class AdminApprovalController {

    private final ApprovalService approvalService;

    @GetMapping
    public ApiResponse<PageResult<ApprovalEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                        @RequestParam(defaultValue = "10") long size,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) String status) {
        return ApiResponse.ok(approvalService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<ApprovalEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(approvalService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody ApprovalEntity entity) {
        return ApiResponse.ok(approvalService.create(entity).getApprovalId());
    }

    @PutMapping("/{id}")
    public ApiResponse<ApprovalEntity> update(@PathVariable String id, @RequestBody ApprovalEntity entity) {
        return ApiResponse.ok(approvalService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        approvalService.delete(id);
        return ApiResponse.ok();
    }

    /** 审批通过 */
    @PostMapping("/{approvalId}/approve")
    public ApiResponse<ApprovalEntity> approve(@PathVariable String approvalId,
                                               @RequestParam(required = false) String approverId,
                                               @RequestParam(required = false) String opinion) {
        return ApiResponse.ok(approvalService.approve(approvalId, approverId, opinion));
    }

    /** 审批驳回 */
    @PostMapping("/{approvalId}/reject")
    public ApiResponse<ApprovalEntity> reject(@PathVariable String approvalId,
                                              @RequestParam(required = false) String approverId,
                                              @RequestParam(required = false) String opinion) {
        return ApiResponse.ok(approvalService.reject(approvalId, approverId, opinion));
    }

    /** 待我审批 */
    @GetMapping("/pending")
    public ApiResponse<List<ApprovalEntity>> pending(@RequestParam(required = false) String approverId) {
        return ApiResponse.ok(approvalService.listPending(approverId));
    }

    /** 审批历史（已归档） */
    @GetMapping("/history")
    public ApiResponse<PageResult<ApprovalEntity>> history(@RequestParam(defaultValue = "1") long page,
                                                           @RequestParam(defaultValue = "10") long size) {
        return ApiResponse.ok(approvalService.history(page, size));
    }

    /** 审批流配置（骨架） */
    @GetMapping("/config")
    public ApiResponse<List<Map<String, Object>>> config() {
        return ApiResponse.ok(approvalService.config());
    }
}
