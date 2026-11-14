package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.impl.TechLearningServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TechLearningServiceTest {
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final TechLearningServiceImpl service = new TechLearningServiceImpl(db, new ObjectMapper().findAndRegisterModules());

    @Test
    void unansweredQuestionKeepsNoInventedSource() {
        when(db.queryForList(contains("agri_prod_knowledge_article"), any(Object[].class))).thenReturn(List.of());
        Map<String, Object> result = service.ask("tenant-a", Map.of("question", "一个知识库没有的问题"));
        assertEquals("NEEDS_REVIEW", result.get("status"));
        assertTrue(String.valueOf(result.get("answer")).contains("没有检索到"));
        assertTrue(String.valueOf(result.get("sources")).equals("[]"));
        verify(db).update(startsWith("INSERT INTO agri_prod_tech_qa_record"), any(), eq("tenant-a"), isNull(), any(), any(), eq("UNKNOWN"), eq(""), any(), eq(new java.math.BigDecimal("0.0000")), eq("NEEDS_REVIEW"), eq("tenant-a"), any());
    }

    @Test
    void matchedQuestionStoresSourceSnapshotAndSafetyBoundary() {
        Map<String, Object> doc = new LinkedHashMap<>();
        doc.put("article_code", "KNWL-1"); doc.put("title", "设施番茄管理"); doc.put("summary", "保花保果要点"); doc.put("source", "农技站"); doc.put("publish_at", "2026-11-01 10:00:00");
        when(db.queryForList(contains("agri_prod_knowledge_article"), any(Object[].class))).thenReturn(List.of(doc));
        Map<String, Object> result = service.ask("tenant-a", Map.of("question", "番茄应该打什么药"));
        assertEquals("REFUSED", result.get("status"));
        assertEquals("SAFETY_BOUNDARY", result.get("intent"));
        assertEquals(1, ((List<?>) result.get("sources")).size());
        verify(db).update(startsWith("INSERT INTO agri_prod_tech_qa_record"), any(), eq("tenant-a"), isNull(), any(), any(), eq("SAFETY_BOUNDARY"), eq("KNWL-1"), contains("KNWL-1"), any(), eq("REFUSED"), eq("tenant-a"), any());
    }

    @Test
    void trainingAnswerCannotBeSubmittedTwice() {
        Map<String, Object> session = new LinkedHashMap<>(); session.put("training_id", "TRN-1"); session.put("answered_count", 0); session.put("correct_count", 0); session.put("question_count", 1);
        Map<String, Object> question = new LinkedHashMap<>(); question.put("training_id", "TRN-1"); question.put("question_no", 1); question.put("answer_key", "B"); question.put("user_answer", null); question.put("explanation", "依据已发布知识");
        when(db.queryForList(contains("agri_prod_training_session"), eq("tenant-a"), eq("TRN-1"))).thenReturn(List.of(session));
        when(db.queryForList(contains("agri_prod_training_question"), eq("TRN-1"), eq(1))).thenReturn(List.of(question));
        Map<String, Object> result = service.answerTraining("tenant-a", "TRN-1", 1, "b");
        assertEquals(true, result.get("correct"));
        question.put("user_answer", "B");
        assertThrows(BusinessException.class, () -> service.answerTraining("tenant-a", "TRN-1", 1, "A"));
    }
}
