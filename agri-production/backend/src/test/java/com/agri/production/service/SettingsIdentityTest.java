package com.agri.production.service;

import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.MediaType;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.junit.jupiter.api.Assertions.*;

class SettingsIdentityTest {
    MockRestServiceServer server;
    MockHttpServletRequest request;
    @BeforeEach void setup() {
        TenantContextService service = new TenantContextService("http://platform.test");
        RestTemplate rest = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        server = MockRestServiceServer.bindTo(rest).build();
        request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer test-token");
        request.addHeader("X-Merchant-Id", "2001");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
    @AfterEach void cleanup() { RequestContextHolder.resetRequestAttributes(); }
    void binding() {
        server.expect(requestTo("http://platform.test/api/v1/platform/merchants/mine"))
            .andExpect(header("Authorization", "Bearer test-token"))
            .andRespond(withSuccess("{\"code\":0,\"data\":[{\"merchantId\":\"2001\",\"userId\":\"17\",\"merchantName\":\"主体名称\",\"creditCode\":\"91350627611515046B\"}]}", MediaType.APPLICATION_JSON));
    }
    @Test void tenantProfileUsesOwnedBinding() {
        binding();
        var profile=TenantContextService.currentTenantProfile();
        assertEquals("2001",profile.get("tenantCode"));
        assertEquals("主体名称",profile.get("tenantName"));
        assertEquals("91350627611515046B",profile.get("creditCode"));
        server.verify();
    }
    @Test void rejectsOtherTenant() {
        binding(); request.removeHeader("X-Merchant-Id"); request.addHeader("X-Merchant-Id","999");
        assertThrows(RuntimeException.class,TenantContextService::currentTenantProfile); server.verify();
    }
    @Test void operatorUsesAuthenticatedProfile() {
        binding();
        server.expect(requestTo("http://platform.test/api/v1/auth/me"))
            .andRespond(withSuccess("{\"data\":{\"id\":\"17\",\"username\":\"farmer\",\"nickname\":\"张农户\"}}",MediaType.APPLICATION_JSON));
        assertEquals("张农户 · farmer · 用户 ID：17",TenantContextService.currentOperator()); server.verify();
    }
    @Test void profileFailureKeepsUserId() {
        binding(); server.expect(requestTo("http://platform.test/api/v1/auth/me")).andRespond(withServerError());
        assertEquals("用户 ID：17",TenantContextService.currentOperator()); server.verify();
    }
    @Test void mismatchedProfileCannotReplaceActor() {
        binding(); server.expect(requestTo("http://platform.test/api/v1/auth/me"))
            .andRespond(withSuccess("{\"data\":{\"id\":\"99\",\"nickname\":\"其他人\"}}",MediaType.APPLICATION_JSON));
        assertEquals("用户 ID：17",TenantContextService.currentOperator()); server.verify();
    }
}
