package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
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

@RestController
@RequestMapping("/api/trade/compensation")
@RequiredArgsConstructor
public class CompensationController {

    private final IGuaranteeService guaranteeService;
    private final ICompensationService compensationService;
    private final PlatformIdentityService identityService;

    @PostMapping("/guarantee")
    public ApiResponse<MerchantGuarantee> createGuarantee(@RequestBody Map<String, Object> params) {
        Long merchantId = ((Number) params.get("merchantId")).longValue();
        String merchantName = (String) params.get("merchantName");
        BigDecimal amount = new BigDecimal(params.get("amount").toString());

        MerchantGuarantee guarantee = guaranteeService.createGuarantee(merchantId, merchantName, amount);
        return ApiResponse.success(guarantee);
    }

    @GetMapping("/guarantee/merchant/{merchantId}")
    public ApiResponse<List<MerchantGuarantee>> getMerchantGuarantees(@PathVariable Long merchantId) {
        List<MerchantGuarantee> guarantees = guaranteeService.getGuaranteesByMerchant(merchantId);
        return ApiResponse.success(guarantees);
    }

    @GetMapping("/guarantee/{merchantId}/balance")
    public ApiResponse<BigDecimal> getGuaranteeBalance(@PathVariable Long merchantId) {
        BigDecimal balance = guaranteeService.getAvailableBalance(merchantId);
        return ApiResponse.success(balance);
    }

    @PostMapping("/guarantee/{guaranteeId}/freeze")
    public ApiResponse<Boolean> freezeGuarantee(@PathVariable Long guaranteeId, @RequestBody Map<String, Object> params) {
        BigDecimal amount = new BigDecimal(params.get("amount").toString());
        boolean result = guaranteeService.freezeGuarantee(guaranteeId, amount);
        return result ? ApiResponse.success(true) : ApiResponse.error("冻结失败，可用余额不足");
    }

    @PostMapping("/guarantee/{guaranteeId}/unfreeze")
    public ApiResponse<Boolean> unfreezeGuarantee(@PathVariable Long guaranteeId, @RequestBody Map<String, Object> params) {
        BigDecimal amount = new BigDecimal(params.get("amount").toString());
        boolean result = guaranteeService.unfreezeGuarantee(guaranteeId, amount);
        return result ? ApiResponse.success(true) : ApiResponse.error("解冻失败，冻结余额不足");
    }

    @PostMapping("/guarantee/{guaranteeId}/replenish")
    public ApiResponse<Boolean> replenishGuarantee(@PathVariable Long guaranteeId, @RequestBody Map<String, Object> params) {
        BigDecimal amount = new BigDecimal(params.get("amount").toString());
        boolean result = guaranteeService.replenishGuarantee(guaranteeId, amount);
        return result ? ApiResponse.success(true) : ApiResponse.error("充值失败");
    }

    @PostMapping
    public ApiResponse<CompensationRecord> createCompensation(@RequestBody Map<String, Object> params) {
        Long orderId = params.containsKey("orderId") ? ((Number) params.get("orderId")).longValue() : null;
        Long disputeId = params.containsKey("disputeId") ? ((Number) params.get("disputeId")).longValue() : null;
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
        // 申请人可以不带：带了纠纷就按纠纷的申请人算（服务层兜底），
        // 原先这里无条件 ((Number) params.get("applicantId")).longValue()，缺一个字段就 500。
        Long applicantId = params.get("applicantId") == null ? null : ((Number) params.get("applicantId")).longValue();
        String applicantName = (String) params.get("applicantName");

        CompensationRecord compensation = compensationService.createCompensation(orderId, disputeId, compensationType, amount, applicantId, applicantName);
        if (compensation == null) {
            return ApiResponse.error("创建失败：金额必须大于 0，且必须挂在一场纠纷或一张订单上（同一场纠纷只能赔一次）");
        }
        return ApiResponse.success(compensation);
    }

    @GetMapping("/dispute/{disputeId}")
    public ApiResponse<CompensationRecord> getCompensationByDispute(@PathVariable Long disputeId) {
        CompensationRecord compensation = compensationService.getByDispute(disputeId);
        return ApiResponse.success(compensation);
    }

    @GetMapping("/order/{orderId}")
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
    public ApiResponse<CompensationRecord> reviewCompensation(@PathVariable Long compensationId, @RequestBody Map<String, String> params) {
        String reviewResult = params.get("reviewResult");
        String reviewer = params.get("reviewer");
        String remark = params.get("remark");

        CompensationRecord compensation = compensationService.reviewCompensation(compensationId, reviewResult, reviewer, remark);
        if (compensation == null) {
            return ApiResponse.error("审核失败");
        }
        return ApiResponse.success(compensation);
    }

    @PostMapping("/{compensationId}/execute")
    public ApiResponse<Boolean> executeCompensation(@PathVariable Long compensationId) {
        boolean result = compensationService.executeCompensation(compensationId);
        return result ? ApiResponse.success(true) : ApiResponse.error("执行失败");
    }
}
