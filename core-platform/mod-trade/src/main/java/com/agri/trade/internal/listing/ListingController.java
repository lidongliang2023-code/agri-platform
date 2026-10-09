package com.agri.trade.internal.listing;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 挂牌（撮合交易 B2B 大宗 MVP）。
 */
@RestController
@RequestMapping("/api/v1/trade/listings")
@RequiredArgsConstructor
public class ListingController {

    private static final DateTimeFormatter NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ListingMapper listingMapper;

    public record CreateListingRequest(@NotBlank String type, @NotNull Long merchantId, @NotNull Long productId,
                                       String productName, @NotNull BigDecimal quantity, @NotNull BigDecimal price) {
    }

    @GetMapping
    public ApiResponse<PageResult<ListingEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                       @RequestParam(defaultValue = "10") long size,
                                                       @RequestParam(required = false) String type,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword) {
        Page<ListingEntity> result = listingMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ListingEntity>()
                        .eq(type != null && !type.isBlank(), ListingEntity::getType, type)
                        .eq(status != null && !status.isBlank(), ListingEntity::getStatus, status)
                        .like(keyword != null && !keyword.isBlank(), ListingEntity::getProductName, keyword)
                        .orderByDesc(ListingEntity::getCreatedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @PostMapping
    public ApiResponse<Long> create(@Valid @RequestBody CreateListingRequest req) {
        if (!"SELL".equals(req.type()) && !"BUY".equals(req.type())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "type 必须为 SELL 或 BUY");
        }
        ListingEntity listing = new ListingEntity();
        listing.setListingNo("LP" + NO_FORMAT.format(LocalDateTime.now())
                + ThreadLocalRandom.current().nextInt(1000, 9999));
        listing.setType(req.type());
        listing.setMerchantId(req.merchantId());
        listing.setProductId(req.productId());
        listing.setProductName(req.productName());
        listing.setQuantity(req.quantity());
        listing.setPrice(req.price());
        listing.setStatus("OPEN");
        listingMapper.insert(listing);
        return ApiResponse.ok(listing.getId());
    }

    @PostMapping("/{id}/close")
    public ApiResponse<Void> close(@PathVariable Long id) {
        ListingEntity listing = listingMapper.selectById(id);
        if (listing == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        if (!"OPEN".equals(listing.getStatus())) {
            throw new BusinessException(ErrorCode.LISTING_CLOSED);
        }
        listing.setStatus("CLOSED");
        listingMapper.updateById(listing);
        return ApiResponse.ok();
    }
}
