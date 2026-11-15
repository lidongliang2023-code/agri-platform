package com.agri.trade.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** 可重放的有界双Agent策略。价格均为同单位商品单价，不包含运费。 */
public final class TradeAgentPolicy {
    public static final String VERSION = "bounded-concession-v1";
    private TradeAgentPolicy() {}
    public record Result(BigDecimal price, List<Map<String,Object>> rounds) {}
    public static Result negotiate(BigDecimal buyerStart, BigDecimal buyerMax,
                                   BigDecimal sellerStart, BigDecimal sellerMin, int maxRounds) {
        if (buyerStart.signum() <= 0 || sellerMin.signum() <= 0 || buyerStart.compareTo(buyerMax)>0
                || sellerMin.compareTo(sellerStart)>0 || maxRounds<1 || maxRounds>10)
            throw new IllegalArgumentException("委托价格边界或协商轮次无效");
        List<Map<String,Object>> rounds = new ArrayList<>();
        for (int i=0;i<maxRounds;i++) {
            BigDecimal progress = maxRounds==1 ? BigDecimal.ONE : BigDecimal.valueOf(i).divide(BigDecimal.valueOf(maxRounds-1),8,RoundingMode.HALF_UP);
            BigDecimal buy=buyerStart.add(buyerMax.subtract(buyerStart).multiply(progress)).setScale(4,RoundingMode.DOWN);
            BigDecimal sell=sellerStart.subtract(sellerStart.subtract(sellerMin).multiply(progress)).setScale(4,RoundingMode.UP);
            rounds.add(Map.of("round",i+1,"buyerOffer",buy,"sellerOffer",sell,"reason","依据双方有效委托逐轮让步；未超越各自授权范围"));
            if(buy.compareTo(sell)>=0) return new Result(sell,rounds);
        }
        return new Result(null,rounds);
    }
    public static boolean compatible(String unitA,String unitB,String varietyA,String varietyB,
                                     String qualityA,String qualityB) {
        return unitA!=null && !unitA.isBlank() && unitA.equals(unitB)
            && (varietyA==null || varietyA.isBlank() || varietyA.equals(varietyB))
            && (qualityA==null || qualityA.isBlank() || qualityA.equals(qualityB));
    }
}
