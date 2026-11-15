package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 产后初加工工艺优化：保存推荐快照、人工确认、下发记录、过程纠偏和成品结果。
 * 批次、设备、质检事实仍由原模块维护，本服务不伪造 PLC 执行结果或修改质检结论。
 */
@Service
public class ProcessOptimizationService {
    private final JdbcTemplate db;
    private final ObjectMapper json;

    public ProcessOptimizationService(JdbcTemplate db, ObjectMapper json) {
        this.db = db;
        this.json = json;
    }

    public Map<String,Object> list(String tenant, int pageNum, int pageSize, String status) {
        int page = Math.max(1, pageNum), size = Math.min(100, Math.max(1, pageSize));
        String condition = status == null || status.isBlank() ? "" : " AND status=?";
        Object[] args = status == null || status.isBlank()
                ? new Object[]{tenant, size, (page - 1) * size}
                : new Object[]{tenant, status, size, (page - 1) * size};
        List<Map<String,Object>> rows = db.queryForList("SELECT id,batch_no batchNo,category,grade,moisture,uniformity,input_quantity inputQuantity,input_unit inputUnit,rain_affected rainAffected,status,source_version sourceVersion,created_at createdAt,updated_at updatedAt FROM agri_prod_process_optimization WHERE tenant_id=?" + condition + " ORDER BY created_at DESC LIMIT ? OFFSET ?", args);
        Number total = db.queryForObject("SELECT COUNT(*) FROM agri_prod_process_optimization WHERE tenant_id=?" + condition, status == null || status.isBlank() ? new Object[]{tenant} : new Object[]{tenant,status}, Number.class);
        return Map.of("list", rows, "total", total == null ? 0 : total.longValue(), "pageNum", page, "pageSize", size, "pages", (int)Math.ceil((total == null ? 0 : total.doubleValue()) / size));
    }

    public Map<String,Object> detail(String tenant, String id) {
        Map<String,Object> row = one(tenant, id);
        Map<String,Object> view = new LinkedHashMap<>();
        view.put("id", row.get("id")); view.put("batchNo", row.get("batch_no"));
        view.put("batchId", row.get("batch_id")); view.put("category", row.get("category"));
        view.put("grade", row.get("grade")); view.put("moisture", row.get("moisture"));
        view.put("uniformity", row.get("uniformity")); view.put("inputQuantity", row.get("input_quantity"));
        view.put("inputUnit", row.get("input_unit")); view.put("rainAffected", row.get("rain_affected"));
        view.put("equipmentSnapshot", read(row.get("equipment_snapshot_json"), Map.of()));
        view.put("input", read(row.get("input_json"), Map.of()));
        view.put("recommendation", read(row.get("recommendation_json"), Map.of()));
        view.put("status", row.get("status")); view.put("sourceVersion", row.get("source_version"));
        view.put("events", db.queryForList("SELECT event_type eventType,payload_json payload,operator,created_at createdAt FROM agri_prod_process_optimization_event WHERE tenant_id=? AND optimization_id=? ORDER BY id", tenant, id));
        view.put("deviations", db.queryForList("SELECT metric,target_value targetValue,actual_value actualValue,action,operator,created_at createdAt FROM agri_prod_process_optimization_deviation WHERE tenant_id=? AND optimization_id=? ORDER BY id", tenant, id));
        view.put("results", db.queryForList("SELECT final_moisture finalMoisture,broken_rate brokenRate,color_score colorScore,final_grade finalGrade,note,operator,created_at createdAt FROM agri_prod_process_optimization_result WHERE tenant_id=? AND optimization_id=? ORDER BY id DESC", tenant, id));
        return view;
    }

