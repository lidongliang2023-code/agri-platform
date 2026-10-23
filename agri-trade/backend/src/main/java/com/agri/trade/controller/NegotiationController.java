package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.service.IInquiryService;
import com.agri.trade.service.IQuoteService;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/trade/negotiation")
@RequiredArgsConstructor
public class NegotiationController {

    private final IInquiryService inquiryService;
    private final IQuoteService quoteService;
    private final PlatformIdentityService identityService;

    @PostMapping("/inquiry")
    public ApiResponse<Inquiry> createInquiry(@RequestBody Map<String, Object> params) {
        // 原先这里无条件执行 ((Number) params.get("demandId")).longValue()：
        // 请求里没带 demandId 就是空指针 → 500，页面上只看到"发起询价失败"，
        // 后端日志里是一行类型转换异常。改成先校验再取。
        Long demandId = asLong(params.get("demandId"));
        Long productId = asLong(params.get("productId"));
        if (demandId == null || productId == null) {
            return ApiResponse.error("请指定要对哪个货源发起询价（demandId 与 productId 都不能为空）");
        }

        // 采购方**由服务端按登录身份推导**，不再采信请求体里的 buyerId ——
        // 否则谁都能以别人的名义向供应商发起询价（供应商看到的是"某家采购方来问了"）。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        Long buyerId = null;
        if (!scope.merchantIds().isEmpty()) {
            buyerId = scope.merchantIds().get(0);
        }
        if (buyerId == null) {
            return ApiResponse.error("当前账号还没有绑定经营主体，无法发起询价");
        }

        Inquiry inquiry = inquiryService.createInquiry(demandId, productId, scope.merchantIds());
        if (inquiry == null) {
            return ApiResponse.error("发起询价失败：采购需求或货源不存在，或这张需求不是你的（只能对自己的采购需求询价）");
        }
        return ApiResponse.success(inquiry);
    }

    @PostMapping("/inquiry/batch")
    public ApiResponse<List<Inquiry>> batchCreateInquiries(@RequestBody Map<String, Object> params) {
        Long demandId = ((Number) params.get("demandId")).longValue();
        List<Number> productIds = (List<Number>) params.get("productIds");
        Long buyerId = params.containsKey("buyerId") ? ((Number) params.get("buyerId")).longValue() : null;

        List<Long> ids = productIds.stream().map(Number::longValue).toList();
        List<Inquiry> inquiries = inquiryService.batchCreateInquiries(demandId, ids, buyerId);
        return ApiResponse.success(inquiries);
    }

    @GetMapping("/inquiry/buyer/{buyerId}")
    public ApiResponse<List<Inquiry>> getBuyerInquiries(@PathVariable Long buyerId) {
        List<Inquiry> inquiries = inquiryService.getInquiriesByBuyer(buyerId);
        return ApiResponse.success(inquiries);
    }

