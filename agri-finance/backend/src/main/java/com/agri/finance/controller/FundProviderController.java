package com.agri.finance.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.PlatformMerchantDirectory;
import com.agri.finance.service.impl.FundProviderServiceImpl;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/fund-provider")
@OperatorOnly("finance:fund")
public class FundProviderController {

    private final FundProviderServiceImpl fundProviderService;
    private final FinanceIdentityService identityService;
    private final PlatformMerchantDirectory merchantDirectory;

    public FundProviderController(FundProviderServiceImpl fundProviderService,
                                  FinanceIdentityService identityService,
                                  PlatformMerchantDirectory merchantDirectory) {
        this.fundProviderService = fundProviderService;
        this.identityService = identityService;
        this.merchantDirectory = merchantDirectory;
    }

    /**
     * 反查主体名称（逐条回源平台，机构数量级很小，不做缓存 —— 缓存会让"主体改名"再也看不见）。
     */
    private String merchantName(String merchantId) {
        PlatformMerchantDirectory.MerchantOption merchant = merchantDirectory.find(merchantId);
        return merchant == null ? "（平台已无此主体）" : merchant.merchantName();
    }

    /** 当前登录者绑定的资金机构（资金端页面用它替代写死的机构号）。 */
    @GetMapping("/mine")
    public Map<String, Object> mine() {
        return Map.of("code", 200, "message", "success",
                "data", fundProviderService.getById(identityService.currentProviderId()));
    }

