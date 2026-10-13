package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.RiskAlert;
import com.agri.trade.service.RiskService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 风控管理（运营端）。
 *
 * <p>扫描是按需触发的，不是定时任务 —— 三条规则都依赖运营自己定的阈值，
 * 自动跑会让人不知道告警是按哪套阈值出来的；现在每次扫描都基于当时生效的配置，
 * 阈值也在页面上与规则一起展示。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/risk")
@RequiredArgsConstructor
public class AdminRiskController {

    private final RiskService riskService;

    @Operation(summary = "规则清单（含当期阈值）")
    @GetMapping("/rule/list")
    public ApiResponse<List<Map<String, Object>>> rules() {
        return ApiResponse.success(riskService.rules());
    }

    @Operation(summary = "告警概览")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.success(riskService.summary());
    }

    @Operation(summary = "告警列表")
    @GetMapping("/alert/page")
    public ApiResponse<IPage<RiskAlert>> alertPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String alertStatus,
            @RequestParam(required = false) String ruleCode,
            @RequestParam(required = false) String alertLevel) {
        return ApiResponse.success(riskService.alertPage(pageNum, pageSize, alertStatus, ruleCode, alertLevel));
    }

    /** 执行一次扫描。同一规则 + 同一对象未处理时只保留一条，不会刷重复。 */
    @Operation(summary = "执行风险扫描")
    @PostMapping("/scan")
    public ApiResponse<Map<String, Object>> scan() {
        return ApiResponse.success(riskService.scan(SecurityUtils.getUsername()));
    }

    @Operation(summary = "处理告警")
    @PostMapping("/alert/{id}/handle")
    public ApiResponse<Boolean> handle(@PathVariable Long id, @RequestBody Map<String, String> params) {
        String error = riskService.handle(id, params.get("status"), params.get("remark"),
                SecurityUtils.getUsername());
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }
}
