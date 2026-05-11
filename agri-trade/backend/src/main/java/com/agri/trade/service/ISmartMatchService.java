package com.agri.trade.service;

import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.vo.MatchResultVO;

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

    Map<String, Double> calculateDimensionScores(Demand demand, TradeProduct product);
}