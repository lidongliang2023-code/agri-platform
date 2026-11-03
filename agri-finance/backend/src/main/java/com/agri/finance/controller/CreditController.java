package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.CreditScore;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.ICreditScoreService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 授信评分查询。
 *
 * <p>融资方只能取自己的分数；运营/资金方可以按主体号查（信用查询页要跨主体看）。
 * 原先 {@code userId} 完全由前端传，任何融资方换个参数就能读别人的授信。</p>
 */
@RestController
@RequestMapping("/api/v1/credit")
public class CreditController {

    private final ICreditScoreService creditScoreService;
    private final FinanceIdentityService identityService;

    public CreditController(ICreditScoreService creditScoreService, FinanceIdentityService identityService) {
        this.creditScoreService = creditScoreService;
        this.identityService = identityService;
    }

    @GetMapping("/score")
    public Map<String, Object> getCreditScore(@RequestParam(defaultValue = "") String userId) {
        String scope = identityService.scopedBorrowerId(userId);
        CreditScore score = creditScoreService.generateCreditReport(
                scope == null ? identityService.currentBorrowerId() : scope);
        return Map.of("code", 200, "message", "success", "data", score);
    }

    @GetMapping("/score/detail")
    public Map<String, Object> getCreditScoreDetail(@RequestParam(defaultValue = "") String userId) {
        return getCreditScore(userId);
    }

    /** 融资方主动重评（额度、履约率、逾期台账按当前数据重算）。 */
    @PostMapping("/evaluate")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> evaluateCredit() {
        CreditScore score = creditScoreService.generateCreditReport(identityService.currentBorrowerId());
        return Map.of("code", 200, "message", "success", "data", score);
    }
}
