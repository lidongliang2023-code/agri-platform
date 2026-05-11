package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.service.IGuaranteeService;
import com.agri.trade.service.ICompensationService;
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
        BigDecimal amount = new BigDecimal(params.get("amount").toString());
        Long applicantId = ((Number) params.get("applicantId")).longValue();
        String applicantName = (String) params.get("applicantName");

        CompensationRecord compensation = compensationService.createCompensation(orderId, disputeId, compensationType, amount, applicantId, applicantName);
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