package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Demand;
import com.agri.trade.service.INlpParseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/trade/nlp")
@RequiredArgsConstructor
public class NlpParseController {

    private final INlpParseService nlpParseService;

    @PostMapping("/parse")
    public ApiResponse<INlpParseService.ParsedDemandResult> parseText(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        if (text == null || text.trim().isEmpty()) {
            return ApiResponse.error("请输入需求文本");
        }
        INlpParseService.ParsedDemandResult result = nlpParseService.parseAndExtract(text);
        return ApiResponse.success(result);
    }

    @PostMapping("/parse-and-create")
    public ApiResponse<Demand> parseAndCreateDemand(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        Long userId = request.containsKey("userId") ? Long.parseLong(request.get("userId")) : 1L;
        
        if (text == null || text.trim().isEmpty()) {
            return ApiResponse.error("请输入需求文本");
        }
        
        Demand demand = nlpParseService.parseNaturalLanguage(text, userId);
        return ApiResponse.success(demand);
    }

    @PostMapping("/extract/product")
    public ApiResponse<String> extractProduct(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        String product = nlpParseService.extractProductName(text);
        return ApiResponse.success(product);
    }

    @PostMapping("/extract/quantity")
    public ApiResponse<String> extractQuantity(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        String quantity = nlpParseService.extractQuantity(text);
        return ApiResponse.success(quantity);
    }

    @PostMapping("/extract/location")
    public ApiResponse<String> extractLocation(@RequestBody Map<String, String> request) {
        String text = request.get("text");
        String location = nlpParseService.extractLocation(text);
        return ApiResponse.success(location);
    }
}