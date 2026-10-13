package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Evaluation;
import com.agri.trade.service.CreditService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 信用管理（运营端）：评价监管 + 申诉处理。
 *
 * <p>路径挂在 /api/trade/admin/ 下，自动受认证拦截器的运营角色校验保护。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/credit")
@RequiredArgsConstructor
public class AdminCreditController {

    private final CreditService creditService;

    @Operation(summary = "评价列表（全平台）")
    @GetMapping("/evaluation/page")
    public ApiResponse<IPage<Evaluation>> evaluationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String evaluationNo,
            @RequestParam(required = false) BigDecimal ratingOverall,
            @RequestParam(required = false) String evaluationStatus) {
        return ApiResponse.success(creditService.evaluationPage(pageNum, pageSize,
                evaluationNo, ratingOverall, evaluationStatus));
    }

    /** 隐藏 / 恢复一条评价（违规处置）。隐藏必须给原因。 */
    @Operation(summary = "隐藏或恢复评价")
    @PostMapping("/evaluation/{id}/status")
    public ApiResponse<Boolean> changeEvaluationStatus(@PathVariable Long id,
                                                       @RequestBody Map<String, String> params) {
        String error = creditService.changeEvaluationStatus(id, params.get("action"), params.get("reason"));
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }

    @Operation(summary = "申诉列表")
    @GetMapping("/appeal/page")
    public ApiResponse<IPage<Map<String, Object>>> appealPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String appealStatus) {
        return ApiResponse.success(creditService.appealPage(pageNum, pageSize, appealStatus));
    }

    @Operation(summary = "审核申诉")
    @PostMapping("/appeal/{id}/audit")
    public ApiResponse<Boolean> auditAppeal(@PathVariable Long id,
                                            @RequestBody Map<String, String> params) {
        String error = creditService.auditAppeal(id, params.get("status"), params.get("remark"),
                SecurityUtils.getUsername());
        return error == null ? ApiResponse.success(true) : ApiResponse.error(error);
    }
}
