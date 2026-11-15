package com.agri.trade.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class TradeAgentPolicyTest {
    BigDecimal n(String v){return new BigDecimal(v);}
    @Test void reachesAgreementWithinBothMandates(){var r=TradeAgentPolicy.negotiate(n("4"),n("6"),n("7"),n("5"),5);assertNotNull(r.price());assertTrue(r.price().compareTo(n("5"))>=0);assertTrue(r.price().compareTo(n("6"))<=0);assertTrue(r.rounds().size()<=5);}
    @Test void nonOverlappingMandatesNeverForceAgreement(){var r=TradeAgentPolicy.negotiate(n("4"),n("5"),n("8"),n("6"),5);assertNull(r.price());assertEquals(5,r.rounds().size());}
    @Test void immediateAgreementStopsWithoutExtraConcession(){var r=TradeAgentPolicy.negotiate(n("7"),n("8"),n("6"),n("5"),5);assertEquals(1,r.rounds().size());assertEquals(0,n("6").compareTo(r.price()));}
    @Test void singleRoundHonorsBounds(){var r=TradeAgentPolicy.negotiate(n("4"),n("6"),n("7"),n("5"),1);assertEquals(1,r.rounds().size());assertEquals(0,n("5").compareTo(r.price()));}
    @Test void invalidMandatesAreRejected(){assertThrows(IllegalArgumentException.class,()->TradeAgentPolicy.negotiate(n("6"),n("5"),n("7"),n("5"),5));assertThrows(IllegalArgumentException.class,()->TradeAgentPolicy.negotiate(n("4"),n("5"),n("7"),n("8"),5));assertThrows(IllegalArgumentException.class,()->TradeAgentPolicy.negotiate(n("0"),n("5"),n("7"),n("5"),5));assertThrows(IllegalArgumentException.class,()->TradeAgentPolicy.negotiate(n("4"),n("5"),n("7"),n("5"),11));}
    @Test void unitsVarietiesAndQualityCannotBeGuessed(){assertFalse(TradeAgentPolicy.compatible("kg","斤",null,null,null,null));assertFalse(TradeAgentPolicy.compatible("kg","kg","红颜","章姬",null,null));assertFalse(TradeAgentPolicy.compatible("kg","kg",null,null,"一级","二级"));assertFalse(TradeAgentPolicy.compatible(null,null,null,null,null,null));assertTrue(TradeAgentPolicy.compatible("kg","kg",null,"红颜",null,"一级"));}
    @Test void offersMonotonicallyConvergeInsidePrivateLimits(){var r=TradeAgentPolicy.negotiate(n("1"),n("3"),n("9"),n("7"),10);BigDecimal lastBuy=n("0"),lastSell=n("10");for(var x:r.rounds()){var buy=(BigDecimal)x.get("buyerOffer");var sell=(BigDecimal)x.get("sellerOffer");assertTrue(buy.compareTo(lastBuy)>=0&&buy.compareTo(n("3"))<=0);assertTrue(sell.compareTo(lastSell)<=0&&sell.compareTo(n("7"))>=0);lastBuy=buy;lastSell=sell;}}
}
