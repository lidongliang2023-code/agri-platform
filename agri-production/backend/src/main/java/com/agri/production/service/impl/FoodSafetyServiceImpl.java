package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.mapper.InputMaterialMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.service.IFoodSafetyService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 食品安全校验实现。

 *
 * <p><b>数据能支撑什么，这里就只算什么</b>（都是先查库确认过的）：</p>
 * <ul>
 *   <li><b>休药期 / 时机</b>：能算 —— 依据 {@code agri_prod_input_usage} 上
 *       {@code used_at} + {@code safety_interval_days}（缺失时回退到投入品档案
 *       {@code agri_prod_input_material.safety_interval}）；</li>
 *   <li><b>库存</b>：能算 —— 投入品档案 {@code stock_qty} 与本次用量比较；</li>
 *   <li><b>禁用清单 / 用量上限 / 复配交互 / 成本替代</b>：**不能算** ——
 *       本部署只有"标准编号清单（{@code agri_prod_fs_standard_library}）"和"检测结果
 *       （{@code agri_prod_fs_standard_item}）"，没有投入品级的禁用/限用/最大用量、复配规则、
 *       价格主数据。这三项一律返回 {@code UNKNOWN} 并写明原因，整体结论也不会因此说成"通过"。</li>
 * </ul>
 */
@Service
public class FoodSafetyServiceImpl implements IFoodSafetyService {

    /** 未校验的统一说明前缀（让前端与文档口径一致） */
    private static final String UNKNOWN_REASON = "本部署未提供该口径的主数据，未做校验（不猜、不按默认值放行）：";

    private final InputUsageRecordMapper usageMapper;
    private final InputMaterialMapper materialMapper;

    public FoodSafetyServiceImpl(InputUsageRecordMapper usageMapper, InputMaterialMapper materialMapper) {
        this.usageMapper = usageMapper;
        this.materialMapper = materialMapper;
    }

    @Override
    public Map<String, Object> preHarvestCheck(List<Long> plotIds, LocalDate plannedHarvestDate, String tenantId) {
        if (plotIds == null || plotIds.isEmpty()) {
            throw new BusinessException(400, "缺少 plotId（或 plotIds）");
        }
        LocalDate planned = plannedHarvestDate != null ? plannedHarvestDate : LocalDate.now();
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("plannedHarvestDate", planned.toString());
        root.put("aiAdjusted", false);
        root.put("basis", "按地块最近一次带安全间隔期的用药记录 + 该投入品的安全间隔期推算；"
                + "本部署没有接入任何 AI 模型，故不做「降解加速」之类的自适应调整");

        List<Map<String, Object>> plots = new ArrayList<>();
        for (Long plotId : plotIds) {
            plots.add(checkOnePlot(plotId, planned, tenantId));
        }
        root.put("plots", plots);
        if (plots.size() == 1) {
            // 单地块（新建采收页）：把结论摊平到根上，页面少解一层
            root.putAll(plots.get(0));
        } else {
            // 多地块（PRD §10.3 的对比页）：只要有一块被拦住，整组就是 block
            boolean anyBlock = plots.stream().anyMatch(row -> "block".equals(row.get("checkResult")));
            boolean anyUnknown = plots.stream().anyMatch(row -> Boolean.FALSE.equals(row.get("dataComplete")));
            root.put("checkResult", anyBlock ? "block" : (anyUnknown ? "warning" : "pass"));
            root.put("blockedPlots", plots.stream()
                    .filter(row -> "block".equals(row.get("checkResult")))
                    .map(row -> row.get("plotId")).toList());
        }
        return root;
    }

    /**
     * 单地块休药期判定。
     *
     * @return 该地块的结论（无带间隔期的用药记录时 {@code dataComplete=false}、"不构成约束"）
     */
    private Map<String, Object> checkOnePlot(Long plotId, LocalDate planned, String tenantId) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("plotId", plotId);
        row.put("plannedHarvestDate", planned.toString());

