package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.TenantContextService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 作物候选（{@code GET /api/v1/production/crops/options}）：给「种养计划」表单的作物下拉供数。

 *
 * <p><b>为什么需要这个接口</b>：这一栏原来是自由文本框，用户得自己敲"水稻"；
 * 而本平台**没有作物主数据表**（`agri_masterdata` 里只有单位 / 租户类型这类字典，
 * `agri_production` 里也没有作物表），所以候选只能从**真实用过的作物**里来。</p>

 *
 * <p><b>候选的构成</b>（两处都是本租户的真实数据，不做任何编造）：</p>
 * <ul>
 *   <li>种养计划的 {@code crop_name} —— 以前建计划时填过的作物；</li>
 *   <li>地块的 {@code current_crop} —— 地块台账上登记的当前作物。</li>
 * </ul>

 *
 * <p><b>刻意不做校验</b>：页面仍允许用户输入候选之外的新作物名（下拉里给一条"使用「xxx」"）。
 * 没有作物主数据却去校验，只会把"西红柿"这类真实作物挡在门外
 * （实测地块台账里就有 {@code 西红柿}，而前端已登记的作物清单里没有它）。</p>

 *
 * <p>出参带用量计数，便于页面按"用得多的排前面"呈现，也让调用方看得见每条候选的来源与规模。</p>
 */
@RestController
@RequestMapping("/api/v1/production/crops")
public class CropOptionsController {

    private final PlantingPlanMapper planMapper;
    private final PlotMapper plotMapper;
    private final FarmIdResolver farmIdResolver;

    public CropOptionsController(PlantingPlanMapper planMapper, PlotMapper plotMapper,
                                 FarmIdResolver farmIdResolver) {
        this.planMapper = planMapper;
        this.plotMapper = plotMapper;
        this.farmIdResolver = farmIdResolver;
    }

    /**
     * 本租户（可按农场过滤）用过的作物候选，按用量降序。
     *
     * @param farmId 农场标识（可为本地主键 / 农场编码 / 平台标识）；不传 = 全租户
     * @returns 候选列表：{@code {cropName, planCount, plotCount}}
     */
    @GetMapping("/options")
    public ApiResponse<List<Map<String, Object>>> options(@RequestParam(required = false) String farmId) {
        String tenantId = TenantContextService.currentTenantId();
        Long resolvedFarmId = farmIdResolver.resolveFilter(farmId, tenantId);

        // 计划侧用过的作物
        Map<String, Integer> planCounts = new LinkedHashMap<>();
        List<PlantingPlan> plans = planMapper.selectList(new LambdaQueryWrapper<PlantingPlan>()
                .eq(PlantingPlan::getTenantId, tenantId)
                .eq(resolvedFarmId != null, PlantingPlan::getFarmId, resolvedFarmId));
        for (PlantingPlan plan : plans) {
            String name = trimToNull(plan.getCropName());
            if (name != null) {
                planCounts.merge(name, 1, Integer::sum);
            }
        }

        // 地块侧登记的当前作物
        Map<String, Integer> plotCounts = new LinkedHashMap<>();
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getTenantId, tenantId)
                .eq(resolvedFarmId != null, Plot::getFarmId, resolvedFarmId));
        for (Plot plot : plots) {
            String name = trimToNull(plot.getCurrentCrop());
            if (name != null) {
                plotCounts.merge(name, 1, Integer::sum);
            }
        }

        Set<String> names = new LinkedHashSet<>(planCounts.keySet());
        names.addAll(plotCounts.keySet());

        List<Map<String, Object>> rows = new ArrayList<>();
        for (String name : names) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("cropName", name);
            row.put("planCount", planCounts.getOrDefault(name, 0));
            row.put("plotCount", plotCounts.getOrDefault(name, 0));
            rows.add(row);
        }
        rows.sort(Comparator
                .comparingInt((Map<String, Object> row) ->
                        (int) row.get("planCount") + (int) row.get("plotCount")).reversed()
                .thenComparing(row -> String.valueOf(row.get("cropName"))));
        return ApiResponse.success(rows);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }
}
