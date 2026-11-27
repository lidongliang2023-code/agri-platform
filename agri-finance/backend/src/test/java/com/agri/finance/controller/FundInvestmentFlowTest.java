package com.agri.finance.controller;

import com.agri.finance.entity.Investment;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.AssetServiceImpl;
import com.agri.finance.service.impl.FundAccountServiceImpl;
import com.agri.finance.service.impl.FinanceApprovalRecordServiceImpl;
import com.agri.finance.service.impl.FundPortfolioServiceImpl;
import com.agri.finance.service.impl.FundWorkbenchServiceImpl;
import com.agri.finance.service.impl.InvestmentServiceImpl;
import com.agri.finance.service.impl.LoanApprovalServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "spring.profiles.active=test",
                "spring.datasource.url=jdbc:h2:mem:fund-flow;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
                "spring.datasource.driver-class-name=org.h2.Driver",
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "spring.sql.init.mode=always",
                "spring.sql.init.schema-locations=classpath:schema.sql",
                "spring.sql.init.data-locations=classpath:data.sql",
                "platform.rbac.enabled=false"
        }
)
@Transactional
class FundInvestmentFlowTest {

    @Autowired
    private FundWorkbenchServiceImpl workbenchService;

    @Autowired
    private FundAccountServiceImpl accountService;

    @Autowired
    private FundPortfolioServiceImpl portfolioService;

    @Autowired
    private LoanApprovalServiceImpl approvalService;

    @Autowired
    private FinanceApprovalRecordServiceImpl approvalRecordService;

    @Autowired
    private AssetServiceImpl assetService;

    @Autowired
    private InvestmentServiceImpl investmentService;

    @Autowired
    private InvestmentController investmentController;

    @Autowired
    private LoanController loanController;

    /** 身份由令牌解析，测试里把它钉在 PROVIDER-BANK-001 上（真实令牌链路见 scripts/e2e-finance-flow.mjs）。 */
    @MockBean
    private FinanceIdentityService identityService;

    @Test
    @SuppressWarnings("unchecked")
    void workbenchAndMarketUsePersistedFundAndAssetData() {
        Map<String, Object> workbench = workbenchService.workbench("PROVIDER-BANK-001");
        Map<String, Object> market = workbenchService.market("PROVIDER-BANK-001");

        assertThat(((FundProvider) workbench.get("provider")).getInstitutionName())
                .isEqualTo("丰链云合作银行");
        assertThat((List<?>) workbench.get("recommendedAssets")).isNotEmpty();
        Map<String, Object> tasks = (Map<String, Object>) workbench.get("tasks");
        Map<String, Object> summary = (Map<String, Object>) market.get("summary");
        assertThat(tasks).containsKeys(
                "pendingApprovals", "dueSoonCount", "overdueCount", "unreadMessages");
        assertThat(((Number) summary.get("assetCount")).intValue()).isEqualTo(4);
        assertThat(((Number) ((Map<?, ?>) market.get("account")).get("availableAmount")).doubleValue())
                .isGreaterThan(0);
    }

    @Test
    void subscriptionAndRepaymentCompleteTheInvestmentLoop() {
        when(identityService.currentProviderId()).thenReturn("PROVIDER-BANK-001");
        BigDecimal beforeAvailable = assetService.getAssetDetail("ASSET-002").getAvailableAmount();
        BigDecimal beforeFund = new BigDecimal(
                accountService.account("PROVIDER-BANK-001").get("availableAmount").toString()
        );

        // 请求体里的机构号是"别人家"的：配置结果必须仍落在令牌解析出的机构上
        Map<String, Object> subscribed = investmentController.subscribe(Map.of(
                "assetId", "ASSET-002",
                "providerId", "PROVIDER-EVIL-999",
                "providerName", "冒名机构",
                "amount", "1000"
        ));

        assertThat(subscribed).containsEntry("code", 200);
        Map<?, ?> receipt = (Map<?, ?>) subscribed.get("data");
        Investment investment = (Investment) receipt.get("investment");
        assertThat(investment.getProviderId()).isEqualTo("PROVIDER-BANK-001");
        assertThat(investment.getProviderName()).isEqualTo("丰链云合作银行");
        assertThat(investment.getStatus()).isEqualTo("投资中");
        assertThat(investment.getExpectedReturnTime()).isNotNull();
        assertThat(assetService.getAssetDetail("ASSET-002").getAvailableAmount())
                .isEqualByComparingTo(beforeAvailable.subtract(BigDecimal.valueOf(1000)));
        assertThat(new BigDecimal(
                accountService.account("PROVIDER-BANK-001").get("availableAmount").toString()
        )).isEqualByComparingTo(beforeFund.subtract(BigDecimal.valueOf(1000)));

        Map<String, Object> completed = investmentController.completeInvestment(investment.getId());
        assertThat(completed).containsEntry("code", 200);
        assertThat(investmentService.getById(investment.getId()).getStatus()).isEqualTo("已完成");
        assertThat(investmentService.getById(investment.getId()).getActualReturnAmount())
                .isEqualByComparingTo(investment.getInvestmentAmount().add(investment.getExpectedReturn()));
    }