    @Transactional
    public Map<String,Object> infer(String tenant, Map<String,Object> request, String operator) {
        String batchNo = text(request.get("batchNo"));
        String category = text(request.get("category"));
        if (batchNo.isBlank() || category.isBlank()) throw new BusinessException(400, "批次号和品类不能为空");
        Long batchId = longValue(request.get("batchId"));
        Number ownedBatch = batchId == null
                ? db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_batch WHERE tenant_id=? AND batch_no=? AND (deleted IS NULL OR deleted=0)", Number.class, tenant, batchNo)
                : db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_batch WHERE tenant_id=? AND id=? AND batch_no=? AND (deleted IS NULL OR deleted=0)", Number.class, tenant, batchId, batchNo);
        if (ownedBatch == null || ownedBatch.longValue() != 1L) {
            throw new BusinessException(400, "批次不存在、已归档或不属于当前经营主体；工艺优化必须挂在真实批次上");
        }
        BigDecimal moisture = decimal(request.get("moisture"), null);
        BigDecimal uniformity = decimal(request.get("uniformity"), null);
        BigDecimal quantity = decimal(request.get("inputQuantity"), null);
        if (moisture == null || moisture.compareTo(BigDecimal.ZERO) <= 0 || moisture.compareTo(new BigDecimal("100")) >= 0)
            throw new BusinessException(400, "请输入 0-100 之间的鲜料含水率");
        if (uniformity == null || uniformity.compareTo(BigDecimal.ZERO) < 0 || uniformity.compareTo(BigDecimal.ONE) > 0)
            throw new BusinessException(400, "匀度评分必须在 0-1 之间");
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) throw new BusinessException(400, "投入量必须大于 0");
        boolean rain = Boolean.parseBoolean(text(request.get("rainAffected"))) || moisture.compareTo(new BigDecimal("78")) > 0;
        Map<String,Object> equipment = equipment(request);
        boolean mixed = Boolean.parseBoolean(text(request.get("mixedBatch")));
        boolean manual = rain || uniformity.compareTo(new BigDecimal("0.70")) < 0 || mixed;
        BigDecimal adjust = moisture.subtract(new BigDecimal("76")).multiply(new BigDecimal("12"));
        BigDecimal wither = new BigDecimal("3.5").add(adjust.divide(new BigDecimal("60"), 2, RoundingMode.HALF_UP)).max(new BigDecimal("1.5"));
        BigDecimal kill = new BigDecimal("285").add(moisture.subtract(new BigDecimal("75")).multiply(new BigDecimal("3"))).setScale(0, RoundingMode.HALF_UP);
        if (uniformity.compareTo(new BigDecimal("0.70")) < 0) quantity = quantity.multiply(new BigDecimal("0.90")).setScale(2, RoundingMode.HALF_UP);
        Map<String,Object> recommendation = new LinkedHashMap<>();
        recommendation.put("segments", List.of(
                Map.of("name","摊青","durationHours",wither,"target","叶片柔软、失水均匀"),
                Map.of("name","杀青","temperatureC",kill,"durationMinutes",5,"target","抑制酶活、不焦边"),
                Map.of("name","揉捻","pressure","中压 2 段","durationMinutes",18,"target","成条率稳定"),
                Map.of("name","烘干","temperatureCurve","110→85→70°C","targetMoisture",4.5,"target","终水分 4.0-6.0%")
        ));
        recommendation.put("notice", manual ? "该批次需要技术员确认后才能下发：雨后/高含水率、低匀度或混批输入触发人工边界。" : "参数由含水率和匀度调整得到，仅作推荐，关键段需持证操作工确认。");
        recommendation.put("manualRequired", manual);
        recommendation.put("deviceDispatch", allDevicesOnline(equipment));
        recommendation.put("version", "CRAFT-v1.4");
        Map<String,Object> input = new LinkedHashMap<>(request); input.put("rainAffected", rain); input.put("equipment", equipment); input.put("source", "USER_CONFIRMED_BATCH_INPUT");
        String id = UUID.randomUUID().toString(); LocalDateTime now = LocalDateTime.now();
        db.update("INSERT INTO agri_prod_process_optimization(id,tenant_id,batch_id,batch_no,category,grade,moisture,uniformity,input_quantity,input_unit,rain_affected,equipment_snapshot_json,input_json,recommendation_json,status,source_version,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", id, tenant, longValue(request.get("batchId")), batchNo, category, text(request.get("grade")), moisture, uniformity, quantity, textOr(request.get("inputUnit"), "kg"), rain ? 1 : 0, write(equipment), write(input), write(recommendation), manual ? "NEEDS_CONFIRMATION" : "DRAFT", "CRAFT_RULE_V1.4", operator, now, now);
        event(tenant,id,"INFERRED",Map.of("manualRequired",manual,"rainAffected",rain,"sourceVersion","CRAFT_RULE_V1.4"),operator);
        return detail(tenant,id);
    }

    @Transactional public Map<String,Object> confirm(String tenant,String id,Map<String,Object> request,String operator) {
        Map<String,Object> row=one(tenant,id); String status=text(row.get("status"));
        if (!List.of("DRAFT","NEEDS_CONFIRMATION").contains(status)) throw new BusinessException(400,"当前方案不能重复确认");
        boolean approved=Boolean.parseBoolean(text(request.get("approved")));
        if (!approved) { db.update("UPDATE agri_prod_process_optimization SET status='MANUAL_REQUIRED',updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now(),tenant,id); event(tenant,id,"MANUAL_REQUIRED",Map.of("reason",textOr(request.get("reason"),"技术员未确认")),operator); return detail(tenant,id); }
        db.update("UPDATE agri_prod_process_optimization SET status='CONFIRMED',confirmed_by=?,confirmed_at=?,updated_at=? WHERE tenant_id=? AND id=?",operator,LocalDateTime.now(),LocalDateTime.now(),tenant,id); event(tenant,id,"CONFIRMED",Map.of("note",textOr(request.get("note"),"技术员确认推荐参数")),operator); return detail(tenant,id);
    }

    @Transactional public Map<String,Object> dispatch(String tenant,String id,String operator) {
        Map<String,Object> row=one(tenant,id); if (!"CONFIRMED".equals(text(row.get("status")))) throw new BusinessException(400,"参数必须先经技术员确认才能下发");
        Map<String,Object> rec=read(row.get("recommendation_json"),Map.of()); boolean device=Boolean.TRUE.equals(rec.get("deviceDispatch"));
        String next=device ? "DISPATCH_RECORDED" : "MANUAL_SET_REQUIRED";
        db.update("UPDATE agri_prod_process_optimization SET status=?,dispatched_at=?,updated_at=? WHERE tenant_id=? AND id=?",next,LocalDateTime.now(),LocalDateTime.now(),tenant,id); event(tenant,id,device?"DISPATCH_RECORDED":"MANUAL_SET_REQUIRED",Map.of("automatic",device,"note",device?"已记录设备下发请求，实际执行需设备回执":"设备不支持自动下发，请操作工手动设定并回填"),operator); return detail(tenant,id);
    }

    @Transactional public Map<String,Object> deviation(String tenant,String id,Map<String,Object> req,String operator) {
        one(tenant,id); String metric=text(req.get("metric")); String action=text(req.get("action")); if(metric.isBlank()||action.isBlank()) throw new BusinessException(400,"偏离指标和纠偏动作不能为空");
        db.update("INSERT INTO agri_prod_process_optimization_deviation(optimization_id,tenant_id,metric,target_value,actual_value,action,operator,created_at) VALUES(?,?,?,?,?,?,?,?)",id,tenant,metric,textOr(req.get("targetValue"),""),textOr(req.get("actualValue"),""),action,operator,LocalDateTime.now()); event(tenant,id,"DEVIATION",req,operator); return detail(tenant,id);
    }

    @Transactional public Map<String,Object> result(String tenant,String id,Map<String,Object> req,String operator) {
        one(tenant,id); db.update("INSERT INTO agri_prod_process_optimization_result(optimization_id,tenant_id,final_moisture,broken_rate,color_score,final_grade,note,operator,created_at) VALUES(?,?,?,?,?,?,?,?,?)",id,tenant,decimal(req.get("finalMoisture"),null),decimal(req.get("brokenRate"),null),decimal(req.get("colorScore"),null),text(req.get("finalGrade")),text(req.get("note")),operator,LocalDateTime.now()); db.update("UPDATE agri_prod_process_optimization SET status='COMPLETED',updated_at=? WHERE tenant_id=? AND id=?",LocalDateTime.now(),tenant,id); event(tenant,id,"RESULT_RECORDED",req,operator); return detail(tenant,id);
    }

    private boolean allDevicesOnline(Map<String,Object> equipment) { return Boolean.parseBoolean(text(equipment.get("allOnline"))); }
    private Map<String,Object> equipment(Map<String,Object> request) { Map<String,Object> e=new LinkedHashMap<>(); e.put("killers",intValue(request.get("killerCount"),0));e.put("rollers",intValue(request.get("rollerCount"),0));e.put("dryers",intValue(request.get("dryerCount"),0));e.put("allOnline",Boolean.parseBoolean(text(request.get("allDevicesOnline"))));return e; }
    private Map<String,Object> one(String tenant,String id){List<Map<String,Object>> rows=db.queryForList("SELECT * FROM agri_prod_process_optimization WHERE tenant_id=? AND id=?",tenant,id);if(rows.isEmpty())throw new BusinessException(404,"工艺优化方案不存在或不属于当前经营主体");return rows.get(0);}
    private void event(String tenant,String id,String type,Object payload,String operator){db.update("INSERT INTO agri_prod_process_optimization_event(optimization_id,tenant_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)",id,tenant,type,write(payload),operator,LocalDateTime.now());}
    private String write(Object v){try{return json.writeValueAsString(v);}catch(Exception e){throw new BusinessException(500,"工艺方案序列化失败");}}
    private <T>T read(Object v,T f){try{return v==null?f:json.readValue(String.valueOf(v),new TypeReference<T>(){});}catch(Exception e){return f;}}
    private static String text(Object v){return v==null?"":String.valueOf(v).trim();} private static String textOr(Object v,String f){String s=text(v);return s.isBlank()?f:s;}
    private static BigDecimal decimal(Object v,BigDecimal f){try{return v==null||text(v).isBlank()?f:new BigDecimal(text(v));}catch(Exception e){throw new BusinessException(400,"数值格式无效");}}
    private static Long longValue(Object v){try{return v==null||text(v).isBlank()?null:Long.valueOf(text(v));}catch(Exception e){return null;}}
    private static int intValue(Object v,int f){try{return v==null||text(v).isBlank()?f:Integer.parseInt(text(v));}catch(Exception e){return f;}}
}
