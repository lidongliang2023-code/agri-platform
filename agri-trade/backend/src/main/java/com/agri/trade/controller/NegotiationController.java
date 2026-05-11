package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.service.IInquiryService;
import com.agri.trade.service.IQuoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trade/negotiation")
@RequiredArgsConstructor
public class NegotiationController {

    private final IInquiryService inquiryService;
    private final IQuoteService quoteService;

    @PostMapping("/inquiry")
    public ApiResponse<Inquiry> createInquiry(@RequestBody Map<String, Object> params) {
        Long demandId = ((Number) params.get("demandId")).longValue();
        Long productId = ((Number) params.get("productId")).longValue();
        Long buyerId = params.containsKey("buyerId") ? ((Number) params.get("buyerId")).longValue() : null;

        Inquiry inquiry = inquiryService.createInquiry(demandId, productId, buyerId);
        if (inquiry == null) {
            return ApiResponse.error("创建询价失败");
        }
        return ApiResponse.success(inquiry);
    }

    @PostMapping("/inquiry/batch")
    public ApiResponse<List<Inquiry>> batchCreateInquiries(@RequestBody Map<String, Object> params) {
        Long demandId = ((Number) params.get("demandId")).longValue();
        List<Number> productIds = (List<Number>) params.get("productIds");
        Long buyerId = params.containsKey("buyerId") ? ((Number) params.get("buyerId")).longValue() : null;

        List<Long> ids = productIds.stream().map(Number::longValue).toList();
        List<Inquiry> inquiries = inquiryService.batchCreateInquiries(demandId, ids, buyerId);
        return ApiResponse.success(inquiries);
    }

    @GetMapping("/inquiry/buyer/{buyerId}")
    public ApiResponse<List<Inquiry>> getBuyerInquiries(@PathVariable Long buyerId) {
        List<Inquiry> inquiries = inquiryService.getInquiriesByBuyer(buyerId);
        return ApiResponse.success(inquiries);
    }

    @GetMapping("/inquiry/seller/{sellerId}")
    public ApiResponse<List<Inquiry>> getSellerInquiries(@PathVariable Long sellerId) {
        List<Inquiry> inquiries = inquiryService.getInquiriesBySeller(sellerId);
        return ApiResponse.success(inquiries);
    }

    @GetMapping("/inquiry/{inquiryId}/quotes")
    public ApiResponse<List<Quote>> getInquiryQuotes(@PathVariable Long inquiryId) {
        List<Quote> quotes = inquiryService.getQuotesByInquiry(inquiryId);
        return ApiResponse.success(quotes);
    }

    @PostMapping("/quote")
    public ApiResponse<Quote> createQuote(@RequestBody Map<String, Object> params) {
        Long inquiryId = ((Number) params.get("inquiryId")).longValue();
        BigDecimal unitPrice = new BigDecimal(params.get("unitPrice").toString());
        BigDecimal quantity = params.containsKey("quantity") ? 
                new BigDecimal(params.get("quantity").toString()) : null;
        BigDecimal freightAmount = params.containsKey("freightAmount") ? 
                new BigDecimal(params.get("freightAmount").toString()) : null;
        String remark = (String) params.get("remark");

        Quote quote = quoteService.createQuote(inquiryId, unitPrice, quantity, freightAmount, remark);
        if (quote == null) {
            return ApiResponse.error("创建报价失败");
        }
        return ApiResponse.success(quote);
    }

    @GetMapping("/quote/buyer/{buyerId}")
    public ApiResponse<List<Quote>> getBuyerQuotes(@PathVariable Long buyerId) {
        List<Quote> quotes = quoteService.getQuotesByBuyer(buyerId);
        return ApiResponse.success(quotes);
    }

    @GetMapping("/quote/seller/{sellerId}")
    public ApiResponse<List<Quote>> getSellerQuotes(@PathVariable Long sellerId) {
        List<Quote> quotes = quoteService.getQuotesBySeller(sellerId);
        return ApiResponse.success(quotes);
    }

    @PostMapping("/quote/{quoteId}/accept")
    public ApiResponse<Boolean> acceptQuote(@PathVariable Long quoteId) {
        Quote quote = quoteService.getById(quoteId);
        if (quote == null) {
            return ApiResponse.error("报价不存在");
        }

        quoteService.acceptQuote(quoteId);
        inquiryService.convertToOrder(quote.getInquiryId(), quoteId);
        return ApiResponse.success(true);
    }

    @PostMapping("/quote/{quoteId}/reject")
    public ApiResponse<Boolean> rejectQuote(@PathVariable Long quoteId, @RequestBody Map<String, String> params) {
        String reason = params.get("reason");
        quoteService.rejectQuote(quoteId, reason);
        return ApiResponse.success(true);
    }

    @PutMapping("/inquiry/{inquiryId}/status")
    public ApiResponse<Boolean> updateInquiryStatus(@PathVariable Long inquiryId, @RequestBody Map<String, String> params) {
        String status = params.get("status");
        inquiryService.updateInquiryStatus(inquiryId, status);
        return ApiResponse.success(true);
    }
}