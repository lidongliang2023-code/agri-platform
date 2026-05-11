package com.agri.trade.service;

import com.agri.trade.entity.Evaluation;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface IEvaluationService extends IService<Evaluation> {

    Evaluation createEvaluation(Long orderId, String evaluatorType, Long evaluatorId, String evaluatorName,
                                BigDecimal ratingOverall, BigDecimal ratingQuality, BigDecimal ratingDelivery,
                                BigDecimal ratingService, String evaluationContent, String evaluationImages,
                                String evaluationTags, Integer isAnonymous);

    boolean replyEvaluation(Long evaluationId, String replyContent);

    boolean applyAppeal(Long evaluationId, String appealReason);

    boolean hideEvaluation(Long evaluationId, String hideReason);

    boolean showEvaluation(Long evaluationId);

    Evaluation getEvaluationByOrder(Long orderId);

    List<Evaluation> getEvaluationsByUser(Long userId, String userType);

    List<Evaluation> getEvaluationsForSeller(Long sellerId);

    BigDecimal getAverageRating(Long userId, String userType);

    Map<String, Object> getUserRatingSummary(Long userId, String userType);

    List<Evaluation> searchEvaluations(String keyword, BigDecimal minRating, String status);
}