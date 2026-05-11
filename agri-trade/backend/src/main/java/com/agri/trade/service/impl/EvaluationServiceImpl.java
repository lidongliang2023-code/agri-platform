package com.agri.trade.service.impl;

import com.agri.trade.entity.Evaluation;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.EvaluationMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.IEvaluationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EvaluationServiceImpl extends ServiceImpl<EvaluationMapper, Evaluation> implements IEvaluationService {

    private final TradeOrderMapper orderMapper;

    @Override
    @Transactional
    public Evaluation createEvaluation(Long orderId, String evaluatorType, Long evaluatorId, String evaluatorName,
                                       BigDecimal ratingOverall, BigDecimal ratingQuality, BigDecimal ratingDelivery,
                                       BigDecimal ratingService, String evaluationContent, String evaluationImages,
                                       String evaluationTags, Integer isAnonymous) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        Long evaluateeId = "buyer".equals(evaluatorType) ? order.getSellerId() : order.getBuyerId();
        String evaluateeName = "buyer".equals(evaluatorType) ? order.getSellerName() : order.getBuyerName();

        Evaluation evaluation = new Evaluation();
        evaluation.setEvaluationNo("EV" + System.currentTimeMillis());
        evaluation.setOrderId(orderId);
        evaluation.setOrderNo(order.getOrderNo());
        evaluation.setEvaluatorType(evaluatorType);
        evaluation.setEvaluatorId(evaluatorId);
        evaluation.setEvaluatorName(isAnonymous != null && isAnonymous == 1 ? "匿名用户" : evaluatorName);
        evaluation.setEvaluateeId(evaluateeId);
        evaluation.setEvaluateeName(evaluateeName);
        evaluation.setRatingOverall(ratingOverall);
        evaluation.setRatingQuality(ratingQuality);
        evaluation.setRatingDelivery(ratingDelivery);
        evaluation.setRatingService(ratingService);
        evaluation.setEvaluationContent(evaluationContent);
        evaluation.setEvaluationImages(evaluationImages);
        evaluation.setEvaluationTags(evaluationTags);
        evaluation.setIsAnonymous(isAnonymous);
        evaluation.setIsSystem(0);
        evaluation.setEvaluationStatus("normal");
        evaluation.setDelFlag(0);
        evaluation.setCreateTime(new Date());
        evaluation.setUpdateTime(new Date());

        baseMapper.insert(evaluation);

        return evaluation;
    }

    @Override
    @Transactional
    public boolean replyEvaluation(Long evaluationId, String replyContent) {
        Evaluation evaluation = baseMapper.selectById(evaluationId);
        if (evaluation == null) {
            return false;
        }

        evaluation.setReplyContent(replyContent);
        evaluation.setReplyTime(new Date());
        evaluation.setUpdateTime(new Date());
        baseMapper.updateById(evaluation);

        return true;
    }

    @Override
    @Transactional
    public boolean applyAppeal(Long evaluationId, String appealReason) {
        Evaluation evaluation = baseMapper.selectById(evaluationId);
        if (evaluation == null) {
            return false;
        }

        evaluation.setEvaluationStatus("appealing");
        evaluation.setHideReason(appealReason);
        evaluation.setUpdateTime(new Date());
        baseMapper.updateById(evaluation);

        return true;
    }

    @Override
    @Transactional
    public boolean hideEvaluation(Long evaluationId, String hideReason) {
        Evaluation evaluation = baseMapper.selectById(evaluationId);
        if (evaluation == null) {
            return false;
        }

        evaluation.setEvaluationStatus("hidden");
        evaluation.setHideReason(hideReason);
        evaluation.setUpdateTime(new Date());
        baseMapper.updateById(evaluation);

        return true;
    }

    @Override
    @Transactional
    public boolean showEvaluation(Long evaluationId) {
        Evaluation evaluation = baseMapper.selectById(evaluationId);
        if (evaluation == null) {
            return false;
        }

        evaluation.setEvaluationStatus("normal");
        evaluation.setHideReason(null);
        evaluation.setUpdateTime(new Date());
        baseMapper.updateById(evaluation);

        return true;
    }

    @Override
    public Evaluation getEvaluationByOrder(Long orderId) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getOrderId, orderId);
        wrapper.eq(Evaluation::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public List<Evaluation> getEvaluationsByUser(Long userId, String userType) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        wrapper.eq("buyer".equals(userType) ? Evaluation::getEvaluatorId : Evaluation::getEvaluateeId, userId);
        wrapper.orderByDesc(Evaluation::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Evaluation> getEvaluationsForSeller(Long sellerId) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        wrapper.eq(Evaluation::getEvaluationStatus, "normal");
        wrapper.eq(Evaluation::getEvaluateeId, sellerId);
        wrapper.orderByDesc(Evaluation::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public BigDecimal getAverageRating(Long userId, String userType) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        wrapper.eq(Evaluation::getEvaluationStatus, "normal");
        
        if ("buyer".equals(userType)) {
            wrapper.eq(Evaluation::getEvaluatorId, userId);
        } else {
            wrapper.eq(Evaluation::getEvaluateeId, userId);
        }

        List<Evaluation> evaluations = baseMapper.selectList(wrapper);
        if (evaluations.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum = evaluations.stream()
            .map(Evaluation::getRatingOverall)
            .filter(r -> r != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return sum.divide(BigDecimal.valueOf(evaluations.size()), 2, RoundingMode.HALF_UP);
    }

    @Override
    public Map<String, Object> getUserRatingSummary(Long userId, String userType) {
        Map<String, Object> summary = new HashMap<>();

        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);
        wrapper.eq(Evaluation::getEvaluationStatus, "normal");
        
        if ("buyer".equals(userType)) {
            wrapper.eq(Evaluation::getEvaluatorId, userId);
        } else {
            wrapper.eq(Evaluation::getEvaluateeId, userId);
        }

        List<Evaluation> evaluations = baseMapper.selectList(wrapper);

        summary.put("totalCount", evaluations.size());
        
        if (evaluations.isEmpty()) {
            summary.put("avgRating", BigDecimal.ZERO);
            summary.put("avgQuality", BigDecimal.ZERO);
            summary.put("avgDelivery", BigDecimal.ZERO);
            summary.put("avgService", BigDecimal.ZERO);
            return summary;
        }

        summary.put("avgRating", evaluations.stream()
            .map(Evaluation::getRatingOverall)
            .filter(r -> r != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(evaluations.size()), 2, RoundingMode.HALF_UP));

        summary.put("avgQuality", evaluations.stream()
            .map(Evaluation::getRatingQuality)
            .filter(r -> r != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(evaluations.size()), 2, RoundingMode.HALF_UP));

        summary.put("avgDelivery", evaluations.stream()
            .map(Evaluation::getRatingDelivery)
            .filter(r -> r != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(evaluations.size()), 2, RoundingMode.HALF_UP));

        summary.put("avgService", evaluations.stream()
            .map(Evaluation::getRatingService)
            .filter(r -> r != null)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(evaluations.size()), 2, RoundingMode.HALF_UP));

        long positiveCount = evaluations.stream()
            .filter(e -> e.getRatingOverall() != null && e.getRatingOverall().compareTo(new BigDecimal("4")) >= 0)
            .count();
        summary.put("positiveRate", BigDecimal.valueOf(positiveCount * 100.0 / evaluations.size())
            .setScale(1, RoundingMode.HALF_UP));

        return summary;
    }

    @Override
    public List<Evaluation> searchEvaluations(String keyword, BigDecimal minRating, String status) {
        LambdaQueryWrapper<Evaluation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Evaluation::getDelFlag, 0);

        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Evaluation::getEvaluationContent, keyword);
        }
        if (minRating != null) {
            wrapper.ge(Evaluation::getRatingOverall, minRating);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Evaluation::getEvaluationStatus, status);
        }

        wrapper.orderByDesc(Evaluation::getCreateTime);
        return baseMapper.selectList(wrapper);
    }
}