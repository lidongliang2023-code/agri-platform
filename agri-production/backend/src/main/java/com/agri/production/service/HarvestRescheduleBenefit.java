package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** 重排的剩余作业增量测算；不承担行情预测、工资结算或财务利润核算。 */
public final class HarvestRescheduleBenefit {
    private HarvestRescheduleBenefit() {}
    private static final List<String> FIELDS = List.of("yieldKgPerMu", "baselinePrice", "candidatePrice", "worstPrice",
            "baselineLossPct", "candidateLossPct", "worstLossPct", "baselineLaborCost", "candidateLaborCost",
            "baselineMachineCost", "candidateMachineCost", "baselineOtherCost", "candidateOtherCost", "adjustmentCost");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    /** 每张派单单独输入；未填写的成本或损耗不默认为零。 */
    public static Map<String,Object> attach(List<Map<String,Object>> rows, Object rawInputs) {
        Map<?,?> inputs;
        if (rawInputs == null) inputs = Map.of();
        else if (rawInputs instanceof Map<?,?> map && map.size() <= 50) inputs = map;
        else throw new BusinessException(400, "收益参数须按派单提交，最多50单");
        Set<String> ids = new HashSet<>(); rows.forEach(r -> ids.add(Objects.toString(r.get("dispatchId"), "")));
        for (Object key : inputs.keySet()) if (!ids.contains(key)) throw new BusinessException(400, "收益参数包含未选中的派单");
        int eligible = 0, calculated = 0;
        Map<String,Object> totals = new LinkedHashMap<>();
        List<String> totalFields = List.of("baselineRevenue", "candidateRevenue", "baselineCost", "candidateCost", "baselineNet", "candidateNet", "netDelta", "worstNet", "worstDelta", "revenueDelta", "costDelta");
        totalFields.forEach(k -> totals.put(k, BigDecimal.ZERO.setScale(2)));
        for (Map<String,Object> row : rows) {
            String id = Objects.toString(row.get("dispatchId"), "");
            boolean proposed = "PROPOSED".equals(row.get("status"));
            if (proposed) eligible++;
            Map<String,Object> benefit = calculate(row.get("remainingArea"), inputs.get(id), proposed);
            row.put("benefitComparison", benefit);
            if (proposed && "CALCULATED".equals(benefit.get("status"))) {
                calculated++;
                for (String k : totalFields) totals.put(k, ((BigDecimal)totals.get(k)).add((BigDecimal)benefit.get(k)));
            }
        }
        Map<String,Object> summary = new LinkedHashMap<>();
        summary.put("modelVersion", "REMAINING_WORK_V1"); summary.put("currency", "CNY");
        summary.put("eligibleCount", eligible); summary.put("calculatedCount", calculated); summary.put("missingCount", eligible-calculated);
        summary.put("status", calculated == 0 ? "NOT_CALCULATED" : calculated == eligible ? "COMPLETE" : "PARTIAL");
        // 未测算时保持空值，不能让空白参数看起来像零收益。
        summary.put("totals", calculated == 0 ? null : totals);
        summary.put("scope", "仅统计已找到候选的剩余作业；部分测算不代表整批收益。原日期为不可执行的反事实基准，不构成冒雨开工建议。");
        summary.put("rules", "销售额=剩余面积×亩产×(1-损耗率/100)×价格；作业净收益=销售额-人工-农机运输-其他-调度追加费。基准不含调度追加费；保守情景采用保守价和损耗，沿用候选成本。人工含机手驾驶员，农机运输费不再含人员；费用为本单剩余作业总额，已发生及种植固定成本不计。参数为人工估算，不是价格预测、收益承诺或工资结算。");
        return summary;
    }

