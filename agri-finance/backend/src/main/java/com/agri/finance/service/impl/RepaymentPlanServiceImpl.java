package com.agri.finance.service.impl;

import com.agri.finance.entity.RepaymentPlan;
import com.agri.finance.mapper.RepaymentPlanMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class RepaymentPlanServiceImpl extends ServiceImpl<RepaymentPlanMapper, RepaymentPlan> {

    public void generatePlans(String loanId, String loanNo, BigDecimal amount, BigDecimal rate, Integer term, String repaymentMethod) {
        if ("等额本息".equals(repaymentMethod)) {
            generateEqualInstallmentPlans(loanId, loanNo, amount, rate, term);
        } else {
            generateSinglePaymentPlan(loanId, loanNo, amount, rate, term);
        }
    }

    private void generateEqualInstallmentPlans(String loanId, String loanNo, BigDecimal amount, BigDecimal rate, Integer term) {
        BigDecimal monthlyRate = rate.divide(new BigDecimal("100")).divide(new BigDecimal("12"), 10, BigDecimal.ROUND_HALF_UP);
        BigDecimal monthlyPayment = amount.multiply(monthlyRate).multiply(
            monthlyRate.add(BigDecimal.ONE).pow(term))
            .divide(
                monthlyRate.add(BigDecimal.ONE).pow(term).subtract(BigDecimal.ONE), 
                2, BigDecimal.ROUND_HALF_UP
            );

        BigDecimal remainingPrincipal = amount;
        LocalDateTime dueDate = LocalDateTime.now().plusMonths(1);

        for (int i = 1; i <= term; i++) {
            BigDecimal interest = remainingPrincipal.multiply(monthlyRate).setScale(2, BigDecimal.ROUND_HALF_UP);
            BigDecimal principal = monthlyPayment.subtract(interest).setScale(2, BigDecimal.ROUND_HALF_UP);
            if (i == term) {
                principal = remainingPrincipal;
            }

            RepaymentPlan plan = new RepaymentPlan();
            plan.setLoanId(loanId);
            plan.setLoanNo(loanNo);
            plan.setPeriod(i);
            plan.setPrincipal(principal);
            plan.setInterest(interest);
            plan.setTotalAmount(principal.add(interest));
            plan.setDueDate(dueDate);
            plan.setStatus("待还款");
            plan.setCreatedAt(LocalDateTime.now());
            plan.setUpdatedAt(LocalDateTime.now());
            plan.setDelFlag(0);

            save(plan);

            remainingPrincipal = remainingPrincipal.subtract(principal);
            dueDate = dueDate.plusMonths(1);
        }
    }

    private void generateSinglePaymentPlan(String loanId, String loanNo, BigDecimal amount, BigDecimal rate, Integer term) {
        BigDecimal totalInterest = amount.multiply(rate).multiply(new BigDecimal(term)).divide(new BigDecimal("1200"), 2, BigDecimal.ROUND_HALF_UP);

        RepaymentPlan plan = new RepaymentPlan();
        plan.setLoanId(loanId);
        plan.setLoanNo(loanNo);
        plan.setPeriod(1);
        plan.setPrincipal(amount);
        plan.setInterest(totalInterest);
        plan.setTotalAmount(amount.add(totalInterest));
        plan.setDueDate(LocalDateTime.now().plusMonths(term));
        plan.setStatus("待还款");
        plan.setCreatedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());
        plan.setDelFlag(0);

        save(plan);
    }
}