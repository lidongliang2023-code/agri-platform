package com.agri.finance.service.impl;

import com.agri.finance.entity.CreditReport;
import com.agri.finance.entity.CreditScore;
import com.agri.finance.mapper.CreditReportMapper;
import com.agri.finance.service.ICreditScoreService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class CreditReportServiceImpl extends ServiceImpl<CreditReportMapper, CreditReport> {

    @Autowired
    private ICreditScoreService creditScoreService;

    public CreditReport getReport(String userId) {
        LambdaQueryWrapper<CreditReport> query = new LambdaQueryWrapper<>();
        query.eq(CreditReport::getUserId, userId)
             .eq(CreditReport::getDelFlag, 0)
             .orderByDesc(CreditReport::getCreatedAt)
             .last("LIMIT 1");
        return getOne(query);
    }

    public CreditReport generateReport(String userId) {
        CreditScore score = creditScoreService.generateCreditReport(userId);
        
        CreditReport report = new CreditReport();
        report.setReportNo("CR" + System.currentTimeMillis());
        report.setUserId(userId);
        report.setUserName("用户" + userId.substring(0, 8));
        report.setCompositeScore(score.getCompositeScore());
        report.setCreditLevel(score.getCreditLevel());
        report.setSuggestedAmount(score.getAvailableAmount());
        report.setReferenceRate(score.getReferenceRate());
        report.setDataSources("交易数据,履约记录,财务数据,征信数据");
        report.setDimensionScores(String.format("{businessAbility:%d,debtAbility:%d,creditRecord:%d,stability:%d}",
                score.getBusinessAbilityScore(), score.getDebtAbilityScore(),
                score.getCreditRecordScore(), score.getStabilityScore()));
        report.setRiskAlerts(score.getOverdueCount() > 0 ? "存在逾期记录" : "暂无风险预警");
        report.setImprovementSuggestions("建议保持良好的履约记录，提高交易频率");
        report.setEvaluationTime(LocalDateTime.now());
        report.setCreatedAt(LocalDateTime.now());
        report.setUpdatedAt(LocalDateTime.now());
        report.setDelFlag(0);
        
        save(report);
        return report;
    }

    public List<CreditReport> getReportHistory(String userId) {
        LambdaQueryWrapper<CreditReport> query = new LambdaQueryWrapper<>();
        query.eq(CreditReport::getUserId, userId)
             .eq(CreditReport::getDelFlag, 0)
             .orderByDesc(CreditReport::getCreatedAt);
        return list(query);
    }
}