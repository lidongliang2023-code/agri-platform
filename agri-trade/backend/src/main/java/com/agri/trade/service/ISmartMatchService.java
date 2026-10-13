package com.agri.trade.service;

import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.vo.MatchResultVO;
import com.agri.trade.vo.MatchRecordVO;
import com.baomidou.mybatisplus.core.metadata.IPage;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface ISmartMatchService {

    List<MatchResultVO> matchDemandToProducts(Long demandId, int limit);

    List<MatchResultVO> matchProductToDemands(Long productId, int limit);

    MatchResultVO calculateMatchScore(Demand demand, TradeProduct product);

    List<MatchRecord> batchCreateMatchRecords(Long demandId, List<Long> productIds);

    void updateMatchScore(Long matchRecordId, Double newScore);

    List<MatchRecord> getMatchRecordsByDemand(Long demandId);

    List<MatchRecord> getMatchRecordsByProduct(Long productId);

    /**
     * 撮合记录分页查询。
     *
     * <p>原先前端 api/match.ts 里就写好了 getMatchList（页面上"查看历史记录"要用），
     * 但 GET /api/trade/match/list 这个路径后端从来没有注册过 —— 又是一处
     * "前端把接口写好了、后端没有"，点下去只能 404。</p>
     */
    IPage<MatchRecordVO> getMatchRecordPage(int pageNum, int pageSize,
                                            Long demandId, Long productId, String matchType,
                                            Collection<Long> scopeMerchantIds);

    Map<String, Double> calculateDimensionScores(Demand demand, TradeProduct product);
}
