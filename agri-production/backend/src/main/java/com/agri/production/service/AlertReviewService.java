package com.agri.production.service;

import com.agri.production.common.constant.AlertDict;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.vo.UserAlertVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class AlertReviewService {
    private final JdbcTemplate jdbc;
    private final AlertRecordMapper alerts;
    private final FarmIdResolver farms;
    private final ObjectMapper json;
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    public AlertReviewService(JdbcTemplate jdbc, AlertRecordMapper alerts, FarmIdResolver farms, ObjectMapper json) {
        this.jdbc=jdbc; this.alerts=alerts; this.farms=farms; this.json=json;
    }
    private AlertRecord require(String tenant, String code, boolean lock) {
        if (tenant==null || tenant.isBlank()) throw new BusinessException(403,"缺少经营主体");
        AlertRecord alert=alerts.selectOne(new LambdaQueryWrapper<AlertRecord>().eq(AlertRecord::getTenantId,tenant)
            .eq(AlertRecord::getAlertCode,code).last(lock?"LIMIT 1 FOR UPDATE":"LIMIT 1"));
        if(alert==null) throw new BusinessException(404,"告警不存在或不属于当前主体");
        return alert;
    }
    public UserAlertVO alert(String tenant,String code){return UserAlertVO.of(require(tenant,code,false));}
    private List<Map<String,Object>> history(String tenant,Long id){
        return jdbc.queryForList("SELECT revision, request_id AS requestId, review_status AS reviewStatus, root_cause AS rootCause, effectiveness, prevention, evidence, follow_up_owner AS followUpOwner, CAST(follow_up_date AS CHAR) AS followUpDate, reviewer_id AS reviewerId, CAST(reviewed_at AS CHAR) AS reviewedAt, alert_snapshot AS alertSnapshot FROM agri_prod_alert_review WHERE tenant_id=? AND alert_id=? ORDER BY revision DESC",tenant,id);
    }
    public Map<String,Object> detail(String tenant,String code){
        AlertRecord a=require(tenant,code,false);
        return Map.of("alert",UserAlertVO.of(a),"history",history(tenant,a.getId()),"eligible",List.of(3,4).contains(AlertDict.codeOfStatus(a.getStatus())));
    }
    public Map<String,Object> list(String tenant,String farmId,String status,int page,int size){
        if(tenant==null||tenant.isBlank())throw new BusinessException(403,"缺少经营主体");
        if(!List.of("ALL","PENDING","FOLLOW_UP","VERIFIED","OVERDUE").contains(status))throw new BusinessException(400,"复盘筛选无效");
        List<Object> args=new ArrayList<>();args.add(tenant);
        String base=" FROM agri_prod_alert_record a LEFT JOIN agri_prod_alert_review r ON r.tenant_id=a.tenant_id AND r.alert_id=a.id AND r.revision=(SELECT MAX(r2.revision) FROM agri_prod_alert_review r2 WHERE r2.tenant_id=a.tenant_id AND r2.alert_id=a.id) WHERE a.tenant_id=? AND a.deleted=0 AND a.status IN (";
        List<String> states=new ArrayList<>(AlertDict.statusValuesOf(3));states.addAll(AlertDict.statusValuesOf(4));
        base+=String.join(",",Collections.nCopies(states.size(),"?"))+")";args.addAll(states);
        if(farmId!=null&&!farmId.isBlank()){Long local=farms.resolveFilter(farmId,tenant);if(local==null)throw new BusinessException(400,"农场无效");base+=" AND a.farm_id=?";args.add(local);}
        String today=LocalDate.now(ZONE).toString();
        Map<String,Object> summary=jdbc.queryForMap("SELECT COUNT(*) AS total, COALESCE(SUM(r.id IS NULL),0) AS pending, COALESCE(SUM(r.review_status='FOLLOW_UP'),0) AS followUp, COALESCE(SUM(r.review_status='VERIFIED'),0) AS verified, COALESCE(SUM(r.review_status='FOLLOW_UP' AND r.follow_up_date<'"+today+"'),0) AS overdue"+base,args.toArray());
        String where=switch(status){case "PENDING"->" AND r.id IS NULL";case "FOLLOW_UP","VERIFIED"->" AND r.review_status=?";case "OVERDUE"->" AND r.review_status='FOLLOW_UP' AND r.follow_up_date<'"+today+"'";default->"";};
        if(List.of("FOLLOW_UP","VERIFIED").contains(status))args.add(status);
        Long total=jdbc.queryForObject("SELECT COUNT(*)"+base+where,Long.class,args.toArray());
        int p=Math.max(1,page),s=Math.max(1,Math.min(100,size));args.add(s);args.add((long)(p-1)*s);
        var rows=jdbc.queryForList("SELECT a.alert_code AS alertId,a.title AS alertTitle,a.handle_result AS handleRemark,CAST(a.handle_time AS CHAR) AS handledAt,COALESCE(r.review_status,'PENDING') AS reviewStatus,COALESCE(r.revision,0) AS revision,r.follow_up_owner AS followUpOwner,CAST(r.follow_up_date AS CHAR) AS followUpDate"+base+where+" ORDER BY a.handle_time DESC,a.id DESC LIMIT ? OFFSET ?",args.toArray());
        return Map.of("list",rows,"total",total==null?0:total,"summary",summary,"pageNum",p,"pageSize",s);
    }
    public static Map<String,Object> validate(Map<String,Object> body,LocalDate today){
        if(body==null)throw new BusinessException(400,"请填写复盘内容");
        Map<String,Object> v=new LinkedHashMap<>();
        for(String key:List.of("rootCause","effectiveness","prevention","evidence"))v.put(key,text(body,key,1000,true));
        String state=text(body,"reviewStatus",24,true);
        if(!List.of("FOLLOW_UP","VERIFIED").contains(state))throw new BusinessException(400,"请选择仍需跟进或已验证");
        v.put("reviewStatus",state);
        String request=text(body,"requestId",64,true);
        if(!request.matches("[A-Za-z0-9_-]{8,64}"))throw new BusinessException(400,"请求标识无效，请刷新复盘页");
        v.put("requestId",request);
        Object raw=body.get("expectedRevision");
        try{int revision=Integer.parseInt(String.valueOf(raw));if(revision<0)throw new NumberFormatException();v.put("expectedRevision",revision);}catch(Exception e){throw new BusinessException(400,"复盘版本无效，请重新加载");}
        if(state.equals("FOLLOW_UP")){
            v.put("followUpOwner",text(body,"followUpOwner",100,true));
            try{LocalDate date=LocalDate.parse(text(body,"followUpDate",10,true));if(date.isBefore(today))throw new IllegalArgumentException();v.put("followUpDate",date.toString());}catch(Exception e){throw new BusinessException(400,"跟进日期不得早于今天，格式为 yyyy-MM-dd");}
        }else{v.put("followUpOwner",null);v.put("followUpDate",null);}
        return v;
    }
    private static String text(Map<String,Object> body,String key,int max,boolean required){
        Object raw=body.get(key);String s=raw instanceof String?((String)raw).trim():"";
        if((required&&s.isBlank())||s.length()>max)throw new BusinessException(400,"复盘字段 "+key+" 必填且不能超过 "+max+" 字");return s;
    }
    @Transactional(rollbackFor=Exception.class)
    public Map<String,Object> save(String tenant,String code,Map<String,Object> body){
        var v=validate(body,LocalDate.now(ZONE));
        AlertRecord a=require(tenant,code,true);
        if(!List.of(3,4).contains(AlertDict.codeOfStatus(a.getStatus())))throw new BusinessException(409,"请先完成告警处置或忽略，再登记复盘");
        String user=TenantContextService.currentUserId();if(user==null||user.isBlank())throw new BusinessException(403,"无法核实复盘人身份");
        var rows=history(tenant,a.getId());
        for(var row:rows)if(v.get("requestId").equals(row.get("requestId"))){
            boolean same=Objects.equals(user,row.get("reviewerId"));
            for(String key:List.of("rootCause","effectiveness","prevention","evidence","reviewStatus","followUpOwner","followUpDate"))same&=Objects.equals(v.get(key),row.get(key));
            if(!same)throw new BusinessException(409,"同一请求标识的复盘内容不一致，请重新加载");
            return detail(tenant,code);
        }
        int current=rows.isEmpty()?0:((Number)rows.get(0).get("revision")).intValue();
        if(current!=(Integer)v.get("expectedRevision"))throw new BusinessException(409,"复盘已被更新，请重新加载后复核");
        String snapshot;
        try{snapshot=json.writeValueAsString(UserAlertVO.of(a));}catch(JsonProcessingException e){throw new BusinessException(500,"告警快照保存失败");}
        jdbc.update("INSERT INTO agri_prod_alert_review (tenant_id,alert_id,revision,request_id,review_status,root_cause,effectiveness,prevention,evidence,follow_up_owner,follow_up_date,reviewer_id,reviewed_at,alert_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            tenant,a.getId(),current+1,v.get("requestId"),v.get("reviewStatus"),v.get("rootCause"),v.get("effectiveness"),v.get("prevention"),v.get("evidence"),v.get("followUpOwner"),v.get("followUpDate"),user,LocalDateTime.now(ZONE),snapshot);
        return detail(tenant,code);
    }
}
