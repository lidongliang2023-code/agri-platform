package com.agri.production.service;

import java.util.List;
import java.util.Map;

/** 农技知识问答与培训陪练：知识引用、训练评分和错题回练。 */
public interface ITechLearningService {
    Map<String, Object> ask(String tenantId, Map<String, Object> payload);
    List<Map<String, Object>> history(String tenantId, int limit);
    Map<String, Object> createTraining(String tenantId, Map<String, Object> payload);
    List<Map<String, Object>> trainings(String tenantId, int limit);
    Map<String, Object> training(String tenantId, String trainingId);
    Map<String, Object> answerTraining(String tenantId, String trainingId, int questionNo, String answer);
    Map<String, Object> completeTraining(String tenantId, String trainingId);
}
