package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.integration.IotDeviceClient;
import com.agri.production.vo.IotDeviceVO;
import com.agri.production.vo.MonitorEnvVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

/** 运营只读聚合：直接读取生产业务台账；设备本体委托物联网，不创建第二套台账。 */
@Service
public class ProductionMonitorQueryService {
 private final TaskMapper tasks; private final InputUsageRecordMapper usages;
 private final FarmMapper farms; private final PlotMapper plots; private final AlertRecordMapper alerts;
 private final ISensorPivotService sensors; private final IotDeviceClient devices;
 public ProductionMonitorQueryService(TaskMapper tasks,InputUsageRecordMapper usages,FarmMapper farms,PlotMapper plots,AlertRecordMapper alerts,ISensorPivotService sensors,IotDeviceClient devices){this.tasks=tasks;this.usages=usages;this.farms=farms;this.plots=plots;this.alerts=alerts;this.sensors=sensors;this.devices=devices;}
 private String text(String s){return s==null?"":s.trim();}
 private int size(int n){return Math.min(100,Math.max(1,n));}
 private Map<String,Object> names(Long farmId,Long plotId){
  Map<String,Object> m=new LinkedHashMap<>(); Farm f=farmId==null?null:farms.selectById(farmId); Plot p=plotId==null?null:plots.selectById(plotId);
  m.put("farmName",f==null?null:f.getFarmName());m.put("plotName",p==null?null:p.getPlotName());return m;
 }
 private LambdaQueryWrapper<Task> taskFilter(String keyword,Long farmId,String status,String type,String from,String to){
  var w=new LambdaQueryWrapper<Task>().eq(farmId!=null,Task::getFarmId,farmId).eq(!text(type).isEmpty(),Task::getTaskType,type);
  if(!text(keyword).isEmpty())w.and(x->x.like(Task::getTaskName,keyword.trim()).or().like(Task::getTaskCode,keyword.trim()));
  if("executing".equals(status))w.in(Task::getStatus,List.of("executing","doing","in_progress"));
  else if("completed".equals(status))w.in(Task::getStatus,List.of("completed","done"));
  else if("overdue".equals(status))w.lt(Task::getPlanEndTime,LocalDateTime.now()).notIn(Task::getStatus,List.of("completed","done","cancelled","expired","rejected"));
  else w.eq(!text(status).isEmpty(),Task::getStatus,status);
  try{if(!text(from).isEmpty())w.ge(Task::getPlanEndTime,LocalDate.parse(from).atStartOfDay());if(!text(to).isEmpty())w.lt(Task::getPlanStartTime,LocalDate.parse(to).plusDays(1).atStartOfDay());}catch(Exception e){throw new BusinessException(400,"日期格式应为 yyyy-MM-dd");}
  return w;
 }
 public Map<String,Object> taskPage(int page,int limit,String keyword,Long farmId,String status,String type,String from,String to){
  var p=tasks.selectPage(new Page<Task>(Math.max(1,page),size(limit)),taskFilter(keyword,farmId,status,type,from,to).orderByDesc(Task::getId));
  var rows=p.getRecords().stream().map(this::taskRow).toList();
  Map<String,Object> result=new LinkedHashMap<>();result.put("list",rows);result.put("total",p.getTotal());result.put("pageNum",p.getCurrent());result.put("pageSize",p.getSize());return result;
 }
 private Map<String,Object> taskRow(Task t){var m=names(t.getFarmId(),t.getPlotId());m.put("task",t);return m;}
 public Map<String,Object> taskDetail(Long id){Task t=tasks.selectById(id);if(t==null)throw new BusinessException(404,"任务不存在");return taskRow(t);}
 public PageResult<Map<String,Object>> inputPage(int page,int limit,String keyword,Long farmId,String from,String to){
  var w=new LambdaQueryWrapper<InputUsageRecord>().eq(farmId!=null,InputUsageRecord::getFarmId,farmId).like(!text(keyword).isEmpty(),InputUsageRecord::getInputName,text(keyword));
  try{if(!text(from).isEmpty())w.ge(InputUsageRecord::getUsedAt,LocalDate.parse(from).atStartOfDay());if(!text(to).isEmpty())w.lt(InputUsageRecord::getUsedAt,LocalDate.parse(to).plusDays(1).atStartOfDay());}catch(Exception e){throw new BusinessException(400,"日期格式应为 yyyy-MM-dd");}
  var p=usages.selectPage(new Page<InputUsageRecord>(Math.max(1,page),size(limit)),w.orderByDesc(InputUsageRecord::getUsedAt).orderByDesc(InputUsageRecord::getUsageId));
  return PageResult.of(p.getRecords().stream().map(u->{var m=names(u.getFarmId(),u.getPlotId());m.put("usage",u);return m;}).toList(),p.getTotal(),(int)p.getCurrent(),(int)p.getSize());
 }
 public MonitorEnvVO environment(Long farmId,int hours){
  if(farmId==null)throw new BusinessException(400,"请选择监测农场");Farm f=farms.selectById(farmId);if(f==null)throw new BusinessException(404,"农场不存在");
  return sensors.monitorEnv(f.getTenantId(),farmId,null,hours);
 }
 public PageResult<Map<String,Object>> alertPage(int page,int limit,Long farmId,String status){
  var w=new LambdaQueryWrapper<AlertRecord>().eq(farmId!=null,AlertRecord::getFarmId,farmId).eq(!text(status).isEmpty(),AlertRecord::getStatus,status).orderByDesc(AlertRecord::getCreateTime);
  var p=alerts.selectPage(new Page<AlertRecord>(Math.max(1,page),size(limit)),w);
  return PageResult.of(p.getRecords().stream().map(a->{var m=names(a.getFarmId(),a.getPlotId());m.put("alert",a);return m;}).toList(),p.getTotal(),(int)p.getCurrent(),(int)p.getSize());
 }
 public Map<String,Object> devicePage(String authorization,int page,int limit,String keyword,String type,String status,Long farmId){
  var query=new LinkedHashMap<String,Object>();if(!text(keyword).isEmpty())query.put("keyword",keyword.trim());
  var rows=devices.listDevices(authorization,query).stream().map(IotDeviceVO::ofIot).filter(Objects::nonNull)
   .filter(d->farmId==null||String.valueOf(farmId).equals(String.valueOf(d.getFarmId())))
   .filter(d->text(type).isEmpty()||text(type).equals(String.valueOf(d.getDeviceType())))
   .filter(d->text(status).isEmpty()||("low".equals(status)?d.getBattery()!=null&&d.getBattery()<=20:status.equals(String.valueOf(d.getOnlineStatus())))).toList();
  var farmIds=rows.stream().map(IotDeviceVO::getFarmId).filter(x->x!=null&&x.matches("\\d+")).map(Long::valueOf).distinct().toList();
  var plotIds=rows.stream().map(IotDeviceVO::getPlotId).filter(x->x!=null&&x.matches("\\d+")).map(Long::valueOf).distinct().toList();
  Map<String,String> farmNames=new HashMap<>(),plotNames=new HashMap<>();
  if(!farmIds.isEmpty())for(Farm f:farms.selectBatchIds(farmIds))farmNames.put(String.valueOf(f.getId()),f.getFarmName());
  if(!plotIds.isEmpty())for(Plot p:plots.selectBatchIds(plotIds))plotNames.put(String.valueOf(p.getId()),p.getPlotName());
  rows.forEach(d->{d.setFarmName(farmNames.get(d.getFarmId()));d.setPlotName(plotNames.get(d.getPlotId()));});
  int count=rows.size(),n=size(limit),start=Math.min(count,(Math.max(1,page)-1)*n);
  var result=new LinkedHashMap<String,Object>();result.put("list",rows.subList(start,Math.min(count,start+n)));result.put("total",count);result.put("pageNum",Math.max(1,page));result.put("pageSize",n);
  result.put("online",rows.stream().filter(d->Integer.valueOf(1).equals(d.getOnlineStatus())).count());result.put("offline",rows.stream().filter(d->Integer.valueOf(2).equals(d.getOnlineStatus())).count());result.put("fault",rows.stream().filter(d->Integer.valueOf(3).equals(d.getOnlineStatus())).count());return result;
 }
}