    /**
     * 运营端：资金机构台账（含经营主体绑定与准入状态）。
     *
     * <p>绑定关系决定"哪个登录账号能进哪家机构的资金工作台"，
     * 之前只能靠运维直接改库 —— 页面把它做出来，运营自己就能开通与换绑。</p>
     */
    @GetMapping("/admin/list")
    @OperatorOnly("finance:admin")
    public Map<String, Object> adminList(@RequestParam(defaultValue = "") String keyword,
                                         @RequestParam(defaultValue = "") String bound) {
        List<Map<String, Object>> items = new java.util.ArrayList<>();
        int boundCount = 0;
        int pendingCount = 0;
        for (FundProvider provider : fundProviderService.listActive(keyword)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", provider.getId());
            item.put("providerNo", provider.getProviderNo());
            item.put("institutionName", provider.getInstitutionName());
            item.put("institutionType", provider.getInstitutionType());
            item.put("creditCode", provider.getCreditCode());
            item.put("status", provider.getStatus());
            item.put("reviewStatus", provider.getReviewStatus());
            item.put("reviewOpinion", provider.getReviewOpinion());
            item.put("contactName", provider.getContactName());
            item.put("contactPhone", provider.getContactPhone());
            String merchantId = provider.getMerchantId();
            item.put("merchantId", merchantId);
            item.put("merchantName", merchantId == null || merchantId.isBlank()
                    ? null : merchantName(merchantId));
            if (merchantId != null && !merchantId.isBlank()) {
                boundCount++;
            }
            if ("待审核".equals(provider.getReviewStatus())
                    || provider.getReviewStatus() == null || provider.getReviewStatus().isBlank()) {
                pendingCount++;
            }
            items.add(item);
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total", items.size());
        summary.put("boundCount", boundCount);
        summary.put("unboundCount", items.size() - boundCount);
        summary.put("pendingCount", pendingCount);
        List<Map<String, Object>> filtered = "bound".equals(bound)
                ? items.stream().filter(item -> item.get("merchantId") != null).toList()
                : "unbound".equals(bound)
                ? items.stream().filter(item -> item.get("merchantId") == null).toList()
                : items;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", filtered);
        data.put("summary", summary);
        return Map.of("code", 200, "message", "success", "data", data);
    }

    /** 运营端：可绑定的平台经营主体候选（按名称模糊搜）。 */
    @GetMapping("/merchant-options")
    @OperatorOnly("finance:admin")
    public Map<String, Object> merchantOptions(@RequestParam(defaultValue = "") String keyword) {
        return Map.of("code", 200, "message", "success", "data", merchantDirectory.search(keyword));
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody FundProvider provider) {
        // 机构与主体的绑定关系由令牌决定：自报 merchantId 等于把别人的机构认领成自己的
        provider.setMerchantId(identityService.currentBorrowerId());
        FundProvider result = fundProviderService.register(provider);
        return Map.of("code", 200, "message", "注册成功", "data", result);
    }

    /** 运营端绑定/换绑/解绑资金机构所属经营主体（未绑定的账号无法进入资金工作台）。 */
    @PutMapping("/{id}/binding")
    @OperatorOnly("finance:admin")
    public Map<String, Object> bind(@PathVariable String id, @RequestBody Map<String, String> request) {
        String merchantId = request.get("merchantId");
        FundProvider provider = fundProviderService.getById(id);
        if (provider == null || Integer.valueOf(1).equals(provider.getDelFlag())) {
            return Map.of("code", 404, "message", "资金机构不存在", "data", "");
        }
        if (merchantId == null || merchantId.isBlank()) {
            // updateById 默认跳过 null 字段（MyBatis-Plus 的 NOT_NULL 更新策略），
            // 解绑必须显式 set null，否则接口 200、库里却还是老绑定 —— 实测踩过一次。
            fundProviderService.lambdaUpdate()
                    .set(FundProvider::getMerchantId, null)
                    .set(FundProvider::getUpdatedAt, LocalDateTime.now())
                    .eq(FundProvider::getId, id)
                    .update();
            provider.setMerchantId(null);
            return Map.of("code", 200, "message", "已解绑经营主体", "data", provider);
        }
        String target = merchantId.trim();
        PlatformMerchantDirectory.MerchantOption merchant = merchantDirectory.find(target);
        if (merchant == null) {
            return Map.of("code", 400, "message", "平台不存在该经营主体：" + target + "，请先在客商中心建档", "data", "");
        }
        FundProvider taken = fundProviderService.lambdaQuery()
                .eq(FundProvider::getMerchantId, target)
                .eq(FundProvider::getDelFlag, 0)
                .ne(FundProvider::getId, id)
                .last("LIMIT 1")
                .one();
        if (taken != null) {
            return Map.of("code", 409, "message", "主体「" + merchant.merchantName() + "」已绑定机构「"
                    + taken.getInstitutionName() + "」，请先解绑", "data", "");
        }
        provider.setMerchantId(target);
        provider.setUpdatedAt(LocalDateTime.now());
        fundProviderService.updateById(provider);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("provider", provider);
        data.put("merchant", merchant);
        return Map.of("code", 200, "message", "绑定已保存", "data", data);
    }

    @PostMapping("/approve/{id}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> approve(@PathVariable String id,
                                       @RequestParam(required = false) String opinion) {
        FundProvider result = fundProviderService.approve(id, identityService.currentOperatorId(), opinion);
        return Map.of("code", 200, "message", "审批通过", "data", result);
    }

    @PostMapping("/reject/{id}")
    @OperatorOnly("finance:admin")
    public Map<String, Object> reject(@PathVariable String id,
                                      @RequestParam(required = false) String opinion) {
        FundProvider result = fundProviderService.reject(id, identityService.currentOperatorId(), opinion);
        return Map.of("code", 200, "message", "已拒绝", "data", result);
    }

    @GetMapping("/pending-review")
    @OperatorOnly("finance:admin")
    public Map<String, Object> getPendingReview() {
        List<FundProvider> providers = fundProviderService.getPendingReview();
        return Map.of("code", 200, "message", "success", "data", providers);
    }

    @GetMapping("/active")
    public Map<String, Object> getActiveProviders() {
        List<FundProvider> providers = fundProviderService.getActiveProviders();
        return Map.of("code", 200, "message", "success", "data", providers);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getProviderDetail(@PathVariable String id) {
        FundProvider provider = fundProviderService.getById(id);
        return Map.of("code", 200, "message", "success", "data", provider);
    }
}
