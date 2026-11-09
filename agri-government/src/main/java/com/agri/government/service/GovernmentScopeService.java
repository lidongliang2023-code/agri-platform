package com.agri.government.service;

import com.agri.government.security.GovernmentIdentityService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class GovernmentScopeService {
    public record Region(String code, String name, boolean includeChildren, List<String> duties) {}
    public record Scope(String id, String organizationCode, String organizationName, String status,
                        List<Region> regions, String note, Long version, String updatedAt) {}
    private static final Set<String> DUTIES = Set.of("inspection", "sampling", "case", "credit", "complaint", "statistics", "subsidy");
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final GovernmentIdentityService identity;
    public GovernmentScopeService(JdbcTemplate jdbc, ObjectMapper json, GovernmentIdentityService identity) {
        this.jdbc=jdbc; this.json=json; this.identity=identity;
    }
    public List<Scope> list() {
        return jdbc.query("SELECT * FROM gov_scope_config ORDER BY updated_at DESC,id", (r,n) -> {
            try {
                return new Scope(r.getString("id"), r.getString("organization_code"), r.getString("organization_name"),
                    r.getString("status"), json.readValue(r.getString("regions_json"), new TypeReference<List<Region>>() {}),
                    r.getString("note"), r.getLong("version"), r.getString("updated_at"));
            } catch (java.io.IOException e) { throw new IllegalStateException("监管范围数据读取失败", e); }
        });
    }
    private static String required(String value, int max, String label) {
        if(value==null || value.isBlank() || value.trim().length()>max) throw bad(label+"不能为空且不能超过"+max+"字");
        return value.trim();
    }
    private static ResponseStatusException bad(String text) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,text); }
    public static Scope validate(Scope body) {
        if(body==null) throw bad("配置不能为空");
        String code=required(body.organizationCode(),64,"机构代码");
        if(!code.matches("[A-Za-z0-9_-]+")) throw bad("机构代码仅支持字母、数字、下划线和短横线");
        String name=required(body.organizationName(),160,"机构名称");
        if(!Set.of("enabled","disabled").contains(Objects.toString(body.status(),""))) throw bad("登记状态无效");
        if(body.regions()==null || body.regions().isEmpty() || body.regions().size()>100) throw bad("请登记1至100个辖区");
        Set<String> codes=new HashSet<>();
        List<Region> regions=new ArrayList<>();
        for(Region r:body.regions()) {
            if(r==null) throw bad("辖区不能为空");
            String regionCode=required(r.code(),12,"行政区划代码");
            if(!regionCode.matches("(?:[1-9][0-9]{5}|[1-9][0-9]{8}|[1-9][0-9]{11})")) throw bad("行政区划代码须为6、9或12位数字");
            if(!codes.add(regionCode)) throw bad("同一机构不能重复登记相同辖区");
            if(r.duties()==null || r.duties().isEmpty() || r.duties().stream().anyMatch(d->d==null || !DUTIES.contains(d))) throw bad("请选择有效监管职责");
            regions.add(new Region(regionCode,required(r.name(),160,"辖区名称"),r.includeChildren(),r.duties().stream().distinct().toList()));
        }
        String note=body.note()==null?"":body.note().trim();
        if(note.length()>1000) throw bad("备注不能超过1000字");
        return new Scope(body.id(),code,name,body.status(),regions,note,body.version(),body.updatedAt());
    }
    @Transactional
    public Scope save(String id, Scope body) {
        Scope clean=validate(body);
        String now=LocalDateTime.now().toString();
        String actor=identity.operatorName();
        if(actor==null || actor.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"无法识别操作账号，请重新登录");
        try {
            String regions=json.writeValueAsString(clean.regions());
            long version=1;
            String before=null;
            if(id==null) {
                id=UUID.randomUUID().toString();
                jdbc.update("INSERT INTO gov_scope_config(id,organization_code,organization_name,status,regions_json,note,version,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                    id,clean.organizationCode(),clean.organizationName(),clean.status(),regions,clean.note(),version,now);
            } else {
                if(clean.version()==null || clean.version()<1) throw bad("缺少有效版本，请刷新后重试");
                List<String> snapshots=jdbc.query("SELECT snapshot_json FROM gov_scope_config_audit WHERE scope_id=? ORDER BY version DESC LIMIT 1",(r,n)->r.getString(1),id);
                before=snapshots.isEmpty()?null:snapshots.get(0);
                version=clean.version()+1;
                int changed=jdbc.update("UPDATE gov_scope_config SET organization_code=?,organization_name=?,status=?,regions_json=?,note=?,version=?,updated_at=? WHERE id=? AND version=?",
                    clean.organizationCode(),clean.organizationName(),clean.status(),regions,clean.note(),version,now,id,clean.version());
                if(changed!=1) throw new ResponseStatusException(HttpStatus.CONFLICT,"记录已被他人修改或不存在，请刷新列表后重新编辑");
            }
            Scope saved=new Scope(id,clean.organizationCode(),clean.organizationName(),clean.status(),clean.regions(),clean.note(),version,now);
            jdbc.update("INSERT INTO gov_scope_config_audit(id,scope_id,version,operator_name,before_json,snapshot_json,created_at) VALUES(?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(),id,version,actor,before,json.writeValueAsString(saved),now);
            return saved;
        } catch(DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"机构代码已存在，请编辑现有机构配置");
        } catch(com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("监管范围保存失败",e); }
    }
}
