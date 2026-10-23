package com.agri.finance.controller;

import com.agri.finance.entity.RepaymentPlan;
import com.agri.finance.entity.Loan;
import com.agri.finance.service.impl.RepaymentPlanServiceImpl;
import com.agri.finance.service.impl.LoanServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/repayment")
public class RepaymentController {

    private final RepaymentPlanServiceImpl repaymentPlanService;
    private final LoanServiceImpl loanService;

    public RepaymentController(RepaymentPlanServiceImpl repaymentPlanService,
                               LoanServiceImpl loanService) {
        this.repaymentPlanService = repaymentPlanService;
        this.loanService = loanService;
    }

    @GetMapping("/plans")
    public Map<String, Object> getRepaymentPlans(@RequestParam(defaultValue = "") String loanId) {
        LambdaQueryWrapper<RepaymentPlan> query = new LambdaQueryWrapper<>();
        query.eq(RepaymentPlan::getDelFlag, 0);
        if (!loanId.isEmpty()) {
            query.eq(RepaymentPlan::getLoanId, loanId);
        }
        query.orderByAsc(RepaymentPlan::getDueDate);
        var list = repaymentPlanService.list(query);
        return Map.of("code", 200, "message", "success", "data", list);
    }

    @GetMapping("/plan/{id}")
    public Map<String, Object> getRepaymentPlan(@PathVariable String id) {
        RepaymentPlan plan = repaymentPlanService.getById(id);
        return Map.of("code", 200, "message", "success", "data", plan);
    }

    @PostMapping("/pay")
    public Map<String, Object> payRepayment(@RequestBody Map<String, String> request) {
        String planId = request.get("planId");
        RepaymentPlan plan = repaymentPlanService.getById(planId);
        if (plan == null || Integer.valueOf(1).equals(plan.getDelFlag())) {
            return Map.of("code", 404, "message", "还款计划不存在", "data", "");
        }
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
        if (loan != null) {
            var plans = repaymentPlanService.lambdaQuery()
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
            loan.setStatus(loan.getRemainingAmount().signum() == 0 ? "已结清" : "还款中");
            loan.setUpdatedAt(LocalDateTime.now());
            loanService.updateById(loan);
        }
        return Map.of("code", 200, "message", "success", "data", plan);
    }
}
