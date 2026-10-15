package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.Inspection;
import com.agri.production.service.IAdminQualityService;
import com.agri.production.vo.AdminQualityLabVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：质量监管（{@code /api/v1/production/admin/quality}）。
 *
 * <p>路径按前端契约 {@code api/admin/trace.ts}（运营端质量监管那一半）逐条对齐：
 * 检测机构分页 / 准入认可 / 准入驳回 / 检测台账分页 / 不合格清单 / 质量总览 / 不合格批次召回。
 * 对应页面是 {@code admin/quality/{LabManage,Inspections,RecallManage}}。</p>
 *
 * <p><b>不做租户过滤</b>，理由见 {@link IAdminQualityService}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/quality")
public class AdminQualityController {

    private final IAdminQualityService adminQualityService;

    public AdminQualityController(IAdminQualityService adminQualityService) {
        this.adminQualityService = adminQualityService;
    }

    /** 检测机构分页（页面 LabManage 走这条）。 */
    @GetMapping("/labs")
    public ApiResponse<PageResult<AdminQualityLabVO>> labs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(adminQualityService.pageLabs(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword));
    }

    /** 机构资质认可（合作中）。 */
    @PostMapping("/labs/{labId}/accredit")
    public ApiResponse<AdminQualityLabVO> accredit(@PathVariable Long labId) {
        return ApiResponse.success(adminQualityService.accredit(labId));
    }

    /**
     * 机构准入驳回（终止合作）。
     *
     * <p>请求体可选：页面 {@code LabManage} 会带上运营手填的驳回原因，这里原样落库。</p>
     */
    @PostMapping("/labs/{labId}/reject")
    public ApiResponse<AdminQualityLabVO> reject(@PathVariable Long labId,
                                                @RequestBody(required = false) Map<String, Object> body) {
        String reason = body == null || body.get("rejectReason") == null
                ? null : String.valueOf(body.get("rejectReason"));
        return ApiResponse.success(adminQualityService.reject(labId, reason));
    }

    /** 检测台账分页（页面 Inspections 走这条）。 */
    @GetMapping("/inspections")
    public ApiResponse<PageResult<Inspection>> inspections(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(adminQualityService.pageInspections(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), result, status));
    }

    /** 不合格检测清单（页面 RecallManage 走这条）。 */
    @GetMapping("/inspections/failed")
    public ApiResponse<List<Inspection>> failed() {
        return ApiResponse.success(adminQualityService.listFailed());
    }

    /** 质量总览。 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(adminQualityService.overview());
    }

    /** 不合格批次召回（冻结批次）。 */
    @PostMapping("/recalls")
    public ApiResponse<Map<String, Object>> recalls(@RequestParam(required = false) String batchId) {
        return ApiResponse.success(adminQualityService.recallBatch(batchId));
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
