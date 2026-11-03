package com.agri.finance.job;

import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.entity.RepaymentPlan;
import com.agri.finance.service.ICreditScoreService;
import com.agri.finance.service.ILoanApplicationService;
import com.agri.finance.service.impl.LoanServiceImpl;
import com.agri.finance.service.impl.OverdueRecordServiceImpl;
import com.agri.finance.service.impl.RepaymentPlanServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 到期未还 → 逾期台账。
 *
 * <p>这一环原先是断的：库里有 {@code overdue_record} 表、运营端有逾期管理页，
 * 但没有任何代码往里写 —— 账单过了到期日状态还停在「待还款」，页面只能看到种子数据，
 * 授信评分也永远不知道主体逾期了。</p>
 *
 * <p>每天 03:10 扫一次；{@code POST /api/v1/overdue/scan} 是同一份逻辑的手动触发口，
 * 便于运营当天就复核结果，而不是等到凌晨。</p>
 */
@Slf4j
@Component
public class RepaymentOverdueScanner {

    private final RepaymentPlanServiceImpl planService;
    private final LoanServiceImpl loanService;
    private final ILoanApplicationService loanApplicationService;
    private final OverdueRecordServiceImpl overdueRecordService;
    private final ICreditScoreService creditScoreService;

    public RepaymentOverdueScanner(RepaymentPlanServiceImpl planService,
                                   LoanServiceImpl loanService,
                                   ILoanApplicationService loanApplicationService,
                                   OverdueRecordServiceImpl overdueRecordService,
                                   ICreditScoreService creditScoreService) {
        this.planService = planService;
        this.loanService = loanService;
        this.loanApplicationService = loanApplicationService;
        this.overdueRecordService = overdueRecordService;
        this.creditScoreService = creditScoreService;
    }

    @Scheduled(cron = "0 10 3 * * *")
    public void scheduledScan() {
        scan();
    }

    /** @return 本次新登记或更新的逾期条数 */
    @Transactional
    public int scan() {
        LocalDateTime now = LocalDateTime.now();
        List<RepaymentPlan> due = planService.lambdaQuery()
                .eq(RepaymentPlan::getDelFlag, 0)
                .in(RepaymentPlan::getStatus, List.of("待还款", "逾期"))
                .lt(RepaymentPlan::getDueDate, now)
                .list();
        Set<String> affectedUsers = new LinkedHashSet<>();
        int registered = 0;
        for (RepaymentPlan plan : due) {
            Loan loan = loanService.getById(plan.getLoanId());
            if (loan == null || "已结清".equals(loan.getStatus())) {
                continue;
            }
            int days = (int) Math.max(1, Duration.between(plan.getDueDate(), now).toDays());
            // 借款表不存主体名称，主体名从对应的融资申请取
            LoanApplication application = loan.getApplicationId() == null
                    ? null : loanApplicationService.getById(loan.getApplicationId());
            OverdueRecord record = overdueRecordService.registerOverdue(
                    loan.getId(), loan.getLoanNo(), loan.getUserId(),
                    application == null ? null : application.getUserName(),
                    loan.getProductType(),
                    plan.getPrincipal() == null ? java.math.BigDecimal.ZERO : plan.getPrincipal(),
                    plan.getInterest() == null ? java.math.BigDecimal.ZERO : plan.getInterest(),
                    days, plan.getPeriod() == null ? 1 : plan.getPeriod());
            affectedUsers.add(record.getUserId());
            if (!"逾期".equals(plan.getStatus())) {
                plan.setStatus("逾期");
                plan.setUpdatedAt(now);
                planService.updateById(plan);
                registered++;
            }
        }
        affectedUsers.forEach(creditScoreService::generateCreditReport);
        if (!due.isEmpty()) {
            log.info("逾期扫描完成：到期账单 {} 笔，新登记 {} 笔，重算授信主体 {} 个",
                    due.size(), registered, affectedUsers.size());
        }
        return registered;
    }
}
