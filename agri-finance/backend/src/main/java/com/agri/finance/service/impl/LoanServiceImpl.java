package com.agri.finance.service.impl;

import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.mapper.LoanMapper;
import com.agri.finance.service.ILoanApplicationService;
import com.agri.finance.service.ILoanService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class LoanServiceImpl extends ServiceImpl<LoanMapper, Loan> implements ILoanService {

    private final ILoanApplicationService loanApplicationService;
    private final RepaymentPlanServiceImpl repaymentPlanService;

    public LoanServiceImpl(ILoanApplicationService loanApplicationService,
                           RepaymentPlanServiceImpl repaymentPlanService) {
        this.loanApplicationService = loanApplicationService;
        this.repaymentPlanService = repaymentPlanService;
    }

    @Override
    @Transactional
    public Loan createLoan(String applicationId) {
        LoanApplication application = loanApplicationService.getById(applicationId);
        if (application == null || !"已通过".equals(application.getStatus())) {
            return null;
        }
        Loan existing = lambdaQuery().eq(Loan::getApplicationId, applicationId)
                .eq(Loan::getDelFlag, 0).one();
        if (existing != null) {
            return existing;
        }

        Loan loan = new Loan();
        loan.setLoanNo("LOAN" + System.currentTimeMillis());
        loan.setApplicationId(applicationId);
        loan.setUserId(application.getUserId());
        loan.setProductType(application.getProductType());
        loan.setAmount(application.getActualAmount());
        loan.setRate(application.getActualRate());
        loan.setTerm(application.getApplyTerm());
        loan.setRepaymentMethod(application.getRepaymentMethod());
        loan.setStatus("还款中");
        loan.setRemainingAmount(application.getActualAmount());
        loan.setPaidAmount(BigDecimal.ZERO);
        loan.setInterestAmount(application.getActualAmount().multiply(application.getActualRate()).divide(new java.math.BigDecimal("100")));
        loan.setLoanDate(LocalDateTime.now());
        loan.setDueDate(LocalDateTime.now().plusMonths(application.getApplyTerm()));
        loan.setCreatedAt(LocalDateTime.now());
        loan.setUpdatedAt(LocalDateTime.now());
        loan.setDelFlag(0);

        save(loan);
        repaymentPlanService.generatePlans(
                loan.getId(),
                loan.getLoanNo(),
                loan.getAmount(),
                loan.getRate(),
                loan.getTerm(),
                loan.getRepaymentMethod()
        );
        return loan;
    }
}
