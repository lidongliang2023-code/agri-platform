package com.agri.iot.controller.trade;

import com.agri.common.entity.ApiResponse;
import com.agri.iot.entity.trade.MerchantGuarantee;
import com.agri.iot.entity.trade.CompensationRecord;
import com.agri.iot.mapper.trade.MerchantGuaranteeMapper;
import com.agri.iot.mapper.trade.CompensationRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;

@RestController
@RequestMapping("/api/trade/guarantee")
@RequiredArgsConstructor
public class GuaranteeController {

    private final MerchantGuaranteeMapper guaranteeMapper;
    private final CompensationRecordMapper compensationMapper;

    @GetMapping("/page")
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
    public ApiResponse<MerchantGuarantee> getGuaranteeById(@PathVariable Long id) {
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) return ApiResponse.error("保证金记录不存在");
        return ApiResponse.success(guarantee);
    }

    @PostMapping
    public ApiResponse<Boolean> createGuarantee(@RequestBody MerchantGuarantee guarantee) {
        guarantee.setGuaranteeNo("GT" + System.currentTimeMillis());
        guarantee.setDelFlag(0);
        guarantee.setGuaranteeStatus("pending");
        guarantee.setAvailableAmount(guarantee.getTotalAmount());
        guarantee.setFrozenAmount(BigDecimal.ZERO);
        guarantee.setUsedAmount(BigDecimal.ZERO);
        guarantee.setApplyTime(new Date());
        guarantee.setCreateTime(new Date());
        guarantee.setUpdateTime(new Date());
        int result = guaranteeMapper.insert(guarantee);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<Boolean> verifyGuarantee(@PathVariable Long id, @RequestBody java.util.Map<String, String> params) {
        MerchantGuarantee guarantee = guaranteeMapper.selectById(id);
        if (guarantee == null) return ApiResponse.error("保证金记录不存在");
        guarantee.setGuaranteeStatus(params.get("status"));
        guarantee.setVerifyTime(new Date());
        guarantee.setVerifiedBy(params.get("auditor"));
        guarantee.setUpdateTime(new Date());
        int result = guaranteeMapper.updateById(guarantee);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("审核失败");
    }

    @GetMapping("/compensation/page")
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