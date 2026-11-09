package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/** 看板与驾驶舱共享实时业务口径；不写入或修改生产事实。 */
@Service
public class ProductionDashboardService {
    private final FarmMapper farms;
    private final PlotMapper plots;
    private final TaskMapper tasks;
    private final HarvestBatchMapper batches;
    private final InspectionMapper inspections;
    private final AlertRecordMapper alerts;
    private final PlantingPlanMapper plans;
    public ProductionDashboardService(FarmMapper farms, PlotMapper plots, TaskMapper tasks,
            HarvestBatchMapper batches, InspectionMapper inspections, AlertRecordMapper alerts, PlantingPlanMapper plans) {
        this.farms=farms; this.plots=plots; this.tasks=tasks; this.batches=batches;
        this.inspections=inspections; this.alerts=alerts; this.plans=plans;
    }
    public static BigDecimal kilograms(BigDecimal qty, String unit) {
        if (qty == null || unit == null) return null;
        return switch(unit.trim().toLowerCase(Locale.ROOT)) {
            case "kg", "公斤", "千克" -> qty;
            case "t", "吨" -> qty.multiply(BigDecimal.valueOf(1000));
            case "斤" -> qty.multiply(BigDecimal.valueOf(0.5));
            default -> null;
        };
    }
    private static boolean done(Task t) { return Set.of("done","completed").contains(Objects.toString(t.getStatus(),"")); }
    private static boolean todo(Task t) { return Set.of("pending","assigned","executing","doing","suspended").contains(Objects.toString(t.getStatus(),"")); }
    private static BigDecimal area(Plot p) { return p.getArea()==null?BigDecimal.ZERO:p.getArea(); }
    @Transactional(readOnly=true, isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Map<String,Object> load(String tenant, Long farmId, int days) {
        if (!Set.of(7,30,90).contains(days)) throw new BusinessException(400,"统计周期仅支持7、30、90天");
        if(farmId!=null) {
            Farm f=farms.selectById(farmId);
            if(f==null || !tenant.equals(f.getTenantId()) || Integer.valueOf(1).equals(f.getDeleted()))
                throw new BusinessException(404,"当前主体下农场不存在");
        }
        List<Plot> ps=plots.selectList(new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId,tenant).eq(farmId!=null,Plot::getFarmId,farmId));
        List<Task> ts=tasks.selectList(new LambdaQueryWrapper<Task>().eq(Task::getTenantId,tenant).eq(farmId!=null,Task::getFarmId,farmId));
        List<HarvestBatch> bs=batches.selectList(new LambdaQueryWrapper<HarvestBatch>().eq(HarvestBatch::getTenantId,tenant).eq(farmId!=null,HarvestBatch::getFarmId,farmId));
        List<Inspection> qs=inspections.selectList(new LambdaQueryWrapper<Inspection>().eq(Inspection::getTenantId,tenant).eq(farmId!=null,Inspection::getFarmId,farmId));
        List<AlertRecord> as=alerts.selectList(new LambdaQueryWrapper<AlertRecord>().eq(AlertRecord::getTenantId,tenant).eq(farmId!=null,AlertRecord::getFarmId,farmId).in(AlertRecord::getStatus,java.util.stream.Stream.concat(com.agri.production.common.constant.AlertDict.statusValuesOf(1).stream(),com.agri.production.common.constant.AlertDict.statusValuesOf(2).stream()).toList()));
        List<PlantingPlan> active=plans.selectList(new LambdaQueryWrapper<PlantingPlan>().eq(PlantingPlan::getTenantId,tenant).eq(farmId!=null,PlantingPlan::getFarmId,farmId).in(PlantingPlan::getPlanStatus,List.of("active","doing")));
        Set<Long> planting=active.stream().map(PlantingPlan::getPlotId).filter(Objects::nonNull).collect(Collectors.toSet());
        LocalDate today=LocalDate.now(), start=today.minusDays(days-1);
        Map<LocalDate,BigDecimal> trend=new TreeMap<>();
        Map<String,BigDecimal> unconverted=new TreeMap<>();
        long missingQuantityCount=0;
        BigDecimal yield=BigDecimal.ZERO, periodYield=BigDecimal.ZERO;
        long periodBatches=0;
        for(HarvestBatch b:bs) {
            if(b.getQuantity()==null) { missingQuantityCount++; continue; }
            BigDecimal kg=kilograms(b.getQuantity(),b.getUnit());
            if(kg==null) { unconverted.merge(Objects.toString(b.getUnit(),"未填单位"),b.getQuantity()==null?BigDecimal.ZERO:b.getQuantity(),BigDecimal::add); continue; }
            yield=yield.add(kg);
            if(b.getHarvestDate()!=null && !b.getHarvestDate().isBefore(start) && !b.getHarvestDate().isAfter(today)) {
                periodYield=periodYield.add(kg); periodBatches++;
                trend.merge(b.getHarvestDate(),kg,BigDecimal::add);
            }
        }
        List<Task> pending=ts.stream().filter(ProductionDashboardService::todo)
            .sorted(Comparator.comparing(Task::getPlanEndTime,Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(Task::getId)).toList();
        long pass=qs.stream().filter(q->"DONE".equalsIgnoreCase(q.getStatus()) && "PASS".equals(q.getResult())).count();
        long fail=qs.stream().filter(q->"DONE".equalsIgnoreCase(q.getStatus()) && "FAIL".equals(q.getResult())).count();
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("asOf",LocalDateTime.now().toString()); out.put("farmId",farmId==null?null:farmId.toString());
        out.put("from",start.toString()); out.put("to",today.toString());
        out.put("plotCount",ps.size()); out.put("totalArea",ps.stream().map(ProductionDashboardService::area).reduce(BigDecimal.ZERO,BigDecimal::add));
        out.put("plantingArea",ps.stream().filter(p->planting.contains(p.getId())).map(ProductionDashboardService::area).reduce(BigDecimal.ZERO,BigDecimal::add));
        out.put("activePlanCount",active.size()); out.put("yieldKg",yield); out.put("periodYieldKg",periodYield);
        out.put("missingQuantityCount",missingQuantityCount); out.put("periodBatchCount",periodBatches); out.put("unconverted",unconverted);
        out.put("pendingTaskCount",pending.size()); out.put("completedTaskCount",ts.stream().filter(ProductionDashboardService::done).count());
        out.put("overdueTaskCount",pending.stream().filter(t->t.getPlanEndTime()!=null && t.getPlanEndTime().isBefore(LocalDateTime.now())).count());
        out.put("alertCount",as.size()); out.put("passCount",pass); out.put("failCount",fail);
        out.put("passRate",pass+fail==0?null:Math.round(1000.0*pass/(pass+fail))/10.0);
        out.put("pendingInspectionCount",qs.stream().filter(q->!"DONE".equalsIgnoreCase(q.getStatus())).count());
        out.put("todos",pending.stream().limit(8).map(t->{Map<String,Object> m=new LinkedHashMap<>();m.put("id",String.valueOf(t.getId()));m.put("name",t.getTaskName());m.put("status",t.getStatus());m.put("executor",t.getExecutorName());m.put("due",t.getPlanEndTime());return m;}).toList());
        out.put("alerts",as.stream().sorted(Comparator.comparing(AlertRecord::getCreateTime,Comparator.nullsLast(Comparator.reverseOrder()))).limit(8).map(a->{Map<String,Object> m=new LinkedHashMap<>();m.put("id",a.getAlertCode());m.put("title",a.getTitle());m.put("level",a.getLevel());m.put("time",a.getCreateTime());return m;}).toList());
        out.put("trend",trend.entrySet().stream().map(e->Map.of("date",e.getKey().toString(),"value",e.getValue())).toList());
        out.put("plots",ps.stream().map(p->{Map<String,Object> m=new LinkedHashMap<>();m.put("id",String.valueOf(p.getId()));m.put("name",p.getPlotName());m.put("area",area(p));m.put("planting",planting.contains(p.getId()));m.put("crop",p.getCurrentCrop());return m;}).toList());
        return out;
    }
}
