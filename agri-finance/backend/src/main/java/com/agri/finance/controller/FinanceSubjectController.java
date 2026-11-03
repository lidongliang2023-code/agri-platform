package com.agri.finance.controller;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.mapper.FundProviderMapper;
import com.agri.finance.mapper.LoanApplicationMapper;
import com.agri.finance.service.FinanceIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 当前登录者在金融侧的身份卡。
 *
 * <p>前端原先把融资方主体号（'2001'）和资金机构号（'PROVIDER-BANK-001'）写死在
 * {@code api/finance.js}、{@code api/operations.js} 里，所有账号登录后看到的都是这一家。
 * 身份一律改由服务端从令牌解析，这里就是那个唯一入口。</p>
 */
@RestController
@RequestMapping("/api/v1/finance")
public class FinanceSubjectController {

    private final FinanceIdentityService identityService;
    private final FundProviderMapper fundProviderMapper;
    private final LoanApplicationMapper loanApplicationMapper;

    public FinanceSubjectController(FinanceIdentityService identityService,
                                    FundProviderMapper fundProviderMapper,
                                    LoanApplicationMapper loanApplicationMapper) {
        this.identityService = identityService;
        this.fundProviderMapper = fundProviderMapper;
        this.loanApplicationMapper = loanApplicationMapper;
    }

    @GetMapping("/subject")
    public Map<String, Object> subject() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("operatorId", identityService.currentOperatorId());
        data.put("operatorName", identityService.currentOperatorName());
        try {
            data.put("borrowerId", identityService.currentBorrowerId());
            data.put("borrowerName", identityService.currentBorrowerName());
            data.put("borrowerError", null);
        } catch (BusinessException e) {
            // 资金方账号未必绑了经营主体：不把整个身份卡打挂，页面按 borrowerError 提示
            data.put("borrowerId", null);
            data.put("borrowerName", null);
            data.put("borrowerError", e.getMessage());
        }
        FundProvider provider = boundProvider();
        data.put("providerId", provider == null ? null : provider.getId());
        data.put("providerName", provider == null ? null : provider.getInstitutionName());
        data.put("providerReady", provider != null
                && "已通过".equals(provider.getReviewStatus())
                && java.util.Set.of("正常", "ACTIVE").contains(provider.getStatus()));
        Map<String, Boolean> roles = new LinkedHashMap<>();
        roles.put("borrower", identityService.hasPermission("finance:borrower"));
        roles.put("fund", identityService.hasPermission("finance:fund"));
        roles.put("admin", identityService.hasPermission("finance:admin"));
        roles.put("review", identityService.hasPermission("finance:review"));
        data.put("roles", roles);
        return Map.of("code", 200, "message", "success", "data", data);
    }

    /**
     * 平台已发生融资业务的主体（运营端「信用查询 / 风控中心」的主体选择器）。
     *
     * <p>这两页原先把主体号写死成 '2001'，页面只能查到一家；现在列真实出现过的主体，
     * 由运营点选。</p>
     */
    @GetMapping("/subjects")
    @OperatorOnly("finance:review")
    public Map<String, Object> subjects() {
        Map<String, String> bySubject = new java.util.LinkedHashMap<>();
        for (LoanApplication application : loanApplicationMapper.selectList(
                new LambdaQueryWrapper<LoanApplication>()
                        .eq(LoanApplication::getDelFlag, 0)
                        .orderByAsc(LoanApplication::getUserId))) {
            String subjectId = application.getUserId();
            if (subjectId == null || subjectId.isBlank()) {
                continue;
            }
            bySubject.putIfAbsent(subjectId, application.getUserName());
        }
        List<Map<String, Object>> data = new ArrayList<>();
        bySubject.forEach((subjectId, subjectName) -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("subjectId", subjectId);
            item.put("subjectName", subjectName == null || subjectName.isBlank() ? subjectId : subjectName);
            data.add(item);
        });
        return Map.of("code", 200, "message", "success", "data", data);
    }

    private FundProvider boundProvider() {
        try {
            String merchantId = identityService.currentBorrowerId();
            return fundProviderMapper.selectOne(new LambdaQueryWrapper<FundProvider>()
                    .eq(FundProvider::getMerchantId, merchantId)
                    .eq(FundProvider::getDelFlag, 0)
                    .last("LIMIT 1"));
        } catch (BusinessException e) {
            return null;
        }
    }
}
