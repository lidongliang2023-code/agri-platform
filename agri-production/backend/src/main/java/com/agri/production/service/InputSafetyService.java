package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** 安全依据、推荐审计与实际台账核对；不创建任务、不操作库存。 */
@Service
public class InputSafetyService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public InputSafetyService(JdbcTemplate db,ObjectMapper json) { this.db=db; this.json=json; }

    @Transactional
    public Map<String,Object> check(String tenant,Map<String,Object> request,String operator) {
        String rid=text(request,"requestId",64,true), crop=text(request,"cropName",100,true), target=text(request,"targetName",191,true), region=text(request,"region",100,true);
        LocalDate app=date(request.get("applicationDate"),true), harvest=date(request.get("harvestDate"),false);
        if (harvest!=null && harvest.isBefore(app)) fail("采收日期不能早于施用日期");
        var previous=db.queryForList("SELECT id,request_json FROM agri_prod_input_recommendation WHERE tenant_id=? AND request_id=?",tenant,rid);
        if(!previous.isEmpty()) {
            if(!decode(previous.get(0).get("request_json")).equals(request)) throw new BusinessException(409,"同一请求编号不能用于不同校验内容");
            var old=detail(tenant,str(previous.get(0).get("id"))); var result=new LinkedHashMap<>(map(old.get("result")));
            result.put("id",old.get("id")); result.put("requestId",rid); result.put("createdAt",old.get("created_at")); return result;
        }
        List<String> mix=ids(request.get("mixInputIds")), recent=ids(request.get("recentInputIds"));
        Set<String> selected=new LinkedHashSet<>(mix);selected.addAll(recent);
        for(String id:selected) material(tenant,id);
        var candidates=db.queryForList("SELECT * FROM agri_prod_input_safety_rule WHERE tenant_id=? AND crop_name=? AND target_name=? AND status='ACTIVE' ORDER BY id",tenant,crop,target);
        List<Map<String,Object>> available=new ArrayList<>(), blocks=new ArrayList<>(), warnings=new ArrayList<>();
        var restrictions=rules(tenant,"restrictions");
        boolean catalogueFresh=restrictions.stream().anyMatch(r->"ACTIVE".equals(r.get("status")) && "CATALOG".equals(r.get("restriction_type")) && fresh(evidence(r)) && region.equals(str(evidence(r).get("region"))));
        for(var rule:candidates) {
            var c=candidate(rule); List<String> reasons=new ArrayList<>(); var e=evidence(rule);
            if(!validRule(rule,app) || !(region.equals(str(e.get("region"))) || "全国".equals(str(e.get("region"))))) reasons.add("登记字段、有效期或来源证据缺失/失效");
            if(!catalogueFresh) reasons.add("属地禁限用名录未核验或已超过7天，须刷新依据");
            Map<String,Object> mat=null;
            if(rule.get("input_id")==null) reasons.add("规则未绑定投入品档案");
            else { try {mat=material(tenant,str(rule.get("input_id")));} catch(BusinessException ex) {reasons.add("投入品档案已停用或不可用");} }
            if(mat!=null && !str(mat.get("registration_no")).equals(str(rule.get("registration_no")))) reasons.add("规则登记证号与投入品档案不一致");
            for(var r:restrictions) if("ACTIVE".equals(r.get("status")) && !"CATALOG".equals(r.get("restriction_type")) && matches(r,rule) && effective(r,app) && (region.equals(str(evidence(r).get("region"))) || "全国".equals(str(evidence(r).get("region"))))) reasons.add("命中禁限用名录："+r.get("reason"));
            if(harvest==null) reasons.add("缺少计划采收日期，不能核验安全间隔");
            else if(rule.get("safety_interval_days")!=null && ChronoUnit.DAYS.between(app,harvest)<number(rule.get("safety_interval_days")).longValue()) reasons.add("距采收不足登记安全间隔，须调整施用或采收日期后重查");
            Set<String> combination=new LinkedHashSet<>(mix); combination.add(str(rule.get("input_id")));
            var conflicts=compatibility(tenant,combination); if(!conflicts.isEmpty()) {reasons.add("拟混用组合命中配伍禁忌"); warnings.addAll(conflicts);}
            if(combination.size()>1) {
                boolean allRegistered=combination.stream().allMatch(id->candidates.stream().anyMatch(r->id.equals(str(r.get("input_id"))) && validRule(r,app)));
                if(!allRegistered) reasons.add("拟混用投入品缺少当前作物与靶标的有效登记依据");
                // 无禁忌记录不等于已证明混配安全。
                reasons.add("混配安全未获专门核验，仅支持单剂推荐；请逐个单剂校验");
            }
            if(mat!=null && !recent.isEmpty()) {
                String ingredients=str(e.get("ingredients")), group=str(rule.get("rotation_group"));
                if(recent.contains(str(rule.get("input_id")))) {reasons.add("近期使用过同一投入品，需核验使用次数与轮换");}
                else for(String id:recent) { var recentRules=db.queryForList("SELECT * FROM agri_prod_input_safety_rule WHERE tenant_id=? AND input_id=? AND status='ACTIVE'",tenant,Long.valueOf(id));
                    if(recentRules.isEmpty() || recentRules.stream().anyMatch(rr->str(evidence(rr).get("ingredients")).isBlank() || str(rr.get("rotation_group")).isBlank())) reasons.add("近期用药成分或作用机制依据缺失，须人工核验轮换");
                    for(var rr:recentRules) {
                    Set<String> a=ingredients(ingredients), b=ingredients(str(evidence(rr).get("ingredients"))); a.retainAll(b);
                    if(!a.isEmpty() || (!group.isBlank() && group.equals(str(rr.get("rotation_group"))))) reasons.add("近期用药存在相同成分或作用机制，需轮换复核");
                }}
            }
            c.put("evidence",e); c.put("reason",reasons.isEmpty()?"登记范围、名录与安全间隔校验通过":String.join("；",new LinkedHashSet<>(reasons)));
            c.put("status",reasons.isEmpty()?"AVAILABLE":"BLOCKED");
            (reasons.isEmpty()?available:blocks).add(c);
        }
        if(candidates.isEmpty()) blocks.add(Map.of("status","REJECTED","reason","没有当前作物与靶标的有效登记规则，拒绝经验推荐"));
        String state=available.isEmpty()?(candidates.isEmpty()?"REJECTED":"BLOCKED"):(blocks.isEmpty()?"PASSED":"NEEDS_REVIEW");
        Map<String,Object> result=new LinkedHashMap<>();result.put("state",state);result.put("cropName",crop);result.put("targetName",target);
        result.put("recommendations",available);result.put("blocked",blocks);result.put("compatibility",warnings);result.put("ruleCount",candidates.size());
        result.put("restrictionSnapshot",restrictions); result.put("retentionUntil",LocalDate.now().plusYears(2).toString());
        result.put("notice","仅为基于登记依据的单剂建议，不替代标签与专业复核；混配须专门核验并先小面积试喷。实际使用在原投入品台账登记。");
        String id=UUID.randomUUID().toString(); LocalDateTime now=LocalDateTime.now();
        db.update("INSERT INTO agri_prod_input_recommendation(id,tenant_id,request_id,crop_name,target_name,application_date,harvest_date,request_json,result_json,state,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",id,tenant,rid,crop,target,java.sql.Date.valueOf(app),harvest==null?null:java.sql.Date.valueOf(harvest),encode(request),encode(result),state,operator,now,now);
        event(tenant,id,"CHECK",result,operator);result.put("id",id);result.put("requestId",rid);result.put("createdAt",now.toString()); return result;
    }

    static boolean validRegistration(Map<String,Object> r,LocalDate app) { return baseValid(r,map(r.get("_evidence")),app); }
    private static boolean baseValid(Map<String,Object> r,Map<String,Object> e,LocalDate app) {
        try {
            for(String k:List.of("registration_no","input_name","dosage_unit","application_method","source","source_version")) if(str(r.get(k)).isBlank()) return false;
            if(str(r.get("source_version")).startsWith("DEMO-")) return false;
            if(number(r.get("dosage_min")).signum()<=0 || number(r.get("dosage_max")).compareTo(number(r.get("dosage_min")))<0 || number(r.get("safety_interval_days")).signum()<0) return false;
            for(String k:List.of("validFrom","validUntil","verifiedOn","ingredients","region")) if(str(e.get(k)).isBlank()) return false;
            LocalDate from=LocalDate.parse(str(e.get("validFrom"))), until=LocalDate.parse(str(e.get("validUntil"))), verified=LocalDate.parse(str(e.get("verifiedOn")));
            return !app.isBefore(from) && !app.isAfter(until) && !verified.isAfter(LocalDate.now());
        }catch(RuntimeException ex){return false;}
    }
    private boolean validRule(Map<String,Object> r,LocalDate d){return baseValid(r,evidence(r),d);}
    static boolean fresh(Map<String,Object> e) {
        try {LocalDate d=LocalDate.parse(str(e.get("verifiedOn")));return !d.isAfter(LocalDate.now()) && !d.isBefore(LocalDate.now().minusDays(7)) && !str(e.get("region")).isBlank() && !str(e.get("sourceVersion")).isBlank();}catch(RuntimeException ex){return false;}
    }
    public List<Map<String,Object>> rules(String tenant,String kind){return db.queryForList("SELECT * FROM "+table(kind)+" WHERE tenant_id=? ORDER BY id DESC LIMIT 500",tenant).stream().map(r->{r.put("evidence",evidence(r));return r;}).toList();}
    @Transactional
    public Map<String,Object> saveRule(String tenant,String kind,Map<String,Object> p,String operator) {
        String t=table(kind), status=text(p,"status",24,true); if(!List.of("DRAFT","ACTIVE","INACTIVE").contains(status)) fail("规则状态无效");
        String id=text(p,"id",32,false);Map<String,Object> row=new LinkedHashMap<>();
        var e=map(p.get("evidence")); row.put("evidence_json",encode(e));row.put("status",status);
        if(kind.equals("registration")) {
            String inputId=text(p,"input_id",32,true);var mat=material(tenant,inputId);
            row.put("input_id",Long.valueOf(inputId));row.put("input_name",mat.get("material_name"));
            for(String k:List.of("crop_name","target_name","registration_no","dosage_unit","application_method","rotation_group","source","source_version")) row.put(k,text(p,k,k.equals("source")?500:100,k.equals("crop_name")||k.equals("target_name")||k.equals("source")));
            for(String k:List.of("dosage_min","dosage_max","safety_interval_days")) row.put(k,p.get(k)==null?null:number(p.get(k)));
            if("ACTIVE".equals(status) && (!baseValid(row,e,LocalDate.now()) || !str(mat.get("registration_no")).equals(str(row.get("registration_no"))))) fail("启用失败：登记字段不完整、失效或证号与档案不一致");
            if(row.get("safety_interval_days")!=null && number(row.get("safety_interval_days")).stripTrailingZeros().scale()>0)fail("安全间隔天数必须为整数");
            row.put("created_by",operator);row.put("updated_at",LocalDateTime.now());
        } else if(kind.equals("restrictions")) {
            String type=text(p,"restriction_type",32,true);if(!List.of("FORBIDDEN","RESTRICTED","CATALOG").contains(type)) fail("名录类型无效");
            row.put("restriction_type",type);row.put("input_id",optionalInput(tenant,p.get("input_id")));row.put("input_name",text(p,"input_name",191,false));
            for(String k:List.of("reason","source"))row.put(k,text(p,k,500,true));
            row.put("effective_date",date(p.get("effective_date"),false));row.put("expires_at",date(p.get("expires_at"),false));
            if("ACTIVE".equals(status) && (!fresh(e) || (!type.equals("CATALOG") && row.get("input_id")==null && str(row.get("input_name")).isBlank()))) fail("启用名录须提供属地、版本、7天内核验日期及投入品匹配依据");
        } else {
            row.put("input_id",optionalInput(tenant,p.get("input_id")));row.put("other_input_id",optionalInput(tenant,p.get("other_input_id")));
            row.put("reason",text(p,"reason",500,true));row.put("source",text(p,"source",500,true));row.put("alternative",text(p,"alternative",500,false));
            if(row.get("input_id")==null || row.get("other_input_id")==null || row.get("input_id").equals(row.get("other_input_id")))fail("请选择两个不同的有效投入品");
            if("ACTIVE".equals(status) && (str(e.get("sourceVersion")).isBlank() || str(e.get("verifiedOn")).isBlank()))fail("启用配伍规则须提供版本与核验日期");
        }
        if(id.isBlank()) {row.put("tenant_id",tenant);String columns=String.join(",",row.keySet());db.update("INSERT INTO "+t+"("+columns+") VALUES("+String.join(",",Collections.nCopies(row.size(),"?"))+")",row.values().toArray());id=String.valueOf(db.queryForObject("SELECT LAST_INSERT_ID()",Long.class));}
        else {var args=new ArrayList<>(row.values());args.add(tenant);args.add(Long.valueOf(id));int n=db.update("UPDATE "+t+" SET "+String.join(",",row.keySet().stream().map(k->k+"=?").toList())+" WHERE tenant_id=? AND id=?",args.toArray());if(n==0)throw new BusinessException(404,"规则不存在");}
        db.update("INSERT INTO agri_prod_input_safety_revision(tenant_id,kind,rule_id,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)",tenant,kind,Long.valueOf(id),encode(row),operator,LocalDateTime.now());return Map.of("id",id,"status",status);
    }
    private Long optionalInput(String tenant,Object id){if(str(id).isBlank())return null;material(tenant,str(id));return Long.valueOf(str(id));}
    private String table(String k){return switch(k){case "registration"->"agri_prod_input_safety_rule";case "restrictions"->"agri_prod_input_restriction";case "compatibility"->"agri_prod_input_compatibility";default->throw new BusinessException(400,"未知规则类型");};}
    private Map<String,Object> material(String tenant,String id){long n;try{n=Long.parseLong(id);}catch(RuntimeException e){throw new BusinessException(400,"投入品编号无效");}var r=db.queryForList("SELECT * FROM agri_prod_input_material WHERE tenant_id=? AND id=? AND deleted=0 AND status=1",tenant,n);if(r.isEmpty())throw new BusinessException(404,"投入品档案不可用");return r.get(0);}
    private List<Map<String,Object>> compatibility(String tenant,Set<String> ids){List<Map<String,Object>> out=new ArrayList<>();for(var r:rules(tenant,"compatibility"))if("ACTIVE".equals(r.get("status")) && ids.contains(str(r.get("input_id"))) && ids.contains(str(r.get("other_input_id")))) {var hit=new LinkedHashMap<>(r);hit.put("status","BLOCKED");out.add(hit);}return out;}
    private boolean matches(Map<String,Object> r,Map<String,Object> c){return r.get("input_id")!=null?str(r.get("input_id")).equals(str(c.get("input_id"))):!str(r.get("input_name")).isBlank() && (str(r.get("input_name")).equals(str(c.get("input_name"))) || ingredients(str(evidence(c).get("ingredients"))).contains(str(r.get("input_name"))));}
    private boolean effective(Map<String,Object> r,LocalDate d){return (r.get("effective_date")==null || !d.isBefore(LocalDate.parse(str(r.get("effective_date"))))) && (r.get("expires_at")==null || !d.isAfter(LocalDate.parse(str(r.get("expires_at")))));}
    private static Set<String> ingredients(String s){return new HashSet<>(Arrays.asList(s.split("[,，、;；]")));}
    public Map<String,Object> list(String tenant,int page,int size,String state){int p=Math.max(1,page),s=Math.min(50,Math.max(1,size));String where=" WHERE tenant_id=?";List<Object>a=new ArrayList<>(List.of(tenant));if(state!=null&&!state.isBlank()){where+=" AND state=?";a.add(state);}Long total=db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_recommendation"+where,Long.class,a.toArray());a.add(s);a.add((p-1)*s);return Map.of("list",db.queryForList("SELECT id,crop_name,target_name,state,created_by,created_at FROM agri_prod_input_recommendation"+where+" ORDER BY created_at DESC LIMIT ? OFFSET ?",a.toArray()),"total",total==null?0:total,"pageNum",p,"pageSize",s);}
    public Map<String,Object> detail(String tenant,String id){var rows=db.queryForList("SELECT * FROM agri_prod_input_recommendation WHERE tenant_id=? AND id=?",tenant,id);if(rows.isEmpty())throw new BusinessException(404,"安全校验记录不存在");var r=new LinkedHashMap<>(rows.get(0));r.put("request",decode(r.remove("request_json")));r.put("result",decode(r.remove("result_json")));r.put("events",db.queryForList("SELECT event_type,payload_json,operator,created_at FROM agri_prod_input_recommendation_event WHERE tenant_id=? AND recommendation_id=? ORDER BY id",tenant,id));return r;}
    @Transactional
    public Map<String,Object> compareActual(String tenant,String id,Map<String,Object> p,String operator){
        var record=detail(tenant,id);String usage=text(p,"usageId",32,true);
        var rows=db.queryForList("SELECT * FROM agri_prod_input_usage WHERE tenant_id=? AND id=? AND deleted=0 AND status=1",tenant,Long.valueOf(usage));if(rows.isEmpty())throw new BusinessException(404,"有效用药台账不存在");
        var actual=rows.get(0);var expected=map(record.get("result"));List<String> reasons=new ArrayList<>();Map<String,Object> match=null;
        for(Object c:list(expected.get("recommendations"))) {var v=map(c);if(str(actual.get("input_id")).equals(str(v.get("inputId"))))match=v;}
        if(actual.get("plot_id")==null) reasons.add("用药台账缺少地块，无法核验作物范围");
        else {var plots=db.queryForList("SELECT current_crop FROM agri_prod_plot_info WHERE tenant_id=? AND id=? AND deleted=0",tenant,actual.get("plot_id"));
            if(plots.isEmpty() || !str(record.get("crop_name")).equals(str(plots.get(0).get("current_crop")))) reasons.add("台账地块作物与本次推荐不一致或缺少可信作物依据");}
        if(match==null)reasons.add("实际投入品未在本次可用候选内，可能存在超登记范围风险");
        else {
            if(!str(actual.get("used_at")).startsWith(str(record.get("application_date"))))reasons.add("实际施用日期与校验日期不一致，须重新校验安全间隔");
            if(!str(actual.get("method")).equals(str(match.get("applicationMethod"))))reasons.add("实际施用方式与登记方式不一致");
            if(!str(actual.get("unit")).equals(str(match.get("dosageUnit"))))reasons.add("台账总量与登记剂量单位不一致，不能自动换算，须人工复核");
            else if(number(actual.get("dosage")).compareTo(number(match.get("dosageMin")))<0 || number(actual.get("dosage")).compareTo(number(match.get("dosageMax")))>0)reasons.add("实际剂量超出登记范围");
        }
        var out=new LinkedHashMap<String,Object>();out.put("matched",reasons.isEmpty());out.put("usageId",usage);out.put("actualSnapshot",actual);out.put("reasons",reasons);out.put("message",reasons.isEmpty()?"本次台账与推荐字段一致；仍需遵守标签与专业复核":"存在差异，已进入用药安全待复核清单");
        if(!reasons.isEmpty())db.update("INSERT INTO agri_prod_input_safety_risk(id,tenant_id,recommendation_id,usage_id,state,payload_json,created_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE state='OPEN',payload_json=VALUES(payload_json),review_note=NULL,reviewed_by=NULL,reviewed_at=NULL",UUID.randomUUID().toString(),tenant,id,Long.valueOf(usage),"OPEN",encode(out),LocalDateTime.now());
        event(tenant,id,"ACTUAL_USAGE_COMPARE",out,operator);return out;
    }
    public List<Map<String,Object>> risks(String tenant){return db.queryForList("SELECT * FROM agri_prod_input_safety_risk WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200",tenant);}
    @Transactional
    public Map<String,Object> reviewRisk(String tenant,String id,Map<String,Object> p,String operator){String note=text(p,"note",2000,true);var rows=db.queryForList("SELECT recommendation_id FROM agri_prod_input_safety_risk WHERE tenant_id=? AND id=? FOR UPDATE",tenant,id);if(rows.isEmpty())throw new BusinessException(404,"风险记录不存在");db.update("UPDATE agri_prod_input_safety_risk SET state='REVIEWED',review_note=?,reviewed_by=?,reviewed_at=? WHERE tenant_id=? AND id=?",note,operator,LocalDateTime.now(),tenant,id);event(tenant,str(rows.get(0).get("recommendation_id")),"RISK_REVIEW",Map.of("riskId",id,"note",note),operator);return Map.of("state","REVIEWED");}
    private Map<String,Object> candidate(Map<String,Object> r){Map<String,Object>c=new LinkedHashMap<>();String[][]keys={{"ruleId","id"},{"inputId","input_id"},{"inputName","input_name"},{"registrationNo","registration_no"},{"dosageMin","dosage_min"},{"dosageMax","dosage_max"},{"dosageUnit","dosage_unit"},{"applicationMethod","application_method"},{"safetyIntervalDays","safety_interval_days"},{"rotationGroup","rotation_group"},{"source","source"},{"sourceVersion","source_version"}};for(var k:keys)c.put(k[0],r.get(k[1]));return c;}
    private Map<String,Object> evidence(Map<String,Object> r){return r.get("evidence_json")==null?Map.of():decode(r.get("evidence_json"));}
    private void event(String tenant,String id,String type,Object p,String operator){db.update("INSERT INTO agri_prod_input_recommendation_event(tenant_id,recommendation_id,event_type,payload_json,operator,created_at) VALUES(?,?,?,?,?,?)",tenant,id,type,encode(p),operator,LocalDateTime.now());}
    private String encode(Object v){try{return json.writeValueAsString(v);}catch(Exception e){throw new BusinessException(500,"安全校验快照写入失败");}}
    private Map<String,Object> decode(Object s){try{return json.readValue(str(s),new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new BusinessException(500,"安全校验快照读取失败");}}
    @SuppressWarnings("unchecked") private static Map<String,Object> map(Object v){return v instanceof Map<?,?>?(Map<String,Object>)v:Map.of();}
    private static List<?> list(Object v){return v instanceof List<?> l?l:List.of();}
    private static String str(Object v){return v==null?"":String.valueOf(v).trim();}
    private static String text(Map<String,Object> p,String k,int max,boolean required){String s=str(p.get(k));if((required&&s.isBlank())||s.length()>max)throw new BusinessException(400,"字段缺失或超长："+k);return s;}
    private static BigDecimal number(Object v){try{return new BigDecimal(str(v));}catch(Exception e){throw new BusinessException(400,"数值字段无效");}}
    private static LocalDate date(Object v,boolean required){String s=str(v);if(s.isBlank()&&!required)return null;try{return LocalDate.parse(s);}catch(Exception e){throw new BusinessException(400,"日期须为yyyy-MM-dd");}}
    private static List<String> ids(Object v){if(v==null)return List.of();if(!(v instanceof List<?> l)||l.size()>20)throw new BusinessException(400,"投入品列表过长或格式无效");return l.stream().map(x->{String s=str(x);try{Long.parseLong(s);}catch(Exception e){throw new BusinessException(400,"投入品编号无效");}return s;}).distinct().toList();}
    private static void fail(String s){throw new BusinessException(400,s);}
}
