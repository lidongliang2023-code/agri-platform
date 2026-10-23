package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.mapper.MerchantGuaranteeMapper;
import com.agri.trade.mapper.CompensationRecordMapper;
import com.agri.trade.service.IGuaranteeService;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/guarantee")
@RequiredArgsConstructor
public class GuaranteeController {

    private final MerchantGuaranteeMapper guaranteeMapper;
    private final CompensationRecordMapper compensationMapper;
    private final IGuaranteeService guaranteeService;
    private final PlatformIdentityService identityService;

    /**
     * 我的保证金账户（商家视角）。
     *
     * <p>范围由服务端按登录身份推导。原先只有
     * {@code /guarantee/merchant/{merchantId}} 这种"传谁的 id 看谁的"，
     * 商家连自己的保证金余额都没有入口，更别说补缴。</p>
     */
    @GetMapping("/mine")
    public ApiResponse<List<MerchantGuarantee>> myGuarantees() {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        if (!scope.hasBinding()) {
            return ApiResponse.success(List.of());
        }
        return ApiResponse.success(guaranteeMapper.selectList(new LambdaQueryWrapper<MerchantGuarantee>()
                .in(MerchantGuarantee::getMerchantId, scope.merchantIds())
                .eq(MerchantGuarantee::getDelFlag, 0)
                .orderByDesc(MerchantGuarantee::getCreateTime)));
    }

    /** 我的保证金流水。 */
    @GetMapping("/mine/{id}/logs")
    public ApiResponse<List<com.agri.trade.entity.GuaranteeLog>> myGuaranteeLogs(@PathVariable Long id) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null || guarantee.getMerchantId() == null
                || !scope.merchantIds().contains(guarantee.getMerchantId())) {
            return ApiResponse.error("只能查看自己经营主体的保证金流水");
        }
        return ApiResponse.success(guaranteeService.getLogs(id));
    }

    /**
     * 补缴保证金（商家主动加钱）。
     *
     * <p>只能给自己的账户补缴；补缴会写一条流水（金额与动作前后的可用/冻结额）。</p>
     */
    @PostMapping("/{id}/replenish")
    public ApiResponse<Boolean> replenish(@PathVariable Long id, @RequestBody Map<String, String> params) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) {
            return ApiResponse.error("保证金账户不存在");
        }
        if (guarantee.getMerchantId() == null || !scope.merchantIds().contains(guarantee.getMerchantId())) {
            return ApiResponse.error("只能给自己的保证金账户补缴");
        }
        if (!"active".equals(guarantee.getGuaranteeStatus())) {
            return ApiResponse.error("只有生效中的保证金账户可以补缴");
        }
        if (guarantee.getExpireTime() != null && guarantee.getExpireTime().before(new Date())) {
            return ApiResponse.error("保证金账户已到期，不能补缴");
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(params.get("amount")).trim());
        } catch (Exception e) {
            return ApiResponse.error("请填写正确的补缴金额");
        }
        if (amount.signum() <= 0) {
            return ApiResponse.error("补缴金额必须大于 0");
        }
        String reason = params.get("reason");
        boolean ok = guaranteeService.replenishGuarantee(id, amount, SecurityUtils.getUsername(),
                reason == null || reason.isEmpty() ? "商家自主补缴" : reason);
        return ok ? ApiResponse.success(true) : ApiResponse.error("补缴失败");
    }

    @GetMapping("/page")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<IPage<MerchantGuarantee>> getGuaranteePage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long merchantId) {
        Page<MerchantGuarantee> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<MerchantGuarantee> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantGuarantee::getDelFlag, 0);
        if (merchantId != null) wrapper.eq(MerchantGuarantee::getMerchantId, merchantId);
        wrapper.orderByDesc(MerchantGuarantee::getCreateTime);
        return ApiResponse.success(guaranteeMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<MerchantGuarantee> getGuaranteeById(@PathVariable Long id) {
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) return ApiResponse.error("保证金记录不存在");
        return ApiResponse.success(guarantee);
    }

    @PostMapping
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> createGuarantee(@RequestBody MerchantGuarantee guarantee) {
        if (guarantee.getTotalAmount() == null || guarantee.getTotalAmount().signum() <= 0) {
            return ApiResponse.error("保证金总额必须大于 0");
        }
        if (guarantee.getMerchantId() == null) {
            return ApiResponse.error("请选择保证金所属经营主体");
        }
        return guaranteeService.submitGuarantee(guarantee, SecurityUtils.getUsername())
                ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/verify")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> verifyGuarantee(@PathVariable Long id,
                                                @RequestBody java.util.Map<String, String> params) {
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) return ApiResponse.error("保证金记录不存在");
        if (!"pending".equals(guarantee.getGuaranteeStatus())) {
            return ApiResponse.error("该账户已经审核过了");
        }
        String status = params.get("status");
        if (!"active".equals(status) && !"rejected".equals(status)) {
            return ApiResponse.error("审核结论只支持 active（通过）或 rejected（驳回）");
        }
        String remark = params.get("remark");
        if ("rejected".equals(status) && (remark == null || remark.trim().isEmpty())) {
            return ApiResponse.error("驳回必须填写原因");
        }
        boolean updated = guaranteeService.verifyGuarantee(id, status, SecurityUtils.getUsername(), remark);
        return updated ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }

    @GetMapping("/compensation/page")
    @com.agri.common.rbac.OperatorOnly("trade:read")
    public ApiResponse<IPage<CompensationRecord>> getCompensationPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Page<CompensationRecord> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompensationRecord::getDelFlag, 0);
        wrapper.orderByDesc(CompensationRecord::getCreateTime);
        return ApiResponse.success(compensationMapper.selectPage(page, wrapper));
    }

    @PostMapping("/compensation")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> createCompensation(@RequestBody CompensationRecord compensation) {
        compensation.setCompensationNo("CP" + System.currentTimeMillis());
        compensation.setDelFlag(0);
        compensation.setCompensationStatus("pending");
        compensation.setCreateTime(new Date());
        compensation.setUpdateTime(new Date());
        int result = compensationMapper.insert(compensation);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/compensation/{id}/audit")
    @com.agri.common.rbac.OperatorOnly
    public ApiResponse<Boolean> auditCompensation(@PathVariable Long id, @RequestBody java.util.Map<String, Object> params) {
        CompensationRecord compensation = compensationMapper.selectById(id);
        if (compensation == null) return ApiResponse.error("赔付记录不存在");

        compensation.setCompensationStatus((String) params.get("status"));
        compensation.setReviewer((String) params.get("reviewer"));
        compensation.setReviewTime(new Date());
        compensation.setReviewResult((String) params.get("result"));
        compensation.setReviewRemark((String) params.get("remark"));
        compensation.setUpdateTime(new Date());

        int result = compensationMapper.updateById(compensation);
        if (result > 0 && "approved".equals(params.get("status"))) {
            compensation.setPayTime(new Date());
            compensation.setTransactionId("TX" + System.currentTimeMillis());
            compensationMapper.updateById(compensation);
        }
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }
}