    @Test
    void invalidAmountsAndCrossProviderOperationsAreRejected() {
        when(identityService.currentProviderId()).thenReturn("PROVIDER-BANK-001");
        Map<String, Object> tooSmall = investmentController.subscribe(Map.of(
                "assetId", "ASSET-002",
                "amount", "1"
        ));
        assertThat(tooSmall).containsEntry("code", 400);

        // 换成另一家机构的身份，去确认别人名下的投资 → 必须拒绝
        when(identityService.currentProviderId()).thenReturn("PROVIDER-OTHER-002");
        Map<String, Object> crossProvider = investmentController.completeInvestment("INVESTMENT-001");
        assertThat(crossProvider).containsEntry("code", 403);
    }

    @Test
    void approvalCreatesAuditRecordAndInvestableAssetOnce() {
        Map<String, Object> approved = approvalService.review(
                "APP-20261015",
                "PROVIDER-BANK-001",
                "丰链云合作银行",
                "已通过",
                "采购合同与经营流水核验通过",
                BigDecimal.valueOf(100000),
                BigDecimal.valueOf(5.80),
                "reviewer-001",
                "资金审批员"
        );

        assertThat(approved).containsEntry("code", 200);
        Map<?, ?> data = (Map<?, ?>) approved.get("data");
        Map<?, ?> generatedAsset = (Map<?, ?>) data.get("generatedAsset");
        assertThat(generatedAsset.get("id")).isEqualTo(
                AssetServiceImpl.approvedApplicationAssetId("APP-20261015")
        );
        assertThat(generatedAsset.get("availableAmount").toString()).isEqualTo("100000.00");
        assertThat(approvalRecordService.findByApplication("APP-20261015", "PROVIDER-BANK-001"))
                .isNotNull();

        Map<String, Object> duplicate = approvalService.review(
                "APP-20261015",
                "PROVIDER-BANK-001",
                "丰链云合作银行",
                "已通过",
                "重复审批",
                BigDecimal.valueOf(100000),
                BigDecimal.valueOf(5.80),
                "reviewer-001",
                "资金审批员"
        );
        assertThat(duplicate).containsEntry("code", 409);
    }

    @Test
    void portfolioAggregationReturnsSummaryAllocationAndActions() {
        Map<String, Object> portfolio = portfolioService.portfolio("PROVIDER-BANK-001");

        Map<?, ?> summary = (Map<?, ?>) portfolio.get("summary");
        assertThat(((Number) summary.get("activeCount")).intValue()).isEqualTo(1);
        assertThat(((Number) summary.get("completedCount")).intValue()).isEqualTo(1);
        assertThat((List<?>) portfolio.get("allocation")).isNotEmpty();
        assertThat((List<?>) portfolio.get("investments")).hasSize(2);
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminApprovalOverviewSucceedsWithoutBoundProvider() {
        when(identityService.hasPermission("finance:admin")).thenReturn(true);
        when(identityService.providerIdFor("")).thenThrow(
                new com.agri.common.exception.BusinessException(403, "当前账号还没有绑定资金机构")
        );

        Map<String, Object> adminView = loanController.approvalOverview("", "admin");
        assertThat(adminView).containsEntry("code", 200);
        Map<String, Object> data = (Map<String, Object>) adminView.get("data");
        assertThat(data).containsEntry("scope", "admin");
        assertThat(data).containsEntry("canSubmitReview", false);
        assertThat((List<?>) data.get("items")).isNotEmpty();

        // 即使未显式传 scope=admin，具备 finance:admin 的运营账号也不应被未绑定资金机构挡成 403
        Map<String, Object> fallbackView = loanController.approvalOverview("", "");
        assertThat(fallbackView).containsEntry("code", 200);
        Map<String, Object> fallbackData = (Map<String, Object>) fallbackView.get("data");
        assertThat(fallbackData).containsEntry("scope", "admin");

        // 非运营账号未绑定资金机构时，仍必须按 403 拒绝，不放宽资金方边界
        when(identityService.hasPermission("finance:admin")).thenReturn(false);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> loanController.approvalOverview("", "admin"))
                .isInstanceOf(com.agri.common.exception.BusinessException.class)
                .hasMessageContaining("资金机构");
    }

