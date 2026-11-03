package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.service.IGuaranteeService;
import com.agri.trade.service.ICompensationService;
import com.agri.trade.service.PlatformIdentityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 赔付（以及它的资金来源：供应商保证金）。
 *
 * <p><b>这一轮删掉的四条保证金写路由</b>：{@code POST /guarantee}、
 * {@code /guarantee/{id}/freeze}、{@code /unfreeze}、{@code /replenish}。
 * 它们与 {@code /api/trade/guarantee}、{@code /api/trade/admin/guarantee} 那两条是同一件事的
 * 第二份实现，而且口径更松：</p>
 *
 * <ul>
 *   <li>建户直接置 active 并给足可用余额 —— 绕开了「开立申请 → 运营审核」那道闸门；</li>
 *   <li>调用的是服务层的不带操作人重载，流水里的操作人写成 "system"/null，
 *       事后查不出是谁冻了商家的钱；</li>
 *   <li>金额直接 {@code params.get("amount").toString()}，缺字段就是 NPE→500。</li>
 * </ul>
 *
 * <p>四条路由前端从未调用过，已下线；这里只保留保证金的两个只读口径
 * （某主体的账户列表、可用余额），因为赔付打款要先看得到钱够不够。
 * 冻结/解冻请走 {@code /api/trade/admin/guarantee/{id}/freeze|unfreeze}（必须填原因、操作人取令牌）。</p>
 */
@RestController
@RequestMapping("/api/trade/compensation")
@RequiredArgsConstructor
public class CompensationController {

    /** 赔付类型词表：与运营端建单表单、列表标签同一组取值。 */
    private static final List<String> COMPENSATION_TYPES =
            List.of("delay", "quality", "quantity", "price", "dispute", "other");

    private final IGuaranteeService guaranteeService;
    private final ICompensationService compensationService;
    private final PlatformIdentityService identityService;

    @GetMapping("/guarantee/merchant/{merchantId}")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<List<MerchantGuarantee>> getMerchantGuarantees(@PathVariable Long merchantId) {
        List<MerchantGuarantee> guarantees = guaranteeService.getGuaranteesByMerchant(merchantId);
        return ApiResponse.success(guarantees);
    }

    @GetMapping("/guarantee/{merchantId}/balance")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<BigDecimal> getGuaranteeBalance(@PathVariable Long merchantId) {
        BigDecimal balance = guaranteeService.getAvailableBalance(merchantId);
        return ApiResponse.success(balance);
    }

    @PostMapping
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<CompensationRecord> createCompensation(@RequestBody Map<String, Object> params) {
        Long orderId = asLong(params.get("orderId"));
        Long disputeId = asLong(params.get("disputeId"));
        String compensationType = (String) params.get("compensationType");
        // 金额必填且必须能解析：原先直接 params.get("amount").toString()，
        // 不传就是 NPE→500，传个 "abc" 就是 NumberFormatException→500。
        if (params.get("amount") == null) {
            return ApiResponse.error("赔付金额不能为空");
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(params.get("amount").toString().trim());
        } catch (NumberFormatException e) {
            return ApiResponse.error("赔付金额格式不正确");
        }
        if (compensationType == null || !COMPENSATION_TYPES.contains(compensationType)) {
            return ApiResponse.error("赔付类型只能是 delay / quality / quantity / price / dispute / other 之一");
        }
        // 申请人可以不带（挂了纠纷就按纠纷的申请方算）。带了点名也行，但服务层会核对
        // 这个主体必须是这场纠纷或这张订单的参与方 —— 原先写谁就当谁，
        // 于是能凭空造出一张"某家应得赔付"的单据。
        // 申请人姓名一律由服务端按单据取，请求体里的 applicantName 不再采信。
        Long applicantId = asLong(params.get("applicantId"));

        CompensationRecord compensation = compensationService.createCompensation(
                orderId, disputeId, compensationType, amount, applicantId, null);
        if (compensation == null) {
            return ApiResponse.error("建单失败：金额必须大于 0；必须挂在一场纠纷或一张订单上（同一场纠纷只赔一次）；"
                    + "指定的申请人得是这场纠纷的申请方或这张订单的买卖双方");
        }
        return ApiResponse.success(compensation);
    }

    @GetMapping("/dispute/{disputeId}")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<CompensationRecord> getCompensationByDispute(@PathVariable Long disputeId) {
        CompensationRecord compensation = compensationService.getByDispute(disputeId);
        return ApiResponse.success(compensation);
    }

    @GetMapping("/order/{orderId}")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<List<CompensationRecord>> getCompensationsByOrder(@PathVariable Long orderId) {
        List<CompensationRecord> compensations = compensationService.getByOrder(orderId);
        return ApiResponse.success(compensations);
    }

    /**
     * 我的获赔（用户端）。
     *
     * <p>收款方范围由服务端按登录令牌推导 —— 赔付涉及具体金额与主体，
     * 不能像原先那样只提供一个"按收款方 id 查"的接口（那等于谁都能查别人的获赔记录）。
     * 服务层的 getByRecipient 一直有，但没有任何接口和页面暴露过：
     * 用户根本看不到自己有没有拿到赔付。</p>
     */
    @GetMapping("/mine")
    public ApiResponse<List<CompensationRecord>> getMyCompensations() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(compensationService.getByRecipients(scope.merchantIds()));
    }

    @PostMapping("/{compensationId}/review")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<CompensationRecord> reviewCompensation(@PathVariable Long compensationId,
                                                               @RequestBody Map<String, String> params) {
        String reviewResult = params.get("reviewResult");
        if (!"approved".equals(reviewResult) && !"rejected".equals(reviewResult)) {
            return ApiResponse.error("审核结论只能是 approved（核准）或 rejected（驳回）");
        }
        String remark = params.get("remark");
        if ("rejected".equals(reviewResult) && (remark == null || remark.trim().isEmpty())) {
            return ApiResponse.error("驳回必须填写原因");
        }
        // 审核人取自令牌（原先读请求体的 reviewer —— 前端拼当前昵称、兜底"运营"，
        // 那种留痕谁都能填，出了纠纷对不出是谁点的核准）。
        String reviewer = SecurityUtils.getUsername();
        if (reviewer == null || reviewer.isEmpty()) {
            return ApiResponse.error("取不到当前操作人，无法留下审核痕迹，请重新登录");
        }

        CompensationRecord compensation = compensationService.reviewCompensation(compensationId, reviewResult, reviewer, remark);
        if (compensation == null) {
            return ApiResponse.error("审核失败：赔付单不存在，或已经不是待审核状态（一张单只审一次）");
        }
        return ApiResponse.success(compensation);
    }

    @PostMapping("/{compensationId}/execute")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> executeCompensation(@PathVariable Long compensationId) {
        boolean result = compensationService.executeCompensation(compensationId);
        return result ? ApiResponse.success(true)
                : ApiResponse.error("打款失败：赔付单不存在，或尚未核准（只有「已核准待打款」的单可以打款）");
    }

    /** 数字字段容错取值：请求体里的 id 可能是数字，也可能是字符串（前端 Long 转字符串）。 */
    private static Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.valueOf(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
