package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Carrier;
import com.agri.trade.mapper.CarrierMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.Map;

/**
 * 承运商管理（运营端）。
 *
 * <p>承运商是全平台共用的运力主数据。原先只有用户侧的 page/list/create 三个接口、
 * 没有页面 —— 而"新增承运商"挂在**用户侧**路径上且没有任何校验，
 * 任何登录用户都能往平台运力库里加一条。新增与停用归到运营端；
 * 用户侧保留两个读接口，物流编辑时要选承运商。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/carrier")
@RequiredArgsConstructor
public class AdminCarrierController {

    private final CarrierMapper carrierMapper;

    @Operation(summary = "承运商列表")
    @GetMapping("/page")
    public ApiResponse<IPage<Carrier>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String carrierName,
            @RequestParam(required = false) Integer status) {
        LambdaQueryWrapper<Carrier> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Carrier::getDelFlag, 0);
        if (carrierName != null && !carrierName.isEmpty()) {
            wrapper.like(Carrier::getCarrierName, carrierName);
        }
        if (status != null) {
            wrapper.eq(Carrier::getStatus, status);
        }
        wrapper.orderByDesc(Carrier::getRating);
        return ApiResponse.success(carrierMapper.selectPage(new Page<>(pageNum, pageSize), wrapper));
    }

    /** 新增承运商。编码由服务端生成。 */
    @Operation(summary = "新增承运商")
    @PostMapping
    public ApiResponse<Boolean> create(@RequestBody Carrier carrier) {
        if (carrier.getCarrierName() == null || carrier.getCarrierName().trim().isEmpty()) {
            return ApiResponse.error("承运商名称不能为空");
        }
        Long exists = carrierMapper.selectCount(new LambdaQueryWrapper<Carrier>()
                .eq(Carrier::getCarrierName, carrier.getCarrierName().trim())
                .eq(Carrier::getDelFlag, 0));
        if (exists != null && exists > 0) {
            return ApiResponse.error("同名承运商已存在");
        }
        carrier.setId(null);
        carrier.setCarrierCode("CR" + System.currentTimeMillis());
        carrier.setDelFlag(0);
        if (carrier.getStatus() == null) {
            carrier.setStatus(1);
        }
        carrier.setCreateTime(new Date());
        carrier.setUpdateTime(new Date());
        int result = carrierMapper.insert(carrier);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("创建失败");
    }

    /**
     * 启用 / 停用承运商。
     *
     * <p>停用（而不是删除）：已经用这家承运商发过货的物流单还要能查到它。</p>
     */
    @Operation(summary = "启停承运商")
    @PostMapping("/{id}/status")
    public ApiResponse<Boolean> changeStatus(@PathVariable Long id, @RequestBody Map<String, Integer> params) {
        Carrier carrier = carrierMapper.selectById(id);
        if (carrier == null || (carrier.getDelFlag() != null && carrier.getDelFlag() == 1)) {
            return ApiResponse.error("承运商不存在");
        }
        Integer status = params.get("status");
        if (status == null || (status != 0 && status != 1)) {
            return ApiResponse.error("状态只能是 1（启用）或 0（停用）");
        }
        carrier.setStatus(status);
        carrier.setUpdateTime(new Date());
        carrierMapper.updateById(carrier);
        return ApiResponse.success(true);
    }
}
