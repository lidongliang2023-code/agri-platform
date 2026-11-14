package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** 生产知识域的结构化图谱。只做已审核证据检索，不把文本相关度当成视觉相似度。 */
@Service
public class PestAtlasService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public PestAtlasService(JdbcTemplate db,ObjectMapper json) { this.db=db; this.json=json; }
    public Map<String,Object> list(String keyword,String status,int page,int size) {
        page=Math.max(1,page); size=Math.max(1,Math.min(size,50));
        String where=" WHERE 1=1"; List<Object> args=new ArrayList<>();
        if(status!=null && !status.isBlank()) { where+=" AND status=?"; args.add(status); }
        if(keyword!=null && !keyword.isBlank()) { where+=" AND payload_json LIKE ?"; args.add("%"+keyword.trim()+"%"); }
        Long total=db.queryForObject("SELECT COUNT(*) FROM agri_prod_pest_atlas"+where,Long.class,args.toArray());
        args.add(size); args.add((page-1)*size);
        var rows=db.query("SELECT * FROM agri_prod_pest_atlas"+where+" ORDER BY updated_at DESC,id LIMIT ? OFFSET ?",(r,n)->{
            Map<String,Object> row=decode(r.getString("payload_json")); row.put("id",r.getString("id")); row.put("revision",r.getInt("revision")); row.put("status",r.getString("status"));
            row.put("updatedAt",r.getTimestamp("updated_at").toLocalDateTime().toString()); return row;
        },args.toArray());
        return Map.of("list",rows,"total",total==null?0:total,"pageNum",page,"pageSize",size);
    }
    @Transactional
    public Map<String,Object> save(String id,Map<String,Object> request) {
        Map<String,Object> payload=normalize(request);
        LocalDateTime now=LocalDateTime.now();
        if(id==null) {
            id=UUID.randomUUID().toString();
            db.update("INSERT INTO agri_prod_pest_atlas(id,revision,status,payload_json,created_at,updated_at) VALUES(?,1,'DRAFT',?,?,?)",id,encode(payload),now,now);
            revision(id,1,"DRAFT",payload);
        } else {
            Map<String,Object> row=locked(id); int version=version(request);
            if(((Number)row.get("revision")).intValue()!=version) throw new BusinessException(409,"图谱已被其他人修改，请刷新后编辑");
            db.update("UPDATE agri_prod_pest_atlas SET revision=revision+1,status='DRAFT',payload_json=?,updated_at=?,published_at=NULL WHERE id=?",encode(payload),now,id);
            revision(id,version+1,"DRAFT",payload);
        }
        return get(id);
    }
    @Transactional
    public Map<String,Object> publish(String id,int version,boolean publish) {
        var row=locked(id);
        if(((Number)row.get("revision")).intValue()!=version) throw new BusinessException(409,"图谱版本已变化，请刷新后重试");
        Map<String,Object> payload=decode(String.valueOf(row.get("payload_json")));
        if(publish) {
            requirePublication(payload);
            if(!sourceActive(payload)) throw new BusinessException(400,"关联知识文章须为已发布的病虫害文章，并具有实际正文");
        }
        String status=publish?"PUBLISHED":"OFFLINE";
        db.update("UPDATE agri_prod_pest_atlas SET revision=revision+1,status=?,updated_at=?,published_at=? WHERE id=?",status,LocalDateTime.now(),publish?LocalDateTime.now():null,id);
        revision(id,version+1,status,payload);
        return get(id);
    }
    private Map<String,Object> locked(String id) {
        var rows=db.queryForList("SELECT * FROM agri_prod_pest_atlas WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty()) throw new BusinessException(404,"图谱条目不存在");
        return rows.get(0);
    }
    public Map<String,Object> get(String id) {
        var rows=db.queryForList("SELECT * FROM agri_prod_pest_atlas WHERE id=?",id);
        if(rows.isEmpty()) throw new BusinessException(404,"图谱条目不存在");
        var row=rows.get(0); var result=decode(String.valueOf(row.get("payload_json")));
        result.put("id",id); result.put("revision",row.get("revision")); result.put("status",row.get("status")); return result;
    }
    private void revision(String id,int version,String state,Map<String,Object> payload) {
        db.update("INSERT INTO agri_prod_pest_atlas_revision(id,revision,status,payload_json,recorded_at) VALUES(?,?,?,?,?)",id,version,state,encode(payload),LocalDateTime.now());
    }
    /** 不使用模型知识声称完成图谱命中；空库、无相关症状均返回明确空结果。 */
    public Map<String,Object> retrieve(String crop,String symptoms,String stage) {
        crop=text(crop,100,true); symptoms=text(symptoms,7000,false); stage=text(stage,100,false);
        String cropJson=encode(crop);
        var rows=db.query("SELECT id,revision,payload_json FROM agri_prod_pest_atlas WHERE status='PUBLISHED' AND (JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.cropName'))=? OR JSON_CONTAINS(JSON_EXTRACT(payload_json,'$.cropAliases'),?)) ORDER BY id",(r,n)->{
            var p=decode(r.getString("payload_json")); p.put("id",r.getString("id")); p.put("revision",r.getInt("revision")); return p;
        },crop,cropJson);
        List<Map<String,Object>> matches=new ArrayList<>();
        for(var row:rows) {
            if(!sourceActive(row)) continue;
            List<String> terms=new ArrayList<>(strings(row.get("symptomKeywords"),20,100));
            terms.add(String.valueOf(row.get("diseaseName"))); terms.addAll(strings(row.get("diseaseAliases"),20,100));
            final String observed=symptoms;
            List<String> hit=terms.stream().filter(x->!x.isBlank() && observed.contains(x)).distinct().toList();
            if(hit.isEmpty()) continue;
            double score=hit.size()*2.0;
            for(String part:strings(row.get("affectedParts"),10,50)) if(observed.contains(part)) score+=0.5;
            if(!stage.isEmpty() && strings(row.get("growthStages"),10,100).contains(stage)) score+=0.5;
            row.put("referenceId",row.get("id")+"@"+row.get("revision")); row.put("matchedKeywords",hit); row.put("retrievalScore",score);
            matches.add(row);
        }
        matches.sort(Comparator.<Map<String,Object>>comparingDouble(x->((Number)x.get("retrievalScore")).doubleValue()).reversed().thenComparing(x->String.valueOf(x.get("id"))));
        var top=matches.stream().limit(6).toList();
        return Map.of("status",top.isEmpty()?"NO_MATCH":"MATCHED","method","STRUCTURED_SYMPTOM_V1","retrievedAt",LocalDateTime.now().toString(),"cropName",crop,"references",top,
            "notice","结构化症状相关性检索；不是图片相似度，检索分数不是诊断置信度");
    }
    private boolean sourceActive(Map<String,Object> p) {
        String article=Objects.toString(p.get("articleId"),"");
        if(article.isBlank()) return true;
        Integer count=db.queryForObject("SELECT COUNT(*) FROM agri_prod_knowledge_article WHERE article_code=? AND category_code='PEST' AND status=1 AND deleted=0 AND content IS NOT NULL AND LENGTH(TRIM(content))>0",Integer.class,article);
        return count!=null && count>0;
    }
    public static Map<String,Object> normalize(Map<String,Object> p) {
        if(p==null) throw new BusinessException(400,"缺少图谱内容");
        var r=new LinkedHashMap<String,Object>();
        for(String key:List.of("cropName","diseaseName")) r.put(key,text(p.get(key),100,true));
        for(String key:List.of("cropAliases","diseaseAliases","symptomKeywords")) r.put(key,strings(p.get(key),20,100));
        r.put("affectedParts",strings(p.get("affectedParts"),10,50)); r.put("growthStages",strings(p.get("growthStages"),10,100));
        for(String key:List.of("identification","differential","measures")) r.put(key,text(p.get(key),5000,false));
        for(String key:List.of("source","sourceVersion","sourceRef")) r.put(key,text(p.get(key),500,false));
        r.put("articleId",text(p.get("articleId"),64,false));
        r.put("quarantine",Boolean.TRUE.equals(p.get("quarantine")));
        return r;
    }
    public static void requirePublication(Map<String,Object> p) {
        for(String key:List.of("source","sourceVersion","sourceRef","identification","differential","measures")) {
            String value=text(p.get(key),5000,true);
            if(value.toLowerCase(Locale.ROOT).contains("example.com") || value.contains("演示") || value.contains("待补充")) throw new BusinessException(400,"发布图谱不能使用演示或待补充的依据和出处");
        }
        if(strings(p.get("symptomKeywords"),20,100).isEmpty() || strings(p.get("affectedParts"),10,50).isEmpty()) throw new BusinessException(400,"发布前请填写症状关键词与受害部位");
    }
    /** 引用由服务端过滤；候选名不在对应图谱病名/别名中时不算图谱内。 */
    @SuppressWarnings("unchecked")
    public static Map<String,Object> ground(Map<String,Object> raw,Map<String,Object> snapshot) {
        var result=new LinkedHashMap<>(raw);
        List<Map<String,Object>> refs=(List<Map<String,Object>>)snapshot.getOrDefault("references",List.of());
        List<?> ids=raw.get("referenceIds") instanceof List<?> list?list:List.of();
        List<Map<String,Object>> cited=refs.stream().filter(r->ids.contains(r.get("referenceId"))).toList();
        String top="";
        if(raw.get("candidates") instanceof List<?> list) {
            double best=-1;
            for(Object item:list) if(item instanceof Map<?,?> candidate && candidate.get("confidence") instanceof Number c && c.doubleValue()>best) {
                best=c.doubleValue(); top=Objects.toString(candidate.get("name"),"");
            }
        }
        final String name=top;
        boolean scope=Boolean.TRUE.equals(raw.get("inKnowledgeScope")) && cited.stream().anyMatch(r->name.equals(r.get("diseaseName")) || strings(r.get("diseaseAliases"),20,100).contains(name));
        result.put("inKnowledgeScope",scope);
        result.put("knowledgeReferences",cited.stream().map(r->r.get("diseaseName")+" · "+r.get("source")+" · "+r.get("sourceVersion")+" · "+r.get("referenceId")).collect(Collectors.joining("；")));
        boolean quarantine=Boolean.TRUE.equals(raw.get("quarantineSuspected")) || cited.stream().anyMatch(r->Boolean.TRUE.equals(r.get("quarantine")));
        result.put("quarantineSuspected",quarantine);
        result.put("referenceIds",cited.stream().map(r->r.get("referenceId")).toList());
        return result;
    }
    private static int version(Map<String,Object> p) {
        if(!(p.get("revision") instanceof Number n) || n.intValue()<1) throw new BusinessException(400,"缺少有效图谱版本号"); return n.intValue();
    }
    private static String text(Object o,int max,boolean required) {
        String s=o instanceof String v?v.trim():"";
        if((required && s.isBlank()) || s.length()>max) throw new BusinessException(400,"图谱字段缺失或超出长度限制"); return s;
    }
    private static List<String> strings(Object o,int max,int length) {
        if(o==null) return List.of();
        if(!(o instanceof List<?> list) || list.size()>max) throw new BusinessException(400,"图谱关键词格式或数量不正确");
        return list.stream().map(x->text(x,length,true)).distinct().toList();
    }
    private String encode(Object o) { try { return json.writeValueAsString(o); } catch(Exception e) { throw new IllegalStateException("图谱序列化失败",e); } }
    private Map<String,Object> decode(String s) { try { return json.readValue(s,new TypeReference<LinkedHashMap<String,Object>>(){}); } catch(Exception e) { throw new IllegalStateException("图谱读取失败",e); } }
}
