package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.GuaranteeLog;
import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.mapper.MerchantGuaranteeMapper;
import com.agri.trade.service.IGuaranteeService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 保证金管理（运营端）。
 *
 * <p>保证金是"商家押在平台、用于赔付的钱"。运营端要做三件事：
 * 审核开立申请、按需冻结/解冻、以及查得清每一笔变动是谁因为什么动的。</p>
 *
 * <p>冻结与解冻**必须填原因**，并且会写一条流水 ——
 * 动了商家的钱而答不出"为什么"，是最容易被投诉也最难自证的一类问题。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/guarantee")
@RequiredArgsConstructor
public class AdminGuaranteeController {

    private final MerchantGuaranteeMapper guaranteeMapper;
    private final IGuaranteeService guaranteeService;

    @Operation(summary = "保证金账户列表")
    @GetMapping("/page")
    public ApiResponse<IPage<MerchantGuarantee>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String guaranteeStatus,
            @RequestParam(required = false) String merchantName) {
        LambdaQueryWrapper<MerchantGuarantee> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantGuarantee::getDelFlag, 0);
        if (guaranteeStatus != null && !guaranteeStatus.isEmpty()) {
            wrapper.eq(MerchantGuarantee::getGuaranteeStatus, guaranteeStatus);
        }
        if (merchantName != null && !merchantName.isEmpty()) {
            wrapper.like(MerchantGuarantee::getMerchantName, merchantName);
        }
        wrapper.orderByDesc(MerchantGuarantee::getCreateTime);
        return ApiResponse.success(guaranteeMapper.selectPage(new Page<>(pageNum, pageSize), wrapper));
    }

    /** 某个账户的流水（含动作前后的可用/冻结额，便于对账）。 */
    @Operation(summary = "保证金流水")
    @GetMapping("/{id}/logs")
    public ApiResponse<List<GuaranteeLog>> logs(@PathVariable Long id) {
        return ApiResponse.success(guaranteeService.getLogs(id));
    }

    /**
     * 审核保证金开立申请。
     *
     * <p>审核人取自令牌（原先是从请求体里读 auditor —— 那种留痕谁都能填）。</p>
     */
    @Operation(summary = "审核保证金")
    @PostMapping("/{id}/verify")
    public ApiResponse<Boolean> verify(@PathVariable Long id, @RequestBody Map<String, String> params) {
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) {
            return ApiResponse.error("保证金账户不存在");
        }
        if (!"pending".equals(guarantee.getGuaranteeStatus())) {
            return ApiResponse.error("该账户已经审核过了");
        }
        String status = params.get("status");
        if (!"active".equals(status) && !"rejected".equals(status)) {
            return ApiResponse.error("审核结论只支持 active（通过）或 rejected（驳回）");
        }
        if ("rejected".equals(status) && (params.get("remark") == null || params.get("remark").isEmpty())) {
            return ApiResponse.error("驳回必须填写原因");
        }
        boolean updated = guaranteeService.verifyGuarantee(id, status, SecurityUtils.getUsername(),
                params.get("remark"));
        return updated ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }

    /** 冻结保证金（风控动作）。必须给原因。 */
    @Operation(summary = "冻结保证金")
    @PostMapping("/{id}/freeze")
    public ApiResponse<Boolean> freeze(@PathVariable Long id, @RequestBody Map<String, String> params) {
        BigDecimal amount = parseAmount(params.get("amount"));
        if (amount == null || amount.signum() <= 0) {
            return ApiResponse.error("请填写大于 0 的冻结金额");
        }
        String reason = params.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ApiResponse.error("冻结保证金必须填写原因");
        }
        boolean ok = guaranteeService.freezeGuarantee(id, amount, SecurityUtils.getUsername(), reason);
        return ok ? ApiResponse.success(true)
                : ApiResponse.error("冻结失败：账户不存在，或可用保证金不足");
    }

    /** 解冻保证金。必须给原因。 */
    @Operation(summary = "解冻保证金")
    @PostMapping("/{id}/unfreeze")
    public ApiResponse<Boolean> unfreeze(@PathVariable Long id, @RequestBody Map<String, String> params) {
        BigDecimal amount = parseAmount(params.get("amount"));
        if (amount == null || amount.signum() <= 0) {
            return ApiResponse.error("请填写大于 0 的解冻金额");
        }
        String reason = params.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ApiResponse.error("解冻保证金必须填写原因");
        }
        boolean ok = guaranteeService.unfreezeGuarantee(id, amount, SecurityUtils.getUsername(), reason);
        return ok ? ApiResponse.success(true)
                : ApiResponse.error("解冻失败：账户不存在，或冻结额不足");
    }

    private static BigDecimal parseAmount(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
