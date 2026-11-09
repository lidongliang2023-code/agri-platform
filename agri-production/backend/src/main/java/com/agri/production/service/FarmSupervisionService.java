package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.vo.FarmVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** 农场监管与用户整改共用生产域台账，平台运营不代替经营主体提交整改。 */
@Service
public class FarmSupervisionService {
 private final FarmMapper farms;
 private final FarmComplianceCheckMapper checks;
 private final PlotMapper plots;
 public FarmSupervisionService(FarmMapper farms,FarmComplianceCheckMapper checks,PlotMapper plots){this.farms=farms;this.checks=checks;this.plots=plots;}
 public Farm owned(Long id,String tenant){
  Farm f=id==null?null:farms.selectById(id);
  if(f==null || (tenant!=null&&!tenant.equals(f.getTenantId())))throw new BusinessException(404,"当前范围下农场不存在");
  return f;
 }
 public PageResult<FarmVO> farms(int page,int size,String keyword,String tenant,String status){
  var w=new LambdaQueryWrapper<Farm>();
  if(keyword!=null&&!keyword.isBlank())w.and(x->x.like(Farm::getFarmName,keyword.trim()).or().like(Farm::getFarmCode,keyword.trim()));
  w.eq(tenant!=null&&!tenant.isBlank(),Farm::getTenantId,tenant).eq(status!=null&&!status.isBlank(),Farm::getStatus,status).orderByDesc(Farm::getId);
  var p=farms.selectPage(new Page<>(Math.max(1,page),Math.min(100,Math.max(1,size))),w);
  return PageResult.of(FarmVO.listOf(p.getRecords()),p.getTotal(),(int)p.getCurrent(),(int)p.getSize());
 }
 public Map<String,Object> detail(Long id){
  Farm f=owned(id,null); var out=new LinkedHashMap<String,Object>();out.put("farm",FarmVO.of(f));
  out.put("plotCount",plots.selectCount(new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId,f.getTenantId()).eq(Plot::getFarmId,id)));
  var all=checks.selectList(new LambdaQueryWrapper<FarmComplianceCheck>().eq(FarmComplianceCheck::getFarmId,id).eq(FarmComplianceCheck::getTenantId,f.getTenantId()));
  out.put("checkCount",all.size());out.put("openCount",all.stream().filter(c->c.getCheckResult()!=null&&c.getCheckResult()>1&&!"rectified".equals(c.getRectifyStatus())).count());
  out.put("reviewCount",all.stream().filter(c->"reviewing".equals(c.getRectifyStatus())).count());return out;
 }
 public PageResult<FarmComplianceCheck> checks(int page,int size,Long farmId,String tenant,String status,Integer result){
  if(farmId!=null)owned(farmId,tenant);
  var w=new LambdaQueryWrapper<FarmComplianceCheck>().eq(farmId!=null,FarmComplianceCheck::getFarmId,farmId).eq(tenant!=null,FarmComplianceCheck::getTenantId,tenant)
   .eq(status!=null&&!status.isBlank(),FarmComplianceCheck::getRectifyStatus,status).eq(result!=null,FarmComplianceCheck::getCheckResult,result).orderByDesc(FarmComplianceCheck::getId);
  var p=checks.selectPage(new Page<>(Math.max(1,page),Math.min(100,Math.max(1,size))),w);
  return PageResult.of(p.getRecords(),p.getTotal(),(int)p.getCurrent(),(int)p.getSize());
 }
 private FarmComplianceCheck locked(String code,String tenant){
  var c=checks.selectOne(new LambdaQueryWrapper<FarmComplianceCheck>().eq(FarmComplianceCheck::getCheckCode,code).last("LIMIT 1 FOR UPDATE"));
  if(c==null||(tenant!=null&&!tenant.equals(c.getTenantId())))throw new BusinessException(404,"当前范围下检查记录不存在");
  owned(c.getFarmId(),c.getTenantId());return c;
 }
 public FarmComplianceCheck get(String code,String tenant){
  var c=checks.selectOne(new LambdaQueryWrapper<FarmComplianceCheck>().eq(FarmComplianceCheck::getCheckCode,code));
  if(c==null||(tenant!=null&&!tenant.equals(c.getTenantId())))throw new BusinessException(404,"当前范围下检查记录不存在");
  owned(c.getFarmId(),c.getTenantId());return c;
 }
 public static String text(Object v,String field,int max){String s=v==null?"":String.valueOf(v).trim();if(s.isEmpty()||s.length()>max)throw new BusinessException(400,field+"必填，且不超过"+max+"字");return s;}
 public static void requireTransition(String action,String state){
  boolean ok=switch(action){case "submit"->Set.of("pending","processing","overdue").contains(Objects.toString(state,""));case "approve","reject"->"reviewing".equals(state);default->false;};
  if(!ok)throw new BusinessException(409,"记录状态已变化，请刷新后操作");
 }
 @Transactional(rollbackFor=Exception.class)
 public FarmComplianceCheck create(Map<String,Object> body,String actor){
  Long id;int result;try{id=Long.valueOf(String.valueOf(body.get("farmId")));result=Integer.parseInt(String.valueOf(body.get("result")));}catch(Exception e){throw new BusinessException(400,"请选择农场和检查结论");}
  Farm farm=owned(id,null);if(result<1||result>3)throw new BusinessException(400,"检查结论无效");
  var c=new FarmComplianceCheck();c.setFarmId(id);c.setFarmName(farm.getFarmName());c.setTenantId(farm.getTenantId());
  c.setCheckCode("FC"+UUID.randomUUID().toString().replace("-",""));c.setCheckType(text(body.get("checkType"),"检查类型",32));c.setCheckItem(text(body.get("checkItem"),"检查事项与依据",200));c.setCheckResult(result);
  c.setCheckerName(text(actor,"检查人",50));c.setCheckedAt(LocalDateTime.now());c.setRectifyStatus(result==1?"none":"pending");
  if(result>1){c.setProblemDesc(text(body.get("problem"),"问题事实",500));c.setRectifyRequirement(text(body.get("rectifyRequirement"),"整改要求",500));
   try{c.setRectifyDeadline(LocalDate.parse(String.valueOf(body.get("rectifyDeadline"))));}catch(Exception e){throw new BusinessException(400,"请填写有效整改期限");}
   if(c.getRectifyDeadline().isBefore(LocalDate.now()))throw new BusinessException(400,"整改期限不能早于今天");}
  c.setDeleted(0);c.setCreateTime(LocalDateTime.now());c.setUpdateTime(LocalDateTime.now());checks.insert(c);return get(c.getCheckCode(),null);
 }
 @Transactional(rollbackFor=Exception.class)
 public FarmComplianceCheck submit(String code,String tenant,String remark,String actor){
  var c=locked(code,tenant);requireTransition("submit",c.getRectifyStatus());
  if(c.getCheckResult()==null||c.getCheckResult()<2)throw new BusinessException(409,"该检查不需要整改");
  c.setRectifyRemark(append(c.getRectifyRemark(),"整改提交",text(remark,"整改结果与凭据说明",500),actor));c.setRectifyStatus("reviewing");c.setUpdateTime(LocalDateTime.now());checks.updateById(c);return get(code,tenant);
 }
 @Transactional(rollbackFor=Exception.class)
 public FarmComplianceCheck review(String code,boolean approved,String remark,String actor){
  var c=locked(code,null);requireTransition(approved?"approve":"reject",c.getRectifyStatus());
  c.setRectifyRemark(append(c.getRectifyRemark(),approved?"复核通过":"退回整改",text(remark,"复核事实与依据",500),actor));c.setRectifyStatus(approved?"rectified":"processing");
  c.setRectifiedAt(approved?LocalDateTime.now():null);c.setUpdateTime(LocalDateTime.now());checks.updateById(c);return get(code,null);
 }
 private String append(String history,String action,String remark,String actor){
  String value=(history==null?"":history+"\n")+LocalDateTime.now()+" · "+actor+" · "+action+"："+remark;
  // 现有字段为 TEXT；保留完整历史，超过保守容量明确拒绝。
  if(value.length()>500)throw new BusinessException(400,"处置历史已达到容量，请联系运营归档");return value;
 }
}
