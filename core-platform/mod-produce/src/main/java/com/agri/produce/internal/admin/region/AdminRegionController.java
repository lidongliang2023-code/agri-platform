package com.agri.produce.internal.admin.region;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 运营端：全国生产分布（区域维度）。
 *
 * <p><b>为什么单开一个 Controller，而不是加进 AdminDashboardController</b>：
 * 该端点原属运营大盘，但 {@code AdminDashboardService} 是另一件在途改动（PRD 8.1.1/8.1.2 词表迁移）
 * 正在编辑的文件。按本项目「文件级归属锁」的规矩不能动它，故以新增类的方式落地，
 * 路径仍挂在同一前缀下、只占用本端点，互不影响。</p>
 *
 * <p>前端契约：{@code OpsRegionStat[]}（region / farmCount / fieldArea / tenantCount / activityLevel），
 * 见 {@code src/api/admin/dashboard.ts}。此前该端点缺失，运营大盘「全国生产分布」只能显示空态。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/dashboard")
@RequiredArgsConstructor
public class AdminRegionController {

    private final AdminRegionDashboardService adminRegionDashboardService;

    /** 区域生产分布 */
    @GetMapping("/region-distribution")
    public ApiResponse<List<Map<String, Object>>> regionDistribution() {
        return ApiResponse.ok(adminRegionDashboardService.regionDistribution());
    }
}
