package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.service.ISmartMatchService;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.vo.MatchResultVO;
import com.agri.trade.vo.MatchRecordVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trade/match")
@RequiredArgsConstructor
public class SmartMatchController {

    private final ISmartMatchService smartMatchService;
    private final PlatformIdentityService identityService;
    private final DemandMapper demandMapper;

    @PostMapping("/demand/{demandId}")
    public ApiResponse<List<MatchResultVO>> matchDemandToProducts(
            @PathVariable Long demandId,
            @RequestParam(defaultValue = "10") Integer limit) {
        // 撮合结果谁都能看（供需大厅是公开的），但只有需求主人触发时才落撮合记录：
        // 否则任何人打开别家的采购详情都会往人家的需求上写一批记录。
        List<MatchResultVO> results = smartMatchService.matchDemandToProducts(
                demandId, limit, ownsDemand(demandId));
        return ApiResponse.success(results);
    }

    @PostMapping("/product/{productId}")
    public ApiResponse<List<MatchResultVO>> matchProductToDemands(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "10") Integer limit) {
        List<MatchResultVO> results = smartMatchService.matchProductToDemands(productId, limit);
        return ApiResponse.success(results);
    }

    private boolean ownsDemand(Long demandId) {
        Demand demand = demandMapper.selectById(demandId);
        if (demand == null || demand.getBuyerId() == null) {
            return false;
        }
        PlatformIdentityService.MerchantScope scope;
        try {
            scope = identityService.currentScope();
        } catch (RuntimeException e) {
            return false;
        }
        return scope.resolved() && scope.merchantIds().contains(demand.getBuyerId());
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

    /**
     * 撮合记录分页列表（页面上的"查看历史记录"）。
     *
     * <p>范围由服务端从令牌推导（我发布的采购需求 / 我发布的货源参与的撮合），
     * 前端不传"看谁的"。没有绑定经营主体时返回空页而不是全量。</p>
     */
    @GetMapping("/list")
    public ApiResponse<IPage<MatchRecordVO>> getMatchRecordPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long demandId,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String matchType) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return ApiResponse.error(scope.error());
        }
        return ApiResponse.success(smartMatchService.getMatchRecordPage(pageNum, pageSize,
                demandId, productId, matchType, scope.merchantIds()));
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
