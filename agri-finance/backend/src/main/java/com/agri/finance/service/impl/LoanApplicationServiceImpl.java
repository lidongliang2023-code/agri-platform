package com.agri.finance.service.impl;

import com.agri.finance.entity.LoanApplication;
import com.agri.finance.mapper.LoanApplicationMapper;
import com.agri.finance.service.ICreditScoreService;
import com.agri.finance.service.ILoanApplicationService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class LoanApplicationServiceImpl extends ServiceImpl<LoanApplicationMapper, LoanApplication> implements ILoanApplicationService {

    private final ICreditScoreService creditScoreService;

    public LoanApplicationServiceImpl(ICreditScoreService creditScoreService) {
        this.creditScoreService = creditScoreService;
    }

    @Override
    public LoanApplication apply(LoanApplication application) {
        application.setApplicationNo("LN" + System.currentTimeMillis());
        application.setStatus("待审批");
        application.setApplyTime(LocalDateTime.now());
        application.setCreatedAt(LocalDateTime.now());
        application.setUpdatedAt(LocalDateTime.now());
        application.setDelFlag(0);
        if (application.getRepaymentMethod() == null || application.getRepaymentMethod().isBlank()) {
            application.setRepaymentMethod("等额本息");
        }

        var creditScore = creditScoreService.generateCreditReport(application.getUserId());
        application.setCreditScore(String.valueOf(creditScore.getCompositeScore()));
        application.setCreditLevel(creditScore.getCreditLevel());
        application.setSuggestedAmount(creditScore.getAvailableAmount());
        application.setSuggestedRate(creditScore.getReferenceRate());

        BigDecimal available = creditScore.getAvailableAmount() == null
                ? BigDecimal.ZERO : creditScore.getAvailableAmount();
        double usageRatio = available.signum() > 0
                ? application.getApplyAmount().divide(available, 6, java.math.RoundingMode.HALF_UP).doubleValue()
                : 1.0;
        double confidence = usageRatio <= 0.5 ? 0.94 : usageRatio <= 0.8 ? 0.85 : 0.72;
        application.setAiReviewResult(confidence >= 0.9 ? "通过" : "人工复核");
        application.setAiConfidence(new BigDecimal(String.format("%.3f", confidence)));

        save(application);
        return application;
    }

    @Override
    public LoanApplication review(String id, String result, String opinion, BigDecimal amount, BigDecimal rate) {
        LoanApplication application = getById(id);
        if (application != null) {
            application.setStatus(result);
            application.setReviewOpinion(opinion);
            application.setReviewTime(LocalDateTime.now());
            if ("已通过".equals(result)) {
                application.setActualAmount(amount != null ? amount : application.getSuggestedAmount());
                application.setActualRate(rate != null ? rate : application.getSuggestedRate());
            }
            application.setUpdatedAt(LocalDateTime.now());
            updateById(application);
        }
        return application;
    }
}
