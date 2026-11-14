package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.ITechLearningService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * 知识问答和培训陪练的应用服务。
 * 只检索已发布知识文章；不替代病虫害诊断、用药安全校验或农事任务服务。
 */
@Service
public class TechLearningServiceImpl implements ITechLearningService {
    private static final String KNOWLEDGE_TENANT = "2001";
    private final JdbcTemplate db;
    private final ObjectMapper json;

    public TechLearningServiceImpl(JdbcTemplate db, ObjectMapper json) {
        this.db = db;
        this.json = json;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> ask(String tenantId, Map<String, Object> payload) {
        requireTenant(tenantId);
        String question = text(payload == null ? null : payload.get("question"), "问题", 2000);
        String sessionId = optional(payload == null ? null : payload.get("sessionId"));
        List<Map<String, Object>> docs = findKnowledge(question, 5);
        String recordId = "QA" + DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS").format(LocalDateTime.now()) + UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> result = new LinkedHashMap<>();
        String intent;
        String status;
        String answer;
        BigDecimal confidence;
        if (docs.isEmpty()) {
            intent = "UNKNOWN";
            status = "NEEDS_REVIEW";
            confidence = new BigDecimal("0.0000");
            answer = "当前已发布农技知识库没有检索到与该问题直接匹配的依据。请补充作物、生产阶段或症状，由农技员确认后再处理；本页面不会用默认知识补答。";
        } else if (isUnsafe(question)) {
            intent = "SAFETY_BOUNDARY";
            status = "REFUSED";
            confidence = new BigDecimal("0.9500");
            answer = "这个问题涉及具体诊断、农药剂量或直接处置指令，不能仅凭知识问答给出结论。请转到对应的病虫害诊断、用药安全校验或农技员复核流程。下面仅展示检索到的知识依据。";
        } else {
            intent = "KNOWLEDGE_QA";
            status = "ANSWERED";
            confidence = new BigDecimal("0.8200");
            answer = buildAnswer(docs);
        }
        List<String> ids = docs.stream().map(d -> String.valueOf(d.get("article_code"))).toList();
        String idsText = String.join(",", ids);
        db.update("INSERT INTO agri_prod_tech_qa_record(record_id,tenant_id,session_id,question,answer,intent,source_ids,source_snapshot,confidence,status,created_by,create_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                recordId, tenantId, sessionId, question, answer, intent, idsText, snapshot(docs), confidence, status, tenantId, LocalDateTime.now());
        result.put("recordId", recordId); result.put("question", question); result.put("answer", answer); result.put("intent", intent); result.put("status", status); result.put("confidence", confidence); result.put("sources", sourceViews(docs));
        return result;
    }

    @Override
    public List<Map<String, Object>> history(String tenantId, int limit) {
        requireTenant(tenantId);
        int n = Math.min(Math.max(limit, 1), 100);
        return db.queryForList("SELECT record_id,question,answer,intent,confidence,status,source_ids,create_time FROM agri_prod_tech_qa_record WHERE tenant_id=? ORDER BY create_time DESC LIMIT " + n, tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> createTraining(String tenantId, Map<String, Object> payload) {
        requireTenant(tenantId);
        String topic = text(payload == null ? null : payload.get("topic"), "培训主题", 64);
        String level = optional(payload == null ? null : payload.get("level")); if (level == null) level = "BASIC";
        int count = number(payload == null ? null : payload.get("questionCount"), 5); count = Math.min(Math.max(count, 3), 10);
        List<Map<String, Object>> docs = findKnowledge(topic, count);
        if (docs.isEmpty()) {
            String category = topic.contains("病虫害") || topic.contains("植保") ? "PEST" : null;
            docs = category == null ? findPublishedKnowledge(count) : findKnowledgeByCategory(category, count);
        }
        if (docs.isEmpty()) throw new BusinessException(400, "当前已发布知识库没有该主题的题目依据，不能生成陪练题");
        String id = "TRN" + DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS").format(LocalDateTime.now()) + UUID.randomUUID().toString().substring(0, 8);
        int actual = Math.min(count, docs.size());
        db.update("INSERT INTO agri_prod_training_session(training_id,tenant_id,title,topic,level,question_count,answered_count,correct_count,status,started_at,created_by,create_time,update_time) VALUES(?,?,?,?,?,?,0,0,'IN_PROGRESS',?,?,?,?)",
                id, tenantId, "农技陪练·" + topic, topic, level, actual, LocalDateTime.now(), tenantId, LocalDateTime.now(), LocalDateTime.now());
        int no = 1;
        for (Map<String, Object> doc : docs.subList(0, actual)) {
            String title = String.valueOf(doc.get("title"));
            String summary = Optional.ofNullable((String) doc.get("summary")).orElse("请结合知识正文和现场条件判断。");
            List<String> options = List.of("已发布知识明确支持该做法", "需要结合现场条件和农技员复核", "可以直接套用任何作物", "无需查看知识出处");
            String question = "关于“" + title + "”，以下哪项更符合平台知识使用边界？";
            String correct = "B";
            Map<String, Object> snap = new LinkedHashMap<>(); snap.put("articleId", doc.get("article_code")); snap.put("title", title); snap.put("summary", summary); snap.put("source", doc.get("source"));
            db.update("INSERT INTO agri_prod_training_question(training_id,question_no,question_text,options_json,answer_key,explanation,source_ids,source_snapshot) VALUES(?,?,?,?,?,?,?,?)",
                    id, no++, question, write(options), correct, "知识问答只能引用已发布依据；具体处置仍需按对应业务流程校验。依据摘要：" + summary, String.valueOf(doc.get("article_code")), write(snap));
        }
        return training(tenantId, id);
    }

    @Override
    public List<Map<String, Object>> trainings(String tenantId, int limit) {
        requireTenant(tenantId); int n = Math.min(Math.max(limit, 1), 100);
        return db.queryForList("SELECT training_id,title,topic,level,question_count,answered_count,correct_count,score,status,started_at,completed_at,update_time FROM agri_prod_training_session WHERE tenant_id=? ORDER BY create_time DESC LIMIT " + n, tenantId);
    }

    @Override
    public Map<String, Object> training(String tenantId, String trainingId) {
        requireTenant(tenantId);
        Map<String, Object> session = one("SELECT * FROM agri_prod_training_session WHERE tenant_id=? AND training_id=?", tenantId, trainingId);
        if (session == null) throw new BusinessException(404, "培训记录不存在");
        List<Map<String, Object>> questions = db.queryForList("SELECT question_no,question_text,options_json,explanation,source_ids,user_answer,is_correct,answered_at FROM agri_prod_training_question WHERE training_id=? ORDER BY question_no", trainingId);
        List<Map<String, Object>> safe = new ArrayList<>();
        for (Map<String, Object> q : questions) { Map<String, Object> row = new LinkedHashMap<>(q); row.put("options", parse(q.get("options_json"), new TypeReference<List<String>>(){})); row.remove("options_json"); row.remove("explanation"); safe.add(row); }
        Map<String, Object> out = new LinkedHashMap<>(session); out.put("questions", safe); return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> answerTraining(String tenantId, String trainingId, int questionNo, String answer) {
        requireTenant(tenantId); String key = text(answer, "答案", 20).toUpperCase(Locale.ROOT);
        Map<String, Object> session = one("SELECT * FROM agri_prod_training_session WHERE tenant_id=? AND training_id=?", tenantId, trainingId);
        if (session == null) throw new BusinessException(404, "培训记录不存在");
        Map<String, Object> q = one("SELECT * FROM agri_prod_training_question WHERE training_id=? AND question_no=?", trainingId, questionNo);
        if (q == null) throw new BusinessException(404, "题目不存在");
        if (q.get("user_answer") != null) throw new BusinessException(409, "该题已经作答，不能重复提交");
        boolean correct = key.equalsIgnoreCase(String.valueOf(q.get("answer_key")));
        db.update("UPDATE agri_prod_training_question SET user_answer=?,is_correct=?,answered_at=? WHERE training_id=? AND question_no=?", key, correct ? 1 : 0, LocalDateTime.now(), trainingId, questionNo);
        int answered = ((Number) session.getOrDefault("answered_count", 0)).intValue() + 1;
        int correctCount = ((Number) session.getOrDefault("correct_count", 0)).intValue() + (correct ? 1 : 0);
        db.update("UPDATE agri_prod_training_session SET answered_count=?,correct_count=?,update_time=? WHERE tenant_id=? AND training_id=?", answered, correctCount, LocalDateTime.now(), tenantId, trainingId);
        Map<String, Object> out = new LinkedHashMap<>(); out.put("trainingId", trainingId); out.put("questionNo", questionNo); out.put("correct", correct); out.put("correctAnswer", q.get("answer_key")); out.put("explanation", q.get("explanation")); out.put("answeredCount", answered); out.put("correctCount", correctCount); return out;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> completeTraining(String tenantId, String trainingId) {
        requireTenant(tenantId); Map<String, Object> s = one("SELECT * FROM agri_prod_training_session WHERE tenant_id=? AND training_id=?", tenantId, trainingId);
        if (s == null) throw new BusinessException(404, "培训记录不存在");
        int total = ((Number)s.getOrDefault("question_count",0)).intValue(); int answered = ((Number)s.getOrDefault("answered_count",0)).intValue(); int correct = ((Number)s.getOrDefault("correct_count",0)).intValue();
        if (answered < total) throw new BusinessException(400, "仍有未作答题目，不能结算成绩");
        BigDecimal score = total == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(correct * 100.0 / total).setScale(2, RoundingMode.HALF_UP);
        String status = score.compareTo(new BigDecimal("60")) < 0 ? "NEEDS_REVIEW" : "COMPLETED";
        db.update("UPDATE agri_prod_training_session SET score=?,status=?,completed_at=?,update_time=? WHERE tenant_id=? AND training_id=?", score, status, LocalDateTime.now(), LocalDateTime.now(), tenantId, trainingId);
        return training(tenantId, trainingId);
    }

    private List<Map<String, Object>> findKnowledge(String text, int limit) {
        String kw = text.trim(); int n = Math.min(Math.max(limit, 1), 10);
        return db.queryForList("SELECT article_code,title,summary,content,author,source,publish_at FROM agri_prod_knowledge_article WHERE status=1 AND deleted=0 AND (title LIKE ? OR summary LIKE ? OR content LIKE ?) ORDER BY publish_at DESC,id DESC LIMIT " + n, "%"+kw+"%", "%"+kw+"%", "%"+kw+"%");
    }
    private List<Map<String, Object>> findKnowledgeByCategory(String category, int limit) {
        int n = Math.min(Math.max(limit, 1), 10);
        return db.queryForList("SELECT article_code,title,summary,content,author,source,publish_at FROM agri_prod_knowledge_article WHERE status=1 AND deleted=0 AND category_code=? ORDER BY publish_at DESC,id DESC LIMIT " + n, category);
    }
    private List<Map<String, Object>> findPublishedKnowledge(int limit) {
        int n = Math.min(Math.max(limit, 1), 10);
        return db.queryForList("SELECT article_code,title,summary,content,author,source,publish_at FROM agri_prod_knowledge_article WHERE status=1 AND deleted=0 ORDER BY publish_at DESC,id DESC LIMIT " + n);
    }
    private List<Map<String,Object>> sourceViews(List<Map<String,Object>> docs) { return docs.stream().map(d -> { Map<String,Object> x=new LinkedHashMap<>(); x.put("articleId",d.get("article_code"));x.put("title",d.get("title"));x.put("summary",d.get("summary"));x.put("source",d.get("source"));x.put("publishAt",d.get("publish_at"));return x; }).toList(); }
    private String buildAnswer(List<Map<String,Object>> docs) { StringBuilder b=new StringBuilder("根据已发布农技知识库检索结果：\n"); for(Map<String,Object>d:docs){b.append("- ").append(d.get("title")).append("：").append(Optional.ofNullable((String)d.get("summary")).orElse("正文已归档，请查看出处")).append("\n");} b.append("以上是知识依据摘要；涉及现场诊断、用药、采收或任务下发时，请转到对应业务模块完成校验和留痕。");return b.toString(); }
    private String snapshot(List<Map<String,Object>> docs) { return write(sourceViews(docs)); }
    private String write(Object o) { try{return json.writeValueAsString(o);}catch(Exception e){throw new BusinessException(500,"知识快照序列化失败");} }
    private <T>T parse(Object o, TypeReference<T> t) { try{return json.readValue(String.valueOf(o),t);}catch(Exception e){return null;} }
    private Map<String,Object> one(String sql,Object...args){List<Map<String,Object>>r=db.queryForList(sql,args);return r.isEmpty()?null:r.get(0);}
    private void requireTenant(String t){if(t==null||t.isBlank())throw new BusinessException(401,"缺少主体身份");}
    private String optional(Object v){return v==null||String.valueOf(v).trim().isEmpty()?null:String.valueOf(v).trim();}
    private String text(Object v,String n,int max){String s=optional(v);if(s==null)throw new BusinessException(400,n+"不能为空");if(s.length()>max)throw new BusinessException(400,n+"不能超过"+max+"个字符");return s;}
    private int number(Object v,int fallback){try{return v==null?fallback:Integer.parseInt(String.valueOf(v));}catch(Exception e){return fallback;}}
    private boolean isUnsafe(String q){String s=q.toLowerCase(Locale.ROOT);return s.contains("打什么药")||s.contains("用药")||s.contains("剂量")||s.contains("确诊")||s.contains("直接处置")||s.contains("喷施");}
}
