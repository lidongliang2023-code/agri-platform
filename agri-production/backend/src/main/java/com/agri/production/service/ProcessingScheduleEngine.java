package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import java.time.*;
import java.util.*;

/** 有限产能启发式排程：交期优先，同交期按品类聚集；所有时间采用工厂本地时间。 */
public class ProcessingScheduleEngine {
    public record Block(LocalDateTime start,LocalDateTime end) {}
    public record Resource(String id,String name,String operation,double kgPerHour,double availability,
                           LocalDateTime availableFrom,List<Block> downtime) {}
    public record Job(String key,String orderId,String itemId,String orderNo,String category,String grade,
                      long batchId,double kg,LocalDateTime arrival,LocalDateTime due,List<String> route,int priority) {}
    public record Slot(String jobKey,String resourceId,String operation,LocalDateTime setupStart,
                       LocalDateTime start,LocalDateTime end,double kg,int setupMinutes,boolean late,String category,String grade) {}
    public record Result(List<Slot> slots,List<Map<String,Object>> conflicts,List<Map<String,Object>> loads) {}
    public static final Set<String> OPERATIONS=Set.of("SPREADING","FIXATION","ROLLING","DRYING","SORTING","GRADING","PACKAGING","PRECOOL","CUTING");
    public Result solve(List<Job> jobs,List<Resource> resources,List<Slot> occupied,LocalDateTime start,
                        int categoryMinutes,int gradeMinutes,int maxChanges) {
        if(jobs.isEmpty()||resources.isEmpty()) throw new BusinessException(400,"请提供真实订单需求及设备产能");
        if(jobs.size()>100 || resources.size()>60) throw new BusinessException(400,"单次最多100个拆批任务、60个设备工序资源");
        LocalDateTime horizon=start.plusDays(7);
        List<Slot> slots=new ArrayList<>(); List<Slot> busy=new ArrayList<>(occupied);
        List<Map<String,Object>> conflicts=new ArrayList<>();
        List<Job> sorted=new ArrayList<>(jobs);
        sorted.sort(Comparator.comparing(Job::due).thenComparing(Comparator.comparingInt(Job::priority).reversed()).thenComparing(Job::category));
        for(Job job:sorted) {
            if(job.kg<=0 || job.route.isEmpty() || !OPERATIONS.containsAll(job.route)) throw new BusinessException(400,"数量或工艺路线无效");
            List<Slot> provisional=new ArrayList<>(); LocalDateTime next=job.arrival.isAfter(start)?job.arrival:start;
            boolean failed=false;
            for(String op:job.route) {
                Slot best=null;
                for(Resource r:resources) {
                    if(!r.operation.equals(op))continue;
                    Slot candidate=find(job,r,next,horizon,busy,provisional,categoryMinutes,gradeMinutes,maxChanges);
                    if(candidate!=null && (best==null || candidate.end.isBefore(best.end)))best=candidate;
                }
                if(best==null){failed=true;break;}
                provisional.add(best);next=best.end;
            }
            if(failed) conflicts.add(conflict(job,"UNSCHEDULED",null));
            else {slots.addAll(provisional);busy.addAll(provisional);if(next.isAfter(job.due))conflicts.add(conflict(job,"LATE",next));}
        }
        List<Map<String,Object>> loads=new ArrayList<>();
        for(Resource r:resources) {
            long capacity=Duration.between(start,horizon).toMinutes();
            for(Block b:r.downtime) capacity-=overlap(start,horizon,b.start,b.end);
            if(r.availableFrom.isAfter(start))capacity-=overlap(start,horizon,start,r.availableFrom);
            capacity=Math.max(0,capacity);
            long used=busy.stream().filter(s->s.resourceId.equals(r.id)).mapToLong(s->overlap(start,horizon,s.setupStart,s.end)).sum();
            double load=capacity==0?(used==0?0:100):Math.round(used*10000d/capacity)/100d;
            loads.add(Map.of("resourceId",r.id,"name",r.name,"operation",r.operation,"availableMinutes",capacity,"usedMinutes",used,"loadPercent",load,"bottleneck",load>=95));
        }
        return new Result(slots,conflicts,loads);
    }
    private Slot find(Job j,Resource r,LocalDateTime earliest,LocalDateTime horizon,List<Slot> busy,List<Slot> local,int cm,int gm,int max) {
        if(r.kgPerHour<=0||r.availability<=0||r.availability>1)throw new BusinessException(400,"设备产能和可用率无效");
        long minutes=Math.max(1,(long)Math.ceil(j.kg/(r.kgPerHour*r.availability)*60));
        LocalDateTime at=earliest.isAfter(r.availableFrom)?earliest:r.availableFrom;
        List<Slot> all=new ArrayList<>(busy);all.addAll(local);
        for(int attempt=0;attempt<500 && at.isBefore(horizon);attempt++) {
            final LocalDateTime point=at;
            Slot previous=all.stream().filter(s->s.resourceId.equals(r.id)&&!s.end.isAfter(point)).max(Comparator.comparing(Slot::end)).orElse(null);
            int setup=previous==null?0:!previous.category.equals(j.category)?cm:!previous.grade.equals(j.grade)?gm:0;
            LocalDateTime run=at.plusMinutes(setup),end=run.plusMinutes(minutes);
            if(end.isAfter(horizon))return null;
            LocalDateTime jump=null;
            for(Block b:r.downtime)if(at.isBefore(b.end)&&end.isAfter(b.start))jump=max(jump,b.end);
            for(Slot s:all)if(s.resourceId.equals(r.id)&&at.isBefore(s.end)&&end.isAfter(s.setupStart))jump=max(jump,s.end);
            if(jump!=null){at=jump;continue;}
            // 插入已有生产之前时无法修改下一工单的既定清洗时间，保守按设备尾排，避免污染换型口径。
            LocalDateTime last=all.stream().filter(s->s.resourceId.equals(r.id)).map(Slot::end).max(LocalDateTime::compareTo).orElse(at);
            if(at.isBefore(last)){at=last;continue;}
            final LocalDate day=at.toLocalDate();
            long changes=all.stream().filter(s->s.resourceId.equals(r.id)&&s.setupMinutes>0&&s.setupStart.toLocalDate().equals(day)).count();
            if(setup>0&&changes>=max){at=day.plusDays(1).atStartOfDay();continue;}
            return new Slot(j.key,r.id,r.operation,at,run,end,j.kg,setup,end.isAfter(j.due),j.category,j.grade);
        }
        return null;
    }
    private Map<String,Object> conflict(Job j,String type,LocalDateTime finish) {
        Map<String,Object> c=new LinkedHashMap<>();c.put("jobKey",j.key);c.put("orderNo",j.orderNo);c.put("type",type);c.put("due",j.due);c.put("finish",finish);
        c.put("options",List.of(Map.of("type","POSTPONE","label","顺延交期","costStatus","需销售核实赔付","risk","需客户另行同意，不改原订单交期"),Map.of("type","OUTSOURCE","label","外协加工","costStatus","按已核验外协报价计算","risk","资质和追溯能力必须核验"),Map.of("type","SPLIT","label","拆批交付","costStatus","按实际新增换型分钟计算","risk","重新拆批排程，交付安排需客户确认")));
        return c;
    }
    static long overlap(LocalDateTime a,LocalDateTime b,LocalDateTime c,LocalDateTime d){LocalDateTime l=a.isAfter(c)?a:c,r=b.isBefore(d)?b:d;return r.isAfter(l)?Duration.between(l,r).toMinutes():0;}
    private static LocalDateTime max(LocalDateTime a,LocalDateTime b){return a==null||b.isAfter(a)?b:a;}
}
