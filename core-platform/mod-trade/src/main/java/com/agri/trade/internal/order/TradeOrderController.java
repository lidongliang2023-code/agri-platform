package com.agri.trade.internal.order;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 订单接口：下单 / 支付回调 / 结算 / 取消 / 列表。
 */
@RestController
@RequestMapping("/api/v1/trade/orders")
@RequiredArgsConstructor
public class TradeOrderController {

    private final TradeOrderService orderService;

    public record CreateOrderRequest(@NotNull Long listingId, @NotNull Long buyerMerchantId,
                                     @NotNull BigDecimal quantity) {
    }

    public record PayRequest(@NotBlank String payNo) {
    }

    @GetMapping
    public ApiResponse<PageResult<TradeOrderEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                          @RequestParam(defaultValue = "10") long size,
                                                          @RequestParam(required = false) String status) {
        return ApiResponse.ok(orderService.page(page, size, status));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateOrderRequest req) {
        return ApiResponse.ok(orderService.createOrder(req.listingId(), req.buyerMerchantId(), req.quantity()).getId());
    }

    /** 支付成功回调（MVP 直调；生产环境由支付网关异步通知并验签） */
    @PostMapping("/{id}/pay")
    public ApiResponse<Void> pay(@PathVariable Long id, @Valid @RequestBody PayRequest req) {
        orderService.pay(id, req.payNo());
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/settle")
    public ApiResponse<Void> settle(@PathVariable Long id) {
        orderService.settle(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<Void> cancel(@PathVariable Long id) {
        orderService.cancel(id);
        return ApiResponse.ok();
    }
}