    @Test
    void overdueReadAllowsFinanceReviewWhileWritesRemainAdminOnly() throws Exception {
        com.agri.common.rbac.PermissionResolver resolver = org.mockito.Mockito.mock(com.agri.common.rbac.PermissionResolver.class);
        com.agri.common.rbac.RbacProperties props = new com.agri.common.rbac.RbacProperties();
        props.setOperatorPaths(List.of("/api/**"));
        props.setReadPermission("finance:read");
        props.setWritePermission("finance:write");
        props.setRequireAuth(true);
        com.agri.common.rbac.OperatorGuardInterceptor interceptor =
                new com.agri.common.rbac.OperatorGuardInterceptor(resolver, props);

        var listMethod = new org.springframework.web.method.HandlerMethod(
                new Object(),
                OverdueController.class.getMethod("getOverdueRecords", String.class, String.class, String.class));
        var scanMethod = new org.springframework.web.method.HandlerMethod(
                new Object(),
                OverdueController.class.getMethod("scan"));
        var assignMethod = new org.springframework.web.method.HandlerMethod(
                new Object(),
                OverdueController.class.getMethod("assignCollector", Map.class));
        var paidMethod = new org.springframework.web.method.HandlerMethod(
                new Object(),
                OverdueController.class.getMethod("markPaid", Map.class));

        // 资金方（finance:fund + finance:review，不含 finance:admin）：可读取逾期列表，但禁止扫描/分配/核销
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:fund", "finance:review"));
        var fundListReq = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/v1/overdue/list");
        fundListReq.addHeader("Authorization", "Bearer fund-token");
        assertThat(interceptor.preHandle(fundListReq, new org.springframework.mock.web.MockHttpServletResponse(), listMethod)).isTrue();

        for (var writeEntry : List.of(
                Map.entry("/api/v1/overdue/scan", scanMethod),
                Map.entry("/api/v1/overdue/assign", assignMethod),
                Map.entry("/api/v1/overdue/paid", paidMethod))) {
            var req = new org.springframework.mock.web.MockHttpServletRequest("POST", writeEntry.getKey());
            req.addHeader("Authorization", "Bearer fund-token");
            var res = new org.springframework.mock.web.MockHttpServletResponse();
            assertThat(interceptor.preHandle(req, res, writeEntry.getValue())).isFalse();
            assertThat(res.getStatus()).isEqualTo(403);
        }

        // 融资方（仅 finance:borrower，不含 finance:review）：读取逾期列表必须拒绝 403
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:borrower"));
        var borrowerReq = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/v1/overdue/list");
        borrowerReq.addHeader("Authorization", "Bearer borrower-token");
        var borrowerRes = new org.springframework.mock.web.MockHttpServletResponse();
        assertThat(interceptor.preHandle(borrowerReq, borrowerRes, listMethod)).isFalse();
        assertThat(borrowerRes.getStatus()).isEqualTo(403);

        // 运营（finance:admin + finance:review）：读写全部放行
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:admin", "finance:review"));
        var adminScanReq = new org.springframework.mock.web.MockHttpServletRequest("POST", "/api/v1/overdue/scan");
        adminScanReq.addHeader("Authorization", "Bearer admin-token");
        assertThat(interceptor.preHandle(adminScanReq, new org.springframework.mock.web.MockHttpServletResponse(), scanMethod)).isTrue();
    }

