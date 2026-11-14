package com.agri.production.service;

import com.agri.production.dto.CalendarArrangeRequest;
import com.agri.production.dto.CalendarArrangeRequest.*;
import com.agri.production.common.exception.BusinessException;
import java.time.*;
import java.util.*;

/** 生产域约束排程。模型解释不具有覆盖安全约束的权限。 */
public final class CalendarSchedulingEngine {
    private CalendarSchedulingEngine() {}
    public record Occupancy(LocalDate date, Long memberId, int people, int machines) {}
    public static List<Map<String,Object>> arrange(CalendarArrangeRequest input, List<Occupancy> occupied, LocalDateTime now) {
        if(input.weekStart()==null || input.weekStart().plusDays(6).isBefore(now.toLocalDate()) || input.weekStart().isAfter(now.toLocalDate().plusDays(90))) fail("编排周须尚未结束，起始日不超过未来90天");
        if(input.operations()==null || input.operations().isEmpty() || input.operations().size()>100) fail("请提供1至100项农事");
        if(input.source()==null || input.source().isBlank() || input.source().length()>1000) fail("请提供标准与资源快照出处（最多1000字）");
        if(input.days()==null || input.days().size()!=7) fail("请提供连续7天的资源和天气快照");
        Map<LocalDate,DaySupply> days=new HashMap<>();
        for(var day:input.days()) {
            if(day.date()==null || day.date().isBefore(input.weekStart()) || day.date().isAfter(input.weekStart().plusDays(6)) || days.put(day.date(),day)!=null) fail("资源日期必须完整覆盖本次7天且不重复");
            if(day.people()<0 || day.people()>10000 || day.machineSlots()<0 || day.machineSlots()>1000) fail("日容量超出范围");
            if(!validTemperature(day.minTemperature()) || !validTemperature(day.greenhouseTemperature())) fail("温度须在-80至80℃范围内");
        }
        Map<LocalDate,Integer> people=new HashMap<>(), machines=new HashMap<>(); Set<String> busy=new HashSet<>();
        for(var used:occupied) { people.merge(used.date(),used.people(),Integer::sum); machines.merge(used.date(),used.machines(),Integer::sum); if(used.memberId()!=null) busy.add(used.date()+":"+used.memberId()); }
        List<Operation> sorted=new ArrayList<>(input.operations()); Set<String> keys=new HashSet<>(); Set<String> identities=new HashSet<>();
        for(var op:sorted) {
            if(op==null || op.key()==null || !op.key().matches("[a-zA-Z0-9_-]{1,64}") || !keys.add(op.key())) fail("农事条目编号缺失或重复");
            if(op.planId()==null || op.stageId()==null || blank(op.taskName()) || op.taskName().length()>150 || blank(op.standardRef()) || op.standardRef().length()>1000) fail("每项农事须关联计划、阶段、名称和标准出处");
            if(!Set.of("pruning","fertilizing","ventilation","pollination","harvesting","pest_control","irrigating","other").contains(Objects.toString(op.taskType(),""))) fail("不支持的农事类型");
            if(!identities.add(op.stageId()+":"+op.taskName().trim())) fail("同阶段农事名称重复，请合并或注明不同作业内容");
            if(op.priority()<1 || op.priority()>4 || op.people()<1 || op.people()>10000 || op.machineSlots()<0 || op.machineSlots()>1000 || op.memberId()==null) fail("请提供有效优先级、人数、机具数量和责任人");
            if(op.earliest()==null || op.latest()==null || op.earliest().isAfter(op.latest()) || op.latest().isBefore(input.weekStart()) || op.earliest().isAfter(input.weekStart().plusDays(6))) fail("农事窗口未覆盖本周或起止无效");
            if(!validTemperature(op.minimumTemperature())) fail("最低作业温度无效");
            if(op.floweringStart()!=null && op.floweringEnd()!=null && op.floweringStart().isAfter(op.floweringEnd())) fail("开花窗口起止无效");
        }
        sorted.sort(Comparator.comparing((Operation o)->!o.mandatory()).thenComparingInt(Operation::priority).thenComparing(Operation::latest).thenComparing(Operation::key));
        List<Map<String,Object>> result=new ArrayList<>();
        for(var op:sorted) {
            var row=new LinkedHashMap<String,Object>(); row.put("key",op.key()); row.put("taskName",op.taskName()); row.put("planId",op.planId()); row.put("stageId",op.stageId()); row.put("mandatory",op.mandatory()); row.put("priority",op.priority());
            row.put("people",op.people()); row.put("machineSlots",op.machineSlots()); row.put("memberId",op.memberId()); row.put("standardRef",op.standardRef());
            List<String> reasons=new ArrayList<>(); LocalDate selected=null;
            for(LocalDate d=input.weekStart();!d.isAfter(input.weekStart().plusDays(6));d=d.plusDays(1)) {
                if(d.isBefore(op.earliest()) || d.isAfter(op.latest())) continue;
                if(d.isBefore(now.toLocalDate())) { reasons.add(d+"：该日期已过去"); continue; }
                DaySupply supply=days.get(d); String blocked=unsafe(op,supply,input,now);
                if(blocked==null && people.getOrDefault(d,0)+op.people()>supply.people()) blocked="劳力容量不足";
                if(blocked==null && machines.getOrDefault(d,0)+op.machineSlots()>supply.machineSlots()) blocked="机具容量不足";
                if(blocked==null && busy.contains(d+":"+op.memberId())) blocked="责任人已有当日任务";
                if(blocked!=null) { reasons.add(d+"："+blocked); continue; }
                selected=d; people.merge(d,op.people(),Integer::sum); machines.merge(d,op.machineSlots(),Integer::sum); busy.add(d+":"+op.memberId()); break;
            }
            row.put("date",selected==null?null:selected.toString()); row.put("status",selected==null?"BLOCKED":"SCHEDULED");
            row.put("reasons",reasons); row.put("windowWarning",!op.latest().isAfter(input.weekStart().plusDays(2)));
            row.put("crossMonth",selected!=null && !YearMonth.from(selected).equals(YearMonth.from(input.weekStart())));
            result.add(row);
        }
        return result;
    }
    static String unsafe(Operation op, DaySupply d, CalendarArrangeRequest input, LocalDateTime now) {
        boolean spray="pest_control".equals(op.taskType());
        if(!blank(op.requiredSkill()) && blank(op.skillEvidence())) return "缺少所需技能核验证明";
        if(spray) {
            if(blank(op.registrationRef()) || op.harvestDate()==null || op.safetyIntervalDays()==null || op.safetyIntervalDays()<0 || op.safetyIntervalDays()>365) return "缺少登记范围、安全间隔及采收日期依据";
            if(op.floweringStart()==null || op.floweringEnd()==null) return "须核实开花期，未开花也须提供经核实的不重叠窗口";
            if(!d.date().isBefore(op.floweringStart()) && !d.date().isAfter(op.floweringEnd())) return "开花期禁止安排施药";
            if(!d.date().isBefore(op.harvestDate()) || d.date().plusDays(op.safetyIntervalDays()).isAfter(op.harvestDate())) return "采收安全间隔不足";
        }
        if(spray || op.weatherSensitive() || "ventilation".equals(op.taskType())) {
            if(!d.weatherVerified()) return "当日天气尚未人工核验";
            if(blank(input.weatherSource()) || input.weatherIssuedAt()==null || input.weatherIssuedAt().isAfter(now.plusMinutes(5)) || input.weatherIssuedAt().isBefore(now.minusHours(24)) || d.date().isAfter(input.weatherIssuedAt().toLocalDate().plusDays(14))) return "天气快照缺失、过期或超出15天预报范围";
            if(d.strongWind()) return "大风窗口不适宜";
            if(spray && d.rain()) return "降雨窗口禁止施药";
            Double temp=op.greenhouse()?d.greenhouseTemperature():d.minTemperature();
            if(temp==null) return op.greenhouse()?"缺少棚内小气候温度":"缺少最低温度";
            if(op.minimumTemperature()==null) return "缺少标准最低作业温度";
            if(temp<op.minimumTemperature()) return "低于标准作业温度";
        }
        return null;
    }
    private static boolean validTemperature(Double n) { return n==null || (Double.isFinite(n)&&n>=-80&&n<=80); }
    private static boolean blank(String s) { return s==null || s.isBlank(); }
    private static void fail(String message) { throw new BusinessException(400,message); }
}
