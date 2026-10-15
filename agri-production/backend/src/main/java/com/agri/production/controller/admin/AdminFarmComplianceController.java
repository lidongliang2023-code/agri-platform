package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.FarmComplianceCheck;
import com.agri.production.service.IAdminReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 运营端：农场监管 - 合规检查（{@code /api/v1/production/admin/farms} 的合规那一部分）。
 *
 * <p>按页面契约实现三条：检查台账分页（{@code /compliance/checks}）、单农场合规画像
 * （{@code /{farmId}/compliance}）、更新检查（{@code PUT /compliance/{checkId}}）。</p>
 *
 * <p>路径说明：{@code /compliance/checks} 与 {@code /{farmId}/compliance} 段数相同但第二段字面量不同，
 * 不会冲突（前者第二段是 checks，后者要求第二段是 compliance）。平台侧的注释里也记过这一点。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/farms")
public class AdminFarmComplianceController {

    private final IAdminReportService adminReportService;

    public AdminFarmComplianceController(IAdminReportService adminReportService) {
        this.adminReportService = adminReportService;
    }

    /** 合规检查台账分页。 */
    @GetMapping("/compliance/checks")
    public ApiResponse<PageResult<FarmComplianceCheck>> checks(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) Long farmId,
            @RequestParam(required = false) Integer result) {
        return ApiResponse.success(adminReportService.pageComplianceChecks(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), farmId, result));
    }

    /** 单农场合规画像。 */
    @GetMapping("/{farmId}/compliance")
    public ApiResponse<Map<String, Object>> compliance(@PathVariable Long farmId) {
        return ApiResponse.success(adminReportService.farmComplianceProfile(farmId));
    }

    /** 更新合规检查（录入结果 / 整改跟踪），请求体是局部补丁。 */
    @PutMapping("/compliance/{checkId}")
    public ApiResponse<FarmComplianceCheck> updateCheck(@PathVariable String checkId,
                                                       @RequestBody(required = false) Map<String, Object> patch) {
        return ApiResponse.success(adminReportService.updateComplianceCheck(checkId, patch));
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
