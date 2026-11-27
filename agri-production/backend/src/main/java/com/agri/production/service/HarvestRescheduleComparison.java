package com.agri.production.service;

import java.math.BigDecimal;
import java.util.*;

/** 仅记录本次重排前后安排；不修改排程、实绩或天气规则，不读取当前主数据补算历史。 */
public final class HarvestRescheduleComparison {
    private HarvestRescheduleComparison() {}

    public static void attach(Map<String,Object> row, Map<String,Object> source,
            List<Map<String,Object>> oldWorkers, List<Map<String,Object>> oldMachines,
            String mode, String oldRisk, String candidateRisk, Object snapshotId) {
        String outcome = "NEXT_CYCLE".equals(mode) ? "DEFERRED" :
                row.containsKey("status") ? text(row.get("status")) : row.get("newDate") == null ? "BLOCKED" : "PROPOSED";
        Map<String,Object> before = new LinkedHashMap<>();
        before.put("date", text(source.get("dispatch_date"))); before.put("status", source.get("status"));
        before.put("area", source.get("area")); before.put("completedArea", source.get("actual_area"));
        before.put("remainingArea", row.get("remainingArea")); before.put("people", source.get("people"));
        before.put("assignedPeople", source.get("assigned_people"));
        before.put("shiftStart", text(source.get("shift_start"))); before.put("shiftEnd", text(source.get("shift_end")));
        before.put("plannedHours", source.get("planned_hours"));
        before.put("workers", workers(oldWorkers)); before.put("machines", machines(oldMachines));
        before.put("riskStatus", oldRisk == null || oldRisk.isBlank() ? "PASSED" : "ATTENTION");
        before.put("riskReason", oldRisk == null || oldRisk.isBlank() ? "本次天气核验通过，仍需现场复核" : oldRisk);
        Map<String,Object> after = new LinkedHashMap<>();
        boolean proposed = "PROPOSED".equals(outcome), unchanged = "UNCHANGED".equals(outcome);
        if (unchanged) after.putAll(before);
        else {
            after.put("date", proposed ? row.get("newDate") : null);
            after.put("area", row.get("remainingArea")); after.put("remainingArea", row.get("remainingArea"));
            after.put("completedArea", BigDecimal.ZERO);
            after.put("people", proposed ? row.get("people") : null);
            after.put("assignedPeople", proposed ? maps(row.get("workers")).size() : null);
            after.put("shiftStart", proposed ? ("WEATHER_RISK_BATCH".equals(mode) ? source.get("shift_start") : "07:00:00") : null);
            after.put("shiftEnd", proposed ? ("WEATHER_RISK_BATCH".equals(mode) ? source.get("shift_end") : "16:00:00") : null);
            after.put("plannedHours", proposed ? row.get("plannedHours") : null);
            after.put("workers", proposed ? workers(maps(row.get("workers"))) : List.of());
            after.put("machines", proposed ? machines(maps(row.get("machines"))) : List.of());
            after.put("riskStatus", proposed ? candidateRisk == null ? "PASSED" : "PENDING" : "PENDING");
            after.put("riskReason", proposed ? candidateRisk == null ? "本次天气及资源候选校验通过；发布、开工前仍须复核" : candidateRisk :
                    "DEFERRED".equals(outcome) ? "下一周期待复核成熟度、天气和资源，尚未排期" : "没有可执行候选，请处理阻塞原因");
        }
        after.put("status", outcome);
        Map<String,Object> comparison = new LinkedHashMap<>();
        comparison.put("schemaVersion", "RESCHEDULE_COMPARISON_V1"); comparison.put("outcome", outcome);
        comparison.put("snapshotId", snapshotId); comparison.put("before", before); comparison.put("after", after);
        comparison.put("scope", "原单已完成量保留，只有剩余量转接续或待复核；人员为采收人员，机手单列。天气结果为本次预览时点判断，不是当前开工许可。");
        row.put("scheduleComparison", comparison);
    }

    private static List<Map<String,Object>> workers(List<Map<String,Object>> rows) {
        return rows.stream().map(w -> {
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("workerId", first(w,"workerId","worker_id","id"));
            item.put("workerName", first(w,"workerName","worker_name")); return item;
        }).toList();
    }
    private static List<Map<String,Object>> machines(List<Map<String,Object>> rows) {
        return rows.stream().map(m -> {
            Map<String,Object> item = new LinkedHashMap<>();
            item.put("machineNo", first(m,"machineNo","machine_no")); item.put("machineName", first(m,"machineName","machine_name"));
            item.put("machineType", first(m,"machineType","machine_type")); item.put("status", first(m,"status"));
            item.put("operatorWorkerId", first(m,"operatorWorkerId","operator_worker_id"));
            item.put("operatorWorkerName", first(m,"operatorWorkerName","operator_worker_name")); return item;
        }).toList();
    }
    private static Object first(Map<String,Object> row, String... keys) {
        for (String key : keys) if (row.get(key) != null) return row.get(key); return null;
    }
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> maps(Object value) { return value instanceof List<?> ? (List<Map<String,Object>>)value : List.of(); }
    private static String text(Object value) { return Objects.toString(value, ""); }
}
