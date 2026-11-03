package com.agri.finance.service.impl;

import com.agri.finance.entity.CreditScore;
import com.agri.finance.entity.Loan;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.entity.RepaymentPlan;
import com.agri.finance.mapper.CreditScoreMapper;
import com.agri.finance.mapper.LoanMapper;
import com.agri.finance.mapper.OverdueRecordMapper;
import com.agri.finance.mapper.RepaymentPlanMapper;
import com.agri.finance.service.ICreditScoreService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * 授信评分。
 *
 * <p><b>基线与实况分开算</b>：外部征信未接入，初评基线仍按账号稳定生成
 * （同一个主体每次算出来的基线一致，不会刷一次换一个分）；但逾期数、在贷余额、
 * 按期履约率、累计放款这些<b>平台自己就有的数据必须真算</b>并参与评分。
 * 原实现是"库里已有就直接返回"，于是还清一笔借款、逾期一期账单，分数与额度都不动 ——
 * 授信模型与业务数据完全脱钩。</p>
 */
@Service
public class CreditScoreServiceImpl extends ServiceImpl<CreditScoreMapper, CreditScore> implements ICreditScoreService {

    private final LoanMapper loanMapper;
    private final OverdueRecordMapper overdueRecordMapper;
    private final RepaymentPlanMapper repaymentPlanMapper;

    public CreditScoreServiceImpl(LoanMapper loanMapper,
                                  OverdueRecordMapper overdueRecordMapper,
                                  RepaymentPlanMapper repaymentPlanMapper) {
        this.loanMapper = loanMapper;
        this.overdueRecordMapper = overdueRecordMapper;
        this.repaymentPlanMapper = repaymentPlanMapper;
    }

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
    @Transactional
    public CreditScore generateCreditReport(String userId) {
        int seed = Math.abs(Objects.hash(userId)) % 31;
        List<Loan> loans = loansOf(userId);
        long overdueCount = overdueRecordsOf(userId).size();
        long settledCount = loans.stream().filter(item -> "已结清".equals(item.getStatus())).count();
        BigDecimal outstanding = loans.stream()
                .map(Loan::getRemainingAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fundedTotal = loans.stream()
                .map(Loan::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal baselineAvailable = new BigDecimal(500000 + seed * 10000L);
        BigDecimal fulfillmentRate = onTimeRate(loans.stream().map(Loan::getId).toList());

        CreditScore existing = getCreditScore(userId);
        CreditScore score = existing == null ? new CreditScore() : existing;
        int baseline = 740 + seed;
        // 逾期一笔扣 20 分，按期结清一笔加 10 分，分数区间与等级口径保持不变
        int composite = Math.max(300, Math.min(950,
                baseline - (int) overdueCount * 20 + (int) settledCount * 10));
        int previous = score.getCompositeScore() == null ? composite : score.getCompositeScore();

        score.setUserId(userId);
        score.setCompositeScore(composite);
        score.setCreditLevel(calculateCreditLevel(composite));
        score.setBusinessAbilityScore(76 + seed / 4);
        score.setDebtAbilityScore(74 + seed / 3);
        score.setCreditRecordScore(Math.max(40, Math.min(100, 86 + seed / 6 - (int) overdueCount * 8)));
        score.setStabilityScore(78 + seed / 5);
        score.setAvailableAmount(baselineAvailable.subtract(outstanding).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP));
        score.setReferenceRate(new BigDecimal("6.20")
                .subtract(new BigDecimal(seed).divide(new BigDecimal("500"), 2, RoundingMode.HALF_UP))
                .add(new BigDecimal(overdueCount * 20).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)));
        score.setScoreChange(composite - previous);
        score.setChangeTrend(composite > previous ? "上升" : composite < previous ? "下降" : "稳定");
        score.setPlatformMonths(18 + seed);
        score.setTotalTransactionAmount(fundedTotal.setScale(2, RoundingMode.HALF_UP));
        score.setFulfillmentRate(fulfillmentRate);
        score.setOverdueCount((int) overdueCount);
        score.setRepurchaseRate(new BigDecimal("82.00")
                .add(new BigDecimal(seed).divide(new BigDecimal("10"), 2, RoundingMode.HALF_UP)));
        score.setRiskAlerts(overdueCount > 0
                ? "当前有 " + overdueCount + " 笔逾期台账未关闭，按每笔 20 分扣减，请及时结清"
                : "无逾期台账；在贷余额 " + outstanding.setScale(2, RoundingMode.HALF_UP).toPlainString() + " 元");
        score.setImprovementSuggestions(settledCount > 0
                ? "已结清 " + settledCount + " 笔借款（每笔加 10 分）；补充仓单或订单确权材料可提升授信额度"
                : "保持订单履约与按期还款；补充仓单或订单确权材料可提升授信额度");
        score.setEvaluationTime(LocalDateTime.now());
        score.setUpdatedAt(LocalDateTime.now());
        if (existing == null) {
            score.setCreatedAt(LocalDateTime.now());
            score.setDelFlag(0);
            save(score);
        } else {
            updateById(score);
        }
        return score;
    }

    /** 按期还款率 = 按期还清的账单 / 已还清的账单；没有已还账单时不参与调整，保持 100。 */
    private BigDecimal onTimeRate(List<String> loanIds) {
        if (loanIds.isEmpty()) {
            return new BigDecimal("100.00");
        }
        LambdaQueryWrapper<RepaymentPlan> query = new LambdaQueryWrapper<>();
        query.in(RepaymentPlan::getLoanId, loanIds)
             .eq(RepaymentPlan::getDelFlag, 0)
             .eq(RepaymentPlan::getStatus, "已还款");
        List<RepaymentPlan> paid = repaymentPlanMapper.selectList(query);
        if (paid.isEmpty()) {
            return new BigDecimal("100.00");
        }
        long onTime = paid.stream()
                .filter(item -> item.getPaidDate() != null && item.getDueDate() != null
                        && !item.getPaidDate().isAfter(item.getDueDate()))
                .count();
        return new BigDecimal(onTime * 100).divide(new BigDecimal(paid.size()), 2, RoundingMode.HALF_UP);
    }

    private List<Loan> loansOf(String userId) {
        return loanMapper.selectList(new LambdaQueryWrapper<Loan>()
                .eq(Loan::getUserId, userId)
                .eq(Loan::getDelFlag, 0));
    }

    private List<OverdueRecord> overdueRecordsOf(String userId) {
        return overdueRecordMapper.selectList(new LambdaQueryWrapper<OverdueRecord>()
                .eq(OverdueRecord::getUserId, userId)
                .eq(OverdueRecord::getDelFlag, 0)
                .ne(OverdueRecord::getStatus, "已结清"));
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