        InputUsageRecord latest = latestWithdrawalUsage(plotId, tenantId);
        Integer interval = intervalOf(latest, tenantId);
        if (latest == null || interval == null || interval <= 0) {
            row.put("checkResult", "pass");
            row.put("dataComplete", false);
            row.put("daysRemaining", 0);
            row.put("note", "该地块没有带安全间隔期的用药记录，休药期不构成约束");
            return row;
        }

        LocalDate applicationDate = latest.getUsedAt().toLocalDate();
        LocalDate earliest = applicationDate.plusDays(interval);
        long remaining = ChronoUnit.DAYS.between(planned, earliest);
        row.put("checkResult", remaining > 0 ? "block" : "pass");
        row.put("dataComplete", true);
        row.put("earliestHarvestDate", earliest.toString());
        row.put("daysRemaining", Math.max(remaining, 0));

        Map<String, Object> last = new LinkedHashMap<>();
        last.put("usageId", latest.getUsageId());
        last.put("inputId", latest.getInputId());
        last.put("productName", latest.getInputName());
        last.put("applicationDate", applicationDate.toString());
        last.put("preHarvestIntervalDays", interval);
        last.put("earliestHarvestDate", earliest.toString());
        last.put("operatorId", latest.getOperatorId());
        row.put("lastApplication", last);
        return row;
    }

    /** 该地块最近一条"带安全间隔期"的用药记录（没有返回 null） */
    private InputUsageRecord latestWithdrawalUsage(Long plotId, String tenantId) {
        LambdaQueryWrapper<InputUsageRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(InputUsageRecord::getTenantId, tenantId);
        wrapper.eq(InputUsageRecord::getPlotId, plotId);
        wrapper.isNotNull(InputUsageRecord::getUsedAt);
        // safety_interval_days 可能没落（历史记录），只要该投入品档案里有间隔期也要算上：
        // 因此这里不按列过滤，取最近若干条后在 intervalOf 里逐条判定
        wrapper.orderByDesc(InputUsageRecord::getUsedAt).last("limit 20");
        List<InputUsageRecord> rows = usageMapper.selectList(wrapper);
        for (InputUsageRecord row : rows) {
            Integer interval = intervalOf(row, tenantId);
            if (interval != null && interval > 0) {
                return row;
            }
        }
        return null;
    }

    /** 该使用记录的休药期间隔：优先记录自身，其次投入品档案（两者都不给返回 null） */
    private Integer intervalOf(InputUsageRecord usage, String tenantId) {
        if (usage == null) {
            return null;
        }
        if (usage.getSafetyIntervalDays() != null && usage.getSafetyIntervalDays() > 0) {
            return usage.getSafetyIntervalDays();
        }
        if (usage.getInputId() == null) {
            return null;
        }
        InputMaterial material = materialMapper.selectById(usage.getInputId());
        if (material == null || !tenantId.equals(material.getTenantId())) {
            return null;
        }
        return material.getSafetyInterval();
    }

    @Override
    public Map<String, Object> complianceCheck(Map<String, Object> body, String tenantId) {
        Long inputId = toLong(body == null ? null : body.get("inputId"));
        Long plotId = toLong(body == null ? null : body.get("plotId"));
        BigDecimal dosage = toDecimal(body == null ? null : body.get("dosage"));
        LocalDate usageDate = parseDate(body == null ? null : body.get("usageDate"));
        if (usageDate == null) {
            usageDate = LocalDate.now();
        }
        if (inputId == null) {
            throw new BusinessException(400, "缺少 inputId");
        }
        InputMaterial material = materialMapper.selectById(inputId);
        if (material == null || !tenantId.equals(material.getTenantId())) {
            throw new BusinessException(404, "投入品不存在：" + inputId);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inputId", inputId);
        result.put("inputName", material.getInputName());
        result.put("inputType", material.getInputType());
        result.put("plotId", plotId);
        result.put("usageDate", usageDate.toString());

        // ① 库存（真实数据：档案 stock_qty）
        Map<String, Object> stock = new LinkedHashMap<>();
        BigDecimal stockQty = material.getStockQty();
        if (dosage == null || stockQty == null) {
            stock.put("result", "UNKNOWN");
            stock.put("detail", "缺用量或库存数，无法比较（用量：" + dosage + "，库存：" + stockQty + "）");
        } else if (dosage.compareTo(stockQty) > 0) {
            stock.put("result", "WARNING");
            stock.put("detail", "本次用量 " + dosage + material.getUnit() + " 超过当前库存 " + stockQty);
        } else {
            stock.put("result", "PASS");
            stock.put("detail", "本次用量 " + dosage + material.getUnit() + "，当前库存 " + stockQty);
        }
        result.put("stock", stock);

        // ② 时机（真实数据：安全间隔期 / 休药期）
        Map<String, Object> timing = new LinkedHashMap<>();
        Integer interval = material.getSafetyInterval();
        if ("PESTICIDE".equalsIgnoreCase(String.valueOf(material.getInputType()))
                && (interval == null || interval <= 0)) {
            timing.put("result", "WARNING");
            timing.put("detail", "该农药档案未登记安全间隔期，无法计算休药期，也就无法判定用药时机是否合规");
        } else if (interval != null && interval > 0) {
            timing.put("result", "PASS");
            timing.put("earliestHarvestDate", usageDate.plusDays(interval).toString());
            timing.put("detail", "按本次使用日 " + usageDate + " + 安全间隔期 " + interval + " 天计算，"
                    + "最早可采收日 " + usageDate.plusDays(interval));
        } else {
            timing.put("result", "UNKNOWN");
            timing.put("detail", "该投入品没有安全间隔期口径（非农药类通常如此），本项不适用");
        }
        result.put("timing", timing);

        // ③ 合规（禁用清单）—— 没有主数据
        Map<String, Object> compliance = new LinkedHashMap<>();
        compliance.put("result", "UNKNOWN");
        compliance.put("detail", UNKNOWN_REASON + "库里只有标准编号清单与检测结果，没有「禁用/限用农药清单」");
        result.put("compliance", compliance);

        // ④ 交互（复配禁忌）—— 没有规则表
        Map<String, Object> interaction = new LinkedHashMap<>();
        interaction.put("result", "UNKNOWN");
        interaction.put("detail", UNKNOWN_REASON + "没有农药复配/交互规则表");
        result.put("interaction", interaction);

        // ⑤ 成本（替代方案性价比）—— 没有价格数据
        Map<String, Object> cost = new LinkedHashMap<>();
        cost.put("result", "UNKNOWN");
        cost.put("detail", UNKNOWN_REASON + "投入品档案没有价格列，无法比较替代方案成本");
        result.put("cost", cost);

        result.put("overall", overall(result));
        result.put("alternativeRecommendations", List.of());
        result.put("note", "整体结论口径：只要有 BLOCK 就是 BLOCK；否则有 WARNING 就是 WARNING；"
                + "否则只要还有 UNKNOWN 就是 UNKNOWN（不会把「没校验」算成通过）；全部通过才是 PASS。");
        return result;
    }

    /** 整体结论：BLOCK &gt; WARNING &gt; UNKNOWN &gt; PASS */
    private String overall(Map<String, Object> result) {
        List<String> items = new ArrayList<>();
        for (String key : List.of("compliance", "interaction", "timing", "cost", "stock")) {
            Object value = result.get(key);
            if (value instanceof Map<?, ?> map && map.get("result") != null) {
                items.add(String.valueOf(map.get("result")));
            }
        }
        if (items.contains("BLOCK")) return "BLOCK";
        if (items.contains("WARNING")) return "WARNING";
        if (items.contains("UNKNOWN")) return "UNKNOWN";
        return "PASS";
    }

    private static Long toLong(Object value) {
        if (value == null) return null;
        try {
            return Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static BigDecimal toDecimal(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDate(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return null;
        try {
            return LocalDate.parse(text.length() > 10 ? text.substring(0, 10) : text);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式不正确：" + text + "（应为 yyyy-MM-dd）");
        }
    }
}
