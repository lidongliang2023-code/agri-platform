package com.agri.government.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.common.exception.BusinessException;
import com.agri.government.security.GovernmentDataScope;
import com.agri.government.security.GovernmentIdentityService;
import com.agri.government.service.GovernmentAuditService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/** 归属登记仅管理编码，不授予访问业务明细的权利。 */
@RestController
@RequestMapping("/api/v1/government/ops/region-registry")
@OperatorOnly("gov:admin")
public class GovernmentRegionController {
    private final JdbcTemplate jdbc;
    private final GovernmentIdentityService identity;
    private final GovernmentAuditService audit;
    public GovernmentRegionController(JdbcTemplate jdbc,GovernmentIdentityService identity,GovernmentAuditService audit) {
        this.jdbc=jdbc;this.identity=identity;this.audit=audit;
    }
    private String table(String kind) { return switch(kind) { case "subjects" -> "gov_subject";case "complaints" -> "gov_complaint";default -> throw BusinessException.validationError("登记类型无效");}; }
    @GetMapping("/{kind}")
    public ApiResponse<List<Map<String,Object>>> list(@PathVariable String kind) {
        String name="subjects".equals(kind)?"subject_name":"complaint_no";
        return ApiResponse.success(jdbc.queryForList("SELECT id,"+name+" AS name,region_code AS regionCode FROM "+table(kind)+" ORDER BY id"));
    }
    @PutMapping("/{kind}/{id}") @Transactional
    public ApiResponse<Map<String,Object>> save(@PathVariable String kind,@PathVariable long id,@RequestBody Map<String,String> body) {
        String table=table(kind),code=Objects.toString(body.get("regionCode"),"").trim();
        String reason=Objects.toString(body.get("reason"),"").trim();
        if(!GovernmentDataScope.validCode(code)) throw BusinessException.validationError("行政区划编码须为6、9或12位数字，请核实真实归属");
        if(reason.isBlank()||reason.length()>500) throw BusinessException.validationError("请填写500字以内的归属登记依据");
        String actor=identity.operatorName();
        if(actor==null||actor.isBlank()) throw BusinessException.unauthorized("未识别操作账号");
        var rows=jdbc.queryForList("SELECT region_code FROM "+table+" WHERE id=? FOR UPDATE",id);
        if(rows.size()!=1) throw BusinessException.notFound("登记对象不存在");
        String previous=Objects.toString(rows.get(0).get("region_code"),"");
        if(!previous.equals(Objects.toString(body.get("previousCode"),""))) throw new BusinessException(409,"归属已变化，请刷新后重新登记");
        jdbc.update("UPDATE "+table+" SET region_code=? WHERE id=?",code,id);
        audit.log(actor,null,"监管配置管理","登记行政区划",kind+":"+id,"原编码："+previous+"；新编码："+code+"；依据："+reason,"subjects".equals(kind)?id:null);
        return ApiResponse.success(Map.of("id",id,"regionCode",code));
    }
}
