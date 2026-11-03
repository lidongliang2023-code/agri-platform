package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.Contract;
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
    private final ContractServiceImpl contractService;
    private final PledgeServiceImpl pledgeService;

    public LoanServiceImpl(ILoanApplicationService loanApplicationService,
                           RepaymentPlanServiceImpl repaymentPlanService,
                           ContractServiceImpl contractService,
                           PledgeServiceImpl pledgeService) {
        this.loanApplicationService = loanApplicationService;
        this.repaymentPlanService = repaymentPlanService;
        this.contractService = contractService;
        this.pledgeService = pledgeService;
    }

    /**
     * 融资方确认借款：审批通过后生成待签合同。
     *
     * <p>放款不在这一步 —— 合同没签完就生成借款和还款计划，等于"钱已经借出去、
     * 但法律依据还没落"，实测原实现正是这样（createLoan 直接把借款置为「还款中」并起算计划）。</p>
     */
    @Transactional
    public Contract prepareContract(String applicationId) {
        LoanApplication application = loanApplicationService.getById(applicationId);
        if (application == null) {
            throw new BusinessException(404, "融资申请不存在");
        }
        if (!"已通过".equals(application.getStatus())) {
            throw new BusinessException(409, "只有审批通过的申请可以确认借款，当前状态：" + application.getStatus());
        }
        if (application.getActualAmount() == null || application.getActualAmount().signum() <= 0) {
            throw new BusinessException(409, "审批未确定放款金额，无法生成合同");
        }
        Contract existing = contractService.lambdaQuery()
                .eq(Contract::getApplicationId, applicationId)
                .eq(Contract::getDelFlag, 0)
                .last("LIMIT 1")
                .one();
        if (existing != null) {
            return existing;
        }
        Contract contract = new Contract();
        contract.setApplicationId(applicationId);
        contract.setUserId(application.getUserId());
        contract.setUserName(application.getUserName());
        contract.setContractType((application.getRepaymentMethod() == null ? "等额本息"
                : application.getRepaymentMethod()) + "借款合同");
        contract.setAmount(application.getActualAmount());
        contract.setRate(application.getActualRate());
        contract.setTerm(application.getApplyTerm());
        contract.setStartDate(LocalDateTime.now());
        contract.setEndDate(LocalDateTime.now().plusMonths(application.getApplyTerm()));
        return contractService.createContract(contract);
    }

    /**
     * 放款：合同双方签署完成后才生成借款与还款计划。
     *
     * <p>幂等：同一申请重复调用返回既有借款（审批页刷新、并发点击都不该产生第二笔债）。</p>
     */
    @Transactional
    public Loan disburse(String applicationId) {
        LoanApplication application = loanApplicationService.getById(applicationId);
        if (application == null || !"已通过".equals(application.getStatus())) {
            throw new BusinessException(400, "申请未通过或不存在，不能放款");
        }
        Loan existing = lambdaQuery().eq(Loan::getApplicationId, applicationId)
                .eq(Loan::getDelFlag, 0).one();
        if (existing != null) {
            return existing;
        }
        Contract contract = contractService.lambdaQuery()
                .eq(Contract::getApplicationId, applicationId)
                .eq(Contract::getDelFlag, 0)
                .last("LIMIT 1")
                .one();
        if (contract == null) {
            throw new BusinessException(409, "还没有生成借款合同，请融资方先确认借款");
        }
        if (!contractService.isFullySigned(contract)) {
            throw new BusinessException(409, "借款合同尚未双方签署，不能放款");
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
        loan.setLoanDate(LocalDateTime.now());
        loan.setDueDate(LocalDateTime.now().plusMonths(application.getApplyTerm()));
        loan.setCreatedAt(LocalDateTime.now());
        loan.setUpdatedAt(LocalDateTime.now());
        loan.setDelFlag(0);
        save(loan);

        contract.setLoanId(loan.getId());
        contract.setLoanNo(loan.getLoanNo());
        contract.setStatus("执行中");
        contract.setUpdatedAt(LocalDateTime.now());
        contractService.updateById(contract);

        // 担保关系跟着借款走：质押是在申请阶段建立的，结清要按借款找得到该释放哪张质押
        pledgeService.linkLoan(applicationId, loan.getId());

        BigDecimal plannedInterest = repaymentPlanService.generatePlans(
                loan.getId(),
                loan.getLoanNo(),
                loan.getAmount(),
                loan.getRate(),
                loan.getTerm(),
                loan.getRepaymentMethod()
        );
        // 应还利息按计划表合计，不是"本金×年利率"一个数 —— 期数不同利息完全不同
        loan.setInterestAmount(plannedInterest);
        loan.setUpdatedAt(LocalDateTime.now());
        updateById(loan);
        return loan;
    }
}
