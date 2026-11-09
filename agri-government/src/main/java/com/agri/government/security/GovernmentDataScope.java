package com.agri.government.security;

import com.agri.common.exception.BusinessException;
import com.agri.government.service.GovernmentPersonnelService;
import com.agri.government.service.GovernmentScopeService.Region;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.*;

/** 服务端辖区边界：角色只允许进入功能，有效人员授权决定数据范围。 */
@Service
public class GovernmentDataScope {
    private final GovernmentPersonnelService grants;
    private final GovernmentIdentityService identity;
    private final JdbcTemplate jdbc;
    private final ThreadLocal<String> reportingDuty = new ThreadLocal<>();
    private static final Map<String,String> DUTIES = Map.ofEntries(
        Map.entry("gov_subject", "*"), Map.entry("gov_warning", "inspection"),
        Map.entry("gov_task", "inspection"), Map.entry("gov_case", "case"),
        Map.entry("gov_rectification", "inspection"), Map.entry("gov_inspection", "inspection"),
        Map.entry("gov_credit_repair", "credit"), Map.entry("gov_credit_event", "credit"),
        Map.entry("gov_sampling", "sampling"), Map.entry("gov_complaint", "complaint"),
        Map.entry("gov_self_check", "inspection"), Map.entry("gov_subsidy", "subsidy"),
        Map.entry("gov_evidence", "evidence"), Map.entry("gov_op_log", "*"));
    private static final Pattern TABLE = Pattern.compile("(?i)\\b(FROM|JOIN)\\s+(gov_[a-z_]+)\\b(?![.])(?:\\s+(?:AS\\s+)?([a-zA-Z_][a-zA-Z_0-9]*))?");
    private static final Set<String> KEYWORDS = Set.of("where","order","group","limit","left","right","inner","join","on","union","having","for");
    public GovernmentDataScope(GovernmentPersonnelService grants, GovernmentIdentityService identity, JdbcTemplate jdbc) {
        this.grants=grants; this.identity=identity; this.jdbc=jdbc;
    }
    public static boolean validCode(String code) { return code!=null && code.matches("[1-9][0-9]{5}(?:[0-9]{3})?(?:[0-9]{3})?"); }
    public static boolean contains(String parent, boolean children, String target) {
        if(!validCode(parent)||!validCode(target)) return false;
        if(parent.equals(target)) return true;
        if(!children) return false;
        String prefix=prefix(parent);
        return target.length()>=parent.length() && target.startsWith(prefix);
    }
    private static String prefix(String code) {
        if(code.length()==6 && code.endsWith("0000")) return code.substring(0,2);
        if(code.length()==6 && code.endsWith("00")) return code.substring(0,4);
        return code;
    }
    private List<Region> regions(Long person, String duty) {
        if(person==null) return List.of();
        return grants.effective(person).stream().flatMap(g->g.regions().stream())
            .filter(r->validCode(r.code()) && ("*".equals(duty)||r.duties().contains(duty)
                ||("evidence".equals(duty)&&(r.duties().contains("inspection")||r.duties().contains("case"))))) .toList();
    }
    private Long currentPerson() { var p=identity.currentInspector(); return p==null?null:((Number)p.get("id")).longValue(); }
    private String predicate(String column,String duty) {
        List<String> conditions=new ArrayList<>();
        for(var r:regions(currentPerson(),duty)) {
            String part=column+"='"+r.code()+"'";
            if(r.includeChildren()) part+=" OR (LENGTH("+column+") IN (6,9,12) AND LENGTH("+column+")>="+r.code().length()+" AND "+column+" LIKE '"+prefix(r.code())+"%')";
            conditions.add("("+part+")");
        }
        return conditions.isEmpty()?"1=0":"("+String.join(" OR ",conditions)+")";
    }
    /** 仅用于本模块固定 SQL。派生表先过滤再统计/排序/分页，客户端参数不参与 SQL 拼接。 */
    public String sql(String original) {
        Matcher matcher=TABLE.matcher(original); StringBuffer out=new StringBuffer();
        while(matcher.find()) {
            String table=matcher.group(2).toLowerCase(Locale.ROOT);
            String alias=matcher.group(3); String tail="";
            if(alias!=null && KEYWORDS.contains(alias.toLowerCase(Locale.ROOT))) { tail=" "+alias; alias=null; }
            String duty=DUTIES.get(table); String filter=null;
            if(table.equals("gov_daily_metric")||table.equals("gov_data_share")) filter="1=0";
            else if(duty!=null) {
                if(reportingDuty.get()!=null) duty=reportingDuty.get();
                if(table.equals("gov_subject")||table.equals("gov_complaint")) filter=predicate("_scope_row.region_code",duty);
                else filter="EXISTS (SELECT 1 FROM gov_subject _scope_subject WHERE _scope_subject.id=_scope_row.subject_id AND "+predicate("_scope_subject.region_code",duty)+")";
            }
            if(filter==null) { matcher.appendReplacement(out,Matcher.quoteReplacement(matcher.group())); continue; }
            String replacement=matcher.group(1)+" (SELECT _scope_row.* FROM "+table+" _scope_row WHERE "+filter+") "+(alias==null?table:alias)+tail;
            matcher.appendReplacement(out,Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out); return out.toString();
    }
    public <T> T statistics(Supplier<T> action) {
        String previous=reportingDuty.get(); reportingDuty.set("statistics");
        try { return action.get(); } finally { if(previous==null) reportingDuty.remove(); else reportingDuty.set(previous); }
    }
    public void requireSubject(Long subjectId,String duty) { requirePersonSubject(currentPerson(),subjectId,duty); }
    public void requirePersonSubject(Long person,Long subjectId,String duty) {
        List<String> codes=jdbc.queryForList("SELECT region_code FROM gov_subject WHERE id=?",String.class,subjectId);
        if(codes.size()!=1 || regions(person,duty).stream().noneMatch(r->contains(r.code(),r.includeChildren(),codes.get(0))))
            throw BusinessException.forbidden("无有效辖区或职责授权，或主体尚未登记行政区划编码");
    }
    public void requireRecord(String table,long id,String duty) {
        if(!DUTIES.containsKey(table)) throw BusinessException.forbidden("该业务未接入辖区授权");
        if(table.equals("gov_complaint")) {
            var codes=jdbc.queryForList("SELECT region_code FROM gov_complaint WHERE id=?",String.class,id);
            if(codes.size()!=1||regions(currentPerson(),duty).stream().noneMatch(r->contains(r.code(),r.includeChildren(),codes.get(0))))
                throw BusinessException.forbidden("举报尚未登记辖区或超出授权范围");
        } else {
            var ids=jdbc.queryForList("SELECT subject_id FROM "+table+" WHERE id=?",Long.class,id);
            if(ids.size()!=1) throw BusinessException.forbidden("记录不存在或不在授权范围");
            requireSubject(ids.get(0),duty);
        }
    }
}
