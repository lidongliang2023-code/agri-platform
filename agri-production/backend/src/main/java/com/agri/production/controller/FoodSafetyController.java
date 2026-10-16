package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.IFoodSafetyService;
import com.agri.production.service.TenantContextService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 食品安全校验接口（移动端 PRD §10.2 投入品四重校验 / §10.3 采收休药期校验）。

 *
 * <p><b>路径说明</b>：PRD 6.3 写的是 {@code /api/v1/mobile/production/food-safety/**}。
 * 本部署落在 {@code /api/v1/production/food-safety/**}，理由：网关是**按业务域分段**路由的
 * （见 {@code ops/gateway/conf/conf.d/20-prod.conf} 的段名白名单），再为"客户端不同"开一套
 * {@code /api/v1/mobile/**} 前缀会让同一份业务出现两条入口；而且这两条规则 PC 端
 * （{@code /production/food-safety/*} 页面）同样适用，放同一域名下 PC 可直接复用。
 * 这条偏差已记进 {@code docs/生产管理模块_移动端接口契约_2026-10-17.md}，产品若要严格对齐 PRD
 * 路径，在网关加一条别名 location 即可，服务端代码不用动。</p>
 */
@RestController
@RequestMapping("/api/v1/production/food-safety")
public class FoodSafetyController {

    private final IFoodSafetyService foodSafetyService;

    public FoodSafetyController(IFoodSafetyService foodSafetyService) {
        this.foodSafetyService = foodSafetyService;
    }

    /**
     * 采收前休药期校验。
     *
     * @param plotId             单个地块（新建采收页用）
     * @param plotIds            多个地块，逗号分隔（PRD §10.3 的多地块对比页用）
     * @param plannedHarvestDate 计划采收日期 yyyy-MM-dd；为空按今天
     * @return 校验结果（单地块摊平结论；多地块给 plots 数组 + 整组结论）
     */
    @GetMapping("/pre-harvest-check")
    public ApiResponse<Map<String, Object>> preHarvestCheck(
            @RequestParam(required = false) String plotId,
            @RequestParam(required = false) String plotIds,
            @RequestParam(required = false) String plannedHarvestDate) {
        List<Long> ids = parsePlotIds(plotId, plotIds);
        if (ids.isEmpty()) {
            throw new BusinessException(400, "缺少 plotId（或 plotIds）");
        }
        return ApiResponse.success(foodSafetyService.preHarvestCheck(
                ids, parseDate(plannedHarvestDate), TenantContextService.currentTenantId()));
    }

    /**
     * 投入品使用前的四重校验（合规 / 交互 / 时机 / 成本）。
     *
     * @param body inputId（必填）、plotId、dosage、unit、usageDate
     * @return 每项结果与说明、整体结论（没有主数据的项如实返回 UNKNOWN）
     */
    @PostMapping("/compliance-check")
    public ApiResponse<Map<String, Object>> complianceCheck(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(foodSafetyService.complianceCheck(body, TenantContextService.currentTenantId()));
    }

    /** 解析 plotId / plotIds 两种传法（都为空返回空列表，由调用方报 400） */
    private static List<Long> parsePlotIds(String plotId, String plotIds) {
        List<Long> ids = new ArrayList<>();
        String raw = (plotIds != null && !plotIds.isBlank()) ? plotIds : plotId;
        if (raw == null || raw.isBlank()) {
            return ids;
        }
        for (String part : raw.split(",")) {
            String text = part.trim();
            if (text.isEmpty()) {
                continue;
            }
            try {
                ids.add(Long.valueOf(text));
            } catch (NumberFormatException e) {
                throw new BusinessException(400, "地块 ID 不是数字：" + text);
            }
        }
        return ids;
    }

    private static LocalDate parseDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim().length() > 10 ? text.trim().substring(0, 10) : text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式不正确：" + text + "（应为 yyyy-MM-dd）");
        }
    }
}
