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
}
