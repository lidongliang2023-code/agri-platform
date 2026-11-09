package com.agri.production.service;

import com.agri.production.integration.TradeCategoryClient;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.P2tVarietyMap;
import com.agri.production.mapper.*;
import org.junit.jupiter.api.*;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class P2tCategoryValidationTest {
    TradeCategoryClient client;
    MockRestServiceServer server;
    @BeforeEach void setup() {
        client = new TradeCategoryClient(new RestTemplateBuilder(), "http://trade");
        RestTemplate rest = (RestTemplate) ReflectionTestUtils.getField(client, "rest");
        server = MockRestServiceServer.bindTo(rest).build();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer test-platform-token");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
    @AfterEach void cleanup() { RequestContextHolder.resetRequestAttributes(); server.verify(); }
    void respond(String rows) {
        server.expect(requestTo("http://trade/api/trade/product/category/list"))
            .andExpect(header("Authorization", "Bearer test-platform-token"))
            .andRespond(withSuccess("{\"code\":200,\"data\":" + rows + "}", MediaType.APPLICATION_JSON));
    }
    String row(int status, int deleted) {
        return "{\"categoryCode\":\"vegetable\",\"categoryName\":\"蔬菜\",\"status\":"+status+",\"delFlag\":"+deleted+"}";
    }
    @Test void enabledCategoryUsesCanonicalNameAndTrimsCode() {
        respond("["+row(1,0)+"]");
        assertEquals(new TradeCategoryClient.Category("vegetable", "蔬菜"), client.requireEnabled(" vegetable "));
    }
    @Test void unknownCodeRejected() { respond("[]"); assertThrows(BusinessException.class, () -> client.requireEnabled("fake")); }
    @Test void disabledRejected() { respond("["+row(0,0)+"]"); assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable")); }
    @Test void deletedRejected() { respond("["+row(1,1)+"]"); assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable")); }
    @Test void duplicateRejected() { respond("["+row(1,0)+","+row(1,0)+"]"); assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable")); }
    @Test void unavailableRejected() {
        server.expect(requestTo("http://trade/api/trade/product/category/list")).andRespond(withServerError());
        assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable"));
    }
    @Test void malformedResponseRejected() { respond("{}"); assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable")); }
    @Test void missingCredentialRejectedBeforeHttp() { RequestContextHolder.resetRequestAttributes(); assertThrows(BusinessException.class, () -> client.requireEnabled("vegetable")); }
    P2tService service(P2tVarietyMapMapper mapper, TradeCategoryClient dict) {
        P2tService service = new P2tService(mapper, mock(P2tOfferMapper.class), mock(P2tSubscriptionMapper.class),
            mock(P2tDiffTicketMapper.class), mock(HarvestBatchMapper.class), mock(InventoryMapper.class));
        ReflectionTestUtils.setField(service, "tradeCategoryClient", dict);
        return service;
    }
    P2tVarietyMap payload() {
        P2tVarietyMap row = new P2tVarietyMap(); row.setCropName("番茄"); row.setCategoryCode("vegetable"); row.setCategoryName("伪造名称"); return row;
    }
    @Test void saveOverwritesForgedName() {
        P2tVarietyMapMapper mapper = mock(P2tVarietyMapMapper.class); TradeCategoryClient dict = mock(TradeCategoryClient.class);
        when(dict.requireEnabled("vegetable")).thenReturn(new TradeCategoryClient.Category("vegetable", "蔬菜"));
        P2tVarietyMap row = payload(); service(mapper, dict).saveVariety(row, "2001");
        assertEquals("蔬菜", row.getCategoryName()); verify(mapper).insert(row);
    }
    @Test void invalidCategoryNeverWrites() {
        P2tVarietyMapMapper mapper = mock(P2tVarietyMapMapper.class); TradeCategoryClient dict = mock(TradeCategoryClient.class);
        when(dict.requireEnabled(any())).thenThrow(new BusinessException(400, "无效品类"));
        assertThrows(BusinessException.class, () -> service(mapper, dict).saveVariety(payload(), "2001"));
        verify(mapper, never()).insert(any(P2tVarietyMap.class)); verify(mapper, never()).updateById(any(P2tVarietyMap.class));
    }
    @Test void crossSubjectEditRejectedBeforeDictionary() {
        P2tVarietyMapMapper mapper = mock(P2tVarietyMapMapper.class); TradeCategoryClient dict = mock(TradeCategoryClient.class);
        P2tVarietyMap row = payload(); row.setId(10L); P2tVarietyMap stored = payload(); stored.setTenantId("2002");
        when(mapper.selectById(10L)).thenReturn(stored);
        assertThrows(BusinessException.class, () -> service(mapper, dict).saveVariety(row, "2001")); verifyNoInteractions(dict);
    }
}
