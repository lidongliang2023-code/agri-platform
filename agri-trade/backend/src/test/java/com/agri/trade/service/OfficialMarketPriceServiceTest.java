package com.agri.trade.service;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.junit.jupiter.api.Assertions.*;
class OfficialMarketPriceServiceTest {
 String html(String unit,String price){return "<title>2026年11月9日石嘴山市百花批发市场地产蔬菜价格</title><table><tr><td>序号</td><td>品种</td><td>规格等级</td><td>计量单位</td><td>批发价格</td></tr><tr><td>1</td><td>西红柿</td><td>新鲜一级</td><td>"+unit+"</td><td>"+price+"</td></tr></table>";}
 @Test void convertsHalfKilogramAndPreservesSource(){var r=OfficialMarketPriceService.parse(html("元/500克","1.30"));assertEquals(LocalDate.of(2026,11,9),r.date());assertEquals(0,r.quotes().get(0).priceKg().compareTo(new BigDecimal("2.60")));assertEquals("元/500克",r.quotes().get(0).originalUnit());}
 @Test void doesNotDoubleKilograms(){assertEquals(0,OfficialMarketPriceService.parse(html("元/公斤","2.6")).quotes().get(0).priceKg().compareTo(new BigDecimal("2.6")));}
 @Test void rejectsUnknownUnitInsteadOfGuessing(){assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/桶","85")));}
 @Test void rejectsMissingValues(){assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/500克","—")));}
 @Test void rejectsNegativeAndZero(){assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/500克","-1")));assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/500克","0")));}
 @Test void rejectsWrongMarketOrTitle(){assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/500克","1").replace("百花","测试")));assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse("<table></table>"));}
 @Test void rejectsUnexpectedTableLayout(){assertThrows(IllegalArgumentException.class,()->OfficialMarketPriceService.parse(html("元/500克","1").replace("批发价格</td>","零售价格</td>")));}
 @Test void onlyExplicitAliases(){assertEquals("西红柿",OfficialMarketPriceService.canonical("番茄"));assertEquals("草莓",OfficialMarketPriceService.canonical("草莓"));assertNotEquals(OfficialMarketPriceService.canonical("番茄"),OfficialMarketPriceService.canonical("小番茄"));}
 @Test void discoversNewestMatchingReport(){String a="<a href='./202611/t20261109_5394300.html'>2026年11月9日石嘴山市百花批发市场地产蔬菜价格</a>";String b="<a href='./202611/t20261110_5395400.html'>2026年11月10日石嘴山市百花批发市场地产蔬菜价格</a>";assertTrue(OfficialMarketPriceService.discover(a+b).endsWith("t20261110_5395400.html"));}
 @Test void refusesForeignLinks(){assertThrows(IllegalStateException.class,()->OfficialMarketPriceService.discover("<a href='https://invalid.example/report'>2026年11月10日石嘴山市百花批发市场地产蔬菜价格</a>"));}
 @Test void skipsUnconvertibleRowsWithoutLosingValidOnes(){String h=html("元/500克","1.3").replace("</table>","<tr><td>2</td><td>油</td><td>5L</td><td>元/桶</td><td>85</td></tr></table>");var r=OfficialMarketPriceService.parse(h);assertEquals(1,r.skipped());assertEquals(1,r.quotes().size());}
 String fujian(String link){return "<html><head><title>2026年11月第1周蔬菜批发市场主要品种价格_价格数据_福建省农业农村厅</title></head><body><a href='"+link+"'>2026年11月第1周蔬菜批发市场主要品种价格</a><table><tr><td>批发市场</td><td>品种</td><td>大宗价（元/公斤）</td><td>报送时间</td></tr><tr><td>闽海峡蔬菜</td><td>生菜</td><td>3.62</td><td>2026/11/05</td></tr><tr><td>闽海峡蔬菜</td><td>番茄</td><td>5.20</td><td>2026/11/05</td></tr></table><p>福建省农业农村厅</p></body></html>";}
 @Test void parsesFujianOfficialRowsInYuanPerKg(){var r=OfficialMarketPriceService.parseFujian(fujian("./202611/t20261105_7245798.htm"));assertEquals(LocalDate.of(2026,11,5),r.date());assertEquals(2,r.quotes().size());assertEquals("闽海峡蔬菜",r.quotes().get(0).market());assertEquals("元/公斤",r.quotes().get(0).originalUnit());assertEquals(0,r.quotes().get(0).priceKg().compareTo(new BigDecimal("3.62")));}
 @Test void discoversFujianLatestReportFromPathDate(){String a="<a href='./202610/t20261029_7243248.htm'>2026年10月第5周蔬菜批发市场主要品种价格</a>";String b="<a href='./202611/t20261105_7245798.htm'>2026年11月第1周蔬菜批发市场主要品种价格</a>";assertTrue(OfficialMarketPriceService.discoverFujian(a+b).endsWith("t20261105_7245798.htm"));}
 @Test void normalizesLegacyOfficialFujianHost(){assertEquals("https://nynct.fj.gov.cn/xxgk/tjxx/tjsj/scpfscjg/202611/t20261109_7246305.htm",OfficialMarketPriceService.discoverFujian("<a href='http://nynct.fujian.gov.cn/xxgk/tjxx/tjsj/scpfscjg/202611/t20261109_7246305.htm'>2026年11月第1周蔬菜批发市场主要品种价格</a>"));}
 @Test void refusesLookalikeHostAndCredentials(){for(String prefix:new String[]{"https://nynct.fujian.gov.cn.invalid.example", "https://user@nynct.fujian.gov.cn", "https://nynct.fujian.gov.cn:8443"})assertThrows(IllegalStateException.class,()->OfficialMarketPriceService.discoverFujian("<a href='"+prefix+"/xxgk/tjxx/tjsj/scpfscjg/202611/t20261109_7246305.htm'>2026年11月第1周蔬菜批发市场主要品种价格</a>"));}
 @Test void refusesForeignFujianLinks(){assertThrows(IllegalStateException.class,()->OfficialMarketPriceService.discoverFujian("<a href='https://invalid.example/report'>2026年11月第1周蔬菜批发市场主要品种价格</a>"));}
}
