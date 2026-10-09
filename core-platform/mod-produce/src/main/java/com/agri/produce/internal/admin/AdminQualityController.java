package com.agri.produce.internal.admin;

import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.QualityLabEntity;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：质量监管（/api/v1/production/admin/quality）。
 */
@RestController
@RequestMapping("/api/v1/production/admin/quality")
@RequiredArgsConstructor
public class AdminQualityController {

    private final AdminQualityService adminQualityService;

    /** 检测机构分页 */
    @GetMapping("/labs")
    public ApiResponse<PageResult<QualityLabEntity>> pageLabs(@RequestParam(defaultValue = "1") long page,
                                                              @RequestParam(defaultValue = "10") long size,
                                                              @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(adminQualityService.pageLabs(page, size, keyword));
    }

    /** 机构资质认可 */
    @PostMapping("/labs/{labId}/accredit")
    public ApiResponse<QualityLabEntity> accredit(@PathVariable String labId) {
        return ApiResponse.ok(adminQualityService.accredit(labId));
    }

    /**
     * 检测台账分页。
     *
     * <p>{@code result} 与 {@code status} 均为<strong>可选</strong>筛选：列表接口强制要求筛选条件
     * 会让调用方被迫绕过条件取数，反而丢数据，故缺失即不过滤（返回全量）。</p>
     */
    @GetMapping("/inspections")
    public ApiResponse<PageResult<InspectionEntity>> pageInspections(@RequestParam(defaultValue = "1") long page,
                                                                     @RequestParam(defaultValue = "10") long size,
                                                                     @RequestParam(required = false) String result,
                                                                     @RequestParam(required = false) String status) {
        return ApiResponse.ok(adminQualityService.pageInspections(page, size, result, status));
    }

    /** 不合格检测清单 */
    @GetMapping("/inspections/failed")
    public ApiResponse<List<InspectionEntity>> failed() {
        return ApiResponse.ok(adminQualityService.listFailed());
    }

    /** 质量总览 */
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(adminQualityService.overview());
    }

    /** 不合格批次召回（冻结） */
    @PostMapping("/recalls")
    public ApiResponse<HarvestBatchEntity> recall(@RequestParam String batchId) {
        return ApiResponse.ok(adminQualityService.recall(batchId));
    }
}
