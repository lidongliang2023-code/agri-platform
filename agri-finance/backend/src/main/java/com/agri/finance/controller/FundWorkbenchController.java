package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.FundWorkbenchServiceImpl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 资金工作台。机构号取当前登录者绑定的资金机构，不再由前端写死。
 */
@RestController
@RequestMapping("/api/v1/fund-workbench")
@OperatorOnly("finance:fund")
public class FundWorkbenchController {

    private final FundWorkbenchServiceImpl workbenchService;
    private final FinanceIdentityService identityService;

    public FundWorkbenchController(FundWorkbenchServiceImpl workbenchService,
                                   FinanceIdentityService identityService) {
        this.workbenchService = workbenchService;
        this.identityService = identityService;
    }

    @GetMapping("/mine")
    public Map<String, Object> workbench() {
        return Map.of("code", 200, "message", "success",
                "data", workbenchService.workbench(identityService.currentProviderId()));
    }

    @GetMapping("/mine/market")
    public Map<String, Object> market() {
        return Map.of("code", 200, "message", "success",
                "data", workbenchService.market(identityService.currentProviderId()));
    }

    @GetMapping("/mine/asset/{assetId}")
    public Map<String, Object> assetDetail(@PathVariable String assetId) {
        try {
            return Map.of("code", 200, "message", "success",
                    "data", workbenchService.assetDetail(identityService.currentProviderId(), assetId));
        } catch (IllegalArgumentException error) {
            return Map.of("code", 404, "message", error.getMessage(), "data", "");
        }
    }
}