    @Test
    void riskRuleReadAllowsFinanceReviewWhileWritesAndCenterRemainFundOnly() throws Exception {
        com.agri.common.rbac.PermissionResolver resolver = org.mockito.Mockito.mock(com.agri.common.rbac.PermissionResolver.class);
        com.agri.common.rbac.RbacProperties props = new com.agri.common.rbac.RbacProperties();
        props.setOperatorPaths(List.of("/api/**"));
        props.setReadPermission("finance:read");
        props.setWritePermission("finance:write");
        props.setRequireAuth(true);
        com.agri.common.rbac.OperatorGuardInterceptor interceptor =
                new com.agri.common.rbac.OperatorGuardInterceptor(resolver, props);
        // 必须用真实控制器实例：HandlerMethod 按 bean 类型读取类级 @OperatorOnly("finance:fund")。
        RiskControlController riskBean = new RiskControlController(null, null);

        Map<String, org.springframework.web.method.HandlerMethod> reads = Map.of(
                "/api/v1/risk-control/rules", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("getAllRules")),
                "/api/v1/risk-control/rules/enabled", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("getEnabledRules")),
                "/api/v1/risk-control/rules/type/CREDIT", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("getRulesByType", String.class)));
        List<Map.Entry<String, org.springframework.web.method.HandlerMethod>> fundOnly = List.of(
                Map.entry("PUT /api/v1/risk-control/rule", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("updateRule", com.agri.finance.entity.RiskControlRule.class))),
                Map.entry("POST /api/v1/risk-control/rule", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("createRule", com.agri.finance.entity.RiskControlRule.class))),
                Map.entry("POST /api/v1/risk-control/rule/enable/R1", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("enableRule", String.class))),
                Map.entry("POST /api/v1/risk-control/rule/disable/R1", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("disableRule", String.class))),
                Map.entry("GET /api/v1/risk-control/center", new org.springframework.web.method.HandlerMethod(riskBean,
                        RiskControlController.class.getMethod("center", String.class))));

        // 平台运营 MARKET_OPS（finance:admin + finance:review，无 finance:fund）：可读规则，不能改规则、不能进风控中台
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:admin", "finance:review"));
        for (var read : reads.entrySet()) {
            var req = new org.springframework.mock.web.MockHttpServletRequest("GET", read.getKey());
            req.addHeader("Authorization", "Bearer ops-token");
            assertThat(interceptor.preHandle(req, new org.springframework.mock.web.MockHttpServletResponse(), read.getValue())).isTrue();
        }
        for (var write : fundOnly) {
            String[] parts = write.getKey().split(" ");
            var req = new org.springframework.mock.web.MockHttpServletRequest(parts[0], parts[1]);
            req.addHeader("Authorization", "Bearer ops-token");
            var res = new org.springframework.mock.web.MockHttpServletResponse();
            assertThat(interceptor.preHandle(req, res, write.getValue())).isFalse();
            assertThat(res.getStatus()).isEqualTo(403);
        }

        // 资金方（finance:fund + finance:review）：读写全部放行
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:fund", "finance:review"));
        for (var write : fundOnly) {
            String[] parts = write.getKey().split(" ");
            var req = new org.springframework.mock.web.MockHttpServletRequest(parts[0], parts[1]);
            req.addHeader("Authorization", "Bearer fund-token");
            assertThat(interceptor.preHandle(req, new org.springframework.mock.web.MockHttpServletResponse(), write.getValue())).isTrue();
        }

        // 融资方（无 finance:review）：读取规则仍必须拒绝
        when(resolver.currentPermissions()).thenReturn(java.util.Set.of("finance:read", "finance:write", "finance:borrower"));
        var borrowerReq = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/v1/risk-control/rules");
        borrowerReq.addHeader("Authorization", "Bearer borrower-token");
        var borrowerRes = new org.springframework.mock.web.MockHttpServletResponse();
        assertThat(interceptor.preHandle(borrowerReq, borrowerRes, reads.get("/api/v1/risk-control/rules"))).isFalse();
        assertThat(borrowerRes.getStatus()).isEqualTo(403);
    }
}
