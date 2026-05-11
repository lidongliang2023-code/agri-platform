package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.service.ISmartMatchService;
import com.agri.trade.vo.MatchResultVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trade/match")
@RequiredArgsConstructor
public class SmartMatchController {

    private final ISmartMatchService smartMatchService;

    @PostMapping("/demand/{demandId}")
    public ApiResponse<List<MatchResultVO>> matchDemandToProducts(
            @PathVariable Long demandId,
            @RequestParam(defaultValue = "10") Integer limit) {
        List<MatchResultVO> results = smartMatchService.matchDemandToProducts(demandId, limit);
        return ApiResponse.success(results);
    }

    @PostMapping("/product/{productId}")
    public ApiResponse<List<MatchResultVO>> matchProductToDemands(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "10") Integer limit) {
        List<MatchResultVO> results = smartMatchService.matchProductToDemands(productId, limit);
        return ApiResponse.success(results);
    }

    @GetMapping("/demand/{demandId}/records")
    public ApiResponse<List<MatchRecord>> getMatchRecordsByDemand(@PathVariable Long demandId) {
        List<MatchRecord> records = smartMatchService.getMatchRecordsByDemand(demandId);
        return ApiResponse.success(records);
    }

    @GetMapping("/product/{productId}/records")
    public ApiResponse<List<MatchRecord>> getMatchRecordsByProduct(@PathVariable Long productId) {
        List<MatchRecord> records = smartMatchService.getMatchRecordsByProduct(productId);
        return ApiResponse.success(records);
    }

    @PutMapping("/{recordId}/score")
    public ApiResponse<Boolean> updateMatchScore(
            @PathVariable Long recordId,
            @RequestBody java.util.Map<String, Double> params) {
        Double score = params.get("score");
        if (score == null) {
            return ApiResponse.error("评分参数不能为空");
        }
        smartMatchService.updateMatchScore(recordId, score);
        return ApiResponse.success(true);
    }
}