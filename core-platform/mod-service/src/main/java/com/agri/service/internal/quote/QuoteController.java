package com.agri.service.internal.quote;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * 行情接口：列表 / 最新价 / 管理端发布。
 */
@RestController
@RequiredArgsConstructor
public class QuoteController {

    private final QuoteService quoteService;

    public record PublishQuoteRequest(@NotBlank String productName, String category, @NotNull BigDecimal price,
                                      BigDecimal changePct, String source) {
    }

    @GetMapping("/api/v1/quotes")
    public ApiResponse<PageResult<QuoteEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                     @RequestParam(defaultValue = "10") long size,
                                                     @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(quoteService.page(page, size, keyword));
    }

    @GetMapping("/api/v1/quotes/latest")
    public ApiResponse<QuoteEntity> latest(@RequestParam String productName) {
        return ApiResponse.ok(quoteService.latest(productName));
    }

    @PostMapping("/api/v1/admin/quotes")
    public ApiResponse<Long> publish(@Valid @RequestBody PublishQuoteRequest req) {
        return ApiResponse.ok(quoteService.publish(req.productName(), req.category(), req.price(),
                req.changePct(), req.source() == null ? "平台发布" : req.source()).getId());
    }
}
