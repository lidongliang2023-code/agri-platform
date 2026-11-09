package com.agri.info.integration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;

/** 绿色供应链服务编排；不替代生产台账、机构认证及法定核查。 */
@Service
public class GreenSupplyService {
    private final JdbcTemplate jdbc; private final ObjectMapper json;
    public GreenSupplyService(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
    private static final Set<String> TYPES=Set.of("factor","project","certificate","consultation");
    private void type(String t){if(!TYPES.contains(t))throw new IllegalArgumentException("业务类型无效");}
    private String text(Map<String,Object>b,String key,int max,boolean required){return CloudFactoryService.text(b,key,max,required);}
    private Map<String,Object> unpack(Map<String,Object> row){try{var b=json.readValue(row.get("payload").toString(),new TypeReference<Map<String,Object>>(){});for(String k:List.of("id","kind","owner_id","status","revision","created_at","updated_at"))b.put(k,row.get(k));if("certificate".equals(row.get("kind")))b.put("expired",LocalDate.parse(b.get("validUntil").toString()).isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai"))));return b;}catch(Exception e){throw new IllegalStateException("绿色服务记录读取失败",e);}}
    private Map<String,Object> row(long id,String kind,String owner){type(kind);var rows=jdbc.queryForList("SELECT * FROM info_green_record WHERE id=? AND kind=?"+(owner==null?"":" AND owner_id=?")+" FOR UPDATE",owner==null?new Object[]{id,kind}:new Object[]{id,kind,owner});if(rows.isEmpty())throw new IllegalArgumentException("记录不存在");return rows.get(0);}
    public List<Map<String,Object>> list(String kind,String owner,boolean publicOnly){type(kind);if(publicOnly&&!Set.of("factor","certificate").contains(kind))throw new IllegalArgumentException("该记录不公开");List<Object>a=new ArrayList<>();a.add(kind);String sql="SELECT * FROM info_green_record WHERE kind=?";if(owner!=null){sql+=" AND owner_id=?";a.add(owner);}if(publicOnly)sql+=" AND status='published'";sql+=" ORDER BY id DESC LIMIT 500";return jdbc.queryForList(sql,a.toArray()).stream().map(this::unpack).map(b->{if(publicOnly){b.remove("owner_id");b.remove("reviewNote");b.remove("actor");b.remove("history");b.remove("handledBy");}return b;}).toList();}
    private String encode(Map<String,Object>b){try{return json.writeValueAsString(b);}catch(Exception e){throw new IllegalArgumentException("数据格式错误",e);}}
    private BigDecimal number(Map<String,Object>b,String key,boolean positive){try{BigDecimal n=new BigDecimal(Objects.toString(b.get(key),""));if(n.scale()>9||n.precision()>24||n.signum()<0||(positive&&n.signum()==0))throw new Exception();return n;}catch(Exception e){throw new IllegalArgumentException(key+"须为有效"+(positive?"正数":"非负数")+"，最多9位小数");}}
    private LocalDate date(Map<String,Object>b,String key){try{return LocalDate.parse(text(b,key,10,true));}catch(Exception e){throw new IllegalArgumentException(key+"须为YYYY-MM-DD格式日期");}}
    private void evidence(String s){CloudFactoryService.mediaUrl(s);}
    private void audit(String actor,String action,long id){jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",actor,action,"绿色供应链#"+id,"绿色服务操作");}
    @Transactional public Map<String,Object> save(String kind,long id,Map<String,Object>b,String actor,boolean ops){
        type(kind);if("factor".equals(kind)&&!ops)throw new IllegalArgumentException("排放因子由运营维护");
        if(id<0)throw new IllegalArgumentException("记录编号无效");
        Map<String,Object>old=id==0?null:row(id,kind,ops?null:actor);int revision=old==null?0:((Number)old.get("revision")).intValue();
        if(!Objects.toString(b.get("revision"),"0").equals(String.valueOf(revision)))throw new IllegalArgumentException("记录已变更，请刷新");
        if(old!=null&&!Set.of("draft","returned").contains(old.get("status")))throw new IllegalArgumentException("请先退回或撤回后编辑");
        Map<String,Object>d=new LinkedHashMap<>();d.put("title",text(b,"title",120,true));d.put("actor",actor);
        switch(kind){
            case "factor" -> {for(String k:List.of("activity","unit","scope","version","reference","validFrom","validUntil"))d.put(k,text(b,k,k.equals("reference")?1500:300,true));d.put("value",number(b,"value",false));if(!Set.of("scope1","scope2","scope3").contains(d.get("scope")))throw new IllegalArgumentException("排放范围无效");evidence(d.get("reference").toString());if(date(d,"validUntil").isBefore(date(d,"validFrom")))throw new IllegalArgumentException("因子有效期倒置");d.put("outputUnit","kgCO2e");}
            case "project" -> {
                for(String k:List.of("enterprise","boundary","methodology","periodStart","periodEnd"))d.put(k,text(b,k,2000,true));
                if(date(d,"periodEnd").isBefore(date(d,"periodStart")))throw new IllegalArgumentException("核算期间倒置");
                if(!(b.get("items") instanceof List<?>items)||items.isEmpty()||items.size()>100)throw new IllegalArgumentException("请提供1至100条活动记录");
                List<Map<String,Object>>lines=new ArrayList<>();BigDecimal total=BigDecimal.ZERO;Map<String,BigDecimal>scopes=new LinkedHashMap<>();
                for(Object raw:items){if(!(raw instanceof Map<?,?>))throw new IllegalArgumentException("活动格式无效");@SuppressWarnings("unchecked") Map<String,Object>i=(Map<String,Object>)raw;Map<String,Object>x=new LinkedHashMap<>();
                    long factorId;try{factorId=Long.parseLong(Objects.toString(i.get("factorId")));}catch(Exception e){throw new IllegalArgumentException("请选择排放因子");}
                    var f=unpack(row(factorId,"factor",null));if(!"published".equals(f.get("status")))throw new IllegalArgumentException("因子尚未发布");
                    for(String k:List.of("name","unit","domain","sourceRef","evidence","observedOn"))x.put(k,text(i,k,k.equals("evidence")?1500:300,true));
                    if(!Set.of("production","iot","logistics","trade","manual").contains(x.get("domain")))throw new IllegalArgumentException("活动来源域无效");
                    LocalDate day=date(x,"observedOn");if(day.isBefore(date(d,"periodStart"))||day.isAfter(date(d,"periodEnd"))||day.isBefore(date(f,"validFrom"))||day.isAfter(date(f,"validUntil")))throw new IllegalArgumentException("活动日期须在核算期间和因子有效期内");
                    if(!Objects.equals(x.get("unit"),f.get("unit")))throw new IllegalArgumentException("活动单位须与因子单位一致；不自动换算");evidence(x.get("evidence").toString());
                    BigDecimal amount=number(i,"amount",true),emission=amount.multiply(new BigDecimal(f.get("value").toString()));total=total.add(emission);String scope=f.get("scope").toString();scopes.merge(scope,emission,BigDecimal::add);
                    x.put("amount",amount);x.put("emissionKg",emission);x.put("factorId",factorId);x.put("factorSnapshot",f);lines.add(x);
                }
                d.put("items",lines);d.put("scopeTotalsKg",scopes);d.put("totalKg",total);d.put("totalTonnes",total.divide(new BigDecimal("1000"),9,RoundingMode.HALF_UP));d.put("limitations",text(b,"limitations",2000,true));d.put("calculatedAt",LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString());
            }
            case "certificate" -> {for(String k:List.of("enterprise","certificateNo","issuer","standard","scope","validFrom","validUntil","evidence","verifyUrl"))d.put(k,text(b,k,1500,true));if(date(d,"validUntil").isBefore(date(d,"validFrom")))throw new IllegalArgumentException("证书有效期倒置");evidence(d.get("evidence").toString());evidence(d.get("verifyUrl").toString());}
            case "consultation" -> {for(String k:List.of("enterprise","service","contact","phone","demand"))d.put(k,text(b,k,2000,true));if(!Set.of("accounting","report","certification","reduction").contains(d.get("service")))throw new IllegalArgumentException("咨询服务类型无效");}
        }
        if(old!=null){var prior=unpack(old);if(prior.containsKey("history"))d.put("history",prior.get("history"));}
        if(old==null){var kh=new org.springframework.jdbc.support.GeneratedKeyHolder();jdbc.update(c->{var p=c.prepareStatement("INSERT INTO info_green_record(kind,owner_id,status,revision,payload) VALUES(?,?,'draft',1,?)",java.sql.Statement.RETURN_GENERATED_KEYS);p.setString(1,kind);p.setString(2,actor);p.setString(3,encode(d));return p;},kh);id=Objects.requireNonNull(kh.getKey()).longValue();}
        else jdbc.update("UPDATE info_green_record SET payload=?,status='draft',revision=revision+1,updated_at=? WHERE id=?",encode(d),LocalDateTime.now().toString(),id);
        if(old==null){String now=LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString();jdbc.update("UPDATE info_green_record SET created_at=?,updated_at=? WHERE id=?",now,now,id);}
        audit(actor,"保存绿色服务"+kind,id);return unpack(row(id,kind,ops?null:actor));
    }
    @Transactional public Map<String,Object> exportReport(long id,int revision,String actor,boolean ops){
        var r=row(id,"project",ops?null:actor);
        if(((Number)r.get("revision")).intValue()!=revision)throw new IllegalArgumentException("报告已更新，请刷新后重新导出");
        var d=unpack(r);String html=GreenReportRenderer.render(d);
        audit(actor,"导出碳报告 版本"+revision+" 状态"+r.get("status"),id);
        return Map.of("html",html,"filename","碳报告-GS-"+id+"-v"+revision+".html","revision",revision,"status",r.get("status"));
    }
    @Transactional public Map<String,Object> transition(String kind,long id,Map<String,Object>b,String actor,boolean ops){
        var r=row(id,kind,ops?null:actor);var d=unpack(r);String from=r.get("status").toString(),to=text(b,"status",30,true),note=text(b,"note",1000,true);
        if(!Objects.toString(b.get("revision"),"").equals(r.get("revision").toString()))throw new IllegalArgumentException("记录已更新，请刷新");
        boolean allowed=false;
        if("consultation".equals(kind))allowed=(Set.of("draft","returned").contains(from)&&"submitted".equals(to))||("submitted".equals(from)&&"cancelled".equals(to))||(ops&&(("submitted".equals(from)&&Set.of("accepted","returned").contains(to))||("accepted".equals(from)&&"completed".equals(to))));
        else allowed=(Set.of("draft","returned").contains(from)&&"review".equals(to))||(ops&&(("review".equals(from)&&Set.of("published","returned").contains(to))||("published".equals(from)&&"returned".equals(to))));
        if(!allowed)throw new IllegalArgumentException("当前状态不支持此操作");
        if("published".equals(to)&&actor.equals(d.get("actor")))throw new IllegalArgumentException("编写人与审核人须不同");
        if("published".equals(to)&&"certificate".equals(kind)&&date(d,"validUntil").isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai"))))throw new IllegalArgumentException("证书已过期，不可发布");
        if("published".equals(to)&&"factor".equals(kind)&&date(d,"validUntil").isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai"))))throw new IllegalArgumentException("因子已过期，不可发布");
        d.remove("expired");d.put("reviewNote",note);d.put("handledBy",actor);if("published".equals(to))d.put("publishedAt",LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString());
        List<Map<String,Object>>history=new ArrayList<>();if(d.get("history") instanceof List<?>h)for(Object x:h){@SuppressWarnings("unchecked") var entry=(Map<String,Object>)x;history.add(entry);}history.add(Map.of("from",from,"to",to,"actor",actor,"note",note,"at",LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString()));d.put("history",history);
        jdbc.update("UPDATE info_green_record SET payload=?,status=?,revision=revision+1,updated_at=? WHERE id=?",encode(d),to,LocalDateTime.now().toString(),id);audit(actor,"流转绿色服务 "+from+" → "+to,id);return unpack(row(id,kind,ops?null:actor));
    }
}
