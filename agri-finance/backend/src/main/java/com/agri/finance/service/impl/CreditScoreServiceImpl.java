package com.agri.finance.service.impl;

import com.agri.finance.entity.CreditScore;
import com.agri.finance.mapper.CreditScoreMapper;
import com.agri.finance.service.ICreditScoreService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class CreditScoreServiceImpl extends ServiceImpl<CreditScoreMapper, CreditScore> implements ICreditScoreService {

    @Override
    public CreditScore getCreditScore(String userId) {
        LambdaQueryWrapper<CreditScore> query = new LambdaQueryWrapper<>();
        query.eq(CreditScore::getUserId, userId)
             .eq(CreditScore::getDelFlag, 0)
             .orderByDesc(CreditScore::getCreatedAt)
             .last("LIMIT 1");
        return getOne(query);
    }

    @Override
    public CreditScore generateCreditReport(String userId) {
        CreditScore existing = getCreditScore(userId);
        
        if (existing != null) {
            return existing;
        }

        // 未接入外部征信时按账号稳定生成可重复的初评结果，避免刷新一次换一个分数。
        int seed = Math.abs(Objects.hash(userId)) % 31;
        CreditScore score = new CreditScore();
        score.setUserId(userId);
        score.setCompositeScore(740 + seed);
        score.setCreditLevel(calculateCreditLevel(score.getCompositeScore()));
        score.setBusinessAbilityScore(76 + seed / 4);
        score.setDebtAbilityScore(74 + seed / 3);
        score.setCreditRecordScore(86 + seed / 6);
        score.setStabilityScore(78 + seed / 5);
        score.setAvailableAmount(new BigDecimal(500000 + seed * 10000L));
        score.setReferenceRate(new BigDecimal("6.20").subtract(new BigDecimal(seed).divide(new BigDecimal("500"), 2, java.math.RoundingMode.HALF_UP)));
        score.setScoreChange(seed / 3 - 3);
        score.setChangeTrend(score.getScoreChange() > 0 ? "上升" : score.getScoreChange() < 0 ? "下降" : "稳定");
        score.setPlatformMonths(18 + seed);
        score.setTotalTransactionAmount(new BigDecimal(1800000 + seed * 50000L));
        score.setFulfillmentRate(new BigDecimal("96.00").add(new BigDecimal(seed).divide(new BigDecimal("10"), 2, java.math.RoundingMode.HALF_UP)));
        score.setOverdueCount(seed % 4 == 0 ? 1 : 0);
        score.setRepurchaseRate(new BigDecimal("82.00").add(new BigDecimal(seed).divide(new BigDecimal("10"), 2, java.math.RoundingMode.HALF_UP)));
        score.setRiskAlerts(score.getOverdueCount() > 0 ? "存在历史逾期记录，请优先保持按期还款" : "当前无逾期，交易履约稳定");
        score.setImprovementSuggestions("保持订单履约；补充仓单或订单确权材料可提升授信额度");
        score.setEvaluationTime(LocalDateTime.now());
        score.setCreatedAt(LocalDateTime.now());
        score.setUpdatedAt(LocalDateTime.now());
        score.setDelFlag(0);

        save(score);
        return score;
    }

    private String calculateCreditLevel(int score) {
        if (score >= 750) return "AAA";
        if (score >= 650) return "AA";
        if (score >= 550) return "A";
        if (score >= 450) return "B";
        if (score >= 350) return "C";
        return "D";
    }
}
