package com.agri.government.service;

import com.agri.government.security.GovernmentIdentityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class GovernmentPersonnelService {
    public record Grant(String id, Long personnelId, String scopeId, String status, List<GovernmentScopeService.Region> regions, String validFrom, String validUntil, String basis, Long version) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final GovernmentIdentityService identity;
    public GovernmentPersonnelService(JdbcTemplate jdbc,ObjectMapper json,GovernmentIdentityService identity){this.jdbc=jdbc;this.json=json;this.identity=identity;}
    private static ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
    public List<Map<String,Object>> personnel(){return jdbc.queryForList("SELECT CAST(id AS CHAR) AS id,name,organization,CAST(platform_user_id AS CHAR) AS platformUserId,status FROM gov_user WHERE platform_user_id IS NOT NULL ORDER BY name,id");}
    private Grant decode(String value){try{return json.readValue(value,Grant.class);}catch(Exception e){throw new IllegalStateException("授权记录读取失败",e);}}
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("授权记录序列化失败",e);}}
    public List<Grant> list(){return jdbc.query("SELECT snapshot_json FROM gov_personnel_grant ORDER BY updated_at DESC,id",(r,n)->decode(r.getString(1)));}
    public List<Map<String,Object>> history(String id){return jdbc.queryForList("SELECT version,operator_name,before_json,snapshot_json,created_at FROM gov_personnel_grant_audit WHERE grant_id=? ORDER BY version DESC",id);}
    public static void validate(Grant g,GovernmentScopeService.Scope scope){
        if(g==null||g.personnelId()==null||g.personnelId()<1)throw bad("请选择监管人员");
        if(!Set.of("enabled","disabled").contains(Objects.toString(g.status(),"")))throw bad("授权状态无效");
        if(g.basis()==null||g.basis().isBlank()||g.basis().length()>1000)throw bad("请填写1000字以内的授权依据");
        try{if(LocalDate.parse(g.validUntil()).isBefore(LocalDate.parse(g.validFrom())))throw bad("结束日期不能早于开始日期");}catch(java.time.DateTimeException|NullPointerException e){throw bad("请填写有效的授权起止日期");}
        if(scope==null)throw bad("监管机构不存在");
        if("disabled".equals(g.status()))return;
        if(!"enabled".equals(scope.status()))throw bad("机构登记已停用，不能启用授权");
        if(g.regions()==null||g.regions().isEmpty()||g.regions().size()>100)throw bad("请选择1至100个辖区");
        Set<String> seen=new HashSet<>();
        for(var r:g.regions()){
            if(r==null||!seen.add(r.code()))throw bad("辖区不能为空或重复");
            var allowed=scope.regions().stream().filter(x->x.code().equals(r.code())).findFirst().orElseThrow(()->bad("辖区不在机构登记范围内"));
            if(r.includeChildren()&&!allowed.includeChildren())throw bad("机构未登记下级区域，不能扩大授权");
            if(r.duties()==null||r.duties().isEmpty()||!allowed.duties().containsAll(r.duties()))throw bad("职责超出机构登记范围");
        }
    }
    @Transactional
    public Grant save(String id,Grant body){
        if(body==null)throw bad("授权内容不能为空");
        String actor=identity.operatorName();
        if(actor==null||actor.isBlank())throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"无法识别操作账号");
        var scopes=jdbc.query("SELECT * FROM gov_scope_config WHERE id=? FOR UPDATE",(r,n)->new GovernmentScopeService.Scope(r.getString("id"),r.getString("organization_code"),r.getString("organization_name"),r.getString("status"),readRegions(r.getString("regions_json")),r.getString("note"),r.getLong("version"),r.getString("updated_at")),body.scopeId());
        var scope=scopes.isEmpty()?null:scopes.get(0);
        validate(body,scope);
        var people=jdbc.queryForList("SELECT id,status,platform_user_id FROM gov_user WHERE id=? FOR UPDATE",body.personnelId());
        if(people.isEmpty()||people.get(0).get("platform_user_id")==null)throw bad("人员尚未绑定平台账号");
        if("enabled".equals(body.status())&&!"active".equals(people.get(0).get("status")))throw bad("人员档案已停用");
        String before=null;long version=1;
        if(id!=null){var records=jdbc.queryForList("SELECT snapshot_json,version FROM gov_personnel_grant WHERE id=? FOR UPDATE",id);if(records.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"授权不存在");before=records.get(0).get("snapshot_json").toString();var old=decode(before);if(!Objects.equals(old.personnelId(),body.personnelId())||!Objects.equals(old.scopeId(),body.scopeId()))throw bad("不能更换授权关联的人员或机构，请停用后新建");if(!Objects.equals(old.version(),body.version()))throw new ResponseStatusException(HttpStatus.CONFLICT,"授权已被修改，请刷新后重试");version=old.version()+1;}
        else {if(jdbc.queryForObject("SELECT COUNT(*) FROM gov_personnel_grant WHERE personnel_id=? AND scope_id=?",Long.class,body.personnelId(),body.scopeId())>0)throw bad("该人员在此机构已有授权记录，请编辑原记录");id=UUID.randomUUID().toString();}
        List<GovernmentScopeService.Region> regions=body.regions()==null?List.of():body.regions();
        if("enabled".equals(body.status()))regions=regions.stream().map(r->new GovernmentScopeService.Region(r.code(),scope.regions().stream().filter(x->x.code().equals(r.code())).findFirst().orElseThrow().name(),r.includeChildren(),r.duties().stream().distinct().toList())).toList();
        var saved=new Grant(id,body.personnelId(),body.scopeId(),body.status(),regions,body.validFrom(),body.validUntil(),body.basis().trim(),version);
        String snapshot=encode(saved),now=LocalDateTime.now().toString();
        if(before==null)jdbc.update("INSERT INTO gov_personnel_grant(id,personnel_id,scope_id,version,snapshot_json,updated_at) VALUES(?,?,?,?,?,?)",id,body.personnelId(),body.scopeId(),version,snapshot,now);
        else jdbc.update("UPDATE gov_personnel_grant SET version=?,snapshot_json=?,updated_at=? WHERE id=?",version,snapshot,now,id);
        jdbc.update("INSERT INTO gov_personnel_grant_audit(id,grant_id,version,operator_name,before_json,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?)",UUID.randomUUID().toString(),id,version,actor,before,snapshot,now);
        return saved;
    }
    private List<GovernmentScopeService.Region> readRegions(String value){try{return json.readValue(value,json.getTypeFactory().constructCollectionType(List.class,GovernmentScopeService.Region.class));}catch(Exception e){throw new IllegalStateException("机构范围读取失败",e);}}
    /** 每次按现有机构登记重新校验；停用、到期或缩减机构范围后不保留旧授权。 */
    public List<Grant> effective(long personnelId){
        LocalDate today=LocalDate.now();
        return list().stream().filter(g->Objects.equals(g.personnelId(),personnelId)&&"enabled".equals(g.status())).filter(g->{
            if(today.isBefore(LocalDate.parse(g.validFrom()))||today.isAfter(LocalDate.parse(g.validUntil())))return false;
            if(jdbc.queryForObject("SELECT COUNT(*) FROM gov_user WHERE id=? AND status='active' AND platform_user_id IS NOT NULL",Long.class,personnelId)==0)return false;
            var scopes=jdbc.query("SELECT * FROM gov_scope_config WHERE id=?",(r,n)->new GovernmentScopeService.Scope(r.getString("id"),r.getString("organization_code"),r.getString("organization_name"),r.getString("status"),readRegions(r.getString("regions_json")),r.getString("note"),r.getLong("version"),r.getString("updated_at")),g.scopeId());
            try{validate(g,scopes.isEmpty()?null:scopes.get(0));return true;}catch(ResponseStatusException e){return false;}
        }).toList();
    }
    /** 仅当前人员的授权诊断，不向移动端暴露其他人员登记。 */
    public Map<String,Object> currentAuthorizationStatus(){
        LocalDate today=LocalDate.now();
        Map<String,Object> result=new LinkedHashMap<>();
        var person=identity.currentInspector();
        result.put("serverDate",today.toString());
        result.put("bound",person!=null);
        result.put("personnelName",person==null?"":person.get("name"));
        List<Map<String,Object>> records=new ArrayList<>();
        if(person!=null){
            long id=((Number)person.get("id")).longValue();
            var own=jdbc.query("SELECT snapshot_json FROM gov_personnel_grant WHERE personnel_id=? ORDER BY updated_at DESC",(r,n)->decode(r.getString(1)),id);
            for(Grant g:own){
                var scopes=jdbc.query("SELECT * FROM gov_scope_config WHERE id=?",(r,n)->new GovernmentScopeService.Scope(r.getString("id"),r.getString("organization_code"),r.getString("organization_name"),r.getString("status"),readRegions(r.getString("regions_json")),r.getString("note"),r.getLong("version"),r.getString("updated_at")),g.scopeId());
                var scope=scopes.isEmpty()?null:scopes.get(0);
                String reason="";
                if(!"enabled".equals(g.status()))reason="授权已停用";
                else {
                    try {
                        if(today.isBefore(LocalDate.parse(g.validFrom())))reason="授权尚未生效";
                        else if(today.isAfter(LocalDate.parse(g.validUntil())))reason="授权已到期";
                        else if(scope==null)reason="机构登记不存在";
                        else if(!"enabled".equals(scope.status()))reason="机构已停用";
                        else {try{validate(g,scope);}catch(ResponseStatusException e){reason="机构范围或授权资料已变化，请管理员重新核对";}}
                    }catch(java.time.DateTimeException|NullPointerException e){reason="授权有效期异常，请管理员核对";}
                }
                Map<String,Object> row=new LinkedHashMap<>();
                row.put("id",g.id());row.put("organizationName",scope==null?"机构登记不存在":scope.organizationName());
                row.put("validFrom",g.validFrom());row.put("validUntil",g.validUntil());
                row.put("effective",reason.isEmpty());row.put("reason",reason);row.put("regions",g.regions()==null?List.of():g.regions());
                records.add(row);
            }
        }
        result.put("grants",records);return result;
    }

}
