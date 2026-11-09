package com.agri.info.integration;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;

/** 验厂服务报告，不代替生产台账、检测报告或认证结论。 */
@Service
public class FactoryVisitReportService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public FactoryVisitReportService(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
    private Map<String,Object> visit(long id,String owner){
        var rows=jdbc.queryForList("SELECT v.*,f.name AS factoryName,f.enterprise,f.region FROM info_cloud_factory_visit v JOIN info_cloud_factory f ON f.id=v.factory_id WHERE v.id=?"+(owner==null?"":" AND v.owner_id=?")+" FOR UPDATE",owner==null?new Object[]{id}:new Object[]{id,owner});
        if(rows.isEmpty())throw new IllegalArgumentException("预约不存在");return rows.get(0);
    }
    @Transactional
    public Map<String,Object> get(long id,String owner){
        visit(id,owner);
        var rows=jdbc.queryForList("SELECT * FROM info_cloud_factory_report WHERE visit_id=?"+(owner==null?"":" AND status='published'"),id);
        if(rows.isEmpty())return Map.of("status","empty");
        var row=rows.get(0);
        try{var result=json.readValue(row.get("payload").toString(),new TypeReference<Map<String,Object>>(){});
            result.put("status",row.get("status"));result.put("revision",row.get("revision"));result.put("reportNo","VRR-"+id);
            for(String key:List.of("author","reviewer","review_note","published_at")) result.put(key,row.get(key));
            return result;
        }catch(Exception e){throw new IllegalStateException("报告内容读取失败",e);}
    }
    @Transactional
    public Map<String,Object> save(long id,Map<String,Object>b,String actor){
        var v=visit(id,null);
        if(!Set.of("confirmed","completed").contains(v.get("status")))throw new IllegalArgumentException("仅已确认或已完成预约可编写报告");
        var existing=jdbc.queryForList("SELECT * FROM info_cloud_factory_report WHERE visit_id=?",id);
        int revision=existing.isEmpty()?0:((Number)existing.get(0).get("revision")).intValue();
        if(!Objects.toString(b.get("revision"),"0").equals(String.valueOf(revision)))throw new IllegalArgumentException("报告已被更新，请关闭后重新打开");
        if(!existing.isEmpty()&&Set.of("review","published").contains(existing.get(0).get("status")))throw new IllegalArgumentException("审核中或已发布报告不可编辑，请先退回或撤回");
        Map<String,Object> data=new LinkedHashMap<>();
        for(String key:List.of("title","inspector","inspectedAt","method","scope","summary","limitations","followUp"))data.put(key,CloudFactoryService.text(b,key,key.equals("title")||key.equals("inspector")?120:2000,Set.of("title","inspector","inspectedAt","method","scope","summary","limitations").contains(key)));
        try{var time=LocalDateTime.parse(data.get("inspectedAt").toString().replace(' ','T'));if(time.isAfter(LocalDateTime.now(ZoneId.of("Asia/Shanghai"))))throw new Exception();}catch(Exception e){throw new IllegalArgumentException("实际核验时间须为有效且不晚于当前的北京时间");}
        if(!Set.of("video","materials","combined").contains(data.get("method")))throw new IllegalArgumentException("请选择核验方式");
        String conclusion=CloudFactoryService.text(b,"conclusion",30,true);
        if(!Set.of("consistent","rectification","insufficient").contains(conclusion))throw new IllegalArgumentException("报告结论无效");data.put("conclusion",conclusion);
        if(!(b.get("items") instanceof List<?> items)||items.isEmpty()||items.size()>30)throw new IllegalArgumentException("请填写1至30项核验记录");
        List<Map<String,Object>> checked=new ArrayList<>();
        for(Object raw:items){if(!(raw instanceof Map<?,?>))throw new IllegalArgumentException("核验项格式无效");@SuppressWarnings("unchecked") var item=(Map<String,Object>)raw;
            Map<String,Object> entry=new LinkedHashMap<>();
            for(String key:List.of("name","result","finding","evidence","action","dueDate"))entry.put(key,CloudFactoryService.text(item,key,key.equals("evidence")?1500:1000,Set.of("name","result","finding").contains(key)));
            if(!Set.of("consistent","issue","unverified","na").contains(entry.get("result")))throw new IllegalArgumentException("核验项结果无效");
            if(!entry.get("evidence").toString().isEmpty())CloudFactoryService.mediaUrl(entry.get("evidence").toString());
            if(!entry.get("dueDate").toString().isEmpty())try{java.time.LocalDate.parse(entry.get("dueDate").toString());}catch(Exception e){throw new IllegalArgumentException("整改期限格式须为YYYY-MM-DD");}
            if("issue".equals(entry.get("result"))&&(entry.get("action").toString().isBlank()||entry.get("dueDate").toString().isBlank()))throw new IllegalArgumentException("存在问题的核验项须填写整改要求及期限");
            if("consistent".equals(entry.get("result"))&&entry.get("evidence").toString().isBlank())throw new IllegalArgumentException("核验一致的项目须提供证据地址");checked.add(entry);
        }
        if("consistent".equals(conclusion)&&checked.stream().anyMatch(x->Set.of("issue","unverified").contains(x.get("result"))))throw new IllegalArgumentException("存在问题或未核验项目，不能选择核验范围内一致");
        data.put("items",checked);data.put("factoryName",v.get("factoryName"));data.put("enterprise",v.get("enterprise"));data.put("region",v.get("region"));data.put("purpose",v.get("purpose"));data.put("visitId",id);
        String payload;try{payload=json.writeValueAsString(data);}catch(Exception e){throw new IllegalArgumentException("报告序列化失败",e);}
        if(existing.isEmpty())jdbc.update("INSERT INTO info_cloud_factory_report(visit_id,payload,status,revision,author) VALUES(?,?,'draft',1,?)",id,payload,actor);
        else jdbc.update("UPDATE info_cloud_factory_report SET payload=?,status='draft',revision=revision+1,author=?,reviewer='',review_note='',published_at=NULL WHERE visit_id=?",payload,actor,id);
        audit(actor,"保存验厂报告",id,"版本 "+(revision+1));return get(id,null);
    }
    @Transactional
    public Map<String,Object> transition(long id,Map<String,Object>b,String actor){
        var v=visit(id,null);var rows=jdbc.queryForList("SELECT * FROM info_cloud_factory_report WHERE visit_id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new IllegalArgumentException("请先保存报告");var row=rows.get(0);String from=row.get("status").toString(),to=CloudFactoryService.text(b,"status",20,true),note=CloudFactoryService.text(b,"note",1000,true);
        if(!Objects.toString(b.get("revision"),"").equals(row.get("revision").toString()))throw new IllegalArgumentException("报告已更新，请重新打开");
        boolean allowed=(Set.of("draft","returned").contains(from)&&"review".equals(to))||("review".equals(from)&&Set.of("returned","published").contains(to))||("published".equals(from)&&"returned".equals(to));
        if(!allowed)throw new IllegalArgumentException("当前报告状态不允许此操作");
        if("review".equals(from)&&actor.equals(row.get("author")))throw new IllegalArgumentException("报告编写人与审核人须为不同运营人员");
        if("published".equals(to)&&!"completed".equals(v.get("status")))throw new IllegalArgumentException("预约完成后才能发布报告");
        jdbc.update("UPDATE info_cloud_factory_report SET status=?,revision=revision+1,reviewer=?,review_note=?,published_at=? WHERE visit_id=?",to,"review".equals(to)?"":actor,note,"published".equals(to)?LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString():null,id);
        audit(actor,"变更验厂报告状态",id,from+" → "+to+"；"+note);return get(id,null);
    }
    private void audit(String actor,String action,long id,String detail){jdbc.update("INSERT INTO info_audit_log(operator_name,action_name,target_name,detail) VALUES(?,?,?,?)",actor,action,"验厂报告#"+id,detail);}
}
