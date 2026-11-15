package com.agri.trade.service;

import com.agri.trade.entity.*;
import com.agri.trade.controller.OrderController;
import com.agri.trade.mapper.*;
import com.agri.trade.common.security.*;
import com.agri.trade.config.MybatisPlusConfig;
import com.agri.trade.service.impl.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(classes=TradeAgentDatabaseTest.Config.class,properties={
 "spring.datasource.url=jdbc:mysql://localhost:3306/agri_trade?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true",
 "spring.datasource.username=${AGENT_DB_USER:root}","spring.datasource.password=${AGENT_DB_PASSWORD:root}","spring.sql.init.mode=never",
 "spring.cloud.openfeign.enabled=false","logging.level.com.agri.trade=ERROR","mybatis-plus.configuration.log-impl=org.apache.ibatis.logging.nologging.NoLoggingImpl"})
@Transactional
@EnabledIfEnvironmentVariable(named="AGENT_DB_IT", matches="true")
class TradeAgentDatabaseTest {
 @org.springframework.boot.test.context.TestConfiguration @EnableAutoConfiguration @MapperScan("com.agri.trade.mapper")
 @Import({TradeAgentService.class,TradeAgentSchema.class,InquiryServiceImpl.class,QuoteServiceImpl.class,MybatisPlusConfig.class,OrderController.class}) static class Config {}
 @Autowired TradeAgentService agent; @Autowired JdbcTemplate db; @Autowired DemandMapper demands; @Autowired TradeProductMapper products; @Autowired TradeOrderMapper orders;
 @MockBean PlatformIdentityService identity; @MockBean IContractService contractService; @MockBean P2tTradeService p2t; @Autowired OrderController orderController;
 Long buyer=99110001L,seller=99110002L; Demand d;TradeProduct p;
 @BeforeEach void seed(){
   var now=new Date();String code="AGENT-IT-"+UUID.randomUUID();
   d=new Demand();d.setDemandNo(code);d.setDemandName("Agent事务测试需求");d.setBuyerId(buyer);d.setBuyerName("测试采购方");d.setProductName("测试番茄");d.setCategoryId(999911L);d.setCategoryName("事务测试品类");d.setQuantity(new BigDecimal("10"));d.setUnit("kg");d.setDemandStatus("pending");d.setDeliveryAddress("隔离测试地址");d.setValidUntil(java.sql.Date.valueOf(LocalDate.now().plusDays(7)));d.setDelFlag(0);d.setCreateTime(now);d.setUpdateTime(now);demands.insert(d);
   p=new TradeProduct();p.setProductCode(code);p.setProductName("测试番茄");p.setSellerId(seller);p.setSellerName("测试供货方");p.setCategoryId(999911L);p.setCategoryName("事务测试品类");p.setStockQuantity(new BigDecimal("100"));p.setUnit("kg");p.setPrice(new BigDecimal("7"));p.setPriceMin(new BigDecimal("5"));p.setPriceMax(new BigDecimal("7"));p.setMinOrderQuantity(BigDecimal.ONE);p.setPublishStatus("published");p.setDelFlag(0);p.setCreateTime(now);p.setUpdateTime(now);products.insert(p);
 }
 @AfterEach void clear(){LoginUserHolder.removeLoginUser();}
 void as(Long id,Long merchant){LoginUser u=new LoginUser();u.setUserId(id);u.setUsername("agent-test");LoginUserHolder.setLoginUser(u);when(identity.currentScope()).thenReturn(new PlatformIdentityService.MerchantScope(true,List.of(merchant),List.of(),null));}
 Map<String,Object> request(String role,long ref,String target,String limit){var b=new HashMap<String,Object>();b.put("role",role);b.put("refId",ref);b.put("targetPrice",target);b.put("limitPrice",limit);b.put("quantity","50");b.put("freight","2.00");b.put("maxRounds",5);b.put("deliveryDate",LocalDate.now().plusDays(2).toString());return b;}
 String session(){as(99101L,buyer);agent.create(request("BUYER",d.getId(),"4","6"));as(99102L,seller);agent.create(request("SELLER",p.getId(),"7","5"));var rows=(List<Map<String,Object>>)agent.workspace("SELLER").get("sessions");return rows.stream().filter(x->((Number)x.get("demand_id")).longValue()==d.getId()).findFirst().orElseThrow().get("id").toString();}
 @Test void fullClosureUsesOriginalOrderQuoteContractAndIsIdempotent(){String id=session();var s=agent.detail(id);assertEquals("AWAITING_CONFIRMATION",s.get("status"));assertFalse(s.containsKey("buyer_mandate_id"));assertFalse(s.containsKey("seller_mandate_id"));
 as(99101L,buyer);var partial=agent.confirm(id,"BUYER",1);assertNull(partial.get("order_id"));
 as(99102L,seller);var done=agent.confirm(id,"SELLER",1);assertEquals("ORDERED",done.get("status"));long order=((Number)done.get("order_id")).longValue();assertEquals("agent",orders.selectById(order).getSource());assertEquals(0,new BigDecimal("90").compareTo(products.selectById(p.getId()).getStockQuantity()));
 assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM agri_trade_order_item WHERE order_id=?",Integer.class,order));assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM agri_trade_contract WHERE order_id=?",Integer.class,order));
 assertEquals(order,((Number)agent.confirm(id,"SELLER",1).get("order_id")).longValue());assertEquals(0,new BigDecimal("90").compareTo(products.selectById(p.getId()).getStockQuantity()));
 assertEquals(0,new BigDecimal("40").compareTo(db.queryForObject("SELECT quantity FROM agri_trade_agent_mandate WHERE role='SELLER' AND ref_id=? AND status='ACTIVE'",BigDecimal.class,p.getId())));
 }
 @Test void participantsAndSameAccountCannotConfirmBothSides(){String id=session();as(99103L,99110003L);assertThrows(IllegalArgumentException.class,()->agent.detail(id));as(99101L,buyer);assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"SELLER",1));agent.confirm(id,"BUYER",1);as(99101L,seller);assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"SELLER",1));}
 @Test void revokedMandateAndWrongRevisionCannotConvert(){String id=session();as(99101L,buyer);assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"BUYER",2));var mandates=(List<Map<String,Object>>)agent.workspace("BUYER").get("mandates");var m=mandates.stream().filter(x->((Number)x.get("ref_id")).longValue()==d.getId()).findFirst().orElseThrow();agent.revoke(m.get("id").toString());assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"BUYER",1));assertEquals(false,agent.detail(id).get("effective"));}
 @Test void disjointLimitsDoNotCreateOrderAndPrivateMandatesStayScoped(){as(99101L,buyer);var b=agent.create(request("BUYER",d.getId(),"2","3"));as(99102L,seller);agent.create(request("SELLER",p.getId(),"7","5"));var ws=agent.workspace("SELLER");var sessions=(List<Map<String,Object>>)ws.get("sessions");assertEquals("NO_AGREEMENT",sessions.get(0).get("status"));assertNull(sessions.get(0).get("agreed_price"));assertTrue(((List<Map<String,Object>>)ws.get("mandates")).stream().allMatch(x->seller.equals(((Number)x.get("merchant_id")).longValue())));assertThrows(IllegalArgumentException.class,()->agent.compare(b.get("id").toString()));}
 @Test void expiredAndRejectedProposalsAreBlocked(){String id=session();as(99101L,buyer);agent.reject(id,"交期不符合安排");assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"BUYER",1));assertEquals("REJECTED",agent.detail(id).get("status"));}
 @Test void otherOwnersAndAmbiguousUnitsCannotAutoNegotiate(){as(99101L,buyer);assertThrows(IllegalArgumentException.class,()->agent.create(request("SELLER",p.getId(),"7","5")));agent.create(request("BUYER",d.getId(),"4","6"));p.setUnit("斤");products.updateById(p);as(99102L,seller);agent.create(request("SELLER",p.getId(),"7","5"));assertTrue(((List<?>)agent.workspace("SELLER").get("sessions")).isEmpty());}
 @Test void changedBusinessTermsAndStockShortageBlockFinalConfirmation(){String id=session();as(99101L,buyer);agent.confirm(id,"BUYER",1);p.setStockQuantity(BigDecimal.ONE);products.updateById(p);as(99102L,seller);assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"SELLER",1));assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_trade_order WHERE demand_id=?",Integer.class,d.getId()));}

 @Test void cancelledAgentOrderRestoresInventoryOnlyOnce(){String id=session();as(99101L,buyer);agent.confirm(id,"BUYER",1);as(99102L,seller);long order=((Number)agent.confirm(id,"SELLER",1).get("order_id")).longValue();as(99101L,buyer);assertEquals(200,orderController.updateOrderStatus(order,Map.of("status","cancelled")).getCode());assertEquals(0,new BigDecimal("100").compareTo(products.selectById(p.getId()).getStockQuantity()));assertNotEquals(200,orderController.updateOrderStatus(order,Map.of("status","cancelled")).getCode());assertEquals(0,new BigDecimal("100").compareTo(products.selectById(p.getId()).getStockQuantity()));var detail=agent.detail(id);assertEquals("cancelled",((TradeOrder)detail.get("order")).getOrderStatus());}
 @Test void expiredProposalAndChangedTermsCannotConvert(){String id=session();as(99101L,buyer);db.update("UPDATE agri_trade_agent_session SET expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE id=?",id);assertEquals(false,agent.detail(id).get("effective"));assertThrows(IllegalArgumentException.class,()->agent.confirm(id,"BUYER",1));}
 @Test void comparisonUsesDeliveredTotalAndNeverReturnsPrivateLimits(){String id=session();as(99101L,buyer);var rows=(List<Map<String,Object>>)agent.workspace("BUYER").get("mandates");String mid=rows.stream().filter(x->((Number)x.get("ref_id")).longValue()==d.getId()).findFirst().orElseThrow().get("id").toString();var result=agent.compare(mid);assertEquals(1,result.size());assertFalse(result.get(0).containsKey("limit_price"));assertEquals(0,new BigDecimal("57.00").compareTo((BigDecimal)result.get(0).get("total_amount")));}
}
