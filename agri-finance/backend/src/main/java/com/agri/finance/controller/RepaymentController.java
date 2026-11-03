package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Loan;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.entity.Pledge;
import com.agri.finance.entity.RepaymentPlan;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.ICreditScoreService;
import com.agri.finance.service.impl.MessageNotificationServiceImpl;
import com.agri.finance.service.impl.OverdueRecordServiceImpl;
import com.agri.finance.service.impl.PledgeServiceImpl;
import com.agri.finance.service.impl.RepaymentPlanServiceImpl;
import com.agri.finance.service.impl.LoanServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/repayment")
public class RepaymentController {

    private final RepaymentPlanServiceImpl repaymentPlanService;
    private final LoanServiceImpl loanService;
    private final OverdueRecordServiceImpl overdueRecordService;
    private final PledgeServiceImpl pledgeService;
    private final ICreditScoreService creditScoreService;
    private final MessageNotificationServiceImpl messageService;
    private final FinanceIdentityService identityService;

    public RepaymentController(RepaymentPlanServiceImpl repaymentPlanService,
                               LoanServiceImpl loanService,
                               OverdueRecordServiceImpl overdueRecordService,
                               PledgeServiceImpl pledgeService,
                               ICreditScoreService creditScoreService,
                               MessageNotificationServiceImpl messageService,
                               FinanceIdentityService identityService) {
        this.repaymentPlanService = repaymentPlanService;
        this.loanService = loanService;
        this.overdueRecordService = overdueRecordService;
        this.pledgeService = pledgeService;
        this.creditScoreService = creditScoreService;
        this.messageService = messageService;
        this.identityService = identityService;
    }