    /**
     * 我发起的询价（范围由服务端按登录身份推导）。
     *
     * <p>注意路径要比 {@code /inquiry/{inquiryId}/quotes} 更具体，否则会被那条吃掉 ——
     * Spring 会按最具体的模板匹配，"{@code inquiry/mine}" 与 "{@code inquiry/{id}/quotes}"
     * 段数不同，不会冲突。</p>
     */
    @GetMapping("/inquiry/mine")
    public ApiResponse<List<Inquiry>> myInquiries() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(inquiryService.getInquiriesByScope(scope.merchantIds()));
    }

    /** 我收到的询价（供应商视角，等我报价的）。 */
    @GetMapping("/inquiry/received")
    public ApiResponse<List<Inquiry>> receivedInquiries() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(inquiryService.getReceivedInquiriesByScope(scope.merchantIds()));
    }

    @GetMapping("/inquiry/seller/{sellerId}")
    public ApiResponse<List<Inquiry>> getSellerInquiries(@PathVariable Long sellerId) {
        List<Inquiry> inquiries = inquiryService.getInquiriesBySeller(sellerId);
        return ApiResponse.success(inquiries);
    }

    @GetMapping("/inquiry/{inquiryId}/quotes")
    public ApiResponse<List<Quote>> getInquiryQuotes(@PathVariable Long inquiryId) {
        Inquiry inquiry = inquiryService.getById(inquiryId);
        if (inquiry == null) {
            return ApiResponse.error("询价单不存在");
        }
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (!scope.merchantIds().contains(inquiry.getBuyerId())
                && (inquiry.getSellerId() == null || !scope.merchantIds().contains(inquiry.getSellerId()))) {
            return ApiResponse.error("只有询价单的采购方或供货方可以查看报价");
        }
        List<Quote> quotes = inquiryService.getQuotesByInquiry(inquiryId);
        return ApiResponse.success(quotes);
    }

    @PostMapping("/quote")
    public ApiResponse<Quote> createQuote(@RequestBody Map<String, Object> params) {
        // 两条路径共用一个入口，但数据来源完全不同，所以在这里就分开：
        //   · 带 inquiryId → "卖家回应某张询价单"，主体/品类/收货地全部继承询价单；
        //   · 不带 inquiryId → "报价管理 → 新增报价"，卖家自己挂一份报价。
        //
        // 原先这里无条件执行 ((Number) params.get("inquiryId")).longValue()，
        // 而新增报价的表单根本不带 inquiryId —— 于是每次点"新增报价"都是 NPE → 500。
        // 页面上只看到"操作失败"，后端日志里是一行类型转换异常。
        if (params.get("inquiryId") == null) {
            return createStandaloneQuote(params);
        }
        Long inquiryId = ((Number) params.get("inquiryId")).longValue();
        BigDecimal unitPrice = new BigDecimal(params.get("unitPrice").toString());
        BigDecimal quantity = params.containsKey("quantity") ? 
                new BigDecimal(params.get("quantity").toString()) : null;
        BigDecimal freightAmount = params.containsKey("freightAmount") ? 
                new BigDecimal(params.get("freightAmount").toString()) : null;
        String remark = (String) params.get("remark");

        // 只有**被询价的那家供应商**能报价。
        //
        // 原先这条路径不校验：任何登录用户都能对别人的询价单报价，而报价单上的卖家
        // 是从询价单带过来的 —— 也就是说能以别人的名义给采购方报价，
        // 采购方那边看到的"某某供应商报了价"根本不是那家供应商报的。
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        com.agri.trade.entity.Inquiry inquiry = inquiryService.getById(inquiryId);
        if (inquiry == null) {
            return ApiResponse.error("询价单不存在");
        }
        if (inquiry.getSellerId() == null || !scope.merchantIds().contains(inquiry.getSellerId())) {
            return ApiResponse.error("只有被询价的供应商可以报价");
        }

        Quote quote = quoteService.createQuote(inquiryId, unitPrice, quantity, freightAmount, remark);
        if (quote == null) {
            return ApiResponse.error("创建报价失败");
        }
        return ApiResponse.success(quote);
    }

    /**
     * 新增独立报价（不挂询价单）。
     *
     * <p>卖家的主体号**由服务端从令牌推导**，不读请求体里的 sellerId ——
     * 否则任何人都能冒用别人的名义挂报价。</p>
     */
    private ApiResponse<Quote> createStandaloneQuote(Map<String, Object> params) {
        PlatformIdentityService.MerchantSelection seller = identityService.selectMerchant(null);
        if (!seller.ok()) {
            return ApiResponse.error(seller.error());
        }
        Quote draft = new Quote();
        draft.setProductId(asLong(params.get("productId")));
        draft.setProductName(asString(params.get("productName")));
        draft.setUnitPrice(asDecimal(params.get("unitPrice")));
        draft.setQuantity(asDecimal(params.get("quantity")));
        draft.setUnit(asString(params.get("unit")));
        draft.setDeliveryTime(asDate(params.get("deliveryTime")));
        draft.setDeliveryAddress(asString(params.get("deliveryAddress")));
        // 质量等级没有独立列（表里只有 quality_description），按口径存进描述列，
        // 存的是面上的标签文本（特级/一级…），不编一个不存在的字段。
        draft.setQualityDescription(qualityText(params.get("qualityLevel")));
        draft.setRemark(asString(params.get("remark")));

        if (draft.getProductName() == null || draft.getUnitPrice() == null || draft.getQuantity() == null) {
            return ApiResponse.error("产品名称、单价、数量都必须填写");
        }
        Quote created = quoteService.createQuoteFromForm(draft, seller.merchantId(), seller.merchantName(),
                asInt(params.get("validDays")));
        return ApiResponse.success(created);
    }

    @Operation(summary = "修改报价（仅限待审核、未生成订单的报价）")
    @PutMapping("/quote/{id}")
    public ApiResponse<Boolean> updateQuote(@PathVariable Long id, @RequestBody Map<String, Object> params) {
        Quote patch = new Quote();
        patch.setProductName(asString(params.get("productName")));
        patch.setUnitPrice(asDecimal(params.get("unitPrice")));
        patch.setQuantity(asDecimal(params.get("quantity")));
        patch.setUnit(asString(params.get("unit")));
        patch.setDeliveryTime(asDate(params.get("deliveryTime")));
        patch.setDeliveryAddress(asString(params.get("deliveryAddress")));
        patch.setQualityDescription(qualityText(params.get("qualityLevel")));
        patch.setRemark(asString(params.get("remark")));

        boolean ok = quoteService.updateQuoteFromForm(id, patch, asInt(params.get("validDays")));
        return ok
                ? ApiResponse.success(true)
                : ApiResponse.error("报价不存在、已被删除，或已受理/已生成订单（这三种情况都不允许修改）");
    }

    @Operation(summary = "删除报价（软删；已生成订单的报价不允许删）")
    @DeleteMapping("/quote/{id}")
    public ApiResponse<Boolean> deleteQuote(@PathVariable Long id) {
        boolean ok = quoteService.deleteQuote(id);
        return ok ? ApiResponse.success(true) : ApiResponse.error("报价不存在或已生成订单，无法删除");
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isEmpty()) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Integer asInt(Object value) {
        Long parsed = asLong(value);
        return parsed == null ? null : parsed.intValue();
    }

    private static BigDecimal asDecimal(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = value.toString().trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String asString(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    /** 质量等级按面上的中文标签落库（表里没有独立列，只有 quality_description）。 */
    private static String qualityText(Object value) {
        String code = asString(value);
        if (code == null) {
            return null;
        }
        return switch (code) {
            case "premium" -> "特级";
            case "level1" -> "一级";
            case "level2" -> "二级";
            case "level3" -> "三级";
            default -> code;
        };
    }

    /** 交货时间表单传的是 yyyy-MM-dd（前端 format 过的），这里按同格式解析。 */
    private static Date asDate(Object value) {
        String text = asString(value);
        if (text == null) {
            return null;
        }
        try {
            return new SimpleDateFormat("yyyy-MM-dd").parse(text);
        } catch (Exception e) {
            log.debug("交货时间解析失败，忽略该字段：{}", text);
            return null;
        }
    }

    @GetMapping("/quote/buyer/{buyerId}")
    public ApiResponse<List<Quote>> getBuyerQuotes(@PathVariable Long buyerId) {
        List<Quote> quotes = quoteService.getQuotesByBuyer(buyerId);
        return ApiResponse.success(quotes);
    }

    @Operation(summary = "报价分页列表")
    @GetMapping("/quote/page")
    public ApiResponse<IPage<Quote>> getQuotePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String quoteStatus,
            @RequestParam(required = false) Long sellerId,
            @RequestParam(required = false) Long buyerId,
            @RequestParam(required = false) String quoteNo,
            @RequestParam(required = false) String productName) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(
                quoteService.getQuotePage(pageNum, pageSize, quoteStatus, sellerId, buyerId, scope.merchantIds(),
                        quoteNo, productName));
    }

    @Operation(summary = "报价详情")
    @GetMapping("/quote/{id}")
    public ApiResponse<Quote> getQuoteById(@PathVariable Long id) {
        Quote quote = quoteService.getById(id);
        if (quote == null) {
            return ApiResponse.error("报价不存在");
        }
        return ApiResponse.success(quote);
    }

    @Operation(summary = "报价转订单")
    @PostMapping("/quote/{quoteId}/convert")
    public ApiResponse<TradeOrder> convertQuoteToOrder(@PathVariable Long quoteId) {
        Quote quote = quoteService.getById(quoteId);
        if (quote == null) {
            return ApiResponse.error("报价不存在");
        }
        // 与"受理"同一口径：生成订单是采购方的动作，否则等于替别人下单。
        String denied = denyIfNotBuyer(quote);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        TradeOrder order = quoteService.convertToOrder(quoteId);
        if (order == null) {
            // 两种 null：报价不存在，或状态不允许（已拒绝的报价不能转订单）。
            // 提示要覆盖两种，否则用户会去怀疑"报价怎么没了"。
            return ApiResponse.error("报价不存在或当前状态不允许生成订单（已拒绝的报价不能转订单）");
        }
        return ApiResponse.success(order);
    }

    @GetMapping("/quote/seller/{sellerId}")
    public ApiResponse<List<Quote>> getSellerQuotes(@PathVariable Long sellerId) {
        List<Quote> quotes = quoteService.getQuotesBySeller(sellerId);
        return ApiResponse.success(quotes);
    }

    @PostMapping("/quote/{quoteId}/accept")
    public ApiResponse<Boolean> acceptQuote(@PathVariable Long quoteId) {
        Quote quote = quoteService.getById(quoteId);
        if (quote == null) {
            return ApiResponse.error("报价不存在");
        }
        String denied = denyIfNotBuyer(quote);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        if ("rejected".equals(quote.getQuoteStatus())) {
            return ApiResponse.error("这份报价已经被拒绝，不能再接受");
        }
        // 幂等：这条报价若已经生成过订单，就不再重复受理。
        // 原先前端是"接受"与"生成订单"两个按钮，两条路径都会试着建单，
        // 重复点一次就会在同一份报价上落下第二张订单。
        if (quote.getOrderId() != null) {
            return ApiResponse.error("这份报价已经生成过订单，请勿重复受理");
        }

        quoteService.acceptQuote(quoteId);
        inquiryService.convertToOrder(quote.getInquiryId(), quoteId);
        return ApiResponse.success(true);
    }

    @PostMapping("/quote/{quoteId}/reject")
    public ApiResponse<Boolean> rejectQuote(@PathVariable Long quoteId, @RequestBody Map<String, String> params) {
        Quote quote = quoteService.getById(quoteId);
        if (quote == null) {
            return ApiResponse.error("报价不存在");
        }
        String denied = denyIfNotBuyer(quote);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        String reason = params.get("reason");
        quoteService.rejectQuote(quoteId, reason);
        return ApiResponse.success(true);
    }

    /**
     * 判权：受理/拒绝报价是**采购方**的动作。
     *
     * <p>原先这两个接口没有任何校验 —— 任何登录用户都能受理别人的报价，
     * 而受理会沿着询价单直接**替买卖双方生成一张订单**（金额、双方名称都由报价单带过去）。
     * 那是"以别人的名义下单"，比看到别人的数据严重得多。</p>
     *
     * @return 拒绝原因；允许时返回 null
     */
    private String denyIfNotBuyer(Quote quote) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (quote.getBuyerId() == null) {
            // 独立报价（报价管理页直接新增的那种）没有采购方，无从受理；
            // 需要成交请走"询价 → 报价 → 受理"这条链路。
            return "这条报价没有指定采购方，无法受理（请通过询价流程成交）";
        }
        if (scope.merchantIds().contains(quote.getBuyerId())) {
            return null;
        }
        return "只有采购方可以受理或拒绝这份报价";
    }

    @PutMapping("/inquiry/{inquiryId}/status")
    public ApiResponse<Boolean> updateInquiryStatus(@PathVariable Long inquiryId, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        inquiryService.updateInquiryStatus(inquiryId, status);
        return ApiResponse.success(true);
    }
}
