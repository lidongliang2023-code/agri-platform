package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.service.ITradeOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trade/trade-order")
public class TradeOrderController {

    private final ITradeOrderService tradeOrderService;

    public TradeOrderController(ITradeOrderService tradeOrderService) {
        this.tradeOrderService = tradeOrderService;
    }

    @GetMapping("/page")
    public ApiResponse<IPage<TradeOrder>> page(@RequestParam(defaultValue = "1") Integer pageNum,
                                               @RequestParam(defaultValue = "10") Integer pageSize,
                                               @RequestParam(required = false) String orderNo,
                                               @RequestParam(required = false) String buyerName) {
        Page<TradeOrder> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        if (orderNo != null && !orderNo.isEmpty()) {
            wrapper.like(TradeOrder::getOrderNo, orderNo);
        }
        if (buyerName != null && !buyerName.isEmpty()) {
            wrapper.like(TradeOrder::getBuyerName, buyerName);
        }
        wrapper.orderByDesc(TradeOrder::getCreateTime);
        IPage<TradeOrder> result = tradeOrderService.page(page, wrapper);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<TradeOrder> getById(@PathVariable Long id) {
        TradeOrder order = tradeOrderService.getById(id);
        return ApiResponse.success(order);
    }

    @PostMapping
    public ApiResponse<TradeOrder> create(@RequestBody TradeOrder order) {
        tradeOrderService.save(order);
        return ApiResponse.success("创建成功", order);
    }

    @PutMapping("/{id}")
    public ApiResponse<TradeOrder> update(@PathVariable Long id, @RequestBody TradeOrder order) {
        order.setId(id);
        tradeOrderService.updateById(order);
        return ApiResponse.success("更新成功", order);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> delete(@PathVariable Long id) {
        tradeOrderService.removeById(id);
        return ApiResponse.success("删除成功");
    }

    @GetMapping("/list")
    public ApiResponse<List<TradeOrder>> list(@RequestParam(required = false) String orderStatus) {
        LambdaQueryWrapper<TradeOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TradeOrder::getDelFlag, 0);
        if (orderStatus != null && !orderStatus.isEmpty()) {
            wrapper.eq(TradeOrder::getOrderStatus, orderStatus);
        }
        List<TradeOrder> list = tradeOrderService.list(wrapper);
        return ApiResponse.success(list);
    }
}