    @GetMapping("/plans")
    public Map<String, Object> getRepaymentPlans(@RequestParam(defaultValue = "") String loanId,
                                                 @RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<RepaymentPlan> query = new LambdaQueryWrapper<>();
        query.eq(RepaymentPlan::getDelFlag, 0);
        if (!loanId.isEmpty()) {
            query.eq(RepaymentPlan::getLoanId, loanId);
        }
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            List<String> loanIds = loanIdsOf(scope);
            if (loanIds.isEmpty()) {
                return Map.of("code", 200, "message", "success", "data", List.of());
            }
            query.in(RepaymentPlan::getLoanId, loanIds);
        }
        query.orderByAsc(RepaymentPlan::getDueDate);
        return Map.of("code", 200, "message", "success", "data", repaymentPlanService.list(query));
    }

    @GetMapping("/plan/{id}")
    public Map<String, Object> getRepaymentPlan(@PathVariable String id) {
        RepaymentPlan plan = repaymentPlanService.getById(id);
        if (plan == null) {
            return Map.of("code", 404, "message", "还款计划不存在", "data", "");
        }
        identityService.assertBorrowerOwns(ownerOf(plan));
        return Map.of("code", 200, "message", "success", "data", plan);
    }

    /**
     * 还款：按期账单还款，本金还清即结清。
     *
     * <p>结清不再只是把状态改一下：同期要关掉逾期记录、重算信用分、给融资方和
     * 资金方各发一条通知 —— 原来还完钱这些都不会发生，逾期台账会一直挂着。</p>
     */
    @PostMapping("/pay")
    @OperatorOnly("finance:borrower")
    @Transactional
    public Map<String, Object> payRepayment(@RequestBody Map<String, String> request) {
        String planId = request.get("planId");
        if (planId == null || planId.isBlank()) {
            return Map.of("code", 400, "message", "缺少还款账单编号", "data", "");
        }
        RepaymentPlan plan = repaymentPlanService.getById(planId);
        if (plan == null || Integer.valueOf(1).equals(plan.getDelFlag())) {
            return Map.of("code", 404, "message", "还款计划不存在", "data", "");
        }
        identityService.assertBorrowerOwns(ownerOf(plan));
        if ("已还款".equals(plan.getStatus())) {
            return Map.of("code", 400, "message", "该期账单已经还清", "data", plan);
        }
        plan.setStatus("已还款");
        plan.setPaidDate(LocalDateTime.now());
        plan.setPaidPrincipal(plan.getPrincipal());
        plan.setPaidInterest(plan.getInterest());
        plan.setUpdatedAt(LocalDateTime.now());
        repaymentPlanService.updateById(plan);

        Loan loan = loanService.getById(plan.getLoanId());
        if (loan == null) {
            return Map.of("code", 404, "message", "账单对应的借款不存在", "data", "");
        }
        List<RepaymentPlan> plans = repaymentPlanService.lambdaQuery()
                .eq(RepaymentPlan::getLoanId, loan.getId())
                .eq(RepaymentPlan::getDelFlag, 0)
                .list();
        BigDecimal paidPrincipal = plans.stream()
                .map(RepaymentPlan::getPaidPrincipal)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paidInterest = plans.stream()
                .map(RepaymentPlan::getPaidInterest)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        loan.setPaidAmount(paidPrincipal);
        loan.setRemainingAmount(loan.getAmount().subtract(paidPrincipal).max(BigDecimal.ZERO));
        loan.setInterestAmount(paidInterest);
        boolean settled = loan.getRemainingAmount().signum() == 0;
        loan.setStatus(settled ? "已结清" : "还款中");
        loan.setUpdatedAt(LocalDateTime.now());
        loanService.updateById(loan);

        if (settled) {
            settle(loan, plans);
        } else {
            messageService.notifyBorrower(loan.getUserId(), "REPAYMENT", "第" + plan.getPeriod() + "期还款成功",
                    "借款 " + loan.getLoanNo() + " 第" + plan.getPeriod() + "期已还清 "
                            + plan.getTotalAmount() + " 元，剩余本金 " + loan.getRemainingAmount() + " 元。",
                    "LOAN", loan.getId());
        }
        return Map.of("code", 200, "message", settled ? "借款已结清" : "还款成功", "data", plan);
    }

    /** 结清后的收尾：逾期台账关闭 + 质押与仓单释放 + 信用分重算 + 双方通知。 */
    private void settle(Loan loan, List<RepaymentPlan> plans) {
        List<OverdueRecord> openRecords = overdueRecordService.lambdaQuery()
                .eq(OverdueRecord::getLoanId, loan.getId())
                .eq(OverdueRecord::getDelFlag, 0)
                .ne(OverdueRecord::getStatus, "已结清")
                .list();
        LocalDateTime now = LocalDateTime.now();
        for (OverdueRecord record : openRecords) {
            record.setStatus("已结清");
            record.setUpdatedAt(now);
            overdueRecordService.updateById(record);
        }
        plans.stream()
                .filter(item -> !"已还款".equals(item.getStatus()) && item.getDueDate() != null
                        && item.getDueDate().isBefore(now))
                .forEach(item -> {
                    item.setStatus("已还款");
                    item.setPaidDate(now);
                    item.setPaidPrincipal(item.getPrincipal());
                    item.setPaidInterest(item.getInterest());
                    item.setUpdatedAt(now);
                    repaymentPlanService.updateById(item);
                });
        creditScoreService.generateCreditReport(loan.getUserId());
        List<Pledge> released = pledgeService.releaseByLoan(loan);
        String releaseNote = released.isEmpty() ? ""
                : "本笔借款关联的 " + released.size() + " 笔质押与仓单已同时释放，货物可以正常出库处置。";
        messageService.notifyBorrower(loan.getUserId(), "REPAYMENT", "借款已结清",
                "借款 " + loan.getLoanNo() + " 本金与利息已全部还清，额度已释放，可再次申请融资。" + releaseNote,
                "LOAN", loan.getId());
    }

    private List<String> loanIdsOf(String userId) {
        return loanService.lambdaQuery()
                .eq(Loan::getUserId, userId)
                .eq(Loan::getDelFlag, 0)
                .list()
                .stream()
                .map(Loan::getId)
                .toList();
    }

    private String ownerOf(RepaymentPlan plan) {
        Loan loan = loanService.getById(plan.getLoanId());
        if (loan == null) {
            throw new com.agri.common.exception.BusinessException(404, "账单对应的借款不存在");
        }
        return loan.getUserId();
    }
}