    private static Map<String,Object> calculate(Object rawArea, Object raw, boolean proposed) {
        Map<String,Object> out = new LinkedHashMap<>();
        out.put("modelVersion", "REMAINING_WORK_V1");
        if (raw != null && !(raw instanceof Map<?,?>)) throw new BusinessException(400, "单张派单收益参数格式无效");
        Map<?,?> input = raw instanceof Map<?,?> m ? m : Map.of();
        Map<String,Object> assumptions = new LinkedHashMap<>();
        List<String> missing = new ArrayList<>();
        for (String field : FIELDS) {
            Object value = input.get(field);
            if (value == null || value.toString().isBlank()) { missing.add(field); continue; }
            BigDecimal number;
            try { number = new BigDecimal(value.toString()); }
            catch (Exception e) { throw new BusinessException(400, "收益参数不是有效数字："+field); }
            BigDecimal max = field.endsWith("Pct") ? HUNDRED : field.contains("Price") ? new BigDecimal("1000000") : new BigDecimal("1000000000");
            if (number.signum()<0 || number.compareTo(max)>0 || number.scale()>4 || field.equals("yieldKgPerMu") && number.signum()==0)
                throw new BusinessException(400, "收益参数超出范围或精度："+field);
            assumptions.put(field, number);
        }
        String source = Objects.toString(input.get("sourceNote"), "").trim();
        if (source.length()>300) throw new BusinessException(400, "收益依据说明最多300字");
        if (source.isEmpty()) missing.add("sourceNote");
        assumptions.put("sourceNote", source); out.put("assumptions", assumptions);
        out.put("missingFields", missing);
        if (!proposed) { out.put("status", "NOT_APPLICABLE"); out.put("message", "未生成接续候选或无需重排，不计入收益汇总"); return out; }
        if (!missing.isEmpty()) { out.put("status", "MISSING_INPUT"); out.put("message", "参数不完整，未测算；损耗和成本需明确填写，零费用也须填0"); return out; }
        BigDecimal candidatePrice = n(assumptions,"candidatePrice"), worstPrice=n(assumptions,"worstPrice");
        if (worstPrice.compareTo(candidatePrice)>0 || n(assumptions,"worstLossPct").compareTo(n(assumptions,"candidateLossPct"))<0)
            throw new BusinessException(400, "保守情景价格不得高于候选价格，损耗率不得低于候选损耗率");
        BigDecimal area = new BigDecimal(rawArea.toString());
        if (area.signum()<0 || area.compareTo(new BigDecimal("1000000000"))>0) throw new BusinessException(400, "剩余面积超出收益测算范围");
        BigDecimal kg=area.multiply(n(assumptions,"yieldKgPerMu"));
        BigDecimal beforeRevenue=revenue(kg,n(assumptions,"baselineLossPct"),n(assumptions,"baselinePrice"));
        BigDecimal afterRevenue=revenue(kg,n(assumptions,"candidateLossPct"),candidatePrice);
        BigDecimal worstRevenue=revenue(kg,n(assumptions,"worstLossPct"),worstPrice);
        BigDecimal beforeCost=money(n(assumptions,"baselineLaborCost").add(n(assumptions,"baselineMachineCost")).add(n(assumptions,"baselineOtherCost")));
        BigDecimal afterCost=money(n(assumptions,"candidateLaborCost").add(n(assumptions,"candidateMachineCost")).add(n(assumptions,"candidateOtherCost")).add(n(assumptions,"adjustmentCost")));
        BigDecimal beforeNet=beforeRevenue.subtract(beforeCost), afterNet=afterRevenue.subtract(afterCost), worstNet=worstRevenue.subtract(afterCost);
        out.put("status","CALCULATED"); out.put("remainingArea",area);
        out.put("baselineRevenue",beforeRevenue); out.put("candidateRevenue",afterRevenue);
        out.put("baselineCost",beforeCost); out.put("candidateCost",afterCost);
        out.put("baselineNet",beforeNet); out.put("candidateNet",afterNet); out.put("worstNet",worstNet);
        out.put("netDelta",afterNet.subtract(beforeNet)); out.put("worstDelta",worstNet.subtract(beforeNet));
        out.put("revenueDelta",afterRevenue.subtract(beforeRevenue)); out.put("costDelta",afterCost.subtract(beforeCost));
        return out;
    }
    private static BigDecimal revenue(BigDecimal kg, BigDecimal loss, BigDecimal price) { return money(kg.multiply(HUNDRED.subtract(loss)).movePointLeft(2).multiply(price)); }
    private static BigDecimal n(Map<String,Object> m,String key) { return (BigDecimal)m.get(key); }
    private static BigDecimal money(BigDecimal v) { return v.setScale(2,RoundingMode.HALF_UP); }
}
