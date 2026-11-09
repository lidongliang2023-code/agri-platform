package com.agri.production.service;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;
@Service
@RequiredArgsConstructor
public class GradeReviewService {
 private final GradeReviewMapper reviews;
 private final P2tDiffTicketMapper tickets;
 private final P2tOfferMapper offers;
 private final HarvestBatchMapper batches;
 private final InspectionMapper inspections;
 private static final List<String> GRADES=List.of("A","B","C","D");
 public record Apply(Long ticketId, Long inspectionId, String reviewedGrade, String reason) {}
 public record Decision(boolean approved, String remark) {}
 private static void require(boolean valid,String message) { if(!valid) throw new BusinessException(400,message); }
 private static boolean text(String s) {return s!=null&&!s.isBlank();}
 private static void scope(String tenant) {require(text(tenant),"缺少当前经营主体");}
 private P2tDiffTicket ticket(Long id,String tenant) {
  scope(tenant);
  P2tDiffTicket t=tickets.selectOne(new LambdaQueryWrapper<P2tDiffTicket>().eq(P2tDiffTicket::getId,id).eq(P2tDiffTicket::getTenantId,tenant).last("FOR UPDATE"));
  require(t!=null,"当前主体下差异工单不存在");
  require("GRADE_DOWN".equals(t.getDiffType())&&"PRODUCTION".equals(t.getOwnerSide())&&"PROCESSING".equals(t.getStatus()),"仅支持生产侧处理中等级降级工单");
  require(text(t.getOrderNo())&&text(t.getOfferNo()),"工单缺少原订单或供给关联");return t;
 }
 private P2tOffer offer(P2tDiffTicket t,String tenant) {
  P2tOffer o=offers.selectOne(new LambdaQueryWrapper<P2tOffer>().eq(P2tOffer::getTenantId,tenant).eq(P2tOffer::getOfferNo,t.getOfferNo()));
  require(o!=null&&o.getBatchId()!=null,"原供给单或批次关联不存在");return o;
 }
 private Inspection inspection(Long id,Long batch,String tenant) {
  Inspection i=inspections.selectById(id);
  require(i!=null&&tenant.equals(i.getTenantId())&&Objects.equals(batch,i.getBatchId())&&"DONE".equals(i.getStatus())&&"PASS".equals(i.getResult()),"复核必须关联同主体同批次已完成且合格的检测单");return i;
 }
 public PageResult<GradeReview> page(int page,int size,Long ticketId,String tenant) {
  scope(tenant);page=Math.max(1,page);size=Math.max(1,Math.min(100,size));
  var w=new LambdaQueryWrapper<GradeReview>().eq(GradeReview::getTenantId,tenant).eq(ticketId!=null,GradeReview::getTicketId,ticketId).orderByDesc(GradeReview::getId);
  Page<GradeReview> p=reviews.selectPage(new Page<>(page,size),w);return PageResult.of(p.getRecords(),p.getTotal(),page,size);
 }
 @Transactional(rollbackFor=Exception.class)
 public GradeReview apply(Apply a,String tenant,String actor) {
  require(a!=null&&a.ticketId()!=null&&a.inspectionId()!=null,"请选择工单和检测单");require(text(actor),"缺少已认证操作人");
  require(text(a.reason())&&a.reason().trim().length()<=500,"请填写不超过500字的复核依据");
  P2tDiffTicket t=ticket(a.ticketId(),tenant);P2tOffer o=offer(t,tenant);
  require(reviews.selectCount(new LambdaQueryWrapper<GradeReview>().eq(GradeReview::getTenantId,tenant).eq(GradeReview::getTicketId,t.getId()).in(GradeReview::getStatus,List.of("PENDING","APPROVED","CONSUMED")))==0,"该工单已有有效复核申请");
  HarvestBatch batch=batches.selectById(o.getBatchId());require(batch!=null&&tenant.equals(batch.getTenantId()),"当前主体下批次不存在");
  String old=batch.getGrade(),grade=a.reviewedGrade();
  require(GRADES.contains(old)&&GRADES.contains(grade)&&GRADES.indexOf(grade)>GRADES.indexOf(old),"复核后等级必须低于原批次等级（A至D）");
  Inspection i=inspection(a.inspectionId(),batch.getBatchId(),tenant);
  GradeReview v=new GradeReview();v.setTenantId(tenant);v.setReviewNo("GR"+UUID.randomUUID().toString().replace("-", "").toUpperCase());
  v.setTicketId(t.getId());v.setTicketNo(t.getTicketNo());v.setOfferNo(t.getOfferNo());v.setOrderNo(t.getOrderNo());v.setBatchId(batch.getBatchId());v.setOriginalGrade(old);v.setReviewedGrade(grade);v.setInspectionId(i.getInspectionId());v.setInspectionNo(i.getInspectionNo());v.setReason(a.reason().trim());v.setApplicantId(actor);v.setStatus("PENDING");v.setCreateTime(LocalDateTime.now());
  require(reviews.insert(v)==1,"复核申请保存失败");return v;
 }
 @Transactional(rollbackFor=Exception.class)
 public GradeReview decide(Long id,Decision d,String tenant,String actor) {
  scope(tenant);require(text(actor),"缺少已认证操作人");require(d!=null&&text(d.remark())&&d.remark().trim().length()<=500,"请填写不超过500字的确认意见");
  GradeReview first=reviews.selectOne(new LambdaQueryWrapper<GradeReview>().eq(GradeReview::getId,id).eq(GradeReview::getTenantId,tenant));require(first!=null,"复核记录不存在");
  P2tDiffTicket t=ticket(first.getTicketId(),tenant);
  GradeReview v=reviews.selectOne(new LambdaQueryWrapper<GradeReview>().eq(GradeReview::getId,id).eq(GradeReview::getTenantId,tenant).last("FOR UPDATE"));
  require(v!=null&&"PENDING".equals(v.getStatus()),"复核已处理，请刷新");require(!actor.equals(v.getApplicantId()),"申请人不可确认自己的复核");
  if(d.approved()) validate(v,t,offer(t,tenant),tenant);
  v.setStatus(d.approved()?"APPROVED":"REJECTED");v.setReviewerId(actor);v.setReviewRemark(d.remark().trim());v.setReviewedAt(LocalDateTime.now());require(reviews.updateById(v)==1,"确认失败");return v;
 }
 private void validate(GradeReview v,P2tDiffTicket t,P2tOffer o,String tenant) {
  require(Objects.equals(v.getTicketId(),t.getId())&&Objects.equals(v.getTicketNo(),t.getTicketNo())&&Objects.equals(v.getOfferNo(),t.getOfferNo())&&Objects.equals(v.getOrderNo(),t.getOrderNo())&&Objects.equals(v.getBatchId(),o.getBatchId()),"复核与原工单、供给、订单或批次不一致");
  HarvestBatch batch=batches.selectById(v.getBatchId());require(batch!=null&&tenant.equals(batch.getTenantId())&&Objects.equals(batch.getGrade(),v.getOriginalGrade()),"批次原等级已变化，请重新复核");
  require(GRADES.contains(v.getOriginalGrade())&&GRADES.contains(v.getReviewedGrade())&&GRADES.indexOf(v.getReviewedGrade())>GRADES.indexOf(v.getOriginalGrade()),"无效降级结论");inspection(v.getInspectionId(),v.getBatchId(),tenant);
 }
 /** 调用方已持有工单锁；凭据核销与工单关闭属于同一事务。 */
 @Transactional(rollbackFor=Exception.class)
 public void consume(String no,P2tDiffTicket t,P2tOffer o,String tenant) {
  scope(tenant);require(tenant.equals(t.getTenantId())&&"GRADE_DOWN".equals(t.getDiffType())&&"PROCESSING".equals(t.getStatus())&&"PRODUCTION".equals(t.getOwnerSide()),"工单不满足等级复核关闭条件");
  GradeReview v=reviews.selectOne(new LambdaQueryWrapper<GradeReview>().eq(GradeReview::getTenantId,tenant).eq(GradeReview::getReviewNo,no).last("FOR UPDATE"));
  require(v!=null&&"APPROVED".equals(v.getStatus())&&text(v.getReviewerId())&&!v.getReviewerId().equals(v.getApplicantId()),"凭据未通过双人确认或已核销");
  validate(v,t,o,tenant);v.setStatus("CONSUMED");v.setConsumedAt(LocalDateTime.now());require(reviews.updateById(v)==1,"凭据核销失败");
 }
}
