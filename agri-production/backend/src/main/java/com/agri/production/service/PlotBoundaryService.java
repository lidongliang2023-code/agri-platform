package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.PlotMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import java.awt.geom.Area;
import java.util.*;

/** 地块写入与农场边界变更共用同一农场行锁，避免并发缩界或重叠漏检。 */
@Service
public class PlotBoundaryService {
    private final FarmMapper farms;
    private final PlotMapper plots;
    public PlotBoundaryService(FarmMapper farms, PlotMapper plots) { this.farms=farms; this.plots=plots; }

    public Farm farm(Long id, String tenant, boolean lock) {
        if (id == null) throw new BusinessException(400,"请选择所属农场");
        Farm farm=lock ? farms.boundaryForUpdate(id) : farms.selectById(id);
        if (farm==null || !Objects.equals(tenant,farm.getTenantId())) throw new BusinessException(404,"所属农场不存在或不属于当前主体");
        return farm;
    }
    private LambdaQueryWrapper<Plot> siblings(Farm farm,Long excludePlotId) {
        return new LambdaQueryWrapper<Plot>().eq(Plot::getFarmId,farm.getId())
            .eq(Plot::getTenantId,farm.getTenantId()).eq(Plot::getDeleted,0)
            .ne(excludePlotId!=null,Plot::getId,excludePlotId).orderByAsc(Plot::getId);
    }
    private static String label(Plot plot) {
        return Objects.toString(plot.getPlotName(),"未命名地块")+"（ID："+plot.getId()+"）";
    }
    public String validatePlot(Long farmId, String tenant, String boundary) {
        return validatePlot(farmId,tenant,boundary,null);
    }
    /** 调用方在事务中持有农场锁直到保存完成，串行检查同农场地块。 */
    public String validatePlot(Long farmId,String tenant,String boundary,Long excludePlotId) {
        Farm farm=farm(farmId,tenant,true);
        String normalized=FarmBoundaryGeometry.normalizePlot(boundary);
        Result range=check(farm.getBoundary(),normalized);
        if (Set.of("outside","invalid").contains(range.status())) throw new BusinessException(400,range.message());
        if (FarmBoundaryGeometry.isPolygon(normalized)) {
            Result overlap=checkOverlaps(normalized,plots.selectList(siblings(farm,excludePlotId).last("FOR UPDATE")));
            if (Set.of("overlap","invalid").contains(overlap.status())) throw new BusinessException(400,overlap.message());
        }
        return normalized;
    }
    public record Result(String status,String message) {}
    public static Result check(String farmBoundary,String plotBoundary) {
        try {
            String plot=FarmBoundaryGeometry.normalizePlot(plotBoundary);
            if (farmBoundary==null || farmBoundary.isBlank()) return new Result("farm_missing","农场未绘制边界，暂无法校验地块范围");
            String farm=FarmBoundaryGeometry.normalize(farmBoundary,false);
            if (!FarmBoundaryGeometry.isPolygon(plot)) return new Result("plot_missing","地块未绘制多边形边界，暂无法校验完整范围");
            return FarmBoundaryGeometry.covers(farm,plot)
                ? new Result("inside","地块完整位于农场范围内（允许贴边）")
                : new Result("outside","地块边界超出所属农场，请调整地块边界或所属农场");
        } catch (BusinessException e) { return new Result("invalid","边界数据异常："+e.getMessage()); }
    }
    private static Result checkOverlaps(String boundary,List<Plot> siblings) {
        Area current=FarmBoundaryGeometry.plotArea(boundary);
        if (current==null) return new Result("plot_missing","尚未绘制完整地块边界，无法校验重叠");
        List<String> conflicts=new ArrayList<>(),invalid=new ArrayList<>();
        int missing=0;
        for (Plot sibling:siblings) {
            Area other;
            try { other=FarmBoundaryGeometry.plotArea(sibling.getBoundary()); }
            catch (BusinessException e) { invalid.add(label(sibling)); continue; }
            if (other==null) { missing++; continue; }
            if (FarmBoundaryGeometry.overlaps(current,other)) conflicts.add(label(sibling));
        }
        if (!conflicts.isEmpty()) return new Result("overlap","地块边界与已有地块重叠："+String.join("、",conflicts.stream().limit(5).toList())
            +(conflicts.size()>5?"等 "+conflicts.size()+" 个地块":"")+"；允许共边或共点，请调整重叠面积");
        if (!invalid.isEmpty()) return new Result("invalid","无法完成重叠校验，请先修复同农场异常地块边界："+String.join("、",invalid.stream().limit(5).toList()));
        if (missing>0) return new Result("incomplete","已绘制的地块未发现重叠；另有 "+missing+" 个地块未绘制完整边界，尚无法比较");
        return new Result("clear","与同农场其他地块无面积重叠（允许共边或共点）");
    }
    /** 只读预校验；排除的编辑地块必须属于当前主体，允许跨农场迁移。 */
    public Result preview(Farm farm,String boundary,Long excludePlotId) {
        if (excludePlotId!=null) {
            Plot current=plots.selectById(excludePlotId);
            if (current==null || !Objects.equals(farm.getTenantId(),current.getTenantId()))
                throw new BusinessException(404,"待编辑地块不存在或不属于当前主体");
        }
        Result range=check(farm.getBoundary(),boundary);
        if (Set.of("outside","invalid").contains(range.status())) return range;
        Result overlap=checkOverlaps(boundary,plots.selectList(siblings(farm,excludePlotId)));
        if (Set.of("overlap","invalid").contains(overlap.status())) return overlap;
        return new Result(range.status().equals("inside") && overlap.status().equals("incomplete")?"incomplete":range.status(),range.message()+"；"+overlap.message());
    }
    public static void assertFarmChange(PlotMapper plots,Farm farm,String boundary) {
        if (boundary==null) return;
        List<Plot> children=plots.selectList(new LambdaQueryWrapper<Plot>()
            .eq(Plot::getFarmId,farm.getId()).eq(Plot::getTenantId,farm.getTenantId()).last("FOR UPDATE"));
        List<String> conflicts=new ArrayList<>();
        for (Plot plot:children) {
            Result result=check(boundary,plot.getBoundary());
            if (Set.of("outside","invalid").contains(result.status()))
                conflicts.add(label(plot)+"（"+(result.status().equals("outside")?"越界":"边界异常")+"）");
        }
        if (!conflicts.isEmpty()) throw new BusinessException(400,"农场边界未保存："+String.join("、",conflicts.stream().limit(5).toList())
            +(conflicts.size()>5?"等 "+conflicts.size()+" 个地块":"")+"；请先调整相关地块或扩大农场边界");
    }
    /** 范围与重叠分别校验；每个多边形仅解析一次，成对比较并双向记录冲突。 */
    public List<Map<String,Object>> report(Farm farm) {
        List<Plot> all=plots.selectList(siblings(farm,null));
        List<Area> areas=new ArrayList<>();
        List<List<Plot>> conflicts=new ArrayList<>();
        int invalid=0,missing=0;
        Set<Long> invalidIds=new HashSet<>();
        for (Plot plot:all) {
            Area area=null;
            try { area=FarmBoundaryGeometry.plotArea(plot.getBoundary()); if (area==null) missing++; }
            catch (BusinessException e) { invalid++; invalidIds.add(plot.getId()); }
            areas.add(area); conflicts.add(new ArrayList<>());
        }
        for (int i=0;i<all.size();i++) for (int j=i+1;j<all.size();j++) {
            if (areas.get(i)!=null && areas.get(j)!=null && FarmBoundaryGeometry.overlaps(areas.get(i),areas.get(j))) {
                conflicts.get(i).add(all.get(j)); conflicts.get(j).add(all.get(i));
            }
        }
        List<Map<String,Object>> rows=new ArrayList<>();
        for (int i=0;i<all.size();i++) {
            Plot plot=all.get(i);
            Result range=check(farm.getBoundary(),plot.getBoundary());
            List<Plot> matches=conflicts.get(i);
            String overlapStatus,overlapMessage;
            if (invalidIds.contains(plot.getId())) { overlapStatus="invalid"; overlapMessage="当前地块边界异常，无法检查重叠"; }
            else if (areas.get(i)==null) { overlapStatus="plot_missing"; overlapMessage="当前地块未绘制完整边界，无法检查重叠"; }
            else if (!matches.isEmpty()) { overlapStatus="overlap"; overlapMessage="与 "+String.join("、",matches.stream().map(PlotBoundaryService::label).toList())+" 存在面积重叠"; }
            else if (invalid+missing>0) { overlapStatus="incomplete"; overlapMessage="已绘制地块未发现重叠；另有 "+invalid+" 个边界异常、"+missing+" 个边界缺失地块无法比较"; }
            else { overlapStatus="clear"; overlapMessage="无面积重叠（允许共边或共点）"; }
            Map<String,Object> row=new LinkedHashMap<>();
            row.put("plotId",String.valueOf(plot.getId())); row.put("plotName",plot.getPlotName()); row.put("plotCode",plot.getPlotCode());
            row.put("status",range.status()); row.put("message",range.message()); row.put("boundary",plot.getBoundary());
            row.put("overlapStatus",overlapStatus); row.put("overlapMessage",overlapMessage);
            row.put("overlapPlots",matches.stream().map(other -> Map.of("plotId",String.valueOf(other.getId()),"plotName",Objects.toString(other.getPlotName(),"未命名地块"))).toList());
            rows.add(row);
        }
        return rows;
    }
}